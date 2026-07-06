import assert from "node:assert/strict";

import {
  applyVideoOperation,
  applyVideoOperationBatch,
  coalesceVideoOperationBatch,
  createVideoOperationBatch,
  type AddAudioItemOperation,
  type AddMediaToTimelineOperation,
  type AddTextItemOperation,
  type DeleteItemOperation,
  type MoveItemOperation,
  type ReorderItemOperation,
  type SetProjectSettingsOperation,
  type SplitItemOperation,
  type TrimItemOperation,
  type UpdateAudioOperation,
  type UpdateSpeedOperation,
  type UpdateTextOperation,
  type UpdateTrackOperation,
  type UpdateTransformCropOperation,
  type VideoOperation,
  type VideoOperationMetadata,
} from "../app/lib/editor/video-operations";
import {
  createMockVideoProjectDocument,
  type AudioTimelineItem,
  type ImageOverlayTimelineItem,
  type TextTimelineItem,
  type VideoClipTimelineItem,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";

const timestamp = "2026-02-01T10:00:00.000Z";

function main(): void {
  assertOperationSuccesses();
  assertInvalidOperationsAreNonDestructive();
  assertInverseOperationsRestoreSimpleEdits();
  assertCheckpointUndoRules();
  assertCoalescing();
  assertRevisionMetadata();
}

function assertOperationSuccesses(): void {
  const operations: VideoOperation[] = [
    addMediaOperation(),
    addImageOperation(),
    addAudioOperation(),
    addTextOperation(),
    moveOperation(),
    trimOperation(),
    splitOperation(),
    deleteOperation(),
    reorderOperation(),
    updateTrackOperation(),
    updateTextOperation(),
    updateAudioOperation(),
    updateSpeedOperation(),
    updateTransformCropOperation(),
    settingsOperation(),
  ];

  for (const operation of operations) {
    const document = createDocument();
    const result = applyVideoOperation(document, operation);
    assert.equal(result.ok, true, `${operation.type} should succeed: ${result.errors?.join("; ")}`);
    assert.notEqual(result.document, document, `${operation.type} should return a new document`);
    assert.equal(result.document.history.revision, document.history.revision + 1);
    assert.equal(result.document.history.lastOperationId, operation.id);
  }
}

function assertInvalidOperationsAreNonDestructive(): void {
  const missingTrack = applyVideoOperation(createDocument(), {
    ...addMediaOperation(),
    id: "invalid-missing-track",
    trackId: "missing-track",
  });
  assertFailedWithoutMutation(missingTrack, createDocument(), "missing track should fail");

  const missingItem = applyVideoOperation(createDocument(), {
    ...moveOperation(),
    id: "invalid-missing-item",
    itemId: "missing-item",
  });
  assertFailedWithoutMutation(missingItem, createDocument(), "missing item should fail");

  const missingMedia = applyVideoOperation(createDocument(), {
    ...addMediaOperation(),
    id: "invalid-missing-media",
    item: { ...addMediaOperation().item, id: "tl-missing-media", mediaId: "missing-media" },
  });
  assertFailedWithoutMutation(missingMedia, createDocument(), "missing media should fail");

  const incompatibleTrack = applyVideoOperation(createDocument(), {
    ...addAudioOperation(),
    id: "invalid-audio-track",
    trackId: "v1",
  });
  assertFailedWithoutMutation(incompatibleTrack, createDocument(), "audio on video track should fail");

  const incompatibleMedia = applyVideoOperation(createDocument(), {
    ...addMediaOperation(),
    id: "invalid-media-kind",
    item: { ...addMediaOperation().item, id: "tl-audio-as-video", mediaId: "audio-main" },
  });
  assertFailedWithoutMutation(incompatibleMedia, createDocument(), "audio media as video should fail");

  const invalidTiming = applyVideoOperation(createDocument(), {
    ...moveOperation(),
    id: "invalid-timing",
    timelineStart: -1,
  });
  assertFailedWithoutMutation(invalidTiming, createDocument(), "negative timing should fail");

  const invalidSourceRange = applyVideoOperation(createDocument(), {
    ...trimOperation(),
    id: "invalid-source-range",
    sourceOut: 99,
  });
  assertFailedWithoutMutation(invalidSourceRange, createDocument(), "source range outside media should fail");

  const lockedTrack = createDocument();
  lockedTrack.tracks = lockedTrack.tracks.map((track) => track.id === "v1" ? { ...track, locked: true } : track);
  const lockedMove = applyVideoOperation(lockedTrack, moveOperation());
  assertFailedWithoutMutation(lockedMove, lockedTrack, "locked track move should fail");

  const boundarySplitOperation = splitOperation();
  const boundarySplit = applyVideoOperation(createDocument(), {
    ...boundarySplitOperation,
    id: "invalid-boundary-split",
    items: [
      { ...(boundarySplitOperation.items[0] as VideoClipTimelineItem), duration: 0, sourceOut: 0 },
      { ...(boundarySplitOperation.items[1] as VideoClipTimelineItem), timelineStart: 41.4, duration: 25, sourceIn: 0, sourceOut: 25 },
    ],
  });
  assertFailedWithoutMutation(boundarySplit, createDocument(), "split at item boundary should fail");
}

function assertInverseOperationsRestoreSimpleEdits(): void {
  const reversibleOperations: VideoOperation[] = [
    moveOperation(),
    trimOperation(),
    reorderOperation(),
    updateTrackOperation(),
    updateTextOperation(),
    updateAudioOperation(),
    updateSpeedOperation(),
    updateTransformCropOperation(),
    settingsOperation(),
  ];

  for (const operation of reversibleOperations) {
    const document = createDocument();
    const result = applyVideoOperation(document, operation);
    assert.equal(result.ok, true, `${operation.type} should apply`);
    assert.equal(result.undo?.type, "inverseOperations", `${operation.type} should return inverse operations`);

    let restored: VideoProjectDocument = result.document;
    for (const inverseOperation of result.undo.inverseOperations) {
      const inverseResult = applyVideoOperation(restored, inverseOperation);
      assert.equal(inverseResult.ok, true, `${operation.type} inverse should apply: ${inverseResult.errors?.join("; ")}`);
      restored = inverseResult.document;
    }

    assertTimelineAndSettingsEqual(restored, document, `${operation.type} inverse should restore document content`);
  }
}

function assertCheckpointUndoRules(): void {
  const deleteResult = applyVideoOperation(createDocument(), deleteOperation());
  assert.equal(deleteResult.ok, true);
  assert.equal(deleteResult.undo?.type, "checkpoint", "delete should checkpoint");

  const splitResult = applyVideoOperation(createDocument(), splitOperation());
  assert.equal(splitResult.ok, true);
  assert.equal(splitResult.undo?.type, "checkpoint", "split should checkpoint");

  const aiBatch = createVideoOperationBatch({
    id: "ai-batch",
    source: "ai",
    timestamp,
    label: "AI trim",
    commandId: "command-1",
    operations: [{ ...trimOperation(), id: "ai-trim", source: "ai", commandId: "command-1" }],
  });
  const aiResult = applyVideoOperationBatch(createDocument(), aiBatch);
  assert.equal(aiResult.ok, true);
  assert.equal(aiResult.undo?.type, "checkpoint", "AI batch should checkpoint");
  assert.equal(aiResult.document.history.revision, createDocument().history.revision + 1);
  assert.equal(aiResult.document.history.lastOperationId, "ai-batch");
}

function assertCoalescing(): void {
  const document = createDocument();
  const batch = createVideoOperationBatch({
    id: "drag-batch",
    source: "manual",
    timestamp,
    label: "Drag clip",
    operations: [
      { ...moveOperation(), id: "move-1", timelineStart: 8 },
      { ...moveOperation(), id: "move-2", timelineStart: 12 },
      { ...moveOperation(), id: "move-3", timelineStart: 15 },
    ],
  });
  const coalesced = coalesceVideoOperationBatch(batch);
  assert.equal(coalesced.operations.length, 1);
  assert.equal(coalesced.operations[0].type, "moveItem");
  assert.equal(coalesced.operations[0].timelineStart, 15);

  const result = applyVideoOperationBatch(document, batch);
  assert.equal(result.ok, true);
  assert.equal(result.undo?.type, "inverseOperations");
  assert.equal(result.undo.inverseOperations.length, 1);
  const inverse = result.undo.inverseOperations[0];
  assert.equal(inverse.type, "moveItem");
  assert.equal(inverse.timelineStart, 2, "coalesced drag undo should use the first pre-drag state");

  const trimBatch = createVideoOperationBatch({
    id: "trim-batch",
    source: "manual",
    timestamp,
    label: "Trim clip",
    operations: [
      { ...trimOperation(), id: "trim-1", duration: 17, sourceOut: 17 },
      { ...trimOperation(), id: "trim-2", duration: 12, sourceOut: 12 },
    ],
  });
  const coalescedTrim = coalesceVideoOperationBatch(trimBatch);
  assert.equal(coalescedTrim.operations.length, 1);
  assert.equal(coalescedTrim.operations[0].type, "trimItem");
  assert.equal(coalescedTrim.operations[0].duration, 12);
}

function assertRevisionMetadata(): void {
  const document = createDocument();
  const result = applyVideoOperation(document, moveOperation());
  assert.equal(result.ok, true);
  assert.equal(result.document.history.revision, document.history.revision + 1);
  assert.equal(result.document.history.lastOperationId, "move-tl-beach");
  assert.equal(result.document.updatedAt, timestamp);

  const failed = applyVideoOperation(document, { ...moveOperation(), id: "bad-move", timelineStart: -4 });
  assert.equal(failed.ok, false);
  assert.equal(failed.document, document);
  assert.equal(failed.document.history.revision, document.history.revision);
  assert.deepEqual(failed.document, document);

  const imageAdded = applyVideoOperation(createDocument(), addImageOperation());
  assert.equal(imageAdded.ok, true);
  const withOverlayTrack: VideoProjectDocument = {
    ...imageAdded.document,
    tracks: [
      ...imageAdded.document.tracks,
      {
        id: "o1",
        kind: "overlay",
        label: "O1",
        locked: false,
        hidden: false,
        muted: false,
        items: [],
      },
    ],
  };
  const movedAcrossTracks = applyVideoOperation(withOverlayTrack, {
    ...base("move-image-track", "Move image", ["tl-added-image"]),
    type: "moveItem",
    itemId: "tl-added-image",
    timelineStart: 9,
    targetTrackId: "o1",
  });
  assert.equal(movedAcrossTracks.ok, true, movedAcrossTracks.errors?.join("; "));
  assert.equal(movedAcrossTracks.document.tracks.find((track) => track.id === "o1")?.items[0]?.id, "tl-added-image");
}

function createDocument(): VideoProjectDocument {
  const document = createMockVideoProjectDocument("operation-test", "Operation Test");
  document.media["still-poster"] = {
    id: "still-poster",
    kind: "image",
    name: "Poster",
    width: 1920,
    height: 1080,
  };
  return document;
}

function base(id: string, label: string, affectedEntityIds: string[]): VideoOperationMetadata {
  return {
    id,
    source: "manual",
    timestamp,
    label,
    affectedEntityIds,
  };
}

function addMediaOperation(): AddMediaToTimelineOperation {
  const item: VideoClipTimelineItem = {
    id: "tl-added-video",
    type: "video",
    mediaId: "clip-city",
    timelineStart: 70,
    duration: 8,
    sourceIn: 2,
    sourceOut: 10,
    speed: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    opacity: 1,
  };
  return { ...base("add-video", "Add video", [item.id]), type: "addMediaToTimeline", trackId: "v1", item };
}

function addImageOperation(): AddMediaToTimelineOperation {
  const item: ImageOverlayTimelineItem = {
    id: "tl-added-image",
    type: "image",
    mediaId: "still-poster",
    timelineStart: 6,
    duration: 4,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 0.9,
    layerOrder: 11,
  };
  return { ...base("add-image", "Add image", [item.id]), type: "addMediaToTimeline", trackId: "v1", item };
}

function addAudioOperation(): AddAudioItemOperation {
  const item: AudioTimelineItem = {
    id: "tl-added-audio",
    type: "audio",
    mediaId: "audio-music",
    timelineStart: 4,
    duration: 6,
    sourceIn: 1,
    sourceOut: 7,
    volume: 0.8,
    muted: false,
    fades: { fadeInDuration: 0.2, fadeOutDuration: 0.2 },
  };
  return { ...base("add-audio", "Add audio", [item.id]), type: "addAudioItem", trackId: "a1", item };
}

function addTextOperation(): AddTextItemOperation {
  const item: TextTimelineItem = {
    id: "tl-added-text",
    type: "text",
    timelineStart: 1,
    duration: 3,
    text: "New title",
    style: { fontFamily: "Inter", fontSize: 36, color: "#ffffff" },
    transform: { x: 0, y: 120, scaleX: 1, scaleY: 1, rotation: 0 },
    layerOrder: 12,
  };
  return { ...base("add-text", "Add text", [item.id]), type: "addTextItem", trackId: "t1", item };
}

function moveOperation(): MoveItemOperation {
  return { ...base("move-tl-beach", "Move beach", ["tl-beach"]), type: "moveItem", itemId: "tl-beach", timelineStart: 10 };
}

function trimOperation(): TrimItemOperation {
  return {
    ...base("trim-tl-beach", "Trim beach", ["tl-beach"]),
    type: "trimItem",
    itemId: "tl-beach",
    edge: "end",
    timelineStart: 2,
    duration: 10,
    sourceIn: 0,
    sourceOut: 10,
  };
}

function splitOperation(): SplitItemOperation {
  return {
    ...base("split-tl-mountain", "Split mountain", ["tl-mountain", "tl-mountain-a", "tl-mountain-b"]),
    type: "splitItem",
    itemId: "tl-mountain",
    items: [
      {
        id: "tl-mountain-a",
        type: "video",
        mediaId: "clip-mountain",
        timelineStart: 41.4,
        duration: 10,
        sourceIn: 0,
        sourceOut: 10,
        speed: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        opacity: 1,
      },
      {
        id: "tl-mountain-b",
        type: "video",
        mediaId: "clip-mountain",
        timelineStart: 51.4,
        duration: 15,
        sourceIn: 10,
        sourceOut: 25,
        speed: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        opacity: 1,
      },
    ],
  };
}

function deleteOperation(): DeleteItemOperation {
  return { ...base("delete-caption", "Delete caption", ["tl-caption"]), type: "deleteItem", itemIds: ["tl-caption"] };
}

function reorderOperation(): ReorderItemOperation {
  return { ...base("reorder-city", "Reorder city", ["tl-city"]), type: "reorderItem", itemId: "tl-city", targetIndex: 0 };
}

function updateTrackOperation(): UpdateTrackOperation {
  return {
    ...base("update-track", "Update track", ["v1"]),
    type: "updateTrack",
    trackId: "v1",
    trackLabel: "Main Video",
    hidden: true,
    muted: false,
  };
}

function updateTextOperation(): UpdateTextOperation {
  return { ...base("update-caption", "Update caption", ["tl-caption"]), type: "updateText", itemId: "tl-caption", text: "Updated caption" };
}

function updateAudioOperation(): UpdateAudioOperation {
  return {
    ...base("update-audio", "Update audio", ["tl-audio-main"]),
    type: "updateAudio",
    itemId: "tl-audio-main",
    volume: 0.45,
    muted: true,
  };
}

function updateSpeedOperation(): UpdateSpeedOperation {
  return {
    ...base("update-speed", "Update speed", ["tl-city"]),
    type: "updateSpeed",
    itemId: "tl-city",
    speed: 1.5,
    duration: 12,
    sourceOut: 16,
  };
}

function updateTransformCropOperation(): UpdateTransformCropOperation {
  return {
    ...base("update-transform", "Update transform", ["tl-beach"]),
    type: "updateTransformCrop",
    itemId: "tl-beach",
    transform: { x: 20, y: 10, scaleX: 1.2, scaleY: 1.2, rotation: 3 },
    crop: { top: 0.1, right: 0, bottom: 0, left: 0 },
    opacity: 0.85,
  };
}

function settingsOperation(): SetProjectSettingsOperation {
  return {
    ...base("settings", "Update settings", ["operation-test"]),
    type: "setProjectSettings",
    settings: { previewQuality: "full", frameRate: 24 },
  };
}

function assertFailedWithoutMutation(
  result: ReturnType<typeof applyVideoOperation>,
  expectedDocument: VideoProjectDocument,
  message: string,
): void {
  assert.equal(result.ok, false, message);
  assert.deepEqual(result.document, expectedDocument, message);
  assert.equal(result.document.history.revision, expectedDocument.history.revision, message);
}

function assertTimelineAndSettingsEqual(actual: VideoProjectDocument, expected: VideoProjectDocument, message: string): void {
  assert.deepEqual(actual.settings, expected.settings, message);
  assert.deepEqual(actual.media, expected.media, message);
  assert.deepEqual(actual.tracks, expected.tracks, message);
  assert.deepEqual(actual.transitions, expected.transitions, message);
  assert.deepEqual(actual.effects, expected.effects, message);
}

main();
