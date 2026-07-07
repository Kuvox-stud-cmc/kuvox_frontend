import assert from "node:assert/strict";

import {
  activeToolChanged,
  aiAutocompleteClosed,
  aiAutocompleteOpened,
  aiCommandApplied,
  aiCommandFailed,
  aiCommandHistoryLoaded,
  aiCommandStarted,
  aiSuggestionHighlighted,
  aiSuggestionInserted,
  aiSuggestionsLoaded,
  currentTimeChanged,
  documentLoaded,
  editorConflictResolved,
  editorDocumentLoaded,
  editorLoadStarted,
  editorReducer,
  mediaAssetAddedToTimeline,
  modalClosed,
  modalOpened,
  muteToggled,
  playbackFrameStepped,
  playbackStepChanged,
  playbackToggled,
  projectOpened,
  selectAssistantState,
  selectIsDirty,
  selectEditorMode,
  selectActiveToolId,
  selectCanRedo,
  selectCanUndo,
  selectMediaReferenceViewModels,
  selectOverlayState,
  selectSelectedTimelineItem,
  selectVideoInspectorState,
  selectVideoHistoryState,
  selectSyncStatus,
  selectTimelineDuration,
  selectTimelinePanelState,
  selectTimelineTrackViewModels,
  selectedTextItemsDuplicated,
  textItemCreated,
  timelineSelectionCleared,
  timelineItemsSelected,
  timelineScrollChanged,
  trackSoloToggled,
  videoOperationApplied,
  videoRedoRequested,
  videoUndoRequested,
} from "../app/store/slices/editor-slice";
import {
  createEmptyVideoProjectDocument,
  createMockVideoProjectDocument,
  type TextTimelineItem,
  type VideoTimelineItem,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";
import {
  createVideoOperationBatch,
  type DeleteItemOperation,
  type MoveItemOperation,
  type SetProjectSettingsOperation,
  type SplitItemOperation,
  type TrimItemOperation,
  type UpdateAudioOperation,
  type UpdateSpeedOperation,
  type UpdateTextOperation,
  type UpdateTrackOperation,
  type UpdateTransformCropOperation,
  type VideoOperation,
  type VideoOperationBatch,
} from "../app/lib/editor/video-operations";
import { MediaKind, OwnerKind, type MediaDto } from "../app/lib/api";

function main(): void {
  assertProjectOpenInstallsDocument();
  assertDocumentLoadedValidation();
  assertEditorLoadActions();
  assertOperationApplication();
  assertTimelineSelectionAndSessionState();
  assertTrackControls();
  assertActiveToolState();
  assertMediaAssetPlacement();
  assertExportModalStateIsNonDestructive();
  assertTextToolCreation();
  assertTextToolCreationFailuresAreNonDestructive();
  assertSelectedTextDuplication();
  assertTargetedMediaAssetPlacement();
  assertMediaAssetPlacementFailuresAreNonDestructive();
  assertFailedOperationIsNonDestructive();
  assertUndoRedoHistoryStacks();
  assertUndoRedoRestoresMutationTypes();
  assertFailedOperationDoesNotAffectHistory();
  assertNewEditAfterUndoClearsRedo();
  assertHistorySanitizesSelectionAndPlayback();
  assertPlaybackClampsToTimelineDuration();
  assertPlaybackControlsUpdateOperationSafeState();
  assertSelectorsDeriveDocumentState();
  assertInspectorStateAndOperationPaths();
  assertAiSuggestionState();
  assertAiCommandStateAndUndo();
}

function assertExportModalStateIsNonDestructive(): void {
  const opened = editorReducer(undefined, projectOpened("v008"));
  const before = {
    revision: opened.document?.history.revision,
    undoCount: opened.undoStack.length,
    redoCount: opened.redoStack.length,
    syncStatus: opened.syncStatus,
    isDirty: selectIsDirty({ editor: opened }),
  };

  const modal = editorReducer(opened, modalOpened("export"));
  assert.equal(selectOverlayState({ editor: modal }).activeModal, "export");
  assert.equal(modal.document?.history.revision, before.revision);
  assert.equal(modal.undoStack.length, before.undoCount);
  assert.equal(modal.redoStack.length, before.redoCount);
  assert.equal(modal.syncStatus, before.syncStatus);
  assert.equal(selectIsDirty({ editor: modal }), before.isDirty);

  const closed = editorReducer(modal, modalClosed());
  assert.equal(selectOverlayState({ editor: closed }).activeModal, null);
  assert.equal(closed.document?.history.revision, before.revision);
  assert.equal(closed.undoStack.length, before.undoCount);
  assert.equal(closed.redoStack.length, before.redoCount);
  assert.equal(closed.syncStatus, before.syncStatus);
  assert.equal(selectIsDirty({ editor: closed }), before.isDirty);
}

function assertActiveToolState(): void {
  const initial = editorReducer(undefined, { type: "init" });
  assert.equal(selectActiveToolId({ editor: initial }), "select");

  const trim = editorReducer(initial, activeToolChanged("trim"));
  assert.equal(trim.ui.activeToolId, "trim");
  assert.equal(selectEditorMode({ editor: trim }), "manual");

  const disabled = editorReducer(trim, activeToolChanged("color"));
  assert.equal(disabled.ui.activeToolId, "trim");
  assert.equal(disabled.ui.editorMode, "manual");

  const invalid = editorReducer(trim, {
    type: activeToolChanged.type,
    payload: "captions",
  });
  assert.equal(invalid.ui.activeToolId, "trim");
  assert.equal(invalid.ui.editorMode, "manual");

  const ai = editorReducer(trim, activeToolChanged("ai"));
  assert.equal(ai.ui.editorMode, "ai");
  assert.equal(ai.ui.activeToolId, "trim");

  const manual = editorReducer(ai, activeToolChanged("select"));
  assert.equal(manual.ui.editorMode, "manual");
  assert.equal(manual.ui.activeToolId, "select");

  const openedWithTrim = editorReducer(trim, projectOpened("v010"));
  assert.equal(openedWithTrim.ui.activeToolId, "trim");

  const loadedWithTrim = editorReducer(trim, documentLoaded(createMockVideoProjectDocument("v010", "V010")));
  assert.equal(loadedWithTrim.ui.activeToolId, "trim");

  const opened = editorReducer(manual, projectOpened("v010"));
  assert.equal(opened.ui.activeToolId, "select");
}

function assertTimelineSelectionAndSessionState(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const multiSelected = editorReducer(
    opened,
    timelineItemsSelected({ itemIds: ["tl-beach", "tl-city"], activeItemId: "tl-city" }),
  );
  assert.deepEqual(multiSelected.selection.selectedItemIds, ["tl-beach", "tl-city"]);
  assert.equal(multiSelected.selection.activeItemId, "tl-city");

  const toggled = editorReducer(
    multiSelected,
    timelineItemsSelected({ itemIds: ["tl-beach"], activeItemId: "tl-beach", mode: "toggle" }),
  );
  assert.deepEqual(toggled.selection.selectedItemIds, ["tl-city"]);

  const scrolled = editorReducer(toggled, timelineScrollChanged({ left: 120, top: 40 }));
  const panel = selectTimelinePanelState({ editor: scrolled });
  assert.equal(panel.scrollLeft, 120);
  assert.equal(panel.scrollTop, 40);

  const soloed = editorReducer(scrolled, trackSoloToggled("a1"));
  assert.deepEqual(selectTimelinePanelState({ editor: soloed }).soloedAudioTrackIds, ["a1"]);
}

function assertTrackControls(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const hidden = editorReducer(opened, videoOperationApplied(updateTrackOperation({ hidden: true })));
  assert.equal(hidden.document?.tracks.find((track) => track.id === "v1")?.hidden, true);
  assert.equal(hidden.syncStatus, "dirty");

  const locked = editorReducer(opened, videoOperationApplied(updateTrackOperation({ locked: true })));
  assert.equal(locked.document?.tracks.find((track) => track.id === "v1")?.locked, true);

  const blocked = editorReducer(locked, videoOperationApplied(moveBeachOperation(18)));
  assert.equal(blocked.document, locked.document);
  assert.ok(blocked.lastError?.includes("locked"));
}

function assertMediaAssetPlacement(): void {
  const loaded = editorReducer(
    undefined,
    documentLoaded(createEmptyVideoProjectDocument({ id: "media-project", name: "Media Project" })),
  );

  const withVideo = editorReducer(
    loaded,
    mediaAssetAddedToTimeline(mediaDto({ id: "ready-video", kind: MediaKind.Video, filename: "ready.mp4", durationSeconds: 12 })),
  );
  assert.equal(withVideo.syncStatus, "dirty");
  assert.equal(withVideo.document?.media["ready-video"]?.kind, "video");
  assert.equal(withVideo.document?.tracks.find((track) => track.kind === "video")?.items.length, 1);

  const withAudio = editorReducer(
    withVideo,
    mediaAssetAddedToTimeline(mediaDto({ id: "ready-audio", kind: MediaKind.Audio, filename: "ready.wav", durationSeconds: 9 })),
  );
  const audioItem = withAudio.document?.tracks.find((track) => track.kind === "audio")?.items[0];
  assert.equal(withAudio.document?.media["ready-audio"]?.kind, "audio");
  assert.equal(withAudio.document?.tracks.find((track) => track.kind === "audio")?.items.length, 1);
  assert.equal(audioItem?.type, "audio");
  assert.equal(withAudio.selection.activeItemId, audioItem?.id);

  const withImage = editorReducer(
    withAudio,
    mediaAssetAddedToTimeline(mediaDto({ id: "ready-image", kind: MediaKind.Image, filename: "ready.png", durationSeconds: null })),
  );
  assert.equal(withImage.document?.media["ready-image"]?.kind, "image");
  assert.equal(withImage.document?.tracks.find((track) => track.kind === "video")?.items.length, 2);
}

function assertTargetedMediaAssetPlacement(): void {
  const loaded = editorReducer(
    undefined,
    documentLoaded(createEmptyVideoProjectDocument({ id: "media-project", name: "Media Project" })),
  );

  const placed = editorReducer(
    loaded,
    mediaAssetAddedToTimeline({
      media: mediaDto({ id: "targeted-video", kind: MediaKind.Video, filename: "targeted.mp4", durationSeconds: 12 }),
      trackId: "v1",
      timelineStart: 7,
    }),
  );

  const item = placed.document?.tracks.find((track) => track.id === "v1")?.items[0];
  assert.equal(item?.timelineStart, 7);
  assert.equal(placed.selection.activeItemId, item?.id);
}

function assertMediaAssetPlacementFailuresAreNonDestructive(): void {
  const loaded = editorReducer(
    undefined,
    documentLoaded(createEmptyVideoProjectDocument({ id: "media-project", name: "Media Project" })),
  );

  const processing = editorReducer(
    loaded,
    mediaAssetAddedToTimeline(mediaDto({ id: "processing-video", status: "Processing" })),
  );
  assert.equal(processing.document, loaded.document);
  assert.equal(processing.syncStatus, "clean");
  assert.ok(processing.lastError?.includes("not ready"));

  const failed = editorReducer(
    loaded,
    mediaAssetAddedToTimeline(mediaDto({ id: "failed-video", status: "Failed", errorMessage: "bad import" })),
  );
  assert.equal(failed.document, loaded.document);
  assert.equal(failed.syncStatus, "clean");

  const noAudioTrackDocument = createEmptyVideoProjectDocument({ id: "media-project", name: "Media Project" });
  const noAudioTrack = editorReducer(
    undefined,
    documentLoaded({
      ...noAudioTrackDocument,
      tracks: noAudioTrackDocument.tracks.filter((track) => track.kind !== "audio"),
    }),
  );
  const missingTrack = editorReducer(
    noAudioTrack,
    mediaAssetAddedToTimeline(mediaDto({ id: "ready-audio", kind: MediaKind.Audio, filename: "ready.wav" })),
  );
  assert.equal(missingTrack.document, noAudioTrack.document);
  assert.equal(missingTrack.syncStatus, "clean");
  assert.ok(missingTrack.lastError?.includes("No compatible audio track"));
}

function assertTextToolCreation(): void {
  const loaded = editorReducer(
    undefined,
    documentLoaded(createEmptyVideoProjectDocument({ id: "text-project", name: "Text Project" })),
  );
  const withText = editorReducer(
    loaded,
    textItemCreated({ preset: "caption", timelineStart: 12.3456, now: "2026-03-01T10:00:00.000Z" }),
  );
  const textItem = withText.document?.tracks.find((track) => track.id === "t1")?.items[0];

  assert.equal(withText.syncStatus, "dirty");
  assert.equal(withText.ui.activeToolId, "select");
  assert.equal(withText.ui.editorMode, "manual");
  assert.equal(textItem?.type, "text");
  assert.equal(textItem?.timelineStart, 12.346);
  assert.equal(textItem?.duration, 4);
  assert.equal(textItem?.type === "text" ? textItem.text : undefined, "New caption");
  assert.equal(textItem?.type === "text" ? textItem.style.backgroundColor : undefined, "#000000");
  assert.equal(textItem?.type === "text" ? textItem.transform.y : undefined, 320);
  assert.deepEqual(withText.selection.selectedItemIds, [textItem?.id]);
  assert.equal(withText.selection.activeItemId, textItem?.id);
  assert.equal(withText.lastAppliedOperationIds[0]?.startsWith("add-text-"), true);
}

function assertTextToolCreationFailuresAreNonDestructive(): void {
  const document = createEmptyVideoProjectDocument({ id: "text-project", name: "Text Project" });
  const noTextTrack = editorReducer(
    undefined,
    documentLoaded({
      ...document,
      tracks: document.tracks.filter((track) => track.kind !== "text"),
    }),
  );
  const missingTrack = editorReducer(noTextTrack, textItemCreated({ now: "2026-03-01T10:00:00.000Z" }));
  assert.equal(missingTrack.document, noTextTrack.document);
  assert.equal(missingTrack.syncStatus, "clean");
  assert.ok(missingTrack.lastError?.includes("No editable text track"));

  const lockedDocument = createEmptyVideoProjectDocument({ id: "locked-text-project", name: "Locked Text Project" });
  const lockedTextTrack = editorReducer(
    undefined,
    documentLoaded({
      ...lockedDocument,
      tracks: lockedDocument.tracks.map((track) => track.kind === "text" ? { ...track, locked: true } : track),
    }),
  );
  const locked = editorReducer(lockedTextTrack, textItemCreated({ now: "2026-03-01T10:00:00.000Z" }));
  assert.equal(locked.document, lockedTextTrack.document);
  assert.equal(locked.syncStatus, "clean");
  assert.ok(locked.lastError?.includes("No editable text track"));
}

function assertSelectedTextDuplication(): void {
  const opened = editorReducer(undefined, projectOpened("v002-text"));
  const selected = editorReducer(opened, timelineItemsSelected({ itemIds: ["tl-caption"], activeItemId: "tl-caption" }));
  const duplicated = editorReducer(
    selected,
    selectedTextItemsDuplicated({ now: "2026-03-01T10:00:00.000Z" }),
  );
  const textItems = duplicated.document?.tracks.find((track) => track.id === "t1")?.items as TextTimelineItem[] | undefined;
  const original = textItems?.find((item) => item.id === "tl-caption");
  const copy = textItems?.find((item) => item.id !== "tl-caption");

  assert.equal(duplicated.syncStatus, "dirty");
  assert.ok(original);
  assert.ok(copy);
  assert.equal(copy?.timelineStart, Number(original?.timelineStart) + 0.5);
  assert.equal(copy?.duration, original?.duration);
  assert.deepEqual(copy?.style, original?.style);
  assert.deepEqual(copy?.transform, original?.transform);
  assert.equal(copy && original ? copy.layerOrder > original.layerOrder : false, true);
  assert.deepEqual(duplicated.selection.selectedItemIds, [copy?.id]);
  assert.equal(duplicated.selection.activeItemId, copy?.id);

  const cleared = editorReducer(opened, timelineSelectionCleared());
  const rejected = editorReducer(cleared, selectedTextItemsDuplicated({ now: "2026-03-01T10:00:00.000Z" }));
  assert.equal(rejected.document, cleared.document);
  assert.equal(rejected.syncStatus, "clean");
  assert.ok(rejected.lastError?.includes("Select a text item"));
}

function assertEditorLoadActions(): void {
  const loading = editorReducer(undefined, editorLoadStarted({ projectId: "loaded" }));
  assert.equal(loading.projectId, "loaded");
  assert.equal(loading.documentStatus, "idle");
  assert.equal(loading.syncStatus, "syncing");

  const document = createMockVideoProjectDocument("loaded", "Loaded");
  const conflict = {
    reason: "local-unsynced-server-changed" as const,
    cachedProjectUpdatedAt: "2026-01-01T10:00:00.000Z",
    serverProjectUpdatedAt: "2026-01-02T10:00:00.000Z",
  };
  const loaded = editorReducer(
    loading,
    editorDocumentLoaded({
      document,
      source: "draft",
      syncStatus: "server-changed",
      pendingSyncCount: 1,
      conflict,
    }),
  );
  assert.equal(loaded.documentStatus, "ready");
  assert.equal(loaded.syncStatus, "server-changed");
  assert.equal(loaded.loadSource, "draft");
  assert.equal(loaded.pendingSyncCount, 1);
  assert.equal(loaded.conflict?.reason, "local-unsynced-server-changed");

  const kept = editorReducer(loaded, editorConflictResolved({ resolution: "keep-local" }));
  assert.equal(kept.syncStatus, "saved-local");
  assert.equal(kept.conflict, null);
  assert.equal(kept.pendingSyncCount, 1);
}

function assertProjectOpenInstallsDocument(): void {
  const state = editorReducer(undefined, projectOpened({ projectId: "v004", projectName: "V004" }));
  assert.equal(state.projectId, "v004");
  assert.equal(state.documentStatus, "ready");
  assert.equal(state.document?.projectId, "v004");
  assert.equal(state.document?.name, "V004");
  assert.equal(state.loadedRevision, state.document?.history.revision);
  assert.equal(state.lastSavedRevision, state.document?.history.revision);
}

function assertDocumentLoadedValidation(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const validDocument = createMockVideoProjectDocument("loaded", "Loaded");
  const loaded = editorReducer(opened, documentLoaded(validDocument));
  assert.equal(loaded.projectId, "loaded");
  assert.equal(loaded.documentStatus, "ready");
  assert.equal(loaded.lastError, null);

  const invalid = editorReducer(
    loaded,
    documentLoaded({ ...validDocument, schemaVersion: 999 } as unknown as VideoProjectDocument),
  );
  assert.equal(invalid.documentStatus, "invalid");
  assert.equal(invalid.document?.projectId, "loaded");
  assert.ok(invalid.lastError?.includes("schemaVersion"));
}

function assertOperationApplication(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const revision = opened.document?.history.revision;
  assert.equal(typeof revision, "number");

  const moved = editorReducer(opened, videoOperationApplied(moveBeachOperation(12)));
  assert.equal(moved.document?.history.revision, Number(revision) + 1);
  assert.equal(moved.document?.history.lastOperationId, "move-beach");
  assert.equal(moved.syncStatus, "dirty");
  assert.deepEqual(moved.lastAppliedOperationIds, ["move-beach"]);
  assert.equal(selectCanUndo({ editor: moved }), true);
  assert.equal(selectCanRedo({ editor: moved }), false);
  assert.equal(moved.document?.history.canUndo, true);
  assert.equal(moved.document?.history.canRedo, false);
  assert.equal(selectVideoHistoryState({ editor: moved }).undoStack[0]?.label, "Move beach");

  const selected = selectSelectedTimelineItem({ editor: moved });
  assert.equal(selected?.id, "tl-beach");
}

function assertFailedOperationIsNonDestructive(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const failed = editorReducer(opened, videoOperationApplied({ ...moveBeachOperation(-4), id: "bad-move" }));
  assert.equal(failed.document, opened.document);
  assert.equal(failed.syncStatus, "clean");
  assert.equal(failed.document?.history.revision, opened.document?.history.revision);
  assert.ok(failed.lastError);
}

function assertUndoRedoHistoryStacks(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const originalStart = findItem(opened.document, "tl-beach")?.timelineStart;
  const moved = editorReducer(opened, videoOperationApplied(moveBeachOperation(12)));
  const undone = editorReducer(moved, videoUndoRequested());

  assert.equal(findItem(undone.document, "tl-beach")?.timelineStart, originalStart);
  assert.equal(undone.undoStack.length, 0);
  assert.equal(undone.redoStack.length, 1);
  assert.equal(undone.syncStatus, "dirty");
  assert.deepEqual(undone.lastAppliedOperationIds, ["undo:move-beach"]);
  assert.equal(undone.document?.history.canUndo, false);
  assert.equal(undone.document?.history.canRedo, true);
  assert.equal(selectCanUndo({ editor: undone }), false);
  assert.equal(selectCanRedo({ editor: undone }), true);

  const redone = editorReducer(undone, videoRedoRequested());
  assert.equal(findItem(redone.document, "tl-beach")?.timelineStart, 12);
  assert.equal(redone.undoStack.length, 1);
  assert.equal(redone.redoStack.length, 0);
  assert.deepEqual(redone.lastAppliedOperationIds, ["redo:move-beach"]);
  assert.equal(redone.document?.history.canUndo, true);
  assert.equal(redone.document?.history.canRedo, false);
}

function assertUndoRedoRestoresMutationTypes(): void {
  assertRoundTripRestores("trim", trimBeachOperation({ timelineStart: 3, duration: 19, sourceIn: 1, sourceOut: 20 }));
  assertRoundTripRestores("text update", updateTextOperation({ text: "Undo text" }));
  assertRoundTripRestores("audio update", updateAudioOperation({ volume: 0.5, muted: true }));
  assertRoundTripRestores("settings update", setProjectSettingsOperation({ width: 1280, previewQuality: "draft" }));
  assertRoundTripRestores("delete checkpoint", deleteBeachOperation());
  assertRoundTripRestores("split checkpoint", splitBeachOperation());
  assertRoundTripRestores(
    "AI batch checkpoint",
    createVideoOperationBatch({
      id: "ai-history-batch",
      source: "ai",
      timestamp: "2026-02-02T10:00:00.000Z",
      label: "AI move",
      commandId: "command-history",
      operations: [{ ...moveBeachOperation(16), id: "ai-move-beach", source: "ai", commandId: "command-history" }],
    }),
  );

  const empty = editorReducer(
    undefined,
    documentLoaded(createEmptyVideoProjectDocument({ id: "history-media", name: "History Media" })),
  );
  const mediaAdded = editorReducer(
    empty,
    mediaAssetAddedToTimeline(mediaDto({ id: "history-video", kind: MediaKind.Video, filename: "history.mp4", durationSeconds: 8 })),
  );
  assert.equal(mediaAdded.undoStack.length, 1);
  const mediaUndone = editorReducer(mediaAdded, videoUndoRequested());
  assert.equal(mediaUndone.document?.media["history-video"], undefined);
  assert.equal(mediaUndone.document?.tracks.find((track) => track.kind === "video")?.items.length, 0);
  const mediaRedone = editorReducer(mediaUndone, videoRedoRequested());
  assert.equal(mediaRedone.document?.media["history-video"]?.kind, "video");

  const textAdded = editorReducer(empty, textItemCreated({ now: "2026-03-01T10:00:00.000Z" }));
  const textUndone = editorReducer(textAdded, videoUndoRequested());
  assert.equal(textUndone.document?.tracks.find((track) => track.id === "t1")?.items.length, 0);
  const textRedone = editorReducer(textUndone, videoRedoRequested());
  assert.equal(textRedone.document?.tracks.find((track) => track.id === "t1")?.items.length, 1);

  const opened = editorReducer(undefined, projectOpened("v002-text"));
  const selected = editorReducer(opened, timelineItemsSelected({ itemIds: ["tl-caption"], activeItemId: "tl-caption" }));
  const duplicated = editorReducer(selected, selectedTextItemsDuplicated({ now: "2026-03-01T10:00:00.000Z" }));
  const duplicatedUndone = editorReducer(duplicated, videoUndoRequested());
  assert.equal(duplicatedUndone.document?.tracks.find((track) => track.id === "t1")?.items.length, 1);
  const duplicatedRedone = editorReducer(duplicatedUndone, videoRedoRequested());
  assert.equal(duplicatedRedone.document?.tracks.find((track) => track.id === "t1")?.items.length, 2);
}

function assertAiCommandStateAndUndo(): void {
  const opened = editorReducer(undefined, projectOpened("video-ai-state"));
  const started = editorReducer(
    opened,
    aiCommandStarted({ commandId: "command-state", prompt: "move clip 1 to 12s" }),
  );
  assert.equal(started.aiCommandStatus, "planning");
  assert.equal(started.aiCommandError, null);
  assert.equal(selectAssistantState({ editor: started }).aiCommandStatus, "planning");
  assert.equal(started.assistantMessages.at(-1)?.role, "user");

  const aiBatch = createVideoOperationBatch({
    id: "ai-state-batch",
    source: "ai",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "AI: move clip",
    commandId: "command-state",
    forceCheckpoint: true,
    operations: [{ ...moveBeachOperation(12), id: "ai-state-move", source: "ai", commandId: "command-state" }],
  });
  const edited = editorReducer(started, videoOperationApplied(aiBatch));
  const applied = editorReducer(
    edited,
    aiCommandApplied({
      commandId: "command-state",
      summary: "Moved tl-beach to 12s.",
      warnings: ["Track is visible."],
      operationBatchId: aiBatch.id,
    }),
  );

  assert.equal(applied.aiCommandStatus, "applied");
  assert.equal(applied.aiLastSummary, "Moved tl-beach to 12s.");
  assert.deepEqual(applied.aiLastWarnings, ["Track is visible."]);
  assert.equal(applied.undoStack.length, 1);
  assert.equal(applied.undoStack[0].source, "ai");
  assert.equal(applied.undoStack[0].historyEntry.commandId, "command-state");
  assert.equal(applied.undoStack[0].undo.type, "checkpoint");
  assert.equal(findItem(applied.document, "tl-beach")?.timelineStart, 12);

  const undone = editorReducer(applied, videoUndoRequested());
  assert.equal(findItem(undone.document, "tl-beach")?.timelineStart, 2);

  const failed = editorReducer(
    started,
    aiCommandFailed({
      commandId: "command-failed",
      prompt: "make it viral",
      error: "Unsupported command.",
      warnings: [],
    }),
  );
  assert.equal(failed.aiCommandStatus, "failed");
  assert.equal(failed.aiCommandError, "Unsupported command.");
  assert.equal(failed.undoStack.length, 0);

  const historyLoaded = editorReducer(
    failed,
    aiCommandHistoryLoaded([
      {
        id: "history-1",
        scopeProjectKey: "scope:project",
        scopeKey: "scope",
        scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
        projectId: "video-ai-state",
        commandId: "command-history",
        source: "ai",
        text: "move clip 1 to 12s",
        timestamp: "2026-02-02T10:00:00.000Z",
        status: "applied",
        operationBatchId: "ai-state-batch",
        cachedAt: 1,
      },
    ]),
  );
  assert.equal(selectAssistantState({ editor: historyLoaded }).recentCommandHistory.length, 1);
}

function assertAiSuggestionState(): void {
  const opened = editorReducer(undefined, projectOpened("video-ai-suggestions"));
  const loaded = editorReducer(
    opened,
    aiSuggestionsLoaded([
      {
        id: "suggestion-move",
        label: "Move selected clip",
        command: "move tl-beach to 12s",
        source: "context",
      },
      {
        id: "suggestion-split",
        label: "Split here",
        command: "split here",
        source: "template",
      },
    ]),
  );
  assert.equal(selectAssistantState({ editor: loaded }).aiSuggestions.length, 2);

  const autocompleteOpen = editorReducer(loaded, aiAutocompleteOpened());
  assert.equal(selectAssistantState({ editor: autocompleteOpen }).aiAutocompleteOpen, true);
  assert.equal(selectAssistantState({ editor: autocompleteOpen }).aiActiveSuggestionIndex, -1);

  const highlighted = editorReducer(autocompleteOpen, aiSuggestionHighlighted(1));
  assert.equal(selectAssistantState({ editor: highlighted }).aiActiveSuggestionIndex, 1);

  const inserted = editorReducer(highlighted, aiSuggestionInserted(loaded.aiSuggestions[0]));
  assert.equal(selectAssistantState({ editor: inserted }).commandInput, "move tl-beach to 12s");
  assert.equal(selectAssistantState({ editor: inserted }).aiAutocompleteOpen, false);
  assert.equal(inserted.undoStack.length, 0);
  assert.equal(inserted.document?.history.revision, opened.document?.history.revision);

  const closed = editorReducer(autocompleteOpen, aiAutocompleteClosed());
  assert.equal(selectAssistantState({ editor: closed }).aiAutocompleteOpen, false);
  assert.equal(selectAssistantState({ editor: closed }).aiActiveSuggestionIndex, -1);
}

function assertFailedOperationDoesNotAffectHistory(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const failed = editorReducer(opened, videoOperationApplied({ ...moveBeachOperation(-4), id: "bad-history-move" }));
  assert.equal(failed.undoStack.length, 0);
  assert.equal(failed.redoStack.length, 0);
  assert.equal(failed.document?.history.canUndo, false);
  assert.equal(failed.document?.history.canRedo, false);
}

function assertNewEditAfterUndoClearsRedo(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const moved = editorReducer(opened, videoOperationApplied(moveBeachOperation(12)));
  const undone = editorReducer(moved, videoUndoRequested());
  assert.equal(undone.redoStack.length, 1);

  const edited = editorReducer(undone, videoOperationApplied(updateTextOperation({ text: "New branch" })));
  assert.equal(edited.undoStack.length, 1);
  assert.equal(edited.redoStack.length, 0);
  assert.equal(edited.document?.history.canUndo, true);
  assert.equal(edited.document?.history.canRedo, false);
}

function assertHistorySanitizesSelectionAndPlayback(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const selected = editorReducer(opened, timelineItemsSelected({ itemIds: ["tl-city"], activeItemId: "tl-city" }));
  const deleted = editorReducer(selected, videoOperationApplied(deleteCityOperation()));
  assert.deepEqual(deleted.selection.selectedItemIds, []);
  assert.equal(deleted.selection.activeItemId, undefined);

  const movedLate = editorReducer(opened, videoOperationApplied(moveBeachOperation(280)));
  const parkedAtLateTime = editorReducer(movedLate, currentTimeChanged(290));
  const undone = editorReducer(parkedAtLateTime, videoUndoRequested());
  assert.equal(undone.playback.currentTime, selectTimelineDuration({ editor: undone }));
}

function assertRoundTripRestores(label: string, operation: VideoOperation | VideoOperationBatch): void {
  const opened = editorReducer(undefined, projectOpened(`history-${label}`));
  const before = opened.document;
  const applied = editorReducer(opened, videoOperationApplied(operation));
  assert.equal(applied.undoStack.length, 1, `${label} should push undo`);
  const undone = editorReducer(applied, videoUndoRequested());
  assertTimelineAndSettingsEqual(undone.document, before, `${label} undo should restore`);
  const redone = editorReducer(undone, videoRedoRequested());
  assertTimelineAndSettingsEqual(redone.document, applied.document, `${label} redo should restore`);
}

function assertPlaybackClampsToTimelineDuration(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const duration = selectTimelineDuration({ editor: opened });
  const clamped = editorReducer(opened, currentTimeChanged(duration + 1000));
  assert.equal(clamped.playback.currentTime, duration);
}

function assertPlaybackControlsUpdateOperationSafeState(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const playing = editorReducer(opened, playbackToggled());
  assert.equal(playing.playback.playing, true);

  const muted = editorReducer(playing, muteToggled());
  assert.equal(muted.playback.muted, true);
  assert.equal(muted.playback.playing, true);

  const jumped = editorReducer(muted, playbackStepChanged(5));
  assert.equal(jumped.playback.playing, false);
  assert.equal(jumped.playback.currentTime, selectTimelineDuration({ editor: opened }));

  const frameForward = editorReducer(editorReducer(opened, currentTimeChanged(1)), playbackFrameStepped(1));
  assert.equal(frameForward.playback.currentTime, 1 + 1 / Number(opened.document?.settings.frameRate));

  const frameStart = editorReducer(editorReducer(opened, currentTimeChanged(0)), playbackFrameStepped(-1));
  assert.equal(frameStart.playback.currentTime, 0);

  const duration = selectTimelineDuration({ editor: opened });
  const frameEnd = editorReducer(editorReducer(opened, currentTimeChanged(duration)), playbackFrameStepped(1));
  assert.equal(frameEnd.playback.currentTime, duration);
}

function assertSelectorsDeriveDocumentState(): void {
  const opened = editorReducer(undefined, projectOpened("v004"));
  const root = { editor: opened };
  assert.equal(selectSyncStatus(root), "clean");
  assert.equal(selectIsDirty(root), false);
  assert.ok(selectTimelineDuration(root) > 0);
  assert.ok(selectTimelineTrackViewModels(root).some((track) => track.clips.length > 0));
  assert.ok(selectMediaReferenceViewModels(root).some((media) => media.id === "clip-beach"));
}

function assertInspectorStateAndOperationPaths(): void {
  const opened = editorReducer(undefined, projectOpened("v001-inspector"));
  const activeInspector = selectVideoInspectorState({ editor: opened });
  assert.equal(activeInspector.kind, "item");
  if (activeInspector.kind !== "item") throw new Error("expected item inspector");
  assert.equal(activeInspector.item.id, "tl-beach");
  assert.equal(activeInspector.track.id, "v1");
  assert.equal(activeInspector.media?.id, "clip-beach");
  assert.equal(activeInspector.linkedAudioItems[0]?.item.id, "tl-audio-main");

  const multiSelected = editorReducer(
    opened,
    timelineItemsSelected({ itemIds: ["tl-beach", "tl-city"], activeItemId: "tl-city" }),
  );
  const multiInspector = selectVideoInspectorState({ editor: multiSelected });
  assert.equal(multiInspector.kind, "item");
  if (multiInspector.kind !== "item") throw new Error("expected multi item inspector");
  assert.equal(multiInspector.selectedCount, 2);
  assert.equal(multiInspector.item.id, "tl-city");

  const projectState = editorReducer(opened, timelineSelectionCleared());
  const projectInspector = selectVideoInspectorState({ editor: projectState });
  assert.equal(projectInspector.kind, "project");
  if (projectInspector.kind !== "project") throw new Error("expected project inspector");
  assert.equal(projectInspector.document?.settings.width, 1920);

  const transitionInspector = selectVideoInspectorState({
    editor: {
      ...opened,
      selection: {
        ...opened.selection,
        selectedItemIds: [],
        activeItemId: undefined,
        selectedTransitionIds: ["transition-beach-city"],
      },
    },
  });
  assert.equal(transitionInspector.kind, "transition");

  const trimmed = editorReducer(opened, videoOperationApplied(trimBeachOperation({ timelineStart: 3, duration: 19, sourceIn: 1, sourceOut: 20 })));
  const trimmedItem = trimmed.document?.tracks[0]?.items.find((item) => item.id === "tl-beach");
  assert.equal(trimmedItem?.timelineStart, 3);
  assert.equal(trimmedItem?.duration, 19);
  assert.equal(trimmed.syncStatus, "dirty");
  assert.equal(trimmed.selection.activeItemId, "tl-beach");

  const speed = editorReducer(opened, videoOperationApplied(updateSpeedOperation(1.25)));
  const speedItem = speed.document?.tracks[0]?.items.find((item) => item.id === "tl-beach");
  assert.equal(speedItem?.type === "video" ? speedItem.speed : undefined, 1.25);

  const transformed = editorReducer(opened, videoOperationApplied(updateTransformOperation({ opacity: 0.6 })));
  const transformedItem = transformed.document?.tracks[0]?.items.find((item) => item.id === "tl-beach");
  assert.equal(transformedItem?.type === "video" ? transformedItem.opacity : undefined, 0.6);

  const captionSelected = editorReducer(opened, timelineItemsSelected({ itemIds: ["tl-caption"], activeItemId: "tl-caption" }));
  const textEdited = editorReducer(captionSelected, videoOperationApplied(updateTextOperation({ text: "Inspector caption" })));
  const textItem = textEdited.document?.tracks.find((track) => track.id === "t1")?.items[0];
  assert.equal(textItem?.type === "text" ? textItem.text : undefined, "Inspector caption");
  assert.equal(textEdited.selection.activeItemId, "tl-caption");

  const audioSelected = editorReducer(opened, timelineItemsSelected({ itemIds: ["tl-audio-main"], activeItemId: "tl-audio-main" }));
  const audioEdited = editorReducer(audioSelected, videoOperationApplied(updateAudioOperation({ volume: 0.5, muted: true })));
  const audioItem = audioEdited.document?.tracks.find((track) => track.id === "a1")?.items[0];
  assert.equal(audioItem?.type === "audio" ? audioItem.volume : undefined, 0.5);
  assert.equal(audioItem?.type === "audio" ? audioItem.muted : undefined, true);
  assert.equal(audioItem?.type === "audio" ? audioItem.linkedGroupId : undefined, "linked-beach");

  const linkedMuted = editorReducer(
    opened,
    videoOperationApplied(createVideoOperationBatch({
      source: "manual",
      timestamp: "2026-02-02T10:00:00.000Z",
      label: "Mute linked audio",
      operations: [updateAudioOperation({ muted: true })],
    })),
  );
  const linkedAudio = linkedMuted.document?.tracks.find((track) => track.id === "a1")?.items[0];
  assert.equal(linkedAudio?.type === "audio" ? linkedAudio.muted : undefined, true);

  const settingsEdited = editorReducer(projectState, videoOperationApplied(setProjectSettingsOperation({ width: 1280, previewQuality: "draft" })));
  assert.equal(settingsEdited.document?.settings.width, 1280);
  assert.equal(settingsEdited.document?.settings.previewQuality, "draft");
  assert.equal(settingsEdited.selection.activeItemId, undefined);

  const invalid = editorReducer(opened, videoOperationApplied(updateAudioOperation({ volume: 2 })));
  assert.equal(invalid.document, opened.document);
  assert.equal(invalid.syncStatus, "clean");
  assert.ok(invalid.lastError);
}

function moveBeachOperation(timelineStart: number): MoveItemOperation {
  return {
    id: "move-beach",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Move beach",
    affectedEntityIds: ["tl-beach"],
    type: "moveItem",
    itemId: "tl-beach",
    timelineStart,
  };
}

function updateTrackOperation(fields: Partial<Pick<UpdateTrackOperation, "trackLabel" | "locked" | "hidden" | "muted">>): UpdateTrackOperation {
  return {
    id: "update-track",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update track",
    affectedEntityIds: ["v1"],
    type: "updateTrack",
    trackId: "v1",
    ...fields,
  };
}

function trimBeachOperation(fields: Pick<TrimItemOperation, "timelineStart" | "duration" | "sourceIn" | "sourceOut">): TrimItemOperation {
  return {
    id: "inspector-trim-beach",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Trim beach",
    affectedEntityIds: ["tl-beach"],
    type: "trimItem",
    itemId: "tl-beach",
    ...fields,
  };
}

function updateSpeedOperation(speed: number): UpdateSpeedOperation {
  return {
    id: "inspector-speed",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update speed",
    affectedEntityIds: ["tl-beach"],
    type: "updateSpeed",
    itemId: "tl-beach",
    speed,
  };
}

function updateTransformOperation(
  fields: Omit<Partial<UpdateTransformCropOperation>, "id" | "source" | "timestamp" | "label" | "affectedEntityIds" | "type" | "itemId">,
): UpdateTransformCropOperation {
  return {
    id: "inspector-transform",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update transform",
    affectedEntityIds: ["tl-beach"],
    type: "updateTransformCrop",
    itemId: "tl-beach",
    ...fields,
  };
}

function updateTextOperation(
  fields: Omit<Partial<UpdateTextOperation>, "id" | "source" | "timestamp" | "label" | "affectedEntityIds" | "type" | "itemId">,
): UpdateTextOperation {
  return {
    id: "inspector-text",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update text",
    affectedEntityIds: ["tl-caption"],
    type: "updateText",
    itemId: "tl-caption",
    ...fields,
  };
}

function updateAudioOperation(
  fields: Omit<Partial<UpdateAudioOperation>, "id" | "source" | "timestamp" | "label" | "affectedEntityIds" | "type" | "itemId">,
): UpdateAudioOperation {
  return {
    id: "inspector-audio",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update audio",
    affectedEntityIds: ["tl-audio-main"],
    type: "updateAudio",
    itemId: "tl-audio-main",
    ...fields,
  };
}

function setProjectSettingsOperation(settings: SetProjectSettingsOperation["settings"]): SetProjectSettingsOperation {
  return {
    id: "inspector-settings",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Update settings",
    affectedEntityIds: ["settings"],
    type: "setProjectSettings",
    settings,
  };
}

function deleteBeachOperation(): DeleteItemOperation {
  return {
    id: "delete-beach",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Delete beach",
    affectedEntityIds: ["tl-beach"],
    type: "deleteItem",
    itemIds: ["tl-beach"],
  };
}

function deleteCityOperation(): DeleteItemOperation {
  return {
    id: "delete-city",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Delete city",
    affectedEntityIds: ["tl-city"],
    type: "deleteItem",
    itemIds: ["tl-city"],
  };
}

function splitBeachOperation(): SplitItemOperation {
  const document = createMockVideoProjectDocument("split-source", "Split Source");
  const item = findItem(document, "tl-beach");
  if (!item || item.type !== "video") throw new Error("expected video item");

  const splitOffset = 4;
  return {
    id: "split-beach",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Split beach",
    affectedEntityIds: ["tl-beach"],
    type: "splitItem",
    itemId: "tl-beach",
    items: [
      {
        ...item,
        id: "tl-beach-a",
        duration: splitOffset,
        sourceOut: item.sourceIn + splitOffset,
      },
      {
        ...item,
        id: "tl-beach-b",
        timelineStart: item.timelineStart + splitOffset,
        duration: item.duration - splitOffset,
        sourceIn: item.sourceIn + splitOffset,
      },
    ],
  };
}

function findItem(document: VideoProjectDocument | null | undefined, itemId: string): VideoTimelineItem | undefined {
  return document?.tracks.flatMap((track) => track.items).find((item) => item.id === itemId);
}

function assertTimelineAndSettingsEqual(
  actual: VideoProjectDocument | null | undefined,
  expected: VideoProjectDocument | null | undefined,
  message: string,
): void {
  assert.ok(actual, `${message}: actual document missing`);
  assert.ok(expected, `${message}: expected document missing`);
  assert.deepEqual(actual.settings, expected.settings, `${message}: settings`);
  assert.deepEqual(actual.media, expected.media, `${message}: media`);
  assert.deepEqual(actual.tracks, expected.tracks, `${message}: tracks`);
  assert.deepEqual(actual.transitions, expected.transitions, `${message}: transitions`);
  assert.deepEqual(actual.effects, expected.effects, `${message}: effects`);
}

function mediaDto(overrides: Partial<MediaDto> = {}): MediaDto {
  const status = String(overrides.status ?? "Ready");
  const normalizedStatus = status.toLowerCase();
  return {
    id: "media-1",
    ownerId: "user-1",
    ownerKind: OwnerKind.User,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: MediaKind.Video,
    filename: "media.mp4",
    storageKey: "raw",
    sizeBytes: 100,
    status,
    canonicalStorageKey: null,
    proxyStorageKey: null,
    thumbnailStorageKey: null,
    errorMessage: null,
    durationSeconds: 10,
    width: null,
    height: null,
    codec: null,
    frameRate: null,
    createdAt: "2026-03-01T10:00:00.000Z",
    isFavorite: false,
    pipeline: {
      stage: normalizedStatus === "ready" ? "ready" : normalizedStatus === "failed" ? "failed" : "ingesting",
      label: status,
      detail: "",
      step: normalizedStatus === "ready" ? 4 : 2,
      stepCount: 4,
      terminal: normalizedStatus === "ready" || normalizedStatus === "failed",
    },
    ...overrides,
  };
}

main();
