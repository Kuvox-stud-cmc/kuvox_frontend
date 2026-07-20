import { createHash } from "node:crypto";

const STATE_SYMBOL = Symbol.for("kuvox.bff.coalescing.v1");
const DEFAULT_RESOURCES = ["auth_me", "studio_memberships", "retrieval_project_media"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CoalescingDeadlineError extends Error {
  constructor(message = "Coalesced upstream request exceeded its deadline.") {
    super(message);
    this.name = "CoalescingDeadlineError";
  }
}

export function getCoalescingConfig(env = process.env) {
  return {
    enabled: booleanEnv(env.KUVOX_BFF_COALESCING_ENABLED, false),
    resources: new Set(stringListEnv(env.KUVOX_BFF_COALESCING_RESOURCES, DEFAULT_RESOURCES)),
    maxInFlight: positiveIntegerEnv(env.KUVOX_BFF_COALESCING_MAX_IN_FLIGHT, 256),
    deadlineMs: positiveIntegerEnv(env.KUVOX_BFF_COALESCING_DEADLINE_MS, 5_000),
  };
}

export function classifyCoalescingRequest(method, origin, path) {
  if (String(method).toUpperCase() !== "GET") {
    return null;
  }

  let url;
  try {
    url = canonicalUrl(origin, path);
  } catch {
    return null;
  }

  const pairs = Array.from(url.searchParams.entries());
  if (url.pathname === "/api/auth/me" && pairs.length === 0) {
    return "auth_me";
  }
  if (url.pathname === "/api/auth/me/studios" && pairs.length === 0) {
    return "studio_memberships";
  }
  if (
    /^\/api\/projects\/[0-9a-f-]+\/media$/i.test(url.pathname)
    && UUID_PATTERN.test(url.pathname.split("/")[3] ?? "")
    && pairs.length === 1
    && pairs[0][0] === "pageSize"
    && pairs[0][1] === "500"
  ) {
    return "retrieval_project_media";
  }
  return null;
}

export async function coalesceJsonRequest({
  resource,
  method = "GET",
  origin,
  path,
  token,
  signal,
  upstream,
  config = getCoalescingConfig(),
  now = Date.now,
}) {
  const state = sharedState();
  state.knownResources.add(resource);
  const classified = classifyCoalescingRequest(method, origin, path);
  const identity = jwtIdentity(token, now());

  if (
    !config.enabled
    || !config.resources.has(resource)
    || classified !== resource
    || identity === null
  ) {
    increment(state.requests, resource, "bypass");
    return independentJsonRequest(state, resource, upstream, signal);
  }

  const currentTime = now();
  const key = registryKey(resource, method, origin, path, identity);
  const existing = state.entries.get(key);
  if (existing) {
    if (existing.expiresAt > currentTime) {
      increment(state.requests, resource, "joiner");
      return awaitForCaller(existing.promise, signal, state, resource);
    }
    deleteOwnedEntry(state, key, existing);
    existing.controller.abort(new CoalescingDeadlineError());
    increment(state.requests, resource, "bypass");
    return independentJsonRequest(state, resource, upstream, signal);
  }

  removeExpiredEntries(state, currentTime);
  if (state.entries.size >= config.maxInFlight) {
    increment(state.requests, resource, "bypass");
    return independentJsonRequest(state, resource, upstream, signal);
  }

  increment(state.requests, resource, "leader");
  const controller = new AbortController();
  const entry = {
    resource,
    expiresAt: currentTime + config.deadlineMs,
    controller,
    promise: null,
  };
  entry.promise = sharedUpstreamRequest(state, resource, upstream, controller, config.deadlineMs);
  state.entries.set(key, entry);
  entry.promise.then(
    () => deleteOwnedEntry(state, key, entry),
    () => deleteOwnedEntry(state, key, entry),
  );
  void entry.promise.catch(() => {});
  return awaitForCaller(entry.promise, signal, state, resource);
}

export function renderCoalescingMetrics() {
  const state = sharedState();
  const lines = [
    "# HELP kuvox_bff_coalescing_requests_total BFF coalescing request decisions and caller cancellations.",
    "# TYPE kuvox_bff_coalescing_requests_total counter",
  ];
  appendCounter(lines, "kuvox_bff_coalescing_requests_total", state.requests);
  lines.push(
    "# HELP kuvox_bff_coalescing_upstream_total Upstream outcomes for coalesced and fail-open requests.",
    "# TYPE kuvox_bff_coalescing_upstream_total counter",
  );
  appendCounter(lines, "kuvox_bff_coalescing_upstream_total", state.upstream);
  lines.push(
    "# HELP kuvox_bff_coalescing_inflight Active process-local coalescing entries.",
    "# TYPE kuvox_bff_coalescing_inflight gauge",
  );
  for (const resource of Array.from(state.knownResources).sort()) {
    let count = 0;
    for (const entry of state.entries.values()) {
      if (entry.resource === resource) count += 1;
    }
    lines.push(`kuvox_bff_coalescing_inflight{resource="${escapeLabel(resource)}"} ${count}`);
  }
  return `${lines.join("\n")}\n`;
}

export function coalescingDebugSnapshot() {
  const state = sharedState();
  return {
    keys: Array.from(state.entries.keys()).sort(),
    metrics: renderCoalescingMetrics(),
  };
}

export function resetCoalescingStateForTests() {
  const state = sharedState();
  for (const entry of state.entries.values()) {
    entry.controller.abort(new Error("Coalescing state reset."));
  }
  state.entries.clear();
  state.requests.clear();
  state.upstream.clear();
  state.knownResources.clear();
}

async function sharedUpstreamRequest(state, resource, upstream, controller, deadlineMs) {
  let timedOut = false;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      const error = new CoalescingDeadlineError();
      controller.abort(error);
      reject(error);
    }, deadlineMs);
    timer.unref?.();
  });

  try {
    const result = await Promise.race([
      Promise.resolve().then(() => upstream({ signal: controller.signal })),
      deadline,
    ]);
    increment(state.upstream, resource, "success");
    return result;
  } catch (error) {
    increment(state.upstream, resource, timedOut ? "timeout" : "failure");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function independentJsonRequest(state, resource, upstream, signal) {
  try {
    const result = await upstream({ signal });
    increment(state.upstream, resource, "success");
    return cloneJson(result);
  } catch (error) {
    if (signal?.aborted) {
      increment(state.requests, resource, "caller_abort");
    }
    increment(state.upstream, resource, "failure");
    throw error;
  }
}

async function awaitForCaller(promise, signal, state, resource) {
  if (signal?.aborted) {
    increment(state.requests, resource, "caller_abort");
    throw abortError(signal.reason);
  }
  if (!signal) {
    return cloneJson(await promise);
  }

  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => {
      increment(state.requests, resource, "caller_abort");
      reject(abortError(signal.reason));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return cloneJson(await Promise.race([promise, aborted]));
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function removeExpiredEntries(state, now) {
  for (const [key, entry] of state.entries) {
    if (entry.expiresAt <= now) {
      state.entries.delete(key);
      entry.controller.abort(new CoalescingDeadlineError());
    }
  }
}

function deleteOwnedEntry(state, key, entry) {
  if (state.entries.get(key) === entry) {
    state.entries.delete(key);
  }
}

function registryKey(resource, method, origin, path, identity) {
  const url = canonicalUrl(origin, path);
  const raw = [
    "kuvox-bff-coalescing-key-v1",
    resource,
    String(method).toUpperCase(),
    url.origin,
    url.pathname,
    url.search,
    identity.sub,
    identity.sid,
  ].join("\n");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function canonicalUrl(origin, path) {
  const url = new URL(path, origin);
  const pairs = Array.from(url.searchParams.entries());
  pairs.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    lexicalCompare(leftKey, rightKey) || lexicalCompare(leftValue, rightValue));
  url.search = "";
  for (const [key, value] of pairs) {
    url.searchParams.append(key, value);
  }
  url.hash = "";
  return url;
}

function jwtIdentity(token, nowMs) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!UUID_PATTERN.test(payload?.sub ?? "") || !UUID_PATTERN.test(payload?.sid ?? "")) {
      return null;
    }
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= nowMs / 1000) {
      return null;
    }
    return { sub: payload.sub.toLowerCase(), sid: payload.sid.toLowerCase() };
  } catch {
    return null;
  }
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeURIComponent(Array.from(atob(padded), (character) =>
    `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
}

function cloneJson(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function abortError(reason) {
  if (reason instanceof Error) return reason;
  const error = new Error("Caller aborted request.");
  error.name = "AbortError";
  return error;
}

function sharedState() {
  if (!globalThis[STATE_SYMBOL]) {
    globalThis[STATE_SYMBOL] = {
      entries: new Map(),
      requests: new Map(),
      upstream: new Map(),
      knownResources: new Set(),
    };
  }
  return globalThis[STATE_SYMBOL];
}

function increment(map, resource, outcome) {
  const key = `${resource}\u0000${outcome}`;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function appendCounter(lines, name, values) {
  for (const [key, value] of Array.from(values.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    const [resource, outcome] = key.split("\u0000");
    lines.push(`${name}{resource="${escapeLabel(resource)}",outcome="${escapeLabel(outcome)}"} ${value}`);
  }
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function booleanEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function positiveIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stringListEnv(value, fallback) {
  if (value === undefined || value.trim() === "") return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
