// scripts/video-observability.assertions.ts
import assert from "node:assert/strict";

// app/lib/editor/editor-observability.client.ts
var requestIdHeaderName = "x-request-id";
var editorCorrelationHeaderName = "x-kuvox-editor-correlation-id";
var redacted = "[redacted]";
var sensitiveKeys = /* @__PURE__ */ new Set([
  "authorization",
  "cookie",
  "setcookie",
  "jwt",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "session",
  "secret",
  "password",
  "credential",
  "storagekey",
  "canonicalstoragekey",
  "proxystoragekey",
  "thumbnailstoragekey",
  "filename",
  "filename",
  "objecturl",
  "url",
  "href",
  "src",
  "command",
  "prompt",
  "query",
  "searchquery",
  "text",
  "evidence",
  "documentjson",
  "document",
  "operationsjson"
]);
var mediaUrlPattern = /^(blob:|data:|https?:\/\/|\/bff\/media\/|\/api\/media\/)/i;
function createEditorCorrelationId(scope) {
  const safeScope = scope.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "editor";
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${safeScope}-${random}`;
}
function sanitizeVideoEditorLogFields(fields) {
  return sanitizeValue(fields, []);
}
function withEditorCorrelationHeaders(headers = {}, correlationId) {
  const next = new Headers(headers);
  if (!next.has(requestIdHeaderName)) {
    next.set(requestIdHeaderName, createEditorCorrelationId("request"));
  }
  if (correlationId && !next.has(editorCorrelationHeaderName)) {
    next.set(editorCorrelationHeaderName, correlationId);
  }
  return next;
}
function sanitizeValue(value, path) {
  const key = path.at(-1) ?? "";
  if (isSensitiveLogKey(key)) {
    return redacted;
  }
  if (typeof value === "string") {
    if (mediaUrlPattern.test(value) || looksLikeToken(value)) return redacted;
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === void 0) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item, index) => sanitizeValue(item, [...path, String(index)]));
  }
  if (typeof value === "object") {
    const record = value;
    return Object.fromEntries(
      Object.entries(record).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, [...path, entryKey])
      ])
    );
  }
  return String(value);
}
function isSensitiveLogKey(key) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (sensitiveKeys.has(normalized)) return true;
  if (normalized.endsWith("token") || normalized.endsWith("secret") || normalized.endsWith("storagekey")) return true;
  return normalized.endsWith("objecturl");
}
function looksLikeToken(value) {
  if (/^Bearer\s+/i.test(value)) return true;
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) return true;
  return value.length > 80 && /^[A-Za-z0-9._~+/=-]+$/.test(value);
}

// scripts/workspace-paths.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
var root = process.cwd();
var workspace = resolve(root, "..");
function resolveRepoPath(repo) {
  const candidates = [
    resolve(workspace, repo),
    resolve(root, repo)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
function readFrontendFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}
function readWorkspaceFile(repo, path) {
  const repoPath = resolveRepoPath(repo);
  if (!repoPath) {
    return null;
  }
  const filePath = resolve(repoPath, path);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf8");
}
function warnSkippedWorkspaceAssertion(label, repo) {
  console.warn(`[verify] skipped ${label}: ${repo} repository is not available in this checkout`);
}

// scripts/video-observability.assertions.ts
function main() {
  assertSanitizerRedactsSensitiveFields();
  assertCorrelationHeaders();
  assertFrontendMarkers();
  assertDevDiagnostics();
  assertBffCorrelation();
  assertApiCorrelationAndTimelineLogs();
  assertAiCorrelationAndSanitizedLogs();
}
function assertSanitizerRedactsSensitiveFields() {
  const sanitized = sanitizeVideoEditorLogFields({
    projectId: "project-1",
    commandId: "command-1",
    operationIds: ["op-1"],
    token: "secret",
    filename: "launch.mp4",
    objectUrl: "blob:http://localhost/123",
    query: "find the launch quote",
    documentJson: { tracks: [] },
    nested: {
      canonicalStorageKey: "media/project/raw.mp4",
      evidence: [{ text: "speaker says private text" }],
      href: "/bff/media/media-1/object/raw?v=secret"
    }
  });
  assert.equal(sanitized.projectId, "project-1");
  assert.equal(sanitized.commandId, "command-1");
  assert.deepEqual(sanitized.operationIds, ["op-1"]);
  assert.equal(sanitized.token, "[redacted]");
  assert.equal(sanitized.filename, "[redacted]");
  assert.equal(sanitized.objectUrl, "[redacted]");
  assert.equal(sanitized.query, "[redacted]");
  assert.equal(sanitized.documentJson, "[redacted]");
  assert.equal(sanitized.nested.canonicalStorageKey, "[redacted]");
  assert.equal(sanitized.nested.evidence, "[redacted]");
  assert.equal(sanitized.nested.href, "[redacted]");
}
function assertCorrelationHeaders() {
  const correlationId = createEditorCorrelationId("unit-test");
  assert.match(correlationId, /^unit-test-/);
  const headers = withEditorCorrelationHeaders({ Accept: "application/json" }, correlationId);
  assert.equal(headers.get("x-kuvox-editor-correlation-id"), correlationId);
  assert.ok(headers.get("x-request-id"));
}
function assertFrontendMarkers() {
  const files = [
    "app/components/editor/video-editor-workspace.tsx",
    "app/components/editor/use-video-autosave.ts",
    "app/components/editor/ai-assistant-panel.tsx",
    "app/components/editor/panels/preview-panel.tsx",
    "app/lib/editor/video-timeline-api.client.ts",
    "app/lib/editor/project-media-api.client.ts",
    "app/lib/editor/video-ai-service-planner.ts",
    "app/lib/editor/video-retrieval.ts",
    "app/lib/editor/video-export.ts",
    "app/lib/editor/video-performance.client.ts"
  ].map(readFrontendFile).join("\n");
  for (const marker of [
    "editor.load.start",
    "editor.load.success",
    "editor.load.failure",
    "editor.cache.miss",
    "editor.cache.corrupt",
    "editor.cache.unavailable",
    "editor.sync.start",
    "editor.sync.success",
    "editor.sync.conflict",
    "editor.sync.failure",
    "editor.ai.command.start",
    "editor.ai.command.fallback",
    "editor.ai.command.failure",
    "editor.ai.command.applied",
    "editor.ai.retrieval.start",
    "editor.ai.retrieval.success",
    "editor.ai.retrieval.failure",
    "editor.media.object.failure",
    "editor.render.request.start",
    "editor.render.request.success",
    "editor.render.request.failure",
    "editor.render.request.backend-unavailable",
    "editor.render.status.success",
    "editor.render.status.failure",
    "editor.render.status.backend-unavailable",
    "editor.performance.metrics"
  ]) {
    assert.ok(files.includes(marker), `missing frontend marker ${marker}`);
  }
  assert.ok(files.includes("withEditorCorrelationHeaders"), "editor fetches attach correlation headers");
}
function assertDevDiagnostics() {
  const helper = readFrontendFile("app/lib/editor/editor-observability.client.ts");
  assert.ok(helper.includes("__KUVOX_VIDEO_EDITOR_DIAGNOSTICS__"));
  assert.ok(helper.includes("import.meta.env?.DEV"));
  assert.ok(helper.includes("getRecentLogs"));
  assert.ok(helper.includes("clearRecentLogs"));
  assert.ok(helper.includes("exportSnapshot"));
  assert.ok(helper.includes("sanitizeVideoEditorLogFields"));
}
function assertBffCorrelation() {
  const proxy = readFrontendFile("server/proxy.mjs");
  assert.ok(proxy.includes("proxyCorrelation(req)"));
  assert.ok(proxy.includes('"x-request-id"'));
  assert.ok(proxy.includes('"x-kuvox-editor-correlation-id"'));
  assert.ok(proxy.includes('headers["x-request-id"] = correlation.requestId'));
  assert.ok(proxy.includes('headers["x-kuvox-editor-correlation-id"] = correlation.editorCorrelationId'));
  assert.ok(proxy.includes("responseHeaders(upstreamRes.headers, auth.setCookie, correlation)"));
  assert.ok(proxy.includes('event: "bff.proxy"'));
  assert.ok(proxy.includes('event: "bff.ai.retrieval"'));
  assert.ok(!proxy.includes("Authorization: `Bearer ${token}` },"));
}
function assertApiCorrelationAndTimelineLogs() {
  const program = readWorkspaceFile("kuvox_api", "Program.cs");
  const service = readWorkspaceFile("kuvox_api", "Modules/Timelines/Services/TimelineService.cs");
  if (!program || !service) {
    warnSkippedWorkspaceAssertion("API correlation and timeline logs", "kuvox_api");
    return;
  }
  assert.ok(program.includes('LogContext.PushProperty("RequestId"'));
  assert.ok(program.includes('LogContext.PushProperty("EditorCorrelationId"'));
  assert.ok(program.includes("x-request-id"));
  assert.ok(program.includes("x-kuvox-editor-correlation-id"));
  for (const marker of [
    "VideoTimelineGet",
    "VideoTimelineSaveConflict",
    "VideoTimelineSaveSuccess",
    "VideoTimelineRenderQueued",
    "VideoTimelineRenderConflict",
    "OperationIds",
    "OperationCount"
  ]) {
    assert.ok(service.includes(marker), `missing timeline log marker ${marker}`);
  }
  assert.ok(!service.includes("DocumentJson={DocumentJson}"));
}
function assertAiCorrelationAndSanitizedLogs() {
  const middleware = readWorkspaceFile("kuvox_ai_service", "src/kuvox_ai/api/middleware.py");
  const planningRoute = readWorkspaceFile("kuvox_ai_service", "src/kuvox_ai/api/routes/planning.py");
  const retrievalRoute = readWorkspaceFile("kuvox_ai_service", "src/kuvox_ai/api/routes/retrieval.py");
  const planningService = readWorkspaceFile("kuvox_ai_service", "src/kuvox_ai/modules/planning/service.py");
  const retrievalService = readWorkspaceFile("kuvox_ai_service", "src/kuvox_ai/modules/retrieval/service.py");
  if (!middleware || !planningRoute || !retrievalRoute || !planningService || !retrievalService) {
    warnSkippedWorkspaceAssertion("AI correlation and sanitized logs", "kuvox_ai_service");
    return;
  }
  assert.ok(middleware.includes("editor_correlation_id"));
  assert.ok(middleware.includes("x-kuvox-editor-correlation-id"));
  assert.ok(planningRoute.includes("planning.video_editor.route.start"));
  assert.ok(planningRoute.includes("planning.video_editor.route.success"));
  assert.ok(planningRoute.includes("action_count"));
  assert.ok(!planningRoute.includes('logger.info(\n        "planning.video_editor.route.start",\n        command='));
  assert.ok(retrievalRoute.includes("retrieval.video_editor.route.start"));
  assert.ok(retrievalRoute.includes("retrieval.video_editor.route.success"));
  assert.ok(retrievalRoute.includes("top_k"));
  assert.ok(retrievalRoute.includes("modalities"));
  assert.ok(!retrievalRoute.includes('logger.info(\n        "retrieval.video_editor.route.start",\n        query='));
  assert.ok(!planningService.includes("command=command"));
  assert.ok(!planningService.includes("command=request.command"));
  assert.ok(!retrievalService.includes("text=query.text"));
}
main();
