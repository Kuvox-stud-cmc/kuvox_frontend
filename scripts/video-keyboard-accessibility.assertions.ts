import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildShortcutDeleteOperation,
  buildShortcutNudgeOperations,
  buildShortcutSplitOperations,
  classifyVideoEditorShortcut,
  resolveEscapeShortcut,
  selectVisibleTimelineItemIds,
  shouldIgnoreVideoEditorShortcutTarget,
  type ShortcutKeyEvent,
} from "../app/lib/editor/video-keyboard-shortcuts";
import { createMockVideoProjectDocument, type VideoProjectDocument } from "../app/lib/editor/video-document";

const timestamp = "2026-07-07T08:00:00.000Z";

function main(): void {
  assertShortcutParser();
  assertIgnoredTargets();
  assertSelectAllExcludesHiddenTracks();
  assertNudgeBuildsBoundedUnlockedMoveOperations();
  assertSplitAndDeleteRequireValidUnlockedSelections();
  assertEscapePrefersOverlays();
  assertAccessibilityMarkers();
}

function assertShortcutParser(): void {
  assert.deepEqual(shortcut(" "), { type: "playPause" });
  assert.deepEqual(shortcut("k"), { type: "playPause" });
  assert.deepEqual(shortcut("z", { metaKey: true }), { type: "undo" });
  assert.deepEqual(shortcut("z", { ctrlKey: true, shiftKey: true }), { type: "redo" });
  assert.deepEqual(shortcut("y", { ctrlKey: true }), { type: "redo" });
  assert.deepEqual(shortcut("v"), { type: "selectTool" });
  assert.deepEqual(shortcut("c"), { type: "splitTool" });
  assert.deepEqual(shortcut("k", { metaKey: true }), { type: "splitAtPlayhead" });
  assert.deepEqual(shortcut("Delete"), { type: "deleteSelected" });
  assert.deepEqual(shortcut("Backspace"), { type: "deleteSelected" });
  assert.deepEqual(shortcut("a", { ctrlKey: true }), { type: "selectAllVisible" });
  assert.deepEqual(shortcut("Escape"), { type: "escape" });
  assert.deepEqual(shortcut("="), { type: "zoomIn" });
  assert.deepEqual(shortcut("+"), { type: "zoomIn" });
  assert.deepEqual(shortcut("-"), { type: "zoomOut" });
  assert.deepEqual(shortcut("ArrowLeft"), { type: "nudgeSelected", direction: -1, seconds: 0 });
  assert.deepEqual(shortcut("ArrowRight", { shiftKey: true }), { type: "nudgeSelected", direction: 1, seconds: 1 });
  assert.equal(shortcut("k", { target: nativeTarget("button") }), null);
}

function assertIgnoredTargets(): void {
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(nativeTarget("input")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(nativeTarget("textarea")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(nativeTarget("select")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(attributeTarget("role", "textbox")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(attributeTarget("contenteditable", "true")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(attributeTarget("data-editor-shortcuts", "ignore")), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(closestIgnoredTarget()), true);
  assert.equal(shouldIgnoreVideoEditorShortcutTarget(nativeTarget("button")), false);
  assert.equal(shortcut("Delete", { target: nativeTarget("input") }), null);
}

function assertSelectAllExcludesHiddenTracks(): void {
  const document = withTracks(createMockVideoProjectDocument("keyboard", "Keyboard"), {
    t1: { hidden: true },
  });

  assert.deepEqual(selectVisibleTimelineItemIds(document), [
    "tl-beach",
    "tl-city",
    "tl-mountain",
    "tl-audio-main",
    "tl-audio-bed",
  ]);
}

function assertNudgeBuildsBoundedUnlockedMoveOperations(): void {
  const document = withTracks(createMockVideoProjectDocument("keyboard", "Keyboard"), {
    v1: { locked: true },
  });
  const lockedSkipped = buildShortcutNudgeOperations({
    document,
    selectedItemIds: ["tl-beach"],
    clipsLinked: false,
    direction: 1,
    seconds: 1,
    now: timestamp,
  });
  assert.equal(lockedSkipped.length, 0);

  const unlocked = createMockVideoProjectDocument("keyboard", "Keyboard");
  const bounded = buildShortcutNudgeOperations({
    document: unlocked,
    selectedItemIds: ["tl-beach"],
    clipsLinked: false,
    direction: -1,
    seconds: 4,
    now: timestamp,
  });
  assert.equal(bounded.length, 1);
  assert.equal(bounded[0].type, "moveItem");
  assert.equal(bounded[0].timelineStart, 0);
  assert.equal(bounded[0].targetTrackId, "v1");
}

function assertSplitAndDeleteRequireValidUnlockedSelections(): void {
  const document = createMockVideoProjectDocument("keyboard", "Keyboard");
  assert.equal(buildShortcutDeleteOperation({ document, selectedItemIds: [], clipsLinked: false, now: timestamp }), null);
  assert.equal(
    buildShortcutDeleteOperation({
      document: withTracks(document, { v1: { locked: true } }),
      selectedItemIds: ["tl-beach"],
      clipsLinked: false,
      now: timestamp,
    }),
    null,
  );

  const deleteOperation = buildShortcutDeleteOperation({
    document,
    selectedItemIds: ["tl-caption"],
    clipsLinked: false,
    now: timestamp,
  });
  assert.equal(deleteOperation?.type, "deleteItem");
  assert.deepEqual(deleteOperation?.itemIds, ["tl-caption"]);

  assert.equal(
    buildShortcutSplitOperations({
      document,
      selectedItemIds: [],
      clipsLinked: false,
      currentTime: 6,
      now: timestamp,
    }).length,
    0,
  );
  assert.equal(
    buildShortcutSplitOperations({
      document,
      selectedItemIds: ["tl-beach"],
      clipsLinked: false,
      currentTime: 2,
      now: timestamp,
    }).length,
    0,
  );

  const splitOperations = buildShortcutSplitOperations({
    document,
    selectedItemIds: ["tl-beach"],
    clipsLinked: false,
    currentTime: 6,
    now: timestamp,
  });
  assert.equal(splitOperations.length, 1);
  assert.equal(splitOperations[0].type, "splitItem");
  assert.equal(splitOperations[0].itemId, "tl-beach");
}

function assertEscapePrefersOverlays(): void {
  assert.equal(resolveEscapeShortcut({ activeModal: "export", activePopover: "profile", selectedItemIds: ["tl-beach"] }), "closeModal");
  assert.equal(resolveEscapeShortcut({ activeModal: null, activePopover: "profile", selectedItemIds: ["tl-beach"] }), "closePopover");
  assert.equal(resolveEscapeShortcut({ activeModal: null, activePopover: null, selectedItemIds: ["tl-beach"] }), "clearSelection");
  assert.equal(resolveEscapeShortcut({ activeModal: null, activePopover: null, selectedItemIds: [] }), "none");
}

function assertAccessibilityMarkers(): void {
  const workspace = readFileSync("app/components/editor/video-editor-workspace.tsx", "utf8");
  const timeline = readFileSync("app/components/editor/panels/timeline-panel.tsx", "utf8");
  const assistant = readFileSync("app/components/editor/ai-assistant-panel.tsx", "utf8");

  assert.match(workspace, /data-video-editor-root/);
  assert.match(timeline, /aria-selected=\{selected\}/);
  assert.match(timeline, /timelineItemAriaLabel/);
  assert.match(timeline, /motion-reduce:transition-none/);
  assert.match(assistant, /data-editor-shortcuts="ignore"/);
}

function shortcut(
  key: string,
  overrides: Partial<Omit<ShortcutKeyEvent, "key">> = {},
) {
  return classifyVideoEditorShortcut({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    ...overrides,
  } as ShortcutKeyEvent);
}

function nativeTarget(tagName: string): EventTarget {
  return {
    tagName,
    getAttribute: () => null,
    closest: () => null,
  } as unknown as EventTarget;
}

function attributeTarget(name: string, value: string): EventTarget {
  return {
    tagName: "div",
    getAttribute: (candidate: string) => candidate === name ? value : null,
    closest: () => null,
  } as unknown as EventTarget;
}

function closestIgnoredTarget(): EventTarget {
  return {
    tagName: "span",
    getAttribute: () => null,
    closest: (selector: string) => selector.includes("data-editor-shortcuts") ? {} : null,
  } as unknown as EventTarget;
}

function withTracks(
  document: VideoProjectDocument,
  patches: Record<string, Partial<VideoProjectDocument["tracks"][number]>>,
): VideoProjectDocument {
  return {
    ...document,
    tracks: document.tracks.map((track) => ({ ...track, ...patches[track.id] })),
  };
}

main();
