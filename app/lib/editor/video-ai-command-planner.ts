import { roundTime } from "./editor-timeline";
import { buildAddTextItemOperation } from "./editor-text";
import {
  applyVideoOperationBatch,
  createVideoOperationBatch,
  type DeleteItemOperation,
  type MoveItemOperation,
  type SplitItemOperation,
  type TrimItemOperation,
  type UpdateAudioOperation,
  type UpdateSpeedOperation,
  type VideoOperation,
  type VideoOperationBatch,
  type VideoOperationMetadata,
} from "./video-operations";
import type {
  VideoEditorSelection,
  VideoMediaReference,
  VideoPlaybackState,
  VideoProjectDocument,
  VideoTimelineItem,
  VideoTrack,
} from "./video-document";

export type VideoAiCommandStatus = "idle" | "planning" | "applied" | "failed";

export type VideoAiCommandPlan =
  | VideoAiSuccessfulCommandPlan
  | {
      ok: false;
      prompt: string;
      error: string;
      warnings: string[];
    };

export interface VideoAiSuccessfulCommandPlan {
  ok: true;
  commandId: string;
  prompt: string;
  label: string;
  summary: string;
  warnings: string[];
  batch: VideoOperationBatch;
}

export interface VideoAiCommandContext {
  document: VideoProjectDocument;
  selection: VideoEditorSelection;
  playback: VideoPlaybackState;
  selectedItem?: VideoTimelineItem | null;
  mediaReferences: Record<string, VideoMediaReference>;
}

export interface PlanVideoAiCommandOptions {
  commandId?: string;
  now?: string | Date;
}

type LocatedItem = {
  item: VideoTimelineItem;
  track: VideoTrack;
  itemIndex: number;
};

type TargetKind = "clip" | "audio" | "text" | "any";

const unsupportedMessage =
  "This mock assistant can trim, split, delete, move, add text, set volume, or change speed.";

export function planVideoAiCommand(
  context: VideoAiCommandContext,
  input: string,
  options: PlanVideoAiCommandOptions = {},
): VideoAiCommandPlan {
  return planMockVideoAiCommand(context, input, options);
}

export function planMockVideoAiCommand(
  context: VideoAiCommandContext,
  input: string,
  options: PlanVideoAiCommandOptions = {},
): VideoAiCommandPlan {
  const prompt = input.trim();
  if (!prompt) {
    return failure(prompt, "Enter a video edit command.");
  }

  const timestamp = timestampString(options.now ?? new Date());
  const commandId = options.commandId ?? createCommandId(timestamp);
  const parsed = parseCommand(context, prompt, commandId, timestamp);
  if (!parsed.ok) return parsed;

  const batch = createVideoOperationBatch({
    id: `ai-batch-${commandId}`,
    source: "ai",
    timestamp,
    label: `AI: ${parsed.label}`,
    commandId,
    forceCheckpoint: true,
    operations: parsed.operations,
  });

  const validation = applyVideoOperationBatch(context.document, batch);
  if (!validation.ok) {
    return failure(
      prompt,
      validation.errors?.join(" ") ?? "The generated edit is not valid for this timeline.",
      validation.warnings,
    );
  }

  return {
    ok: true,
    commandId,
    prompt,
    label: parsed.label,
    summary: parsed.summary,
    warnings: [...parsed.warnings, ...validation.warnings],
    batch,
  };
}

function parseCommand(
  context: VideoAiCommandContext,
  prompt: string,
  commandId: string,
  timestamp: string,
): { ok: true; label: string; summary: string; warnings: string[]; operations: VideoOperation[] } | Extract<VideoAiCommandPlan, { ok: false }> {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  if (lower === "split here") {
    return splitPlan(context, prompt, "", context.playback.currentTime, commandId, timestamp);
  }

  const addText = normalized.match(/^add\s+text\s+"([^"]+)"(?:\s+at\s+(.+))?$/i);
  if (addText) {
    return addTextPlan(context, prompt, addText[1], addText[2], commandId, timestamp);
  }

  const trimRange = normalized.match(/^trim(?:\s+(.+?))?\s+from\s+(.+?)\s+to\s+(.+)$/i);
  if (trimRange) {
    const start = parseTime(trimRange[2]);
    const end = parseTime(trimRange[3]);
    if (start === null || end === null) return failure(prompt, "Use a valid trim range, such as 5s to 12s.");
    return trimPlan(context, prompt, trimRange[1] ?? "", start, end, commandId, timestamp);
  }

  const trimDuration = normalized.match(/^trim(?:\s+(.+?))?\s+to\s+(.+)$/i);
  if (trimDuration) {
    const duration = parseTime(trimDuration[2]);
    if (duration === null) return failure(prompt, "Use a valid trim duration, such as 8s.");
    const target = resolveSingleTarget(context, trimDuration[1] ?? "", "any");
    if (!target.ok) return failure(prompt, target.error);
    return trimPlan(
      context,
      prompt,
      trimDuration[1] ?? "",
      target.value.item.timelineStart,
      target.value.item.timelineStart + duration,
      commandId,
      timestamp,
    );
  }

  const split = normalized.match(/^split(?:\s+(.+?))?\s+at\s+(.+)$/i);
  if (split) {
    const time = parseTime(split[2]);
    if (time === null) return failure(prompt, "Use a valid split time, such as 12s.");
    return splitPlan(context, prompt, split[1] ?? "", time, commandId, timestamp);
  }

  const deleteMatch = normalized.match(/^delete(?:\s+(.+))?$/i);
  if (deleteMatch) {
    return deletePlan(context, prompt, deleteMatch[1] ?? "", commandId, timestamp);
  }

  const move = normalized.match(/^move(?:\s+(.+?))?\s+to\s+(.+)$/i);
  if (move) {
    const time = parseTime(move[2]);
    if (time === null) return failure(prompt, "Use a valid move time, such as 18s.");
    return movePlan(context, prompt, move[1] ?? "", time, commandId, timestamp);
  }

  const volume = normalized.match(/^set\s+volume(?:\s+(.+?))?\s+to\s+(\d+(?:\.\d+)?)\s*%$/i);
  if (volume) {
    const percent = Number(volume[2]);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return failure(prompt, "Volume must be between 0% and 100%.");
    }
    return volumePlan(context, prompt, volume[1] ?? "", percent, commandId, timestamp);
  }

  const speed = normalized.match(/^change\s+speed(?:\s+(.+?))?\s+to\s+(\d+(?:\.\d+)?)\s*x$/i);
  if (speed) {
    const rate = Number(speed[2]);
    if (!Number.isFinite(rate) || rate <= 0) {
      return failure(prompt, "Speed must be greater than 0x.");
    }
    return speedPlan(context, prompt, speed[1] ?? "", rate, commandId, timestamp);
  }

  return failure(prompt, unsupportedMessage);
}

function trimPlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  start: number,
  end: number,
  commandId: string,
  timestamp: string,
) {
  if (end <= start) return failure(prompt, "Trim end must be after trim start.");
  const target = resolveSingleTarget(context, targetText, "any");
  if (!target.ok) return failure(prompt, target.error);

  const item = target.value.item;
  const duration = roundTime(end - start);
  const range = mediaRangeForTimelineRange(item, start, duration);
  if (range === null) {
    return failure(prompt, "That trim range falls outside the source media.");
  }

  const operation: TrimItemOperation = {
    ...metadata({
      id: `ai-trim-${item.id}-${commandId}`,
      source: "ai",
      timestamp,
      label: `AI trim ${item.id}`,
      affectedEntityIds: [item.id],
      commandId,
      forceCheckpoint: true,
    }),
    type: "trimItem",
    itemId: item.id,
    timelineStart: roundTime(start),
    duration,
    ...range,
  };

  return {
    ok: true as const,
    label: "trim clip",
    summary: `Trimmed ${item.id} to ${formatSeconds(start)}-${formatSeconds(end)}.`,
    warnings: [],
    operations: [operation],
  };
}

function splitPlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  splitTime: number,
  commandId: string,
  timestamp: string,
) {
  const target = resolveSingleTarget(context, targetText, "any");
  if (!target.ok) return failure(prompt, target.error);

  const item = target.value.item;
  const offset = roundTime(splitTime - item.timelineStart);
  if (offset <= 0 || offset >= item.duration) {
    return failure(prompt, `Split time must be inside ${item.id}.`);
  }

  const items = splitItem(item, splitTime, commandId);
  if (!items) return failure(prompt, "That item cannot be split at the requested time.");

  const operation: SplitItemOperation = {
    ...metadata({
      id: `ai-split-${item.id}-${commandId}`,
      source: "ai",
      timestamp,
      label: `AI split ${item.id}`,
      affectedEntityIds: [item.id, items[0].id, items[1].id],
      commandId,
      forceCheckpoint: true,
    }),
    type: "splitItem",
    itemId: item.id,
    items,
  };

  return {
    ok: true as const,
    label: "split clip",
    summary: `Split ${item.id} at ${formatSeconds(splitTime)}.`,
    warnings: [],
    operations: [operation],
  };
}

function deletePlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  commandId: string,
  timestamp: string,
) {
  const targets = targetText.trim()
    ? resolveSingleTarget(context, targetText, "any")
    : resolveSelectedTargets(context);
  if (!targets.ok) return failure(prompt, targets.error);

  const itemIds = "value" in targets ? [targets.value.item.id] : targets.values.map(({ item }) => item.id);
  const uniqueItemIds = Array.from(new Set(itemIds));
  const operation: DeleteItemOperation = {
    ...metadata({
      id: `ai-delete-${commandId}`,
      source: "ai",
      timestamp,
      label: "AI delete",
      affectedEntityIds: uniqueItemIds,
      commandId,
      forceCheckpoint: true,
    }),
    type: "deleteItem",
    itemIds: uniqueItemIds,
  };

  return {
    ok: true as const,
    label: "delete selection",
    summary: `Deleted ${uniqueItemIds.length} timeline item${uniqueItemIds.length === 1 ? "" : "s"}.`,
    warnings: [],
    operations: [operation],
  };
}

function movePlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  time: number,
  commandId: string,
  timestamp: string,
) {
  const target = resolveSingleTarget(context, targetText, "any");
  if (!target.ok) return failure(prompt, target.error);

  const operation: MoveItemOperation = {
    ...metadata({
      id: `ai-move-${target.value.item.id}-${commandId}`,
      source: "ai",
      timestamp,
      label: `AI move ${target.value.item.id}`,
      affectedEntityIds: [target.value.item.id],
      commandId,
      forceCheckpoint: true,
    }),
    type: "moveItem",
    itemId: target.value.item.id,
    timelineStart: roundTime(time),
  };

  return {
    ok: true as const,
    label: "move clip",
    summary: `Moved ${target.value.item.id} to ${formatSeconds(time)}.`,
    warnings: [],
    operations: [operation],
  };
}

function addTextPlan(
  context: VideoAiCommandContext,
  prompt: string,
  content: string,
  timeText: string | undefined,
  commandId: string,
  timestamp: string,
) {
  const time = timeText ? parseTime(timeText) : context.playback.currentTime;
  if (time === null) return failure(prompt, "Use a valid text start time, such as 4s.");

  const build = buildAddTextItemOperation({
    document: context.document,
    now: timestamp,
    timelineStart: time,
    text: content,
    source: "ai",
    commandId,
  });
  if (!build.ok) return failure(prompt, build.reason);

  const operation = {
    ...build.operation,
    id: `ai-add-text-${commandId}`,
    label: "AI add text",
    forceCheckpoint: true,
  };

  return {
    ok: true as const,
    label: "add text",
    summary: `Added text at ${formatSeconds(time)}.`,
    warnings: [],
    operations: [operation],
  };
}

function volumePlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  percent: number,
  commandId: string,
  timestamp: string,
) {
  const target = resolveSingleTarget(context, targetText, "audio");
  if (!target.ok) return failure(prompt, target.error);

  const operation: UpdateAudioOperation = {
    ...metadata({
      id: `ai-volume-${target.value.item.id}-${commandId}`,
      source: "ai",
      timestamp,
      label: `AI volume ${target.value.item.id}`,
      affectedEntityIds: [target.value.item.id],
      commandId,
      forceCheckpoint: true,
    }),
    type: "updateAudio",
    itemId: target.value.item.id,
    volume: roundTime(percent / 100),
    muted: false,
  };

  return {
    ok: true as const,
    label: "set volume",
    summary: `Set ${target.value.item.id} volume to ${percent}%.`,
    warnings: [],
    operations: [operation],
  };
}

function speedPlan(
  context: VideoAiCommandContext,
  prompt: string,
  targetText: string,
  speed: number,
  commandId: string,
  timestamp: string,
) {
  const target = resolveSingleTarget(context, targetText, "clip");
  if (!target.ok) return failure(prompt, target.error);
  if (target.value.item.type !== "video") {
    return failure(prompt, "Speed changes currently target video clips.");
  }

  const sourceDuration = target.value.item.sourceOut - target.value.item.sourceIn;
  const operation: UpdateSpeedOperation = {
    ...metadata({
      id: `ai-speed-${target.value.item.id}-${commandId}`,
      source: "ai",
      timestamp,
      label: `AI speed ${target.value.item.id}`,
      affectedEntityIds: [target.value.item.id],
      commandId,
      forceCheckpoint: true,
    }),
    type: "updateSpeed",
    itemId: target.value.item.id,
    speed: roundTime(speed),
    duration: roundTime(sourceDuration / speed),
    sourceOut: target.value.item.sourceOut,
  };

  return {
    ok: true as const,
    label: "change speed",
    summary: `Changed ${target.value.item.id} speed to ${speed}x.`,
    warnings: [],
    operations: [operation],
  };
}

function resolveSingleTarget(
  context: VideoAiCommandContext,
  targetText: string,
  kind: TargetKind,
): { ok: true; value: LocatedItem } | { ok: false; error: string } {
  const target = targetText.trim();
  const matches = target ? resolveTargetText(context, target, kind) : resolveDefaultTarget(context, kind);
  if (matches.length === 1) return { ok: true, value: matches[0] };
  if (matches.length === 0) return { ok: false, error: "No matching timeline item was found." };
  return { ok: false, error: "That target is ambiguous. Try an item id, clip 1, audio 1, or text 1." };
}

function resolveSelectedTargets(
  context: VideoAiCommandContext,
): { ok: true; values: LocatedItem[] } | { ok: false; error: string } {
  const locations = new Map(allLocatedItems(context.document).map((location) => [location.item.id, location]));
  const values = context.selection.selectedItemIds.flatMap((itemId) => {
    const location = locations.get(itemId);
    return location ? [location] : [];
  });
  if (values.length === 0) return { ok: false, error: "Select one or more timeline items to delete." };
  return { ok: true, values };
}

function resolveDefaultTarget(context: VideoAiCommandContext, kind: TargetKind): LocatedItem[] {
  const locations = allLocatedItems(context.document);
  if (context.selection.activeItemId) {
    const active = locations.find(({ item }) => item.id === context.selection.activeItemId);
    if (active && isCompatibleTarget(active.item, kind)) return [active];
  }

  const selected = new Set(context.selection.selectedItemIds);
  return locations.filter(({ item }) => selected.has(item.id) && isCompatibleTarget(item, kind));
}

function resolveTargetText(context: VideoAiCommandContext, targetText: string, kind: TargetKind): LocatedItem[] {
  const target = targetText.trim().toLowerCase();
  const items = allLocatedItems(context.document).filter(({ item }) => isCompatibleTarget(item, kind));
  const exact = items.filter(({ item }) => item.id.toLowerCase() === target);
  if (exact.length > 0) return exact;

  const ordinal = target.match(/^(clip|audio|text)\s+(\d+)$/i);
  if (ordinal) {
    const ordinalKind = ordinal[1].toLowerCase() as "clip" | "audio" | "text";
    const index = Number(ordinal[2]) - 1;
    const ordered = items.filter(({ item }) => isCompatibleTarget(item, ordinalKind)).sort(compareLocatedItems);
    return ordered[index] ? [ordered[index]] : [];
  }

  return items.filter(({ item }) => item.id.toLowerCase().includes(target));
}

function allLocatedItems(document: VideoProjectDocument): LocatedItem[] {
  return document.tracks.flatMap((track) =>
    track.items.map((item, itemIndex) => ({ item, track, itemIndex })),
  );
}

function compareLocatedItems(a: LocatedItem, b: LocatedItem): number {
  return a.item.timelineStart - b.item.timelineStart || a.track.id.localeCompare(b.track.id) || a.itemIndex - b.itemIndex;
}

function isCompatibleTarget(item: VideoTimelineItem, kind: TargetKind): boolean {
  if (kind === "any") return true;
  if (kind === "audio") return item.type === "audio";
  if (kind === "text") return item.type === "text";
  return item.type === "video" || item.type === "image" || item.type === "overlay";
}

function mediaRangeForTimelineRange(
  item: VideoTimelineItem,
  timelineStart: number,
  duration: number,
): { sourceIn?: number; sourceOut?: number } | null {
  if (!isMediaTimelineItem(item)) return {};
  const speed = item.type === "video" ? item.speed : 1;
  const sourceIn = roundTime(item.sourceIn + (timelineStart - item.timelineStart) * speed);
  const sourceOut = roundTime(sourceIn + duration * speed);
  if (sourceIn < 0 || sourceOut <= sourceIn) return null;
  return { sourceIn, sourceOut };
}

function splitItem(
  item: VideoTimelineItem,
  splitTime: number,
  commandId: string,
): [VideoTimelineItem, VideoTimelineItem] | null {
  const offset = roundTime(splitTime - item.timelineStart);
  const left = { ...cloneJson(item), id: `${item.id}-a-${commandId}`, duration: offset } as VideoTimelineItem;
  const right = {
    ...cloneJson(item),
    id: `${item.id}-b-${commandId}`,
    timelineStart: roundTime(splitTime),
    duration: roundTime(item.duration - offset),
  } as VideoTimelineItem;

  if (isMediaTimelineItem(item)) {
    const speed = item.type === "video" ? item.speed : 1;
    const splitSource = roundTime(item.sourceIn + offset * speed);
    (left as Extract<VideoTimelineItem, { sourceIn: number; sourceOut: number }>).sourceOut = splitSource;
    (right as Extract<VideoTimelineItem, { sourceIn: number; sourceOut: number }>).sourceIn = splitSource;
  }

  return [left, right] as [VideoTimelineItem, VideoTimelineItem];
}

function isMediaTimelineItem(item: VideoTimelineItem): item is Extract<VideoTimelineItem, { sourceIn: number; sourceOut: number }> {
  return item.type === "video" || item.type === "audio";
}

function metadata(input: VideoOperationMetadata): VideoOperationMetadata {
  return {
    id: input.id,
    source: input.source,
    timestamp: input.timestamp,
    label: input.label,
    affectedEntityIds: input.affectedEntityIds,
    ...(input.commandId !== undefined ? { commandId: input.commandId } : {}),
    ...(input.forceCheckpoint !== undefined ? { forceCheckpoint: input.forceCheckpoint } : {}),
  };
}

function parseTime(value: string): number | null {
  const input = value.trim().toLowerCase();
  const colonParts = input.split(":");
  if (colonParts.length > 1 && colonParts.every((part) => /^\d+(?:\.\d+)?$/.test(part))) {
    const parts = colonParts.map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return roundTime(parts.reduce((total, part) => total * 60 + part, 0));
  }

  const match = input.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)?$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? roundTime(seconds) : null;
}

function formatSeconds(value: number): string {
  return `${roundTime(value)}s`;
}

function timestampString(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

function createCommandId(timestamp: string): string {
  return `command-${timestamp.replace(/[^0-9a-z]/gi, "").toLowerCase()}`;
}

function failure(prompt: string, error: string, warnings: string[] = []): Extract<VideoAiCommandPlan, { ok: false }> {
  return { ok: false, prompt, error, warnings };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
