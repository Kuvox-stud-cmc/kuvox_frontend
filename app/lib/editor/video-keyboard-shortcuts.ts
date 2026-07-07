import {
  buildSplitOperation,
  expandLinkedItemIds,
  roundTime,
} from "./editor-timeline";
import type {
  DeleteItemOperation,
  MoveItemOperation,
  SplitItemOperation,
  VideoOperationMetadata,
} from "./video-operations";
import type {
  VideoProjectDocument,
  VideoTimelineItem,
  VideoTrack,
} from "./video-document";

export type VideoEditorShortcut =
  | { type: "playPause" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "selectTool" }
  | { type: "splitTool" }
  | { type: "splitAtPlayhead" }
  | { type: "deleteSelected" }
  | { type: "selectAllVisible" }
  | { type: "escape" }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "stepPlayhead"; direction: -1 | 1; seconds: 0 | 1 }
  | { type: "nudgeSelected"; direction: -1 | 1; seconds: number };

export type EscapeShortcutResolution = "closeModal" | "closePopover" | "clearSelection" | "none";

export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "target"
>;

type ShortcutTargetLike = {
  tagName?: string;
  isContentEditable?: boolean;
  dataset?: Record<string, string | undefined>;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

export function classifyVideoEditorShortcut(event: ShortcutKeyEvent): VideoEditorShortcut | null {
  if (shouldIgnoreVideoEditorShortcutTarget(event.target)) return null;

  const key = normalizeShortcutKey(event.key);
  const commandOrControl = event.metaKey || event.ctrlKey;

  if (commandOrControl && key === "z" && !event.altKey) {
    return event.shiftKey ? { type: "redo" } : { type: "undo" };
  }

  if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && key === "y") {
    return { type: "redo" };
  }

  if (commandOrControl && !event.shiftKey && !event.altKey && key === "k") {
    return { type: "splitAtPlayhead" };
  }

  if (commandOrControl && !event.shiftKey && !event.altKey && key === "a") {
    return { type: "selectAllVisible" };
  }

  if (commandOrControl || event.altKey) return null;

  if ((key === " " || key === "spacebar" || key === "k") && !isNativeShortcutControl(event.target)) {
    return { type: "playPause" };
  }

  if (key === "v") return { type: "selectTool" };
  if (key === "c") return { type: "splitTool" };
  if (key === "delete" || key === "backspace") return { type: "deleteSelected" };
  if (key === "escape") return { type: "escape" };
  if (key === "+" || key === "=") return { type: "zoomIn" };
  if (key === "-") return { type: "zoomOut" };

  if (key === "arrowleft" || key === "arrowright") {
    const direction = key === "arrowleft" ? -1 : 1;
    return event.shiftKey
      ? { type: "nudgeSelected", direction, seconds: 1 }
      : { type: "nudgeSelected", direction, seconds: 0 };
  }

  return null;
}

export function shouldIgnoreVideoEditorShortcutTarget(target: EventTarget | null): boolean {
  const element = asShortcutTarget(target);
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (element.isContentEditable) return true;
  if (element.dataset?.editorShortcuts === "ignore") return true;
  if (element.getAttribute?.("data-editor-shortcuts") === "ignore") return true;
  if (element.getAttribute?.("role") === "textbox") return true;
  if (element.getAttribute?.("contenteditable") === "true") return true;
  if (element.getAttribute?.("contenteditable") === "plaintext-only") return true;

  return Boolean(element.closest?.(shortcutIgnoreSelector));
}

export function selectVisibleTimelineItemIds(document: VideoProjectDocument): string[] {
  return document.tracks.flatMap((track) => track.hidden ? [] : track.items.map((item) => item.id));
}

export function resolveEscapeShortcut({
  activeModal,
  activePopover,
  selectedItemIds,
}: {
  activeModal: unknown | null;
  activePopover: unknown | null;
  selectedItemIds: string[];
}): EscapeShortcutResolution {
  if (activeModal) return "closeModal";
  if (activePopover) return "closePopover";
  if (selectedItemIds.length > 0) return "clearSelection";
  return "none";
}

export function buildShortcutDeleteOperation({
  document,
  selectedItemIds,
  clipsLinked,
  now = new Date().toISOString(),
}: {
  document: VideoProjectDocument;
  selectedItemIds: string[];
  clipsLinked: boolean;
  now?: string;
}): DeleteItemOperation | null {
  const editableItemIds = unlockedSelectedItemIds(document, selectedItemIds, clipsLinked);
  if (editableItemIds.length === 0) return null;

  return {
    ...operationMetadata("shortcut-delete-items", "Delete clips", editableItemIds, now),
    type: "deleteItem",
    itemIds: editableItemIds,
  };
}

export function buildShortcutSplitOperations({
  document,
  selectedItemIds,
  clipsLinked,
  currentTime,
  now = new Date().toISOString(),
}: {
  document: VideoProjectDocument;
  selectedItemIds: string[];
  clipsLinked: boolean;
  currentTime: number;
  now?: string;
}): SplitItemOperation[] {
  return unlockedSelectedItems(document, selectedItemIds, clipsLinked)
    .filter(({ item }) => currentTime > item.timelineStart && currentTime < item.timelineStart + item.duration)
    .map(({ item }) =>
      buildSplitOperation({
        item,
        playheadTime: currentTime,
        frameRate: document.settings.frameRate,
        metadata: operationMetadata("shortcut-split-item", "Split clip", [item.id], now),
      }),
    )
    .filter((operation): operation is SplitItemOperation => operation !== null);
}

export function buildShortcutNudgeOperations({
  document,
  selectedItemIds,
  clipsLinked,
  direction,
  seconds,
  now = new Date().toISOString(),
}: {
  document: VideoProjectDocument;
  selectedItemIds: string[];
  clipsLinked: boolean;
  direction: -1 | 1;
  seconds: number;
  now?: string;
}): MoveItemOperation[] {
  if (seconds <= 0) return [];

  return unlockedSelectedItems(document, selectedItemIds, clipsLinked).flatMap(({ item, track }) => {
    const timelineStart = roundTime(Math.max(0, item.timelineStart + direction * seconds));
    if (timelineStart === item.timelineStart) return [];

    return [{
      ...operationMetadata("shortcut-nudge-item", "Nudge clip", [item.id], now),
      type: "moveItem" as const,
      itemId: item.id,
      timelineStart,
      targetTrackId: track.id,
    }];
  });
}

export function frameDurationSeconds(document: VideoProjectDocument | null | undefined): number {
  return 1 / Math.max(1, document?.settings.frameRate ?? 30);
}

function unlockedSelectedItems(
  document: VideoProjectDocument,
  selectedItemIds: string[],
  clipsLinked: boolean,
): Array<{ item: VideoTimelineItem; track: VideoTrack }> {
  const ids = unlockedSelectedItemIds(document, selectedItemIds, clipsLinked);
  return ids.flatMap((itemId) => {
    const location = findTimelineItemLocation(document, itemId);
    return location ? [location] : [];
  });
}

function unlockedSelectedItemIds(
  document: VideoProjectDocument,
  selectedItemIds: string[],
  clipsLinked: boolean,
): string[] {
  const expanded = expandLinkedItemIds(document, selectedItemIds, clipsLinked);
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const itemId of expanded) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const location = findTimelineItemLocation(document, itemId);
    if (location && !location.track.locked) {
      ids.push(itemId);
    }
  }

  return ids;
}

function findTimelineItemLocation(
  document: VideoProjectDocument,
  itemId: string,
): { item: VideoTimelineItem; track: VideoTrack } | null {
  for (const track of document.tracks) {
    const item = track.items.find((candidate) => candidate.id === itemId);
    if (item) return { item, track };
  }

  return null;
}

function operationMetadata(
  idPrefix: string,
  label: string,
  affectedEntityIds: string[],
  now: string,
): VideoOperationMetadata {
  return {
    id: `${idPrefix}-${now.replace(/[-:.TZ]/g, "")}-${affectedEntityIds.join("-")}`,
    source: "manual",
    timestamp: now,
    label,
    affectedEntityIds,
  };
}

function normalizeShortcutKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function isNativeShortcutControl(target: EventTarget | null): boolean {
  const element = asShortcutTarget(target);
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  return tagName === "button" || tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "a";
}

function asShortcutTarget(target: EventTarget | null): ShortcutTargetLike | null {
  if (!target || typeof target !== "object") return null;
  return target as ShortcutTargetLike;
}

const shortcutIgnoreSelector = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[role='textbox']",
  "[data-editor-shortcuts='ignore']",
].join(",");
