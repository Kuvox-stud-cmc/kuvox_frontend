#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const METRIC_NAMES = new Set([
  "kuvox_retrieval_stage_calls_total",
  "kuvox_query_embedding_encoder_inputs_total",
  "kuvox_retrieval_cache_operations_total",
  "kuvox_redis_commands_total",
  "kuvox_single_flight_events_total",
]);

const options = parseArgs(process.argv.slice(2));
const fixture = JSON.parse(await readFile(options.fixture, "utf8"));
const cookie = await login(options);
const body = {
  projectId: fixture.project_id,
  query: "KUVOX CACHE BASELINE SECOND SCENE",
  modalities: ["transcript", "ocr"],
  topK: 10,
  expandGraph: true,
  mediaIds: [randomUUID()],
  scopeRevision: "0".repeat(64),
};

const cold = await concurrentMeasure(options, cookie, body);
const warm = await concurrentMeasure(options, cookie, body);
validate(cold, warm, options.concurrency);

const report = {
  capturedAt: new Date().toISOString(),
  concurrency: options.concurrency,
  fixture: {
    schemaVersion: fixture.schema_version,
    searchRevision: fixture.search_revision,
  },
  browserScopeFieldsSupplied: true,
  cold,
  warm,
};
await mkdir(dirname(options.output), { recursive: true });
await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`BFF retrieval evidence written to ${options.output}`);

async function login(config) {
  const response = await fetch(`${config.bffUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: config.email,
      password: config.password,
      redirectTo: "/dashboard",
      replaceExistingSession: "true",
    }),
    redirect: "manual",
  });
  if (response.status !== 302) {
    throw new Error(`BFF login returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("BFF login did not return a session cookie.");
  }
  return setCookie.split(";", 1)[0];
}

async function concurrentMeasure(config, cookie, requestBody) {
  const before = await scrapeMetrics(config.aiUrl);
  const responses = await Promise.all(
    Array.from({ length: config.concurrency }, async () => {
      const response = await fetch(`${config.bffUrl}/bff/ai/retrieval/video-editor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      return { status: response.status, payload, hash: stableHash(payload) };
    }),
  );
  const after = await scrapeMetrics(config.aiUrl);
  const metricDeltas = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const delta = (after[key] ?? 0) - (before[key] ?? 0);
    if (delta !== 0) metricDeltas[key] = Number(delta.toFixed(6));
  }
  const resultCounts = responses.map(({ payload }) => payload?.result?.results?.length ?? 0);
  return {
    statuses: [...new Set(responses.map(({ status }) => status))].sort(),
    responseHashes: [...new Set(responses.map(({ hash }) => hash))].sort(),
    resultCounts: [...new Set(resultCounts)].sort((a, b) => a - b),
    metricDeltas,
  };
}

async function scrapeMetrics(aiUrl) {
  const response = await fetch(`${aiUrl}/metrics`);
  if (!response.ok) throw new Error(`AI metrics returned ${response.status}.`);
  const metrics = {};
  for (const line of (await response.text()).split("\n")) {
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([-+0-9.eE]+)$/.exec(line);
    if (!match || !METRIC_NAMES.has(match[1])) continue;
    metrics[`${match[1]}${match[2] ?? ""}`] = Number(match[3]);
  }
  return metrics;
}

function validate(cold, warm, concurrency) {
  if (JSON.stringify(cold.statuses) !== "[200]" || JSON.stringify(warm.statuses) !== "[200]") {
    throw new Error("One or more BFF retrieval requests failed.");
  }
  if (cold.responseHashes.length !== 1 || cold.responseHashes[0] !== warm.responseHashes[0]) {
    throw new Error("Cold/warm BFF retrieval response hashes differ.");
  }
  if (cold.resultCounts.length !== 1 || cold.resultCounts[0] <= 0) {
    throw new Error("Cold BFF retrieval returned no evidence-bearing results.");
  }
  requireTotal(cold, "kuvox_retrieval_stage_calls_total", { stage: "qdrant_search", outcome: "success" }, 2);
  requireTotal(
    cold,
    "kuvox_retrieval_stage_calls_total",
    { stage: "kuzu_neighbors", outcome: "success" },
    cold.resultCounts[0],
  );
  requireTotal(cold, "kuvox_query_embedding_encoder_inputs_total", { outcome: "miss" }, 1);
  const leaders = total(cold, "kuvox_single_flight_events_total", {
    service: "ai",
    component: "retrieval",
    outcome: "leader",
  });
  if (leaders < 1) throw new Error("Cold BFF retrieval did not elect a cache leader.");
  requireTotal(cold, "kuvox_retrieval_cache_operations_total", { outcome: "write" }, 1);
  const coldHits = total(cold, "kuvox_retrieval_cache_operations_total", { outcome: "hit" });
  if (coldHits !== concurrency - 1) {
    throw new Error(`Expected ${concurrency - 1} cold follower cache hits, observed ${coldHits}.`);
  }
  requireTotal(warm, "kuvox_retrieval_cache_operations_total", { outcome: "hit" }, concurrency);
  requireTotal(warm, "kuvox_retrieval_stage_calls_total", { stage: "qdrant_search" }, 0);
  requireTotal(warm, "kuvox_retrieval_stage_calls_total", { stage: "kuzu_neighbors" }, 0);
  requireTotal(warm, "kuvox_query_embedding_encoder_inputs_total", {}, 0);
  const warmLockCommands = ["set_nx_px", "exists", "eval_release"].reduce(
    (sum, command) => sum + total(warm, "kuvox_redis_commands_total", { service: "ai", command }),
    0,
  );
  if (warmLockCommands !== 0) {
    throw new Error(`Warm BFF retrieval hits issued ${warmLockCommands} lock commands.`);
  }
}

function requireTotal(result, name, labels, expected) {
  const observed = total(result, name, labels);
  if (observed !== expected) {
    throw new Error(`${name} ${JSON.stringify(labels)} observed ${observed}, expected ${expected}.`);
  }
}

function total(result, name, labels) {
  return Object.entries(result.metricDeltas)
    .filter(([key]) => key.startsWith(name))
    .filter(([key]) => Object.entries(labels).every(([label, value]) => key.includes(`${label}="${value}"`)))
    .reduce((sum, [, value]) => sum + value, 0);
}

function stableHash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseArgs(args) {
  const values = {
    fixture: "/tmp/kuvox-cache-fixture.json",
    bffUrl: "http://127.0.0.1:3001",
    aiUrl: "http://127.0.0.1:8001",
    email: "dev@kuvox.local",
    password: "Password123!",
    concurrency: 16,
    output: "docs/evidence/cache/bff-retrieval-singleflight-local.json",
  };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!(key in values) || args[index + 1] === undefined) throw new Error(`Unknown or incomplete option: ${args[index]}`);
    values[key] = key === "concurrency" ? Number(args[index + 1]) : args[index + 1];
  }
  return values;
}
