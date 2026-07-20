import {
  VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
  type VideoProjectDocument,
  validateVideoProjectDocument,
} from "./video-document";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";

export interface VideoTimelineSyncOperationEntry {
  id: string;
  type: string;
  label: string;
  source: string;
  createdAt: string;
  revision?: number;
  operationIds?: string[];
}

export interface SaveVideoTimelineRequest {
  documentJson: VideoProjectDocument;
  operationsJson: VideoTimelineSyncOperationEntry[];
  baseRevisionNumber: number;
  documentSchemaVersion: number;
  source?: string;
  label?: string;
}

export interface ServerVideoTimeline {
  projectId: string;
  timelineId: string;
  revisionId: string | null;
  document: VideoProjectDocument;
  revisionNumber: number;
  documentSchemaVersion: number;
  source: string | null;
  label: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export type VideoTimelineLoadResult =
  | { status: "found"; timeline: ServerVideoTimeline }
  | { status: "not-found" }
  | { status: "unavailable"; message: string };

export async function getVideoTimelineFromBff(
  projectId: string,
  options: { correlationId?: string } = {},
): Promise<VideoTimelineLoadResult> {
  const correlationId = options.correlationId ?? createEditorCorrelationId("timeline-load");
  try {
    const response = await fetch(videoTimelineUrl(projectId), {
      headers: withEditorCorrelationHeaders({ Accept: "application/json" }, correlationId),
    });
    if (response.status === 404) {
      logVideoEditorEvent("editor.cache.miss", { projectId, correlationId, source: "server-timeline" }, "warn");
      return { status: "not-found" };
    }
    if (!response.ok) {
      return {
        status: "unavailable",
        message: await readVideoTimelineError(response, "Server timeline could not be loaded."),
      };
    }
    return { status: "found", timeline: normalizeVideoTimelinePayload(await response.json()) };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Server timeline could not be loaded.",
    };
  }
}

export async function saveVideoTimelineToBff(
  projectId: string,
  request: SaveVideoTimelineRequest,
  fallback = "Video timeline sync failed.",
  options: { correlationId?: string; pendingCount?: number; timelineId?: string | null } = {},
) {
  const correlationId = options.correlationId ?? createEditorCorrelationId("timeline-sync");
  logVideoEditorEvent("editor.sync.start", {
    projectId,
    correlationId,
    pendingCount: options.pendingCount,
    baseRevisionNumber: request.baseRevisionNumber,
    timelineId: options.timelineId,
    operationCount: request.operationsJson.length,
    operationIds: request.operationsJson.flatMap((entry) => entry.operationIds ?? [entry.id]),
    operationBatchId: request.operationsJson.at(-1)?.id,
  });
  const response = await fetch(videoTimelineUrl(projectId), {
    method: "PUT",
    headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
    body: JSON.stringify(request),
  });

  if (response.status === 409) {
    logVideoEditorEvent("editor.sync.conflict", {
      projectId,
      correlationId,
      pendingCount: options.pendingCount,
      baseRevisionNumber: request.baseRevisionNumber,
      operationCount: request.operationsJson.length,
      operationIds: request.operationsJson.flatMap((entry) => entry.operationIds ?? [entry.id]),
    }, "warn");
    return {
      ok: false as const,
      conflict: true as const,
      message: await readVideoTimelineError(response, "The server has a newer version."),
    };
  }

  if (!response.ok) {
    logVideoEditorEvent("editor.sync.failure", {
      projectId,
      correlationId,
      status: response.status,
      pendingCount: options.pendingCount,
      baseRevisionNumber: request.baseRevisionNumber,
      operationCount: request.operationsJson.length,
    }, "error");
    throw new Error(await readVideoTimelineError(response, fallback));
  }

  const timeline = normalizeVideoTimelinePayload(await response.json());
  logVideoEditorEvent("editor.sync.success", {
    projectId,
    correlationId,
    timelineId: timeline.timelineId,
    revisionId: timeline.revisionId,
    revisionNumber: timeline.revisionNumber,
    pendingCount: options.pendingCount,
    operationCount: request.operationsJson.length,
    operationIds: request.operationsJson.flatMap((entry) => entry.operationIds ?? [entry.id]),
  });
  return {
    ok: true as const,
    conflict: false as const,
    timeline,
  };
}

export function normalizeVideoTimelinePayload(value: unknown): ServerVideoTimeline {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const validation = validateVideoProjectDocument(body.documentJson);
  if (!validation.ok) {
    throw new Error(`Server video timeline failed validation: ${validation.errors.join(" ")}`);
  }

  return {
    projectId: String(body.projectId ?? validation.document.projectId),
    timelineId: String(body.timelineId ?? ""),
    revisionId: typeof body.revisionId === "string" ? body.revisionId : null,
    document: validation.document,
    revisionNumber: Number(body.revisionNumber) || 0,
    documentSchemaVersion: Number(body.documentSchemaVersion) || validation.document.schemaVersion,
    source: typeof body.source === "string" ? body.source : null,
    label: typeof body.label === "string" ? body.label : null,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
    updatedByUserId: typeof body.updatedByUserId === "string" ? body.updatedByUserId : null,
  };
}

export function createSaveVideoTimelineRequest(input: {
  document: VideoProjectDocument;
  operations: VideoTimelineSyncOperationEntry[];
  baseRevisionNumber: number;
  source?: string;
  label?: string;
}): SaveVideoTimelineRequest {
  return {
    documentJson: input.document,
    operationsJson: input.operations,
    baseRevisionNumber: input.baseRevisionNumber,
    documentSchemaVersion: VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
    source: input.source,
    label: input.label,
  };
}

export async function readVideoTimelineError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return nestedErrorMessage(body) ?? fallback;
  } catch {
    return fallback;
  }
}

function nestedErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return nestedErrorMessage(record.detail)
    ?? nestedErrorMessage(record.message)
    ?? nestedErrorMessage(record.error)
    ?? nestedErrorMessage(record.title);
}

function videoTimelineUrl(projectId: string) {
  return `/bff/projects/${encodeURIComponent(projectId)}/video-timeline`;
}
