import type {
  CachedPendingSyncRecord,
  CachedVideoTimelineDraftRecord,
  EditorCacheMissReason,
  EditorCacheResult,
} from "./editor-cache";
import type { VideoProjectDocument } from "./video-document";

export type EditorRecoveryKind =
  | "stale-auth"
  | "api-unavailable"
  | "cache-corrupt"
  | "media-fetch-failed"
  | "sync-failed"
  | "render-failed"
  | "unknown";

export interface EditorRecoveryClassification {
  kind: EditorRecoveryKind;
  status: number | null;
  retryable: boolean;
  userAction: "login" | "retry" | "continue-local" | "reload-server" | "none";
  message: string;
}

export type EditorRecoveryContext = "route" | "media" | "sync" | "render" | "cache" | "unknown";

export type DraftRecoveryState =
  | {
      state: "prompt";
      defaultAction: "continue-local-draft";
      secondaryAction: "reload-server-copy";
      pendingSyncCount: number;
      reason: "unsynced-draft" | "pending-sync";
      message: string;
    }
  | {
      state: "warning";
      kind: "cache-corrupt";
      cacheReason: EditorCacheMissReason;
      message: string;
    }
  | { state: "none" };

export function classifyEditorRecoveryError(
  error: unknown,
  context: EditorRecoveryContext = "unknown",
): EditorRecoveryClassification {
  const status = statusFromError(error);
  const message = messageFor(context, status, error);

  if (status === 401 || status === 403) {
    return {
      kind: "stale-auth",
      status,
      retryable: false,
      userAction: "login",
      message: "Your session needs attention before the editor can continue.",
    };
  }

  if (context === "cache" || isCacheCorruptMessage(error)) {
    return {
      kind: "cache-corrupt",
      status,
      retryable: false,
      userAction: "reload-server",
      message: "A local editor draft could not be read. The server copy is still available.",
    };
  }

  if (context === "media") {
    return {
      kind: "media-fetch-failed",
      status,
      retryable: true,
      userAction: "retry",
      message,
    };
  }

  if (context === "sync" || status === 409) {
    return {
      kind: "sync-failed",
      status,
      retryable: true,
      userAction: status === 409 ? "reload-server" : "retry",
      message: status === 409
        ? "The server timeline changed. Keep editing locally or reload the server copy."
        : message,
    };
  }

  if (context === "render") {
    return {
      kind: "render-failed",
      status,
      retryable: true,
      userAction: "retry",
      message,
    };
  }

  if (
    status === null ||
    status >= 500 ||
    status === 408 ||
    status === 429 ||
    /network|failed to fetch|timeout|timed out|backend|unavailable/i.test(safeErrorMessage(error))
  ) {
    return {
      kind: "api-unavailable",
      status,
      retryable: true,
      userAction: "retry",
      message: "The editor backend is not reachable right now. Local editing can continue where possible.",
    };
  }

  return {
    kind: "unknown",
    status,
    retryable: true,
    userAction: "retry",
    message,
  };
}

export function draftRecoveryState(input: {
  draft: EditorCacheResult<VideoProjectDocument>;
  draftRecord?: EditorCacheResult<CachedVideoTimelineDraftRecord>;
  pendingSync?: EditorCacheResult<CachedPendingSyncRecord[]>;
}): DraftRecoveryState {
  if (!input.draft.ok && isCorruptCacheReason(input.draft.reason)) {
    return {
      state: "warning",
      kind: "cache-corrupt",
      cacheReason: input.draft.reason,
      message: `Local video draft cache ${input.draft.reason}. Loaded the server copy instead.`,
    };
  }

  if (input.draftRecord && !input.draftRecord.ok && isCorruptCacheReason(input.draftRecord.reason)) {
    return {
      state: "warning",
      kind: "cache-corrupt",
      cacheReason: input.draftRecord.reason,
      message: `Local video draft metadata ${input.draftRecord.reason}. Loaded the server copy instead.`,
    };
  }

  if (!input.draft.ok) return { state: "none" };

  const pendingSyncCount = input.pendingSync?.ok ? input.pendingSync.value.length : 0;
  const hasUnsyncedChanges = input.draftRecord?.ok === true && input.draftRecord.value.hasUnsyncedChanges === true;
  if (!hasUnsyncedChanges && pendingSyncCount === 0) return { state: "none" };

  return {
    state: "prompt",
    defaultAction: "continue-local-draft",
    secondaryAction: "reload-server-copy",
    pendingSyncCount,
    reason: hasUnsyncedChanges ? "unsynced-draft" : "pending-sync",
    message: pendingSyncCount > 0
      ? `This browser has a local draft with ${pendingSyncCount} pending timeline sync record${pendingSyncCount === 1 ? "" : "s"}.`
      : "This browser has a local video draft that has not synced yet.",
  };
}

export function isCorruptCacheReason(reason: EditorCacheMissReason): boolean {
  return reason === "corrupt" || reason === "schema-mismatch";
}

function statusFromError(error: unknown): number | null {
  if (typeof Response !== "undefined" && error instanceof Response) return error.status;
  if (isRecord(error) && typeof error.status === "number") return error.status;
  if (isRecord(error) && typeof error.statusCode === "number") return error.statusCode;
  return null;
}

function messageFor(context: EditorRecoveryContext, status: number | null, error: unknown): string {
  if (context === "media") return "Media refresh failed. Cached media remains available when present.";
  if (context === "render") return "Render job creation failed. Editing and local drafts are unchanged.";
  if (context === "sync") return "Timeline sync failed. Local edits are saved in this browser.";
  if (status && status >= 500) return "The editor backend returned an error. Try again shortly.";
  return safeErrorMessage(error) || "The editor hit a recoverable error.";
}

function isCacheCorruptMessage(error: unknown): boolean {
  return /cache.*(corrupt|schema-mismatch)|schema-mismatch|corrupt/i.test(safeErrorMessage(error));
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.statusText === "string") return error.statusText;
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
