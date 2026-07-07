import { roundTime } from "./editor-timeline";
import type {
  TextTimelineItem,
  VideoProjectDocument,
  VideoTextStyle,
  VideoTrack,
  VideoTransform,
} from "./video-document";
import type {
  AddTextItemOperation,
  VideoOperationMetadata,
  VideoOperationSource,
} from "./video-operations";

export type TextPreset = "caption" | "title";

export type AddTextItemBuildResult =
  | {
      ok: true;
      operation: AddTextItemOperation;
    }
  | { ok: false; reason: string };

export type DuplicateTextBuildResult =
  | {
      ok: true;
      operations: AddTextItemOperation[];
      duplicateItemIds: string[];
    }
  | { ok: false; reason: string };

export function buildAddTextItemOperation({
  document,
  now,
  preset = "caption",
  trackId,
  timelineStart,
  text,
  itemId,
  source = "manual",
  commandId,
}: {
  document: VideoProjectDocument;
  now: string | Date;
  preset?: TextPreset;
  trackId?: string;
  timelineStart?: number;
  text?: string;
  itemId?: string;
  source?: VideoOperationSource;
  commandId?: string;
}): AddTextItemBuildResult {
  const timestamp = timestampString(now);
  const targetTrack = targetTextTrack(document, trackId);
  if (!targetTrack) {
    return { ok: false, reason: "No editable text track is available." };
  }

  const presetDefaults = textPresetDefaults(preset);
  const targetItemId = itemId ?? createTextItemId(preset, timestamp);
  const item: TextTimelineItem = {
    id: targetItemId,
    type: "text",
    timelineStart: roundTime(timelineStart ?? 0),
    duration: 4,
    text: text ?? presetDefaults.text,
    style: { ...presetDefaults.style },
    transform: { ...presetDefaults.transform },
    layerOrder: nextTextLayerOrder(document),
  };

  return {
    ok: true,
    operation: {
      ...metadata({
        id: `add-text-${targetItemId}`,
        source,
        timestamp,
        label: preset === "caption" ? "Add caption" : "Add title",
        affectedEntityIds: [targetItemId],
        commandId,
      }),
      type: "addTextItem",
      trackId: targetTrack.id,
      item,
    },
  };
}

export function buildDuplicateTextOperations({
  document,
  selectedItemIds,
  now,
  timelineOffset = 0.5,
  source = "manual",
  commandId,
}: {
  document: VideoProjectDocument;
  selectedItemIds: string[];
  now: string | Date;
  timelineOffset?: number;
  source?: VideoOperationSource;
  commandId?: string;
}): DuplicateTextBuildResult {
  if (selectedItemIds.length === 0) {
    return { ok: false, reason: "Select a text item to duplicate." };
  }

  const selected = new Set(selectedItemIds);
  const timestamp = timestampString(now);
  const orderedTextItems = document.tracks.flatMap((track) =>
    track.items.flatMap((item) =>
      selected.has(item.id) && item.type === "text" && !track.locked
        ? [{ item, track }]
        : [],
    ),
  );

  if (orderedTextItems.length === 0) {
    return { ok: false, reason: "Select an editable text item to duplicate." };
  }

  let layerOrder = nextTextLayerOrder(document);
  const operations = orderedTextItems.map(({ item, track }, index) => {
    const duplicateId = `${item.id}-copy-${slugTimestamp(timestamp)}${orderedTextItems.length > 1 ? `-${index + 1}` : ""}`;
    const duplicate: TextTimelineItem = {
      ...cloneJson(item),
      id: duplicateId,
      timelineStart: roundTime(item.timelineStart + timelineOffset),
      layerOrder: layerOrder++,
    };

    return {
      ...metadata({
        id: `duplicate-text-${duplicateId}`,
        source,
        timestamp,
        label: "Duplicate text",
        affectedEntityIds: [item.id, duplicateId],
        commandId,
      }),
      type: "addTextItem" as const,
      trackId: track.id,
      item: duplicate,
    };
  });

  return {
    ok: true,
    operations,
    duplicateItemIds: operations.map((operation) => operation.item.id),
  };
}

function textPresetDefaults(preset: TextPreset): { text: string; style: VideoTextStyle; transform: VideoTransform } {
  if (preset === "title") {
    return {
      text: "New title",
      style: {
        fontFamily: "Inter",
        fontSize: 72,
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
      },
      transform: { x: 0, y: -280, scaleX: 1, scaleY: 1, rotation: 0 },
    };
  }

  return {
    text: "New caption",
    style: {
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: "semibold",
      color: "#ffffff",
      backgroundColor: "#000000",
      textAlign: "center",
    },
    transform: { x: 0, y: 320, scaleX: 1, scaleY: 1, rotation: 0 },
  };
}

function targetTextTrack(document: VideoProjectDocument, preferredTrackId?: string): VideoTrack | null {
  if (preferredTrackId) {
    const preferred = document.tracks.find((track) => track.id === preferredTrackId);
    return preferred && preferred.kind === "text" && !preferred.locked ? preferred : null;
  }

  return document.tracks.find((track) => track.kind === "text" && !track.locked) ?? null;
}

function nextTextLayerOrder(document: VideoProjectDocument): number {
  return document.tracks.reduce((maxOrder, track) => {
    if (track.kind !== "text" && track.kind !== "overlay") {
      return maxOrder;
    }

    return Math.max(
      maxOrder,
      ...track.items.map((item) => ("layerOrder" in item ? item.layerOrder : 0)),
    );
  }, 0) + 1;
}

function metadata(input: VideoOperationMetadata): VideoOperationMetadata {
  return {
    id: input.id,
    source: input.source,
    timestamp: input.timestamp,
    label: input.label,
    affectedEntityIds: input.affectedEntityIds,
    ...(input.commandId !== undefined ? { commandId: input.commandId } : {}),
  };
}

function createTextItemId(preset: TextPreset, timestamp: string): string {
  return `tl-${preset}-${slugTimestamp(timestamp)}`;
}

function timestampString(now: string | Date): string {
  return typeof now === "string" ? now : now.toISOString();
}

function slugTimestamp(timestamp: string): string {
  return timestamp.replace(/[^a-zA-Z0-9]/g, "");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
