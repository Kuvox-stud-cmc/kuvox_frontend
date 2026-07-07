export type VideoEditorLogLevel = "debug" | "info" | "warn" | "error";

export type VideoEditorLogEventName =
  | "editor.load.start"
  | "editor.load.success"
  | "editor.load.failure"
  | "editor.cache.miss"
  | "editor.cache.corrupt"
  | "editor.cache.unavailable"
  | "editor.sync.start"
  | "editor.sync.success"
  | "editor.sync.conflict"
  | "editor.sync.failure"
  | "editor.ai.command.start"
  | "editor.ai.command.fallback"
  | "editor.ai.command.failure"
  | "editor.ai.command.applied"
  | "editor.ai.retrieval.start"
  | "editor.ai.retrieval.success"
  | "editor.ai.retrieval.failure"
  | "editor.media.object.failure"
  | "editor.render.request.start"
  | "editor.render.request.success"
  | "editor.render.request.failure"
  | "editor.render.request.backend-unavailable"
  | "editor.performance.metrics";

export type VideoEditorLogFields = Record<string, unknown>;

export interface VideoEditorDiagnosticsSnapshot {
  generatedAt: string;
  events: VideoEditorLogSnapshot[];
}

interface VideoEditorLogSnapshot {
  eventName: VideoEditorLogEventName;
  level: VideoEditorLogLevel;
  timestamp: string;
  fields: VideoEditorLogFields;
}

declare global {
  interface Window {
    __KUVOX_VIDEO_EDITOR_DIAGNOSTICS__?: {
      getRecentLogs(): VideoEditorLogSnapshot[];
      clearRecentLogs(): void;
      exportSnapshot(): VideoEditorDiagnosticsSnapshot;
    };
  }
}

const requestIdHeaderName = "x-request-id";
const editorCorrelationHeaderName = "x-kuvox-editor-correlation-id";
const diagnosticsLimit = 200;
const redacted = "[redacted]";

const sensitiveKeys = new Set([
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
  "operationsjson",
]);
const mediaUrlPattern = /^(blob:|data:|https?:\/\/|\/bff\/media\/|\/api\/media\/)/i;

const recentLogs: VideoEditorLogSnapshot[] = [];

export function createEditorCorrelationId(scope: string): string {
  const safeScope = scope.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "editor";
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${safeScope}-${random}`;
}

export function logVideoEditorEvent(
  eventName: VideoEditorLogEventName,
  fields: VideoEditorLogFields = {},
  level: VideoEditorLogLevel = "info",
): void {
  const snapshot: VideoEditorLogSnapshot = {
    eventName,
    level,
    timestamp: new Date().toISOString(),
    fields: sanitizeVideoEditorLogFields(fields),
  };

  if (isDevRuntime()) {
    recentLogs.push(snapshot);
    while (recentLogs.length > diagnosticsLimit) recentLogs.shift();
    installDiagnosticsGlobal();
  }

  const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : level === "debug" ? "debug" : "info";
  console[consoleMethod]("[kuvox-video-editor]", snapshot);
}

export function sanitizeVideoEditorLogFields(fields: VideoEditorLogFields): VideoEditorLogFields {
  return sanitizeValue(fields, []) as VideoEditorLogFields;
}

export function withEditorCorrelationHeaders(headers: HeadersInit = {}, correlationId?: string): Headers {
  const next = new Headers(headers);
  if (!next.has(requestIdHeaderName)) {
    next.set(requestIdHeaderName, createEditorCorrelationId("request"));
  }
  if (correlationId && !next.has(editorCorrelationHeaderName)) {
    next.set(editorCorrelationHeaderName, correlationId);
  }
  return next;
}

function sanitizeValue(value: unknown, path: string[]): unknown {
  const key = path.at(-1) ?? "";
  if (isSensitiveLogKey(key)) {
    return redacted;
  }

  if (typeof value === "string") {
    if (mediaUrlPattern.test(value) || looksLikeToken(value)) return redacted;
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item, index) => sanitizeValue(item, [...path, String(index)]));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, [...path, entryKey]),
      ]),
    );
  }

  return String(value);
}

function isSensitiveLogKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (sensitiveKeys.has(normalized)) return true;
  if (normalized.endsWith("token") || normalized.endsWith("secret") || normalized.endsWith("storagekey")) return true;
  return normalized.endsWith("objecturl");
}

function looksLikeToken(value: string): boolean {
  if (/^Bearer\s+/i.test(value)) return true;
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) return true;
  return value.length > 80 && /^[A-Za-z0-9._~+/=-]+$/.test(value);
}

function installDiagnosticsGlobal(): void {
  if (!isDevRuntime() || typeof window === "undefined" || window.__KUVOX_VIDEO_EDITOR_DIAGNOSTICS__) {
    return;
  }

  window.__KUVOX_VIDEO_EDITOR_DIAGNOSTICS__ = {
    getRecentLogs: () => recentLogs.map(cloneSnapshot),
    clearRecentLogs: () => {
      recentLogs.length = 0;
    },
    exportSnapshot: () => ({
      generatedAt: new Date().toISOString(),
      events: recentLogs.map(cloneSnapshot),
    }),
  };
}

function cloneSnapshot(snapshot: VideoEditorLogSnapshot): VideoEditorLogSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as VideoEditorLogSnapshot;
}

function isDevRuntime(): boolean {
  return Boolean(import.meta.env?.DEV);
}
