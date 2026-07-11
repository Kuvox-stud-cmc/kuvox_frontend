import { describe, expect, it } from "vitest";

import {
  compareMediaPreparationRequests,
  createTimelinePreparationRequests,
  mediaPreparationKey,
  selectPreparationBatch,
  type MediaPreparationResourceState,
} from "./media-preparation";
import { createMockVideoProjectDocument } from "./video-document";
import {
  currentTimeChanged,
  editorReducer,
  playbackClockTimeChanged,
  playbackToggled,
  previewBufferingResolved,
  previewBufferingStarted,
} from "~/store/slices/editor-slice";

function resource(
  key: string,
  kind: "image" | "video" | "audio",
  priority: MediaPreparationResourceState["priority"],
  timelineStart: number,
): MediaPreparationResourceState {
  return {
    key,
    mediaId: `media-${key}`,
    kind,
    objectUrl: `/bff/media/media-${key}/object/proxy?v=${key}`,
    sourceTime: 0,
    timelineStart,
    priority,
    status: "queued",
    attempts: 0,
    queuedAt: 0,
  };
}

describe("media preparation planning", () => {
  it("prioritizes insertions, playhead media, the nearby window, then chronology", () => {
    const requests = [
      resource("background", "image", "background", 1),
      resource("nearby", "video", "nearby", 20),
      resource("playhead", "audio", "playhead", 30),
      resource("insert", "video", "insertion", 100),
    ].sort(compareMediaPreparationRequests);

    expect(requests.map((request) => request.key)).toEqual(["insert", "playhead", "nearby", "background"]);
  });

  it("limits total work to four resources and timed decoders to two", () => {
    const selected = selectPreparationBatch([
      resource("v1", "video", "insertion", 0),
      resource("a1", "audio", "playhead", 0),
      resource("v2", "video", "nearby", 0),
      resource("i1", "image", "nearby", 0),
      resource("i2", "image", "background", 0),
    ], { activeCount: 0, activeDecoderCount: 0 });

    expect(selected).toHaveLength(4);
    expect(selected.filter((request) => request.kind !== "image")).toHaveLength(2);
    expect(selected.map((request) => request.key)).toEqual(["v1", "a1", "i1", "i2"]);
  });

  it("deduplicates shared media by kind and versioned preview object URL", () => {
    const document = createMockVideoProjectDocument("preparation-shared");
    document.media["clip-beach"].objectUrls = { proxy: "/bff/media/clip-beach/object/proxy?v=1" };
    const videoTrack = document.tracks.find((track) => track.kind === "video")!;
    videoTrack.items.push({ ...videoTrack.items[0], id: "shared-placement", timelineStart: 12 });

    const requests = createTimelinePreparationRequests({ document, currentTime: 0 });
    const beach = requests.filter((request) => request.mediaId === "clip-beach");
    expect(beach).toHaveLength(1);
    expect(beach[0].key).toBe(mediaPreparationKey(beach[0].kind, beach[0].objectUrl));
  });

  it("reprioritizes the same resource when the playhead enters it", () => {
    const document = createMockVideoProjectDocument("preparation-seek");
    document.media["clip-beach"].objectUrls = { proxy: "/bff/media/clip-beach/object/proxy?v=1" };
    const background = createTimelinePreparationRequests({ document, currentTime: 100 })
      .find((request) => request.mediaId === "clip-beach");
    const active = createTimelinePreparationRequests({ document, currentTime: 3 })
      .find((request) => request.mediaId === "clip-beach");
    expect(background?.priority).toBe("background");
    expect(active?.priority).toBe("playhead");
    expect(active?.key).toBe(background?.key);
  });
});

describe("preview buffering state", () => {
  it("keeps a manual seek stable, blocks clocks, and resumes prior playback intent", () => {
    let state = editorReducer(undefined, { type: "init" });
    state = editorReducer(state, currentTimeChanged(5));
    state = editorReducer(state, playbackToggled());
    state = editorReducer(state, previewBufferingStarted({
      requestedTime: 5,
      requiredResourceKeys: ["video:test"],
      startedAt: 10,
    }));
    expect(state.playback.currentTime).toBe(5);
    expect(state.playback.playing).toBe(false);
    expect(state.previewBuffering.resumeIntent).toBe(true);

    state = editorReducer(state, playbackClockTimeChanged(0));
    expect(state.playback.currentTime).toBe(5);

    state = editorReducer(state, previewBufferingResolved());
    expect(state.playback.currentTime).toBe(5);
    expect(state.playback.playing).toBe(true);
  });
});
