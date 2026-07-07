import { buildSplitOperation, roundTime } from "./editor-timeline";
import { buildAddTextItemOperation } from "./editor-text";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";
import {
  applyVideoOperationBatch,
  createVideoOperationBatch,
  type DeleteItemOperation,
  type MoveItemOperation,
  type TrimItemOperation,
  type UpdateAudioOperation,
  type UpdateSpeedOperation,
  type VideoOperation,
  type VideoOperationMetadata,
} from "./video-operations";
import {
  planMockVideoAiCommand,
  type PlanVideoAiCommandOptions,
  type VideoAiCommandContext,
  type VideoAiCommandPlan,
} from "./video-ai-command-planner";
import type { VideoMediaReference, VideoTimelineItem } from "./video-document";

type ServiceAction =
  | {
      type: "trimItem";
      itemId: string;
      timelineStart: number;
      duration: number;
      sourceIn?: number | null;
      sourceOut?: number | null;
    }
  | { type: "splitItem"; itemId: string; timelineTime: number }
  | { type: "deleteItems"; itemIds: string[] }
  | { type: "moveItem"; itemId: string; timelineStart: number; targetTrackId?: string | null }
  | { type: "addText"; text: string; timelineStart: number; trackId?: string | null }
  | { type: "updateAudio"; itemId: string; volume?: number | null; muted?: boolean | null }
  | { type: "updateSpeed"; itemId: string; speed: number };

interface VideoEditorPlanningResponse {
  ok: boolean;
  planId: string;
  commandId: string;
  actions: ServiceAction[];
  warnings: string[];
  explanation: string | null;
  confidence: number;
  unsupportedReason?: string | null;
}

const fallbackWarning = "AI service unavailable; used local command planning.";

export async function planVideoAiCommandWithService(
  context: VideoAiCommandContext,
  input: string,
  options: PlanVideoAiCommandOptions = {},
): Promise<VideoAiCommandPlan> {
  const commandId = options.commandId ?? createCommandId(options.now ?? new Date());
  const timestamp = timestampString(options.now ?? new Date());
  const correlationId = createEditorCorrelationId("ai-command");
  let response: VideoEditorPlanningResponse;

  try {
    response = await requestVideoEditorPlan(context, input, commandId, correlationId);
  } catch (error) {
    if (isServiceUnavailable(error)) {
      logVideoEditorEvent("editor.ai.command.fallback", {
        projectId: context.document.projectId,
        commandId,
        correlationId,
        reason: "service-unavailable",
      }, "warn");
      const fallback = planMockVideoAiCommand(context, input, { ...options, commandId, now: timestamp });
      return fallback.ok
        ? { ...fallback, warnings: [...fallback.warnings, fallbackWarning] }
        : { ...fallback, warnings: [...fallback.warnings, fallbackWarning] };
    }

    logVideoEditorEvent("editor.ai.command.failure", {
      projectId: context.document.projectId,
      commandId,
      correlationId,
      reason: error instanceof Error ? error.message : "AI planning failed.",
    }, "error");
    return failure(input, error instanceof Error ? error.message : "AI planning failed.");
  }

  if (!response.ok) {
    logVideoEditorEvent("editor.ai.command.failure", {
      projectId: context.document.projectId,
      commandId,
      planId: response.planId,
      correlationId,
      actionCount: response.actions.length,
      warningCount: response.warnings.length,
    }, "warn");
    return failure(
      input,
      response.unsupportedReason ?? response.explanation ?? "The AI planner could not handle that command.",
      response.warnings,
    );
  }

  const operations = mapServiceActionsToOperations(context, response.actions, commandId, timestamp);
  if (!operations.ok) {
    logVideoEditorEvent("editor.ai.command.failure", {
      projectId: context.document.projectId,
      commandId,
      planId: response.planId,
      correlationId,
      actionCount: response.actions.length,
      reason: operations.error,
    }, "error");
    return failure(input, operations.error, response.warnings);
  }

  const batch = createVideoOperationBatch({
    id: `ai-batch-${commandId}`,
    source: "ai",
    timestamp,
    label: `AI: ${response.explanation ?? input}`,
    commandId,
    forceCheckpoint: true,
    operations: operations.value,
  });
  const validation = applyVideoOperationBatch(context.document, batch);
  if (!validation.ok) {
    logVideoEditorEvent("editor.ai.command.failure", {
      projectId: context.document.projectId,
      commandId,
      planId: response.planId,
      operationBatchId: batch.id,
      correlationId,
      actionCount: response.actions.length,
      operationCount: operations.value.length,
      reason: "validation-failed",
    }, "error");
    return failure(
      input,
      validation.errors?.join(" ") ?? "The generated edit is not valid for this timeline.",
      [...response.warnings, ...validation.warnings],
    );
  }

  logVideoEditorEvent("editor.ai.command.applied", {
    projectId: context.document.projectId,
    commandId,
    planId: response.planId,
    operationBatchId: batch.id,
    correlationId,
    actionCount: response.actions.length,
    operationCount: operations.value.length,
    operationIds: operations.value.map((operation) => operation.id),
  });
  return {
    ok: true,
    commandId,
    prompt: input.trim(),
    label: response.explanation ?? "AI edit",
    summary: response.explanation ?? "Planned edit.",
    warnings: [...response.warnings, ...validation.warnings],
    batch,
  };
}

async function requestVideoEditorPlan(
  context: VideoAiCommandContext,
  command: string,
  commandId: string,
  correlationId: string,
): Promise<VideoEditorPlanningResponse> {
  let response: Response;
  try {
    logVideoEditorEvent("editor.ai.command.start", {
      projectId: context.document.projectId,
      commandId,
      correlationId,
      revisionNumber: context.document.history.revision,
      selectedItemCount: context.selection.selectedItemIds.length,
    });
    response = await fetch("/bff/ai/planning/video-editor", {
      method: "POST",
      headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
      body: JSON.stringify(buildPlanningRequest(context, command, commandId)),
    });
  } catch (error) {
    throw new VideoAiServiceUnavailableError(error instanceof Error ? error.message : "AI service unavailable.");
  }

  if (!response.ok) {
    const message = await readPlanningError(response);
    if ([502, 503, 504].includes(response.status)) {
      throw new VideoAiServiceUnavailableError(message);
    }
    throw new Error(message);
  }

  return normalizePlanningResponse(await response.json());
}

function buildPlanningRequest(context: VideoAiCommandContext, command: string, commandId: string) {
  const media = Object.values(context.mediaReferences).map(mediaReferenceSummary);
  return {
    projectId: context.document.projectId,
    commandId,
    command,
    playheadTime: context.playback.currentTime,
    selection: {
      selectedItemIds: context.selection.selectedItemIds,
      activeItemId: context.selection.activeItemId ?? null,
    },
    playback: {
      currentTime: context.playback.currentTime,
    },
    timeline: {
      projectId: context.document.projectId,
      revision: context.document.history.revision,
      frameRate: context.document.settings.frameRate,
      media,
      tracks: context.document.tracks.map((track) => ({
        id: track.id,
        kind: track.kind,
        label: track.label,
        locked: track.locked,
        hidden: track.hidden,
        muted: track.muted,
        items: track.items.map((item) => ({
          id: item.id,
          type: item.type,
          mediaId: "mediaId" in item ? item.mediaId : null,
          shotId: "shotId" in item ? item.shotId ?? null : null,
          timelineStart: item.timelineStart,
          duration: item.duration,
          sourceIn: "sourceIn" in item ? item.sourceIn : null,
          sourceOut: "sourceOut" in item ? item.sourceOut : null,
          speed: "speed" in item ? item.speed : null,
          text: item.type === "text" ? item.text : null,
        })),
      })),
    },
    availableMedia: media,
  };
}

function mapServiceActionsToOperations(
  context: VideoAiCommandContext,
  actions: ServiceAction[],
  commandId: string,
  timestamp: string,
): { ok: true; value: VideoOperation[] } | { ok: false; error: string } {
  const operations: VideoOperation[] = [];
  for (const [index, action] of actions.entries()) {
    const mapped = mapServiceActionToOperation(context, action, commandId, timestamp, index);
    if (!mapped.ok) return mapped;
    operations.push(mapped.value);
  }
  return { ok: true, value: operations };
}

function mapServiceActionToOperation(
  context: VideoAiCommandContext,
  action: ServiceAction,
  commandId: string,
  timestamp: string,
  index: number,
): { ok: true; value: VideoOperation } | { ok: false; error: string } {
  if (action.type === "trimItem") {
    const operation: TrimItemOperation = {
      ...metadata(`ai-trim-${action.itemId}-${index}`, `AI trim ${action.itemId}`, [action.itemId], commandId, timestamp),
      type: "trimItem",
      itemId: action.itemId,
      timelineStart: roundTime(action.timelineStart),
      duration: roundTime(action.duration),
      ...(action.sourceIn !== null && action.sourceIn !== undefined ? { sourceIn: roundTime(action.sourceIn) } : {}),
      ...(action.sourceOut !== null && action.sourceOut !== undefined ? { sourceOut: roundTime(action.sourceOut) } : {}),
    };
    return { ok: true, value: operation };
  }

  if (action.type === "splitItem") {
    const item = findTimelineItem(context, action.itemId);
    if (!item) return { ok: false, error: `AI planner referenced missing item ${action.itemId}.` };
    const operation = buildSplitOperation({
      item,
      playheadTime: action.timelineTime,
      frameRate: context.document.settings.frameRate,
      metadata: metadata(`ai-split-${action.itemId}-${index}`, `AI split ${action.itemId}`, [action.itemId], commandId, timestamp),
    });
    return operation
      ? { ok: true, value: operation }
      : { ok: false, error: `AI planner split for ${action.itemId} is outside the item range.` };
  }

  if (action.type === "deleteItems") {
    const operation: DeleteItemOperation = {
      ...metadata(`ai-delete-${index}`, "AI delete", action.itemIds, commandId, timestamp),
      type: "deleteItem",
      itemIds: action.itemIds,
    };
    return { ok: true, value: operation };
  }

  if (action.type === "moveItem") {
    const operation: MoveItemOperation = {
      ...metadata(`ai-move-${action.itemId}-${index}`, `AI move ${action.itemId}`, [action.itemId], commandId, timestamp),
      type: "moveItem",
      itemId: action.itemId,
      timelineStart: roundTime(action.timelineStart),
      ...(action.targetTrackId ? { targetTrackId: action.targetTrackId } : {}),
    };
    return { ok: true, value: operation };
  }

  if (action.type === "addText") {
    const build = buildAddTextItemOperation({
      document: context.document,
      now: timestamp,
      timelineStart: action.timelineStart,
      text: action.text,
      trackId: action.trackId ?? undefined,
      source: "ai",
      commandId,
    });
    if (!build.ok) return { ok: false, error: build.reason };
    return {
      ok: true,
      value: {
        ...build.operation,
        id: `ai-add-text-${commandId}-${index}`,
        label: "AI add text",
        forceCheckpoint: true,
      },
    };
  }

  if (action.type === "updateAudio") {
    const operation: UpdateAudioOperation = {
      ...metadata(`ai-audio-${action.itemId}-${index}`, `AI audio ${action.itemId}`, [action.itemId], commandId, timestamp),
      type: "updateAudio",
      itemId: action.itemId,
      ...(action.volume !== null && action.volume !== undefined ? { volume: roundTime(action.volume) } : {}),
      ...(action.muted !== null && action.muted !== undefined ? { muted: action.muted } : {}),
    };
    return { ok: true, value: operation };
  }

  const operation: UpdateSpeedOperation = {
    ...metadata(`ai-speed-${action.itemId}-${index}`, `AI speed ${action.itemId}`, [action.itemId], commandId, timestamp),
    type: "updateSpeed",
    itemId: action.itemId,
    speed: roundTime(action.speed),
  };
  return { ok: true, value: operation };
}

function metadata(
  id: string,
  label: string,
  affectedEntityIds: string[],
  commandId: string,
  timestamp: string,
): VideoOperationMetadata {
  return {
    id,
    source: "ai",
    timestamp,
    label,
    affectedEntityIds,
    commandId,
    forceCheckpoint: true,
  };
}

function findTimelineItem(context: VideoAiCommandContext, itemId: string): VideoTimelineItem | null {
  for (const track of context.document.tracks) {
    const item = track.items.find((candidate) => candidate.id === itemId);
    if (item) return item;
  }
  return null;
}

function mediaReferenceSummary(media: VideoMediaReference) {
  return {
    id: media.id,
    kind: media.kind,
    name: media.name,
    duration: media.duration ?? null,
  };
}

function normalizePlanningResponse(value: unknown): VideoEditorPlanningResponse {
  const body = isRecord(value) ? value : {};
  return {
    ok: body.ok === true,
    planId: String(body.planId ?? ""),
    commandId: String(body.commandId ?? ""),
    actions: Array.isArray(body.actions) ? body.actions.flatMap(normalizeAction) : [],
    warnings: Array.isArray(body.warnings) ? body.warnings.map(String) : [],
    explanation: typeof body.explanation === "string" ? body.explanation : null,
    confidence: numberOrDefault(body.confidence, 0),
    unsupportedReason: typeof body.unsupportedReason === "string" ? body.unsupportedReason : null,
  };
}

function normalizeAction(value: unknown): ServiceAction[] {
  if (!isRecord(value) || typeof value.type !== "string") return [];
  return [value as ServiceAction];
}

async function readPlanningError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return body.detail.map((item: unknown) => JSON.stringify(item)).join(" ");
  } catch {
    // Fall back to status text below.
  }
  return response.statusText || "AI planning failed.";
}

function failure(input: string, error: string, warnings: string[] = []): VideoAiCommandPlan {
  return {
    ok: false,
    prompt: input.trim(),
    error,
    warnings,
  };
}

function isServiceUnavailable(error: unknown): boolean {
  return error instanceof VideoAiServiceUnavailableError;
}

class VideoAiServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoAiServiceUnavailableError";
  }
}

function createCommandId(now: string | Date): string {
  return `command-${timestampString(now).replace(/[^0-9a-z]/gi, "").toLowerCase()}`;
}

function timestampString(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
