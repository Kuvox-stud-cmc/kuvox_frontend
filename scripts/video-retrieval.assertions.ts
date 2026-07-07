import assert from "node:assert/strict";

import { MediaKind, OwnerKind, type MediaDto, type ProjectMediaDto } from "../app/lib/api";
import { createMockVideoProjectDocument } from "../app/lib/editor/video-document";
import { planVideoAiCommandWithService } from "../app/lib/editor/video-ai-service-planner";
import {
  normalizeVideoEditorRetrievalResponse,
  type VideoEditorShotSearchResult,
} from "../app/lib/editor/video-retrieval";
import {
  editorReducer,
  projectMediaAvailabilityLoaded,
  projectOpened,
  semanticReferenceSelected,
  semanticSearchStarted,
  semanticSearchSucceeded,
  semanticShotAddedToTimeline,
  selectSemanticSearchState,
} from "../app/store/slices/editor-slice";

async function main(): Promise<void> {
  assertNormalizationDropsMalformedResults();
  assertSearchLifecycleAndReadiness();
  assertSemanticSelection();
  assertShotAddCreatesUndoableClip();
  assertReadOnlyBlocksShotAdd();
  await assertPlanningSummaryIncludesShotId();
}

function assertNormalizationDropsMalformedResults(): void {
  const normalized = normalizeVideoEditorRetrievalResponse({
    result: {
      projectId: "project-1",
      query: "speaker",
      warnings: ["partial"],
      totalCandidatesConsidered: 3,
      results: [
        shotResult(),
        { shotId: "bad", mediaId: "media-1", startSeconds: 5, endSeconds: 1, score: 1 },
        { mediaId: "media-1", startSeconds: 0, endSeconds: 1, score: 1 },
      ],
    },
  });

  assert.equal(normalized.results.length, 1);
  assert.equal(normalized.results[0].shotId, "media-1:shot:000001");
  assert.deepEqual(normalized.warnings, ["partial"]);
}

function assertSearchLifecycleAndReadiness(): void {
  let state = editorReducer(undefined, projectOpened("project-1"));
  state = editorReducer(state, semanticSearchStarted({ query: "speaker", modalities: ["transcript", "ocr"] }));
  assert.equal(state.semanticSearchStatus, "searching");

  state = editorReducer(state, semanticSearchSucceeded({
    query: "speaker",
    results: [shotResult()],
    warnings: ["Qdrant collection shots_ocr is not available."],
  }));
  const search = selectSemanticSearchState({ editor: state });
  assert.equal(search.status, "succeeded");
  assert.equal(search.results.length, 1);
  assert.equal(search.warnings[0], "Qdrant collection shots_ocr is not available.");

  state = editorReducer(state, projectMediaAvailabilityLoaded([projectMedia({ shotCount: undefined })]));
  assert.equal(state.semanticReadinessByMediaId["media-1"].ready, true);
  assert.equal(state.semanticReadinessByMediaId["media-1"].shotCount, null);

  state = editorReducer(state, projectMediaAvailabilityLoaded([projectMedia({ shotCount: 0 })]));
  assert.equal(state.semanticReadinessByMediaId["media-1"].ready, false);
  assert.equal(state.semanticReadinessByMediaId["media-1"].shotCount, 0);
}

function assertSemanticSelection(): void {
  const state = editorReducer(undefined, projectOpened("project-1"));
  const selectedExisting = editorReducer(state, semanticReferenceSelected({
    ...shotResult(),
    shotId: "shot-beach-opening",
    mediaId: "clip-beach",
  }));
  assert.equal(selectedExisting.selection.activeItemId, "tl-beach");
  assert.equal(selectedExisting.selectedSemanticReference?.existingItemId, "tl-beach");

  const selectedNew = editorReducer(state, semanticReferenceSelected(shotResult()));
  assert.equal(selectedNew.selectedSemanticReference?.shotId, "media-1:shot:000001");
  assert.equal(selectedNew.selection.activeItemId, "tl-beach");
}

function assertShotAddCreatesUndoableClip(): void {
  const state = editorReducer(undefined, projectOpened("project-1"));
  const added = editorReducer(state, semanticShotAddedToTimeline({
    result: shotResult(),
    media: mediaDto(),
    canWrite: true,
    timelineStart: 12,
    now: "2026-07-06T00:00:00.000Z",
  }));

  assert.equal(added.undoStack.length, 1);
  assert.equal(added.syncStatus, "dirty");
  const item = added.document?.tracks.flatMap((track) => track.items).find((candidate) => candidate.id === added.selection.activeItemId);
  assert.ok(item && item.type === "video");
  assert.equal(item.mediaId, "media-1");
  assert.equal(item.shotId, "media-1:shot:000001");
  assert.equal(item.timelineStart, 12);
  assert.equal(item.sourceIn, 2);
  assert.equal(item.sourceOut, 5);
  assert.equal(added.document?.media["media-1"].name, "Interview.mp4");
}

function assertReadOnlyBlocksShotAdd(): void {
  const state = editorReducer(undefined, projectOpened("project-1"));
  const blocked = editorReducer(state, semanticShotAddedToTimeline({
    result: shotResult(),
    media: mediaDto(),
    canWrite: false,
  }));

  assert.equal(blocked.undoStack.length, 0);
  assert.equal(blocked.ui.toastMessage, "View only: you cannot edit this timeline");
}

async function assertPlanningSummaryIncludesShotId(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let capturedBody: any;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      ok: false,
      planId: "plan-1",
      commandId: capturedBody.commandId,
      actions: [],
      warnings: [],
      explanation: null,
      confidence: 1,
      unsupportedReason: "stop",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const document = createMockVideoProjectDocument("project-1");
    await planVideoAiCommandWithService({
      document,
      selection: {
        selectedTrackIds: [],
        selectedItemIds: ["tl-beach"],
        selectedTransitionIds: [],
        selectedEffectIds: [],
        activeItemId: "tl-beach",
      },
      playback: { playing: false, currentTime: 3, volume: 1, muted: false, loop: false },
      selectedItem: document.tracks[0].items[0],
      mediaReferences: document.media,
    }, "delete selected", {
      commandId: "command-1",
      now: "2026-07-06T00:00:00.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const item = capturedBody.timeline.tracks[0].items.find((candidate: any) => candidate.id === "tl-beach");
  assert.equal(item.shotId, "shot-beach-opening");
}

function shotResult(overrides: Partial<VideoEditorShotSearchResult> = {}): VideoEditorShotSearchResult {
  return {
    shotId: "media-1:shot:000001",
    mediaId: "media-1",
    startSeconds: 2,
    endSeconds: 5,
    score: 0.5,
    modalityScores: { transcript: 0.9 },
    evidence: [{ modality: "transcript", text: "speaker mentions the launch", score: 0.9 }],
    ...overrides,
  };
}

function mediaDto(): MediaDto {
  return {
    id: "media-1",
    ownerId: "owner-1",
    ownerKind: OwnerKind.User,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: MediaKind.Video,
    filename: "Interview.mp4",
    storageKey: "media/media-1/raw.mp4",
    sizeBytes: 10,
    status: "Ready",
    canonicalStorageKey: "media/media-1/canonical.mp4",
    proxyStorageKey: "media/media-1/proxy.mp4",
    thumbnailStorageKey: null,
    errorMessage: null,
    durationSeconds: 30,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    createdAt: "2026-07-06T00:00:00.000Z",
    isFavorite: false,
    pipeline: { stage: "ready", label: "Ready", detail: "Ready.", step: 4, stepCount: 4, terminal: true },
  };
}

function projectMedia(overrides: Partial<ProjectMediaDto> = {}): ProjectMediaDto {
  return {
    mediaId: "media-1",
    kind: MediaKind.Video,
    availability: "available",
    filename: "Interview.mp4",
    ownerId: "owner-1",
    ownerKind: OwnerKind.User,
    status: "Ready",
    storageKey: "media/media-1/raw.mp4",
    sizeBytes: 10,
    canonicalStorageKey: "media/media-1/canonical.mp4",
    proxyStorageKey: "media/media-1/proxy.mp4",
    thumbnailStorageKey: null,
    errorMessage: null,
    durationSeconds: 30,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    createdAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

void main();
