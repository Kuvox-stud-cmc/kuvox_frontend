import assert from "node:assert/strict";

import { MediaKind, OwnerKind, type MediaDto } from "../app/lib/api";
import {
  buildSplitOperation,
  buildTrimPlan,
  createItemLayouts,
  createTrackLayouts,
  expandLinkedItemIds,
  hitTestTimeline,
  marqueeSelectItems,
  pixelToTime,
  planMediaDrop,
  selectRangeWithinTrack,
  snapTime,
  timelineScale,
  timeToPixel,
} from "../app/lib/editor/editor-timeline";
import {
  applyVideoOperation,
  type DeleteItemOperation,
  type MoveItemOperation,
  type VideoOperationMetadata,
} from "../app/lib/editor/video-operations";
import { createMockVideoProjectDocument, type AudioTimelineItem, type TextTimelineItem, type VideoClipTimelineItem } from "../app/lib/editor/video-document";

const timestamp = "2026-03-01T12:00:00.000Z";

function main(): void {
  assertScaleConversions();
  assertLayoutAndHitTesting();
  assertSnapping();
  assertDropPlanning();
  assertTrimMath();
  assertSplitCreation();
  assertTextItemsUseTimelineOperations();
  assertLinkedExpansion();
  assertMarqueeAndRangeSelection();
}

function assertTextItemsUseTimelineOperations(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const textItem = document.tracks.find((track) => track.id === "t1")?.items[0] as TextTimelineItem | undefined;
  assert.ok(textItem);

  const move: MoveItemOperation = {
    ...metadata("move-text", "Move text", [textItem.id]),
    type: "moveItem",
    itemId: textItem.id,
    timelineStart: 12,
  };
  const moved = applyVideoOperation(document, move);
  assert.equal(moved.ok, true, moved.errors?.join("; "));
  const movedText = moved.document.tracks.find((track) => track.id === "t1")?.items.find((item) => item.id === textItem.id);
  assert.equal(movedText?.timelineStart, 12);

  const trim = buildTrimPlan({
    item: textItem,
    edge: "end",
    pointerTime: 9,
    frameRate: 30,
  });
  assert.ok(trim);
  assert.equal(trim.operation.sourceIn, undefined);
  assert.equal(trim.operation.sourceOut, undefined);
  const trimmed = applyVideoOperation(document, {
    ...metadata("trim-text", "Trim text", [textItem.id]),
    ...trim.operation,
  });
  assert.equal(trimmed.ok, true, trimmed.errors?.join("; "));

  const split = buildSplitOperation({
    item: textItem,
    playheadTime: 9,
    frameRate: 30,
    metadata: metadata("split-text", "Split text", [textItem.id]),
  });
  assert.ok(split);
  assert.equal(split.items[0].type, "text");
  assert.equal(split.items[1].type, "text");
  const splitResult = applyVideoOperation(document, split);
  assert.equal(splitResult.ok, true, splitResult.errors?.join("; "));

  const deleteText: DeleteItemOperation = {
    ...metadata("delete-text", "Delete text", [textItem.id]),
    type: "deleteItem",
    itemIds: [textItem.id],
  };
  const deleted = applyVideoOperation(document, deleteText);
  assert.equal(deleted.ok, true, deleted.errors?.join("; "));
  assert.equal(deleted.document.tracks.find((track) => track.id === "t1")?.items.length, 0);
}

function assertScaleConversions(): void {
  const scale = timelineScale(50);
  assert.equal(pixelToTime(timeToPixel(12.5, scale), scale), 12.5);
  assert.ok(timelineScale(1).pixelsPerSecond < timelineScale(100).pixelsPerSecond);
}

function assertLayoutAndHitTesting(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const scale = timelineScale(50);
  const tracks = createTrackLayouts(document);
  const items = createItemLayouts(document, scale);
  const beach = items.find((item) => item.item.id === "tl-beach");
  assert.ok(beach);
  assert.equal(beach.trackId, "v1");

  const hit = hitTestTimeline(beach.left + 12, beach.top + 8, tracks, items);
  assert.equal(hit.itemId, "tl-beach");
  assert.equal(hit.edge, "body");

  const startHit = hitTestTimeline(beach.left + 1, beach.top + 8, tracks, items);
  assert.equal(startHit.edge, "start");
}

function assertSnapping(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const scale = timelineScale(80);
  const nearPlayhead = snapTime({
    time: 10.04,
    document,
    playheadTime: 10,
    enabled: true,
    scale,
  });
  assert.equal(nearPlayhead.snapped, true);
  assert.equal(nearPlayhead.time, 10);

  const disabled = snapTime({
    time: 10.04,
    document,
    playheadTime: 10,
    enabled: false,
    scale,
  });
  assert.equal(disabled.snapped, false);
  assert.equal(disabled.time, 10.04);
}

function assertDropPlanning(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const videoDrop = planMediaDrop({
    document,
    media: mediaDto({ id: "video", kind: MediaKind.Video }),
    trackId: "v1",
    timelineStart: 4,
  });
  assert.equal(videoDrop.ok, true);
  if (videoDrop.ok) {
    assert.equal(videoDrop.placement.trackId, "v1");
    assert.equal(videoDrop.placement.timelineStart, 4);
  }

  const audioOnVideo = planMediaDrop({
    document,
    media: mediaDto({ id: "audio", kind: MediaKind.Audio }),
    trackId: "v1",
    timelineStart: 4,
  });
  assert.equal(audioOnVideo.ok, true, "drop planning should fall back to a compatible audio track");
  if (audioOnVideo.ok) assert.equal(audioOnVideo.placement.trackId, "a1");

  const locked = {
    ...document,
    tracks: document.tracks.map((track) => track.kind === "audio" ? { ...track, locked: true } : track),
  };
  const lockedAudio = planMediaDrop({
    document: locked,
    media: mediaDto({ id: "audio", kind: MediaKind.Audio }),
    trackId: "a1",
    timelineStart: 4,
  });
  assert.equal(lockedAudio.ok, false);
}

function assertTrimMath(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const item = document.tracks[0].items[0];
  const startTrim = buildTrimPlan({
    item,
    edge: "start",
    pointerTime: 5,
    frameRate: 30,
    mediaDuration: 32,
  });
  assert.ok(startTrim);
  assert.equal(startTrim.operation.timelineStart, 5);
  assert.equal(startTrim.operation.duration, 18);
  assert.equal(startTrim.operation.sourceIn, 3);

  const endTrim = buildTrimPlan({
    item,
    edge: "end",
    pointerTime: 12,
    frameRate: 30,
    mediaDuration: 32,
  });
  assert.ok(endTrim);
  assert.equal(endTrim.operation.duration, 10);
  assert.equal(endTrim.operation.sourceOut, 10);
}

function assertSplitCreation(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const item = document.tracks[0].items[0];
  const split = buildSplitOperation({
    item,
    playheadTime: 8,
    frameRate: 30,
    metadata: {
      id: "split",
      source: "manual",
      timestamp,
      label: "Split",
      affectedEntityIds: [item.id],
    },
  });
  assert.ok(split);
  assert.equal(split.items[0].duration, 6);
  assert.equal(split.items[1].timelineStart, 8);
  assert.equal((split.items[0] as VideoClipTimelineItem).sourceOut, 6);
  assert.equal((split.items[1] as VideoClipTimelineItem).sourceIn, 6);

  const boundary = buildSplitOperation({
    item,
    playheadTime: item.timelineStart,
    frameRate: 30,
    metadata: {
      id: "split-boundary",
      source: "manual",
      timestamp,
      label: "Split",
      affectedEntityIds: [item.id],
    },
  });
  assert.equal(boundary, null);

  const audioItem = document.tracks.find((track) => track.id === "a1")?.items.find((item) => item.id === "tl-audio-bed");
  assert.ok(audioItem?.type === "audio");
  const audioSplit = buildSplitOperation({
    item: audioItem,
    playheadTime: 46.4,
    frameRate: 30,
    metadata: {
      id: "split-audio",
      source: "manual",
      timestamp,
      label: "Split audio",
      affectedEntityIds: [audioItem.id],
    },
  });
  assert.ok(audioSplit);
  assert.equal(audioSplit.items[0].type, "audio");
  assert.equal(audioSplit.items[1].type, "audio");
  assert.equal((audioSplit.items[0] as AudioTimelineItem).sourceOut, 5);
  assert.equal((audioSplit.items[1] as AudioTimelineItem).sourceIn, 5);
}

function assertLinkedExpansion(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  assert.deepEqual(expandLinkedItemIds(document, ["tl-beach"], true).sort(), ["tl-audio-main", "tl-beach"].sort());
  assert.deepEqual(expandLinkedItemIds(document, ["tl-beach"], false), ["tl-beach"]);
}

function assertMarqueeAndRangeSelection(): void {
  const document = createMockVideoProjectDocument("timeline", "Timeline");
  const scale = timelineScale(50);
  const items = createItemLayouts(document, scale);
  const beach = items.find((item) => item.item.id === "tl-beach");
  assert.ok(beach);
  const selected = marqueeSelectItems(items, {
    left: beach.left - 2,
    top: beach.top - 2,
    width: beach.width + 4,
    height: beach.height + 4,
  });
  assert.ok(selected.includes("tl-beach"));

  assert.deepEqual(selectRangeWithinTrack(document, "tl-beach", "tl-city"), ["tl-beach", "tl-city"]);
}

function mediaDto(overrides: Partial<MediaDto> = {}): MediaDto {
  return {
    id: "media",
    ownerId: "user-1",
    ownerKind: OwnerKind.User,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: MediaKind.Video,
    filename: "media.mp4",
    storageKey: "raw",
    canonicalStorageKey: null,
    proxyStorageKey: "proxy",
    thumbnailStorageKey: null,
    sizeBytes: 10,
    durationSeconds: 10,
    width: 1920,
    height: 1080,
    status: "Ready",
    errorMessage: null,
    createdAt: timestamp,
    codec: null,
    frameRate: null,
    isFavorite: false,
    pipeline: {
      stage: "ready",
      label: "Ready",
      detail: "Ready",
      step: 1,
      stepCount: 1,
      terminal: true,
    },
    ...overrides,
  };
}

function metadata(id: string, label: string, affectedEntityIds: string[]): VideoOperationMetadata {
  return {
    id,
    source: "manual",
    timestamp,
    label,
    affectedEntityIds,
  };
}

main();
