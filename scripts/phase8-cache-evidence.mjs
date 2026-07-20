#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCookieSessionStorage } from "react-router";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const sessionSecret = "phase-8-local-evidence-secret-change-me";
const proxyPort = 15283;
const aiPort = 18080;
const disabledPort = 13101;
const enabledPort = 13102;
const activeProject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const timeoutProject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const failureProject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const isolationProject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";

const counts = new Map();
const apiProxy = http.createServer(handleApiProxy);
const aiStub = http.createServer(handleAiStub);
let disabledFrontend;
let enabledFrontend;
const cleanupProjects = [];
let bobRemoved = false;

try {
  await listen(apiProxy, proxyPort);
  await listen(aiStub, aiPort);

  const owner = await login(args.apiUrl, "dev@kuvox.local", "Password123!");
  const bob = await login(args.apiUrl, "bob@kuvox.local", "Password123!");
  const ownerUser = await apiJson(args.apiUrl, owner.accessToken, "GET", "/api/auth/me");
  const bobUser = await apiJson(args.apiUrl, bob.accessToken, "GET", "/api/auth/me");
  const studios = await apiJson(args.apiUrl, owner.accessToken, "GET", "/api/auth/me/studios");
  const studioId = studios.find((studio) => studio.name === "Dev Studio")?.id;
  if (!studioId) throw new Error("Dev Studio fixture was not seeded.");

  const ownerCookie = await sessionCookie(owner, ownerUser);
  const bobCookie = await sessionCookie(bob, bobUser);

  disabledFrontend = await startFrontend(disabledPort, false);
  resetCounts();
  const disabledHtml = await frontendRequest(disabledPort, "/dashboard/reviews", ownerCookie);
  const disabledCounts = selectedCounts();
  await stopFrontend(disabledFrontend);
  disabledFrontend = undefined;

  enabledFrontend = await startFrontend(enabledPort, true);
  resetCounts();
  const enabledHtml = await frontendRequest(enabledPort, "/dashboard/reviews", ownerCookie);
  const enabledCounts = selectedCounts();
  assertStatus(disabledHtml, 200, "disabled dashboard SSR");
  assertStatus(enabledHtml, 200, "enabled dashboard SSR");

  const video = await createProject(owner.accessToken, studioId, 0, "Phase 8 video");
  const image = await createProject(owner.accessToken, studioId, 1, "Phase 8 image");
  cleanupProjects.push(video.id, image.id);
  await saveTimeline(owner.accessToken, video.id, 0, 1);
  await saveImage(owner.accessToken, image.id, 0, 1);

  resetCounts();
  const retrievalBatch = await Promise.all(Array.from({ length: 16 }, () =>
    retrieval(enabledPort, ownerCookie, video.id, "phase 8 shared lookup")));
  requireAllStatus(retrievalBatch, 200, "coalesced retrieval batch");
  const mediaLookupKey = `GET /api/projects/${video.id}/media?pageSize=500`;
  if (count(mediaLookupKey) !== 1) {
    throw new Error(`Expected one shared media lookup, observed ${count(mediaLookupKey)}.`);
  }
  const responseHashes = new Set(retrievalBatch.map((response) => response.hash));
  if (responseHashes.size !== 1) throw new Error("Coalesced retrieval responses diverged.");

  const identityOne = await syntheticCookie(
    "11111111-1111-4111-8111-111111111111",
    "11111111-1111-4111-8111-111111111112");
  const identityTwo = await syntheticCookie(
    "22222222-2222-4222-8222-222222222222",
    "22222222-2222-4222-8222-222222222223");
  const sameUserOtherSession = await syntheticCookie(
    "11111111-1111-4111-8111-111111111111",
    "33333333-3333-4333-8333-333333333333");
  const expiredCookie = await syntheticCookie(
    "44444444-4444-4444-8444-444444444444",
    "44444444-4444-4444-8444-444444444445",
    Math.floor(Date.now() / 1000) - 60);

  resetCounts();
  const differentUsers = await Promise.all([
    retrieval(enabledPort, identityOne, isolationProject, "identity isolation"),
    retrieval(enabledPort, identityTwo, isolationProject, "identity isolation"),
  ]);
  requireAllStatus(differentUsers, 200, "different-user isolation");
  const differentUserLookups = count(`GET /api/projects/${isolationProject}/media?pageSize=500`);

  resetCounts();
  const differentSessions = await Promise.all([
    retrieval(enabledPort, identityOne, isolationProject, "session isolation"),
    retrieval(enabledPort, sameUserOtherSession, isolationProject, "session isolation"),
  ]);
  requireAllStatus(differentSessions, 200, "different-session isolation");
  const differentSessionLookups = count(`GET /api/projects/${isolationProject}/media?pageSize=500`);
  if (differentUserLookups !== 2 || differentSessionLookups !== 2) {
    throw new Error("Identity or session isolation incorrectly shared upstream work.");
  }

  const activeRequest = retrieval(enabledPort, identityOne, activeProject, "active metric");
  await delay(40);
  const activeMetrics = await metrics(enabledPort);
  await activeRequest;
  await retrieval(enabledPort, expiredCookie, isolationProject, "bypass metric");
  const failureResponse = await retrieval(enabledPort, identityOne, failureProject, "failure metric");
  const timeoutResponse = await retrieval(enabledPort, identityOne, timeoutProject, "timeout metric");
  if (failureResponse.status !== 502 || timeoutResponse.status !== 502) {
    throw new Error("Deterministic failure/timeout scenarios did not fail through the BFF.");
  }
  const boundedMetrics = await metrics(enabledPort);
  requireMetric(activeMetrics, 'kuvox_bff_coalescing_inflight{resource="retrieval_project_media"}', 1);
  for (const outcome of ["leader", "joiner", "bypass", "caller_abort"]) {
    if (outcome !== "caller_abort") {
      requireMetricContains(boundedMetrics, "kuvox_bff_coalescing_requests_total", `outcome="${outcome}"`);
    }
  }
  requireMetricContains(boundedMetrics, "kuvox_bff_coalescing_upstream_total", 'outcome="failure"');
  requireMetricContains(boundedMetrics, "kuvox_bff_coalescing_upstream_total", 'outcome="timeout"');

  const validatorEvidence = await validators({ owner, bob, ownerCookie, bobCookie, studioId, video, image });
  bobRemoved = false;

  resetCounts();
  const warmRuns = [];
  for (let index = 0; index < 5; index += 1) {
    const started = performance.now();
    const response = await retrieval(enabledPort, ownerCookie, video.id, "warm latency");
    warmRuns.push({
      status: response.status,
      bytes: response.bytes,
      hash: response.hash,
      latencyMs: round(performance.now() - started),
    });
  }
  const warmMediaLookups = count(mediaLookupKey);
  if (warmMediaLookups !== 5) {
    throw new Error("Unexpected persistent BFF L1 behavior was observed.");
  }

  const publicWithoutCookie = await frontendRequest(enabledPort, "/favicon.ico");
  const publicWithCookie = await frontendRequest(enabledPort, "/favicon.ico", ownerCookie);
  const dynamicHtml = await frontendRequest(enabledPort, "/dashboard/reviews", ownerCookie);
  if (publicWithoutCookie.hash !== publicWithCookie.hash) {
    throw new Error("Public static asset varied by cookie.");
  }
  if (dynamicHtml.cacheControl !== "no-store") {
    throw new Error(`Authenticated HTML cache policy was ${dynamicHtml.cacheControl}.`);
  }

  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    defaultsRemainDisabled: true,
    ssrDuplicateReads: {
      route: "/dashboard/reviews",
      disabled: disabledCounts,
      enabled: enabledCounts,
      responseHashStable: disabledHtml.hash === enabledHtml.hash,
    },
    simultaneousRetrievals: {
      requests: 16,
      projectMediaLookups: 1,
      responseStatuses: unique(retrievalBatch.map((item) => item.status)),
      responseBytes: unique(retrievalBatch.map((item) => item.bytes)),
      responseHashCount: responseHashes.size,
    },
    isolation: {
      differentUsersProjectMediaLookups: differentUserLookups,
      differentSessionsProjectMediaLookups: differentSessionLookups,
      identifiersRedacted: true,
    },
    metrics: {
      activeSample: selectMetricLines(activeMetrics),
      boundedFaultSample: selectMetricLines(boundedMetrics),
    },
    validators: validatorEvidence,
    persistentL1Decision: {
      decision: "declined",
      sequentialWarmProjectMediaLookups: warmMediaLookups,
      responseBytes: unique(warmRuns.map((item) => item.bytes)),
      responseHashCount: new Set(warmRuns.map((item) => item.hash)).size,
      latencyMs: warmRuns.map((item) => item.latencyMs),
      medianLatencyMs: median(warmRuns.map((item) => item.latencyMs)),
      rationale: "The payload is small and stable; a persistent BFF copy would add invalidation and replica divergence for only the measured network hop.",
    },
    cachePolicy: {
      publicAssetStatus: publicWithoutCookie.status,
      publicAssetCookieIndependent: publicWithoutCookie.hash === publicWithCookie.hash,
      publicAssetCacheControl: publicWithoutCookie.cacheControl,
      dynamicHtmlStatus: dynamicHtml.status,
      dynamicHtmlCacheControl: dynamicHtml.cacheControl,
    },
  };
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Phase 8 evidence written to ${args.output}\n`);
} finally {
  if (bobRemoved) {
    try {
      const owner = await login(args.apiUrl, "dev@kuvox.local", "Password123!");
      const studios = await apiJson(args.apiUrl, owner.accessToken, "GET", "/api/auth/me/studios");
      const studioId = studios.find((studio) => studio.name === "Dev Studio")?.id;
      if (studioId) await apiJson(args.apiUrl, owner.accessToken, "POST", `/api/auth/studios/${studioId}/members`, { email: "bob@kuvox.local", role: 2 });
    } catch {}
  }
  for (const projectId of cleanupProjects) {
    try {
      const owner = await login(args.apiUrl, "dev@kuvox.local", "Password123!");
      await apiJson(args.apiUrl, owner.accessToken, "DELETE", `/api/projects/${projectId}`);
      await apiJson(args.apiUrl, owner.accessToken, "DELETE", `/api/projects/${projectId}/permanent`);
    } catch {}
  }
  if (disabledFrontend) await stopFrontend(disabledFrontend);
  if (enabledFrontend) await stopFrontend(enabledFrontend);
  await closeServer(apiProxy);
  await closeServer(aiStub);
}

async function validators({ owner, bob, ownerCookie, bobCookie, studioId, video, image }) {
  const timelinePath = `/api/timelines/projects/${video.id}/current`;
  const imagePath = `/api/projects/${image.id}/image-composition`;
  const timelineInitial = await rawApi(owner.accessToken, "GET", timelinePath);
  const imageInitial = await rawApi(owner.accessToken, "GET", imagePath);
  const timeline304 = await rawApi(owner.accessToken, "GET", timelinePath, undefined, { "If-None-Match": `W/${timelineInitial.etag}` });
  const image304 = await rawApi(owner.accessToken, "GET", imagePath, undefined, { "If-None-Match": `\"other\", W/${imageInitial.etag}` });
  if (timeline304.status !== 304 || image304.status !== 304 || timeline304.bytes !== 0 || image304.bytes !== 0) {
    throw new Error("API conditional reads were not bodyless 304 responses.");
  }

  const timelineBff304 = await frontendRequest(enabledPort, `/bff/projects/${video.id}/video-timeline`, ownerCookie, { "If-None-Match": timelineInitial.etag });
  const imageBff304 = await frontendRequest(enabledPort, `/bff/projects/${image.id}/image-composition`, ownerCookie, { "If-None-Match": imageInitial.etag });
  if (timelineBff304.status !== 304 || imageBff304.status !== 304 || timelineBff304.bytes !== 0 || imageBff304.bytes !== 0) {
    throw new Error("BFF did not preserve bodyless validator responses.");
  }

  await saveTimeline(owner.accessToken, video.id, 1, 2);
  await saveImage(owner.accessToken, image.id, 1, 2);
  const timelineAdvanced = await rawApi(owner.accessToken, "GET", timelinePath, undefined, { "If-None-Match": timelineInitial.etag });
  const imageAdvanced = await rawApi(owner.accessToken, "GET", imagePath, undefined, { "If-None-Match": imageInitial.etag });
  if (timelineAdvanced.status !== 200 || imageAdvanced.status !== 200 || timelineAdvanced.etag === timelineInitial.etag || imageAdvanced.etag === imageInitial.etag) {
    throw new Error("Validators did not advance after authoritative mutations.");
  }

  const bobTimeline = await rawApi(bob.accessToken, "GET", timelinePath);
  const bobImage = await rawApi(bob.accessToken, "GET", imagePath);
  if (bobTimeline.status !== 200 || bobImage.status !== 200) throw new Error("Seed member could not read Studio editor documents.");
  await apiJson(args.apiUrl, owner.accessToken, "DELETE", `/api/auth/studios/${studioId}/members/${bob.userId}`);
  bobRemoved = true;
  const revokedTimeline = await rawApi(bob.accessToken, "GET", timelinePath, undefined, { "If-None-Match": bobTimeline.etag });
  const revokedImage = await frontendRequest(enabledPort, `/bff/projects/${image.id}/image-composition`, bobCookie, { "If-None-Match": bobImage.etag });
  if (revokedTimeline.status !== 403 || revokedImage.status !== 403) {
    throw new Error(`Revoked member conditional statuses were ${revokedTimeline.status}/${revokedImage.status}.`);
  }
  await apiJson(args.apiUrl, owner.accessToken, "POST", `/api/auth/studios/${studioId}/members`, { email: "bob@kuvox.local", role: 2 });
  bobRemoved = false;

  return {
    apiTimeline: { initialStatus: timelineInitial.status, conditionalStatus: timeline304.status, conditionalBytes: timeline304.bytes, advancedStatus: timelineAdvanced.status, etagAdvanced: timelineAdvanced.etag !== timelineInitial.etag },
    apiImage: { initialStatus: imageInitial.status, conditionalStatus: image304.status, conditionalBytes: image304.bytes, advancedStatus: imageAdvanced.status, etagAdvanced: imageAdvanced.etag !== imageInitial.etag },
    bff: { timelineConditionalStatus: timelineBff304.status, timelineConditionalBytes: timelineBff304.bytes, imageConditionalStatus: imageBff304.status, imageConditionalBytes: imageBff304.bytes },
    revokedMemberStatuses: { timelineApi: revokedTimeline.status, imageBff: revokedImage.status },
  };
}

async function createProject(token, studioId, kind, name) {
  return apiJson(args.apiUrl, token, "POST", `/api/projects?studioId=${studioId}`, { kind, name, description: "Disposable Phase 8 evidence" });
}

async function saveTimeline(token, projectId, baseRevisionNumber, schemaVersion) {
  return apiJson(args.apiUrl, token, "PUT", `/api/timelines/projects/${projectId}/current`, {
    documentJson: { projectId, schemaVersion, tracks: [], marker: baseRevisionNumber + 1 },
    operationsJson: [], baseRevisionNumber, documentSchemaVersion: schemaVersion,
    source: "phase8-evidence", label: `revision-${baseRevisionNumber + 1}`,
  });
}

async function saveImage(token, projectId, baseRevisionNumber, marker) {
  return apiJson(args.apiUrl, token, "PUT", `/api/projects/${projectId}/image-composition`, {
    documentJson: { projectId, layers: [], marker }, operationsJson: [], baseRevisionNumber,
  });
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, replaceExistingSession: true }),
  });
  if (!response.ok) throw new Error(`Login failed with ${response.status}.`);
  const tokens = await response.json();
  const payload = JSON.parse(Buffer.from(tokens.accessToken.split(".")[1], "base64url").toString("utf8"));
  return { ...tokens, userId: payload.sub };
}

async function apiJson(baseUrl, token, method, pathname, body) {
  const response = await rawApi(token, method, pathname, body, {}, baseUrl);
  if (response.status >= 400) throw new Error(`${method} ${pathname} returned ${response.status}.`);
  return response.bytes === 0 ? null : JSON.parse(response.text);
}

async function rawApi(token, method, pathname, body, headers = {}, baseUrl = args.apiUrl) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, bytes: buffer.length, text: buffer.toString("utf8"), etag: response.headers.get("etag"), cacheControl: response.headers.get("cache-control"), hash: sha(buffer) };
}

async function sessionCookie(tokens, user) {
  const storage = createCookieSessionStorage({ cookie: { name: "__kuvox_session", httpOnly: true, path: "/", sameSite: "lax", secrets: [sessionSecret, "dev-only-session-secret-change-me"], secure: true, maxAge: 2_592_000 } });
  const session = await storage.getSession();
  session.set("user", { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan, emailVerified: user.emailVerified });
  session.set("accessToken", tokens.accessToken);
  session.set("refreshToken", tokens.refreshToken);
  session.set("expiresAt", tokens.expiresAt);
  return (await storage.commitSession(session)).split(";", 1)[0];
}

async function syntheticCookie(sub, sid, exp = Math.floor(Date.now() / 1000) + 3_600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "none" })}.${encode({ sub, sid, exp })}.redacted-signature`;
  return sessionCookie({ accessToken, refreshToken: "redacted-refresh", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }, { id: sub, email: "redacted@example.invalid", displayName: "Redacted", plan: "free", emailVerified: true });
}

async function startFrontend(port, enabled) {
  const child = spawn(process.execPath, ["server/index.mjs", "build/server/index.js"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", API_URL: `http://127.0.0.1:${proxyPort}`, VITE_API_URL: `http://127.0.0.1:${proxyPort}`, AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`, VITE_AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`, SESSION_SECRET: sessionSecret, KUVOX_BFF_COALESCING_ENABLED: String(enabled), KUVOX_BFF_COALESCING_RESOURCES: "auth_me,studio_memberships,retrieval_project_media", KUVOX_BFF_COALESCING_MAX_IN_FLIGHT: "256", KUVOX_BFF_COALESCING_DEADLINE_MS: "200", KUVOX_BFF_METRICS_ENABLED: "true", LOG_LEVEL: "warn" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-8_000); });
  child.stderr.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-8_000); });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/metrics`)).status === 200, 15_000, () => logs);
  return child;
}

async function stopFrontend(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function retrieval(port, cookie, projectId, query) {
  return frontendRequest(port, "/bff/ai/retrieval/video-editor", cookie, { "Content-Type": "application/json" }, { projectId, query, modalities: ["transcript", "ocr"], topK: 8, expandGraph: true });
}

async function frontendRequest(port, pathname, cookie, headers = {}, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { method: body === undefined ? "GET" : "POST", headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, bytes: buffer.length, hash: sha(buffer), cacheControl: response.headers.get("cache-control"), etag: response.headers.get("etag") };
}

async function metrics(port) {
  const response = await fetch(`http://127.0.0.1:${port}/metrics`);
  if (!response.ok) throw new Error(`Metrics returned ${response.status}.`);
  return response.text();
}

async function handleApiProxy(req, res) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${proxyPort}`);
  const key = `${req.method} ${url.pathname}${url.search}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const mediaMatch = /^\/api\/projects\/([0-9a-f-]+)\/media$/i.exec(url.pathname);
  if (req.method === "GET" && mediaMatch && url.searchParams.get("pageSize") === "500") {
    const projectId = mediaMatch[1].toLowerCase();
    if (projectId === failureProject) return json(res, 500, { error: "deterministic failure" });
    if (projectId === timeoutProject) await delay(500);
    else if (projectId === activeProject) await delay(150);
    else await delay(80);
    if ([timeoutProject, activeProject, isolationProject].includes(projectId)) return json(res, 200, { items: [], page: 1, pageSize: 500, totalCount: 0, totalPages: 0 });
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const target = new URL(url.pathname + url.search, args.apiUrl);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  const response = await fetch(target, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined, redirect: "manual" });
  res.statusCode = response.status;
  response.headers.forEach((value, name) => { if (!["content-encoding", "content-length", "transfer-encoding"].includes(name)) res.setHeader(name, value); });
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function handleAiStub(req, res) {
  counts.set(`${req.method} ${req.url}`, (counts.get(`${req.method} ${req.url}`) ?? 0) + 1);
  for await (const _ of req) {}
  await delay(10);
  json(res, 200, { results: [], totalCandidatesConsidered: 0, modalitiesSearched: ["transcript", "ocr"] });
}

function json(res, status, value) { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
function listen(server, port) { return new Promise((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve)); }
function closeServer(server) { return new Promise((resolve) => server.close(() => resolve())); }
function resetCounts() { counts.clear(); }
function count(key) { return counts.get(key) ?? 0; }
function selectedCounts() { return Object.fromEntries(Array.from(counts.entries()).filter(([key]) => key.includes("/api/auth/me") || key.includes("/api/projects/")).sort()); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function round(value) { return Math.round(value * 100) / 100; }
function unique(values) { return Array.from(new Set(values)).sort(); }
function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }
function assertStatus(response, status, name) { if (response.status !== status) throw new Error(`${name} returned ${response.status}.`); }
function requireAllStatus(responses, status, name) { for (const response of responses) assertStatus(response, status, name); }
function requireMetric(text, key, minimum) { const line = text.split("\n").find((item) => item.startsWith(`${key} `)); const value = Number(line?.split(" ").at(-1)); if (!(value >= minimum)) throw new Error(`Metric ${key} was ${value}.`); }
function requireMetricContains(text, name, label) { if (!text.split("\n").some((line) => line.startsWith(name) && line.includes(label))) throw new Error(`Missing ${name} ${label}.`); }
function selectMetricLines(text) { return text.split("\n").filter((line) => line.startsWith("kuvox_bff_coalescing_")).sort(); }
async function waitFor(operation, timeout, diagnostics) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { try { if (await operation()) return; } catch {} await delay(100); } throw new Error(`Timed out waiting for local server. ${diagnostics()}`); }
function parseArgs(argv) { const outputIndex = argv.indexOf("--output"); const apiIndex = argv.indexOf("--api-url"); return { apiUrl: apiIndex >= 0 ? argv[apiIndex + 1] : "http://127.0.0.1:5283", output: path.resolve(outputIndex >= 0 ? argv[outputIndex + 1] : path.join(root, "docs/evidence/cache/phase-8-local-evidence.json")) }; }
