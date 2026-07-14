import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LARGE_TIMELINE_ITEM_THRESHOLD,
  LARGE_TIMELINE_TRACK_THRESHOLD,
  computeTimelineContentSize,
  countTimelineItems,
  createItemLayouts,
  createTimelineLayoutWindow,
  createTrackLayouts,
  hitTestTimeline,
  marqueeSelectItems,
  timelineScale,
} from "../app/lib/editor/editor-timeline";
import {
  sanitizeVideoEditorPerformanceBatch,
  sanitizeVideoEditorPerformanceMetric,
  type VideoEditorPerformanceMetric,
} from "../app/lib/editor/video-performance.client";
import {
  createEmptyVideoProjectDocument,
  createMockVideoProjectDocument,
  type VideoClipTimelineItem,
  type VideoProjectDocument,
  type VideoTrack,
} from "../app/lib/editor/video-document";
import { readWorkspaceFile, warnSkippedWorkspaceAssertion } from "./workspace-paths";

function main(): void {
  assertSmallTimelineRendersFully();
  assertLargeTimelineWindowsItemsAndTracks();
  assertMetricSanitization();
  assertTelemetryPayloadShape();
  assertProxyAndApiMarkers();
  assertBoundedHistoryAndCacheMarkers();
  assertPreviewLifecycleMarkers();
}

function assertSmallTimelineRendersFully(): void {
  const document = createMockVideoProjectDocument("small-performance", "Small Performance");
  const scale = timelineScale(50);
  const tracks = createTrackLayouts(document);
  const items = createItemLayouts(document, scale);
  const contentSize = computeTimelineContentSize({ document, scale });
  const window = createTimelineLayoutWindow({
    document,
    trackLayouts: tracks,
    itemLayouts: items,
    viewport: { scrollLeft: 100, scrollTop: 40, width: 320, height: 160 },
    scale,
    contentSize,
  });

  assert.equal(window.windowed, false);
  assert.equal(window.itemLayouts.length, items.length);
  assert.equal(window.trackLayouts.length, tracks.length);
  assert.deepEqual(window.contentSize, contentSize);
}

function assertLargeTimelineWindowsItemsAndTracks(): void {
  const document = largeTimelineDocument();
  assert.ok(countTimelineItems(document) > LARGE_TIMELINE_ITEM_THRESHOLD);
  assert.ok(document.tracks.length > LARGE_TIMELINE_TRACK_THRESHOLD);

  const scale = timelineScale(60);
  const tracks = createTrackLayouts(document);
  const items = createItemLayouts(document, scale);
  const contentSize = computeTimelineContentSize({ document, scale });
  const visibleTarget = items.find((layout) => layout.item.id === "large-v10-i10");
  const overscanTarget = items.find((layout) => layout.item.id === "large-v10-i2");
  assert.ok(visibleTarget);
  assert.ok(overscanTarget);

  const window = createTimelineLayoutWindow({
    document,
    trackLayouts: tracks,
    itemLayouts: items,
    viewport: {
      scrollLeft: visibleTarget.left - 40,
      scrollTop: visibleTarget.top - 20,
      width: 360,
      height: 120,
    },
    scale,
    contentSize,
  });

  assert.equal(window.windowed, true);
  assert.ok(window.itemLayouts.length < items.length);
  assert.ok(window.trackLayouts.length < tracks.length);
  assert.ok(window.itemLayouts.some((layout) => layout.item.id === visibleTarget.item.id));
  assert.ok(window.itemLayouts.some((layout) => layout.item.id === overscanTarget.item.id));
  assert.equal(window.contentSize.width, contentSize.width);
  assert.equal(window.contentSize.height, contentSize.height);

  const hit = hitTestTimeline(visibleTarget.left + 4, visibleTarget.top + 6, tracks, window.itemLayouts);
  assert.equal(hit.itemId, visibleTarget.item.id);
  assert.equal(hit.edge, "start");

  const selected = marqueeSelectItems(window.itemLayouts, {
    left: visibleTarget.left - 2,
    top: visibleTarget.top - 2,
    width: visibleTarget.width + 4,
    height: visibleTarget.height + 4,
  });
  assert.ok(selected.includes(visibleTarget.item.id));
}

function assertMetricSanitization(): void {
  const valid = sanitizeVideoEditorPerformanceMetric({
    name: "timeline-drag-latency",
    durationMs: 12.34567,
    measuredAt: "2026-07-07T00:00:00.000Z",
    trackCount: 4,
    itemCount: 40,
    renderedItemCount: 12,
    timelineDurationSeconds: 92.1234,
  });
  assert.equal(valid?.durationMs, 12.346);
  assert.equal(valid?.timelineDurationSeconds, 92.123);

  assert.equal(sanitizeVideoEditorPerformanceMetric({
    name: "unknown" as VideoEditorPerformanceMetric["name"],
    durationMs: 1,
  }), null);
  assert.equal(sanitizeVideoEditorPerformanceMetric({
    name: "editor-open",
    durationMs: -1,
  }), null);
  assert.equal(sanitizeVideoEditorPerformanceMetric({
    name: "editor-open",
    durationMs: Number.POSITIVE_INFINITY,
  }), null);
  assert.deepEqual(sanitizeVideoEditorPerformanceBatch(Array.from({ length: 51 }, () => ({
    name: "editor-open",
    durationMs: 1,
  }))), []);
}

function assertTelemetryPayloadShape(): void {
  const source = readFileSync("app/lib/editor/video-performance.client.ts", "utf8");
  assert.doesNotMatch(source, /setTimeout|setInterval/);
  assert.match(source, /flushVideoEditorPerformanceMetrics/);

  const metric = sanitizeVideoEditorPerformanceMetric({
    name: "first-usable-editor",
    durationMs: 44,
    measuredAt: "2026-07-07T00:00:00.000Z",
    trackCount: 3,
    itemCount: 8,
    renderedItemCount: 8,
    timelineDurationSeconds: 66,
  });
  assert.ok(metric);
  const payload = JSON.stringify({ metrics: [metric] });
  for (const forbidden of ["mediaUrl", "filename", "commandText", "jwt", "storageKey", "/bff/media/"]) {
    assert.equal(payload.includes(forbidden), false);
  }
}

function assertProxyAndApiMarkers(): void {
  const proxy = readFileSync("server/proxy.mjs", "utf8");
  assert.match(proxy, /parseTimelinePerformanceRoute/);
  assert.match(proxy, /\\\/bff\\\/timelines\\\/projects\\\/\(\[\^\/\]\+\)\\\/performance/);
  assert.match(proxy, /\/api\/timelines\/projects\/\$\{match\[1\]\}\/performance/);

  const controller = readWorkspaceFile("kuvox_api", "Modules/Timelines/Controllers/TimelinesController.cs");
  const service = readWorkspaceFile("kuvox_api", "Modules/Timelines/Services/TimelineService.cs");
  const dtos = readWorkspaceFile("kuvox_api", "Modules/Timelines/Dtos/TimelineDtos.cs");
  if (!controller || !service || !dtos) {
    warnSkippedWorkspaceAssertion("timeline performance API markers", "kuvox_api");
    return;
  }

  assert.match(controller, /HttpPost\("projects\/\{projectId:guid\}\/performance"\)/);
  assert.match(service, /RequireReadAccessAsync\(projectId, caller/);
  assert.match(service, /VideoEditorPerformanceMetric/);
  assert.match(service, /LogInformation/);
  assert.doesNotMatch(service, /UserId=\{UserId\}/);
  assert.match(dtos, /RecordVideoEditorPerformanceRequest/);
  assert.match(dtos, /VideoEditorPerformanceMetricDto/);
}

function assertBoundedHistoryAndCacheMarkers(): void {
  const editorState = readFileSync("app/store/slices/editor-slice.ts", "utf8");
  assert.match(editorState, /const maxVideoHistoryFrames = 50/);
  assert.match(editorState, /next\.length > maxVideoHistoryFrames/);

  const workspace = readFileSync("app/components/editor/video-editor-workspace.tsx", "utf8");
  assert.match(workspace, /operationLogLimit: 500/);
  assert.match(workspace, /undoCheckpointLimit: 20/);
}

function assertPreviewLifecycleMarkers(): void {
  const preview = readFileSync("app/components/editor/panels/preview-panel.tsx", "utf8");
  assert.match(preview, /plan\??\.activeVisual/);
  assert.match(preview, /plan\??\.activeAudio\.filter/);
  assert.match(preview, /decodedImageCache/);
  assert.doesNotMatch(preview, /revokeObjectURL\([^)]*\/bff\/media/);
}

function largeTimelineDocument(): VideoProjectDocument {
  const document = createEmptyVideoProjectDocument({ id: "large-performance", name: "Large Performance" });
  const media = {
    "clip-large": {
      id: "clip-large",
      kind: "video" as const,
      name: "large.mp4",
      duration: 600,
      width: 1920,
      height: 1080,
      objectUrls: {
        proxy: "/bff/media/clip-large/object/proxy?v=large-proxy",
      },
    },
  };
  const tracks: VideoTrack[] = Array.from({ length: LARGE_TIMELINE_TRACK_THRESHOLD + 5 }, (_, trackIndex) => ({
    id: `large-v${trackIndex}`,
    kind: "video",
    label: `V${trackIndex}`,
    locked: false,
    hidden: false,
    muted: false,
    items: Array.from({ length: 18 }, (_, itemIndex): VideoClipTimelineItem => ({
      id: `large-v${trackIndex}-i${itemIndex}`,
      type: "video",
      mediaId: "clip-large",
      timelineStart: itemIndex * 3,
      duration: 1.5,
      sourceIn: 0,
      sourceOut: 1.5,
      speed: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      opacity: 1,
    })),
  }));

  return {
    ...document,
    media,
    tracks,
  };
}

main();
