import assert from "node:assert/strict";

import {
  activeToolChanged,
  currentTimeChanged,
  documentLoaded,
  editorConflictResolved,
  editorDocumentLoaded,
  editorLoadStarted,
  editorReducer,
  mediaAssetAddedToTimeline,
  muteToggled,
  playbackFrameStepped,
  playbackStepChanged,
  playbackToggled,
  projectOpened,
  selectIsDirty,
  selectEditorMode,
  selectActiveToolId,
  selectMediaReferenceViewModels,
  selectSelectedTimelineItem,
  selectSyncStatus,
  selectTimelineDuration,
  selectTimelinePanelState,
  selectTimelineTrackViewModels,
  timelineItemsSelected,
  timelineScrollChanged,
  trackSoloToggled,
  videoOperationApplied,
} from "../app/store/slices/editor-slice";
import {
  createEmptyVideoProjectDocument,
  createMockVideoProjectDocument,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";
import type { MoveItemOperation, UpdateTrackOperation } from "../app/lib/editor/video-operations";
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
  assertTargetedMediaAssetPlacement();
  assertMediaAssetPlacementFailuresAreNonDestructive();
  assertFailedOperationIsNonDestructive();
  assertPlaybackClampsToTimelineDuration();
  assertPlaybackControlsUpdateOperationSafeState();
  assertSelectorsDeriveDocumentState();
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
  assert.equal(withAudio.document?.media["ready-audio"]?.kind, "audio");
  assert.equal(withAudio.document?.tracks.find((track) => track.kind === "audio")?.items.length, 1);

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
