import assert from "node:assert/strict";

import {
  choosePreviewObjectUrl,
  computeFrameBounds,
  computeSafeGuides,
  createProgramMonitorPlan,
  stepPreviewTime,
  timelineTimeToMediaSourceTime,
} from "../app/lib/editor/editor-preview";
import {
  createMockVideoProjectDocument,
  type AudioTimelineItem,
  type ImageOverlayTimelineItem,
  type TextTimelineItem,
  type VideoClipTimelineItem,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";

function main(): void {
  assertActiveVideoClipResolvesAtPlayhead();
  assertTrimAndSpeedMapToSourceTime();
  assertActiveAudioPlansResolveAndMixAtPlayhead();
  assertAudioSoloMuteAndFadePlanning();
  assertImageAndTextOverlaysResolveInActiveRange();
  assertProxyUrlIsPreferred();
  assertMissingMediaReturnsWarningState();
  assertFrameStepClampsAtTimelineEdges();
  assertFrameBoundsAndSafeGuidesAreComputed();
}

function assertActiveAudioPlansResolveAndMixAtPlayhead(): void {
  const base = withPreviewUrls(createMockVideoProjectDocument("preview", "Preview"));
  const standalone: AudioTimelineItem = {
    id: "tl-standalone-music",
    type: "audio",
    mediaId: "audio-music",
    timelineStart: 7,
    duration: 6,
    sourceIn: 2,
    sourceOut: 8,
    volume: 0.5,
    muted: false,
    fades: { fadeInDuration: 0, fadeOutDuration: 0 },
  };
  const audioTrack = base.tracks.find((track) => track.id === "a1");
  assert.ok(audioTrack);
  const document: VideoProjectDocument = {
    ...base,
    tracks: base.tracks.map((track) =>
      track.id === "a1" ? { ...track, items: [...track.items, standalone] } : track,
    ),
  };

  const plan = createProgramMonitorPlan({ document, currentTime: 8, previewVolume: 0.8 });
  assert.deepEqual(plan.activeAudio.map((audio) => audio.item.id), ["tl-audio-main", "tl-standalone-music"]);
  assert.equal(plan.primaryAudio?.item.id, "tl-audio-main");

  const linked = plan.activeAudio.find((audio) => audio.item.id === "tl-audio-main");
  const music = plan.activeAudio.find((audio) => audio.item.id === "tl-standalone-music");
  assert.equal(linked?.role, "linked");
  assert.equal(music?.role, "standalone");
  assert.equal(linked?.trackId, "a1");
  assert.equal(linked?.sourceTime, 6);
  assert.equal(music?.sourceTime, 3);
  assert.equal(music?.effectiveVolume, 0.4);
}

function assertAudioSoloMuteAndFadePlanning(): void {
  const base = withPreviewUrls(createMockVideoProjectDocument("preview", "Preview"));
  const fadeItem: AudioTimelineItem = {
    id: "tl-fade",
    type: "audio",
    mediaId: "audio-music",
    timelineStart: 5,
    duration: 10,
    sourceIn: 0,
    sourceOut: 10,
    volume: 0.8,
    muted: false,
    fades: { fadeInDuration: 2, fadeOutDuration: 4 },
  };
  const document: VideoProjectDocument = {
    ...base,
    tracks: [
      ...base.tracks,
      {
        id: "a2",
        kind: "audio",
        label: "A2",
        locked: false,
        hidden: false,
        muted: false,
        items: [fadeItem],
      },
    ],
  };

  const fadingIn = createProgramMonitorPlan({ document, currentTime: 6, previewVolume: 0.5, soloedAudioTrackIds: ["a2"] });
  assert.equal(fadingIn.activeAudio.length, 1);
  assert.equal(fadingIn.activeAudio[0].item.id, "tl-fade");
  assert.equal(fadingIn.activeAudio[0].fadeGain, 0.5);
  assert.equal(fadingIn.activeAudio[0].effectiveVolume, 0.2);

  const fadingOut = createProgramMonitorPlan({ document, currentTime: 13, previewVolume: 1, soloedAudioTrackIds: ["a2"] });
  assert.equal(fadingOut.activeAudio[0].fadeGain, 0.5);
  assert.equal(fadingOut.activeAudio[0].effectiveVolume, 0.4);

  const muted = createProgramMonitorPlan({ document, currentTime: 6, previewMuted: true, soloedAudioTrackIds: ["a2"] });
  assert.equal(muted.activeAudio[0].muted, true);
}

function assertActiveVideoClipResolvesAtPlayhead(): void {
  const document = withPreviewUrls(createMockVideoProjectDocument("preview", "Preview"));
  const plan = createProgramMonitorPlan({ document, currentTime: 8, previewQuality: "balanced" });

  assert.equal(plan.activeVisual?.item.id, "tl-beach");
  assert.equal(plan.activeVisual?.media.id, "clip-beach");
  assert.equal(plan.activeVisual?.objectUrl, "/bff/media/clip-beach/object/proxy?v=clip-beach-proxy");
  assert.equal(plan.activeVisual?.sourceTime, 6);
}

function assertTrimAndSpeedMapToSourceTime(): void {
  const item: VideoClipTimelineItem = {
    id: "speedy",
    type: "video",
    mediaId: "clip-beach",
    timelineStart: 10,
    duration: 6,
    sourceIn: 4,
    sourceOut: 16,
    speed: 2,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    opacity: 1,
  };

  assert.equal(timelineTimeToMediaSourceTime(item, 13), 10);
  assert.equal(timelineTimeToMediaSourceTime(item, 20), 16);
}

function assertImageAndTextOverlaysResolveInActiveRange(): void {
  const imageItem: ImageOverlayTimelineItem = {
    id: "tl-logo",
    type: "overlay",
    mediaId: "image-logo",
    timelineStart: 5,
    duration: 5,
    transform: { x: 420, y: -280, scaleX: 0.5, scaleY: 0.5, rotation: 0 },
    opacity: 1,
    layerOrder: 20,
  };
  const textItem: TextTimelineItem = {
    id: "tl-title",
    type: "text",
    timelineStart: 6,
    duration: 4,
    text: "Launch",
    style: {
      fontFamily: "Inter",
      fontSize: 52,
      color: "#ffffff",
      backgroundColor: "#000000",
      textAlign: "center",
    },
    transform: { x: 0, y: 260, scaleX: 1, scaleY: 1, rotation: 0 },
    layerOrder: 30,
  };
  const base = withPreviewUrls(createMockVideoProjectDocument("preview", "Preview"));
  const document: VideoProjectDocument = {
    ...base,
    media: {
      ...base.media,
      "image-logo": {
        id: "image-logo",
        kind: "image",
        name: "logo.png",
        width: 800,
        height: 450,
        objectUrls: {
          proxy: "/bff/media/image-logo/object/proxy?v=logo-proxy",
        },
      },
    },
    tracks: [
      ...base.tracks,
      {
        id: "ov1",
        kind: "overlay",
        label: "OV1",
        locked: false,
        hidden: false,
        muted: false,
        items: [imageItem, textItem],
      },
    ],
  };

  const plan = createProgramMonitorPlan({ document, currentTime: 7 });
  assert.deepEqual(
    plan.overlays.map((overlay) => overlay.item.id),
    ["tl-caption", "tl-logo", "tl-title"],
  );
  const titleOverlay = plan.overlays.find((overlay) => overlay.item.id === "tl-title");
  assert.equal(titleOverlay?.kind, "text");
  assert.equal(titleOverlay?.kind === "text" ? titleOverlay.item.style.backgroundColor : undefined, "#000000");

  const beforeOverlays = createProgramMonitorPlan({ document, currentTime: 4 });
  assert.deepEqual(beforeOverlays.overlays.map((overlay) => overlay.item.id), []);

  const afterTitle = createProgramMonitorPlan({ document, currentTime: 10 });
  assert.equal(afterTitle.overlays.some((overlay) => overlay.item.id === "tl-title"), false);
}

function assertProxyUrlIsPreferred(): void {
  const media = {
    id: "media-1",
    kind: "video" as const,
    name: "media.mp4",
    objectUrls: {
      proxy: "/bff/media/media-1/object/proxy?v=proxy",
      canonical: "/bff/media/media-1/object/canonical?v=canonical",
      raw: "/bff/media/media-1/object/raw?v=raw",
    },
  };

  assert.deepEqual(choosePreviewObjectUrl(media, "balanced"), {
    url: "/bff/media/media-1/object/proxy?v=proxy",
    variant: "proxy",
  });
}

function assertMissingMediaReturnsWarningState(): void {
  const document = createMockVideoProjectDocument("preview", "Preview");
  const firstTrack = document.tracks[0];
  const firstItem = firstTrack?.items[0];
  assert.ok(firstTrack);
  assert.ok(firstItem?.type === "video");

  const missing: VideoProjectDocument = {
    ...document,
    tracks: [
      {
        ...firstTrack,
        items: [{ ...firstItem, mediaId: "missing-media" }],
      },
      ...document.tracks.slice(1),
    ],
  };
  const plan = createProgramMonitorPlan({ document: missing, currentTime: 8 });

  assert.equal(plan.activeVisual, null);
  assert.ok(plan.warnings.some((warning) => warning.code === "missing-media" && warning.mediaId === "missing-media"));
}

function assertFrameStepClampsAtTimelineEdges(): void {
  assert.equal(stepPreviewTime({ currentTime: 0, direction: -1, frameRate: 30, timelineDuration: 10 }), 0);
  assert.equal(stepPreviewTime({ currentTime: 10, direction: 1, frameRate: 30, timelineDuration: 10 }), 10);
  assert.equal(stepPreviewTime({ currentTime: 1, direction: 1, frameRate: 25, timelineDuration: 10 }), 1.04);
}

function assertFrameBoundsAndSafeGuidesAreComputed(): void {
  const frame = computeFrameBounds(800, 600, 1920, 1080);
  assert.equal(frame.width, 800);
  assert.equal(frame.height, 450);
  assert.equal(frame.y, 75);

  const guides = computeSafeGuides(frame);
  assert.equal(guides.length, 2);
  assert.equal(guides[0].x, 40);
  assert.equal(guides[1].x, 80);
}

function withPreviewUrls(document: VideoProjectDocument): VideoProjectDocument {
  return {
    ...document,
    media: Object.fromEntries(
      Object.entries(document.media).map(([id, media]) => [
        id,
        {
          ...media,
          objectUrls: {
            proxy: `/bff/media/${id}/object/proxy?v=${id}-proxy`,
            canonical: `/bff/media/${id}/object/canonical?v=${id}-canonical`,
            raw: `/bff/media/${id}/object/raw?v=${id}-raw`,
          },
        },
      ]),
    ),
  };
}

main();
