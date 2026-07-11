import assert from "node:assert/strict";

import {
  choosePreviewObjectUrl,
  computeFrameBounds,
  computeCenterOriginMediaGeometry,
  computeMediaBounds,
  computeProjectMediaGeometry,
  computeVisualTransformPreset,
  computeSafeGuides,
  createProgramMonitorPlan,
  mediaSourceTimeToTimelineTime,
  previewDeltaToProjectDelta,
  previewPointToProjectPoint,
  resizeVisualFromOppositeCorner,
  rotationForPointer,
  normalizeRotation,
  snapRotation,
  clampInteractiveHandle,
  applyHandlePointerOffset,
  applyEvaluatedCropTransformDeltasToRaw,
  computeCroppedSourceGeometry,
  cropSourcePixelDensity,
  panCropSourceWindow,
  resizeCropFromOppositeEdge,
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
  assertSourceTimeMapsBackToTimelineTime();
  assertSourceAndTimelineTimeRoundTrip();
  assertActiveAudioPlansResolveAndMixAtPlayhead();
  assertAudioSoloMuteAndFadePlanning();
  assertImageAndTextOverlaysResolveInActiveRange();
  assertTopTrackControlsVisualPriority();
  assertProxyUrlIsPreferred();
  assertMissingMediaReturnsWarningState();
  assertFrameStepClampsAtTimelineEdges();
  assertFrameBoundsAndSafeGuidesAreComputed();
  assertPreviewDeltasConvertToProjectSpace();
  assertVisualTransformGeometry();
  assertVisualTransformPresets();
  assertCropGeometry();
}

function assertCropGeometry(): void {
  const input = {
    projectWidth: 1920,
    projectHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    crop: { top: 0.1, right: 0.2, bottom: 0.15, left: 0.1 },
    transform: { x: 80, y: -40, scaleX: 1.25, scaleY: 1.25, rotation: 27 },
  };
  assert.deepEqual(computeCroppedSourceGeometry(1080, 1920, input.crop), {
    x: 108,
    y: 192,
    width: 756,
    height: 1440,
  });
  const before = computeProjectMediaGeometry(input);
  const density = cropSourcePixelDensity(input);
  const resized = resizeCropFromOppositeEdge({ ...input, edge: "right", pointer: before.center });
  const after = computeProjectMediaGeometry({ ...input, ...resized });
  assert.ok(distance(before.edgeCenters.left, after.edgeCenters.left) < 1e-6);
  assert.ok(Math.abs(cropSourcePixelDensity({ ...input, ...resized }).x - density.x) < 1e-9);
  assert.ok(Math.abs(cropSourcePixelDensity({ ...input, ...resized }).y - density.y) < 1e-9);
  assert.equal(resized.transform.rotation, input.transform.rotation);

  const panned = panCropSourceWindow({ ...input, projectDelta: { x: 120, y: -60 } });
  assert.ok(Math.abs((1 - panned.left - panned.right) - (1 - input.crop.left - input.crop.right)) < 1e-9);
  assert.ok(Math.abs((1 - panned.top - panned.bottom) - (1 - input.crop.top - input.crop.bottom)) < 1e-9);
  assert.ok(panned.left >= 0 && panned.right >= 0 && panned.top >= 0 && panned.bottom >= 0);

  const raw = applyEvaluatedCropTransformDeltasToRaw({
    rawCrop: { top: 0, right: 0, bottom: 0, left: 0 },
    rawTransform: { x: 10, y: 20, scaleX: 2, scaleY: 3, rotation: 27 },
    evaluatedCrop: input.crop,
    evaluatedTransform: input.transform,
    nextEvaluatedCrop: resized.crop,
    nextEvaluatedTransform: resized.transform,
  });
  assert.equal(raw.transform.rotation, 27);
  assert.equal(raw.crop.left, resized.crop.left - input.crop.left);

  const normalFrame = computeFrameBounds(960, 540, 1920, 1080);
  const fullscreenFrame = computeFrameBounds(1600, 1000, 1920, 1080);
  const normal = computeCenterOriginMediaGeometry({
    frameBounds: normalFrame,
    frameWidth: 1920,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform: input.transform,
    crop: input.crop,
  });
  const fullscreen = computeCenterOriginMediaGeometry({
    frameBounds: fullscreenFrame,
    frameWidth: 1920,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform: input.transform,
    crop: input.crop,
  });
  assert.deepEqual(previewPointToProjectPoint(normal.center, normalFrame, 1920, 1080), before.center);
  assert.ok(distance(previewPointToProjectPoint(fullscreen.center, fullscreenFrame, 1920, 1080), before.center) < 1e-6);
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function assertVisualTransformPresets(): void {
  const projectWidth = 1920;
  const projectHeight = 1080;
  const mediaWidth = 1080;
  const mediaHeight = 1920;
  const transformed = {
    x: 240,
    y: -120,
    scaleX: 2,
    scaleY: 0.75,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
  };
  const input = { transform: transformed, projectWidth, projectHeight, mediaWidth, mediaHeight };

  const fit = computeVisualTransformPreset({ ...input, preset: "fit" });
  assert.deepEqual(fit, {
    ...transformed,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });
  const fill = computeVisualTransformPreset({ ...input, preset: "fill" });
  assert.deepEqual(fill, {
    ...transformed,
    x: 0,
    y: 0,
    scaleX: 3.160494,
    scaleY: 3.160494,
  });
  const original = computeVisualTransformPreset({ ...input, preset: "original-size" });
  assert.deepEqual(original, {
    ...transformed,
    x: 0,
    y: 0,
    scaleX: 1.777778,
    scaleY: 1.777778,
  });
  const center = computeVisualTransformPreset({ ...input, preset: "center" });
  assert.deepEqual(center, { ...transformed, x: 0, y: 0 });
  const reset = computeVisualTransformPreset({ ...input, preset: "reset" });
  assert.deepEqual(reset, {
    ...transformed,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });

  const rotatedTransform = { ...transformed, rotation: 37 };
  const rotatedFit = computeVisualTransformPreset({ ...input, transform: rotatedTransform, preset: "fit" });
  assert.ok(rotatedFit);
  const fitGeometry = computeProjectMediaGeometry({
    projectWidth,
    projectHeight,
    mediaWidth,
    mediaHeight,
    transform: rotatedFit,
  });
  for (const corner of Object.values(fitGeometry.corners)) {
    assert.ok(corner.x >= -1e-6 && corner.x <= projectWidth + 1e-6);
    assert.ok(corner.y >= -1e-6 && corner.y <= projectHeight + 1e-6);
  }

  const rotatedFill = computeVisualTransformPreset({ ...input, transform: rotatedTransform, preset: "fill" });
  assert.ok(rotatedFill);
  const fillGeometry = computeProjectMediaGeometry({
    projectWidth,
    projectHeight,
    mediaWidth,
    mediaHeight,
    transform: rotatedFill,
  });
  for (const corner of [
    { x: 0, y: 0 },
    { x: projectWidth, y: 0 },
    { x: projectWidth, y: projectHeight },
    { x: 0, y: projectHeight },
  ]) {
    assert.ok(pointInsideRotatedMedia(corner, fillGeometry.center, fillGeometry.width, fillGeometry.height, fillGeometry.rotation));
  }

  assert.equal(computeVisualTransformPreset({ ...input, mediaWidth: undefined, preset: "fit" }), null);
  assert.equal(computeVisualTransformPreset({ ...input, mediaHeight: 0, preset: "fill" }), null);
  assert.equal(computeVisualTransformPreset({ ...input, projectWidth: Number.NaN, preset: "original-size" }), null);
}

function pointInsideRotatedMedia(
  point: { x: number; y: number },
  center: { x: number; y: number },
  width: number,
  height: number,
  rotation: number,
): boolean {
  const radians = -rotation * Math.PI / 180;
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;
  const localX = deltaX * Math.cos(radians) - deltaY * Math.sin(radians);
  const localY = deltaX * Math.sin(radians) + deltaY * Math.cos(radians);
  return Math.abs(localX) <= width / 2 + 1e-5 && Math.abs(localY) <= height / 2 + 1e-5;
}

function assertVisualTransformGeometry(): void {
  const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 90 };
  const project = computeProjectMediaGeometry({
    projectWidth: 1920,
    projectHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform,
  });
  assert.deepEqual(project.center, { x: 960, y: 540 });
  assert.equal(project.width, 607.5);
  assert.equal(project.height, 1080);
  assert.ok(Math.abs(project.corners.nw.x - 1500) < 1e-9);
  assert.ok(Math.abs(project.corners.nw.y - 236.25) < 1e-9);

  const normalFrame = computeFrameBounds(960, 540, 1920, 1080);
  const fullscreenFrame = computeFrameBounds(1600, 1000, 1920, 1080);
  const normal = computeCenterOriginMediaGeometry({
    frameBounds: normalFrame,
    frameWidth: 1920,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform,
  });
  const fullscreen = computeCenterOriginMediaGeometry({
    frameBounds: fullscreenFrame,
    frameWidth: 1920,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform,
  });
  assert.deepEqual(previewPointToProjectPoint(normal.center, normalFrame, 1920, 1080), project.center);
  assert.ok(Math.abs(previewPointToProjectPoint(fullscreen.center, fullscreenFrame, 1920, 1080).x - project.center.x) < 1e-9);

  const linked = resizeVisualFromOppositeCorner({
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 0.5, rotation: 0 },
    projectWidth: 1920,
    projectHeight: 1080,
    mediaWidth: 1920,
    mediaHeight: 1080,
    corner: "se",
    pointer: { x: 1440, y: 675 },
    linked: true,
  });
  assert.equal(linked.scaleX, 0.75);
  assert.equal(linked.scaleY, 0.375);
  const linkedGeometry = computeProjectMediaGeometry({
    projectWidth: 1920,
    projectHeight: 1080,
    mediaWidth: 1920,
    mediaHeight: 1080,
    transform: linked,
  });
  assert.deepEqual(linkedGeometry.corners.nw, { x: 0, y: 270 });

  const independent = resizeVisualFromOppositeCorner({
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    projectWidth: 1920,
    projectHeight: 1080,
    mediaWidth: 1920,
    mediaHeight: 1080,
    corner: "se",
    pointer: { x: 960, y: 810 },
    linked: false,
  });
  assert.equal(independent.scaleX, 0.5);
  assert.equal(independent.scaleY, 0.75);
  const minimum = resizeVisualFromOppositeCorner({
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    projectWidth: 1920,
    projectHeight: 1080,
    corner: "se",
    pointer: { x: -100, y: -100 },
    linked: false,
  });
  assert.equal(minimum.scaleX, 0.01);
  assert.equal(minimum.scaleY, 0.01);

  assert.equal(rotationForPointer({
    center: { x: 100, y: 100 },
    startPointer: { x: 100, y: 0 },
    pointer: { x: 200, y: 100 },
    startRotation: 0,
  }), 90);
  assert.equal(rotationForPointer({
    center: { x: 100, y: 100 },
    startPointer: { x: 100, y: 0 },
    pointer: { x: 198, y: 83 },
    startRotation: 0,
    snap: true,
  }), 75);
  assert.equal(normalizeRotation(540), -180);
  assert.equal(snapRotation(22), 15);

  const proxy = clampInteractiveHandle({ x: -40, y: 600 }, { x: 0, y: 0, width: 960, height: 540 }, 7);
  assert.deepEqual(proxy.reachable, { x: 7, y: 533 });
  assert.deepEqual(applyHandlePointerOffset(proxy.reachable, proxy), proxy.actual);
}

function assertPreviewDeltasConvertToProjectSpace(): void {
  const projectWidth = 1920;
  const normalFrame = computeFrameBounds(960, 540, projectWidth, 1080);
  const fullscreenFrame = computeFrameBounds(1536, 900, projectWidth, 1080);
  assert.equal(previewDeltaToProjectDelta(48, normalFrame, projectWidth), 96);
  assert.ok(Math.abs(previewDeltaToProjectDelta(76.8, fullscreenFrame, projectWidth) - 96) < 1e-9);

  const transform = { x: 96, y: -40, scaleX: 1, scaleY: 1, rotation: 0 };
  const normalBounds = computeMediaBounds({
    frameBounds: normalFrame,
    frameWidth: projectWidth,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform,
  });
  const fullscreenBounds = computeMediaBounds({
    frameBounds: fullscreenFrame,
    frameWidth: projectWidth,
    frameHeight: 1080,
    mediaWidth: 1080,
    mediaHeight: 1920,
    transform,
  });
  assert.equal(normalBounds.x - (normalFrame.x + normalFrame.width / 2 - normalBounds.width / 2), 48);
  assert.ok(Math.abs(
    fullscreenBounds.x - (fullscreenFrame.x + fullscreenFrame.width / 2 - fullscreenBounds.width / 2) - 76.8,
  ) < 1e-9);
}

function assertTopTrackControlsVisualPriority(): void {
  const base = withPreviewUrls(createMockVideoProjectDocument("track-stack", "Track Stack"));
  const beach = base.tracks.find((track) => track.id === "v1")?.items.find((item) => item.id === "tl-beach");
  const city = base.tracks.find((track) => track.id === "v1")?.items.find((item) => item.id === "tl-city");
  assert.ok(beach && beach.type === "video");
  assert.ok(city && city.type === "video");
  const topTrack = {
    id: "v2",
    kind: "video" as const,
    label: "V2",
    locked: false,
    hidden: false,
    muted: false,
    items: [{ ...city, timelineStart: 2, duration: 10, sourceIn: 0, sourceOut: 10 }],
  };
  const lowerTrack = {
    ...base.tracks.find((track) => track.id === "v1")!,
    items: [{ ...beach, timelineStart: 2, duration: 10, sourceIn: 0, sourceOut: 10 }],
  };

  const topCity = createProgramMonitorPlan({
    document: { ...base, tracks: [topTrack, lowerTrack] },
    currentTime: 3,
  });
  assert.equal(topCity.activeVisual?.item.id, "tl-city");
  assert.deepEqual(topCity.visuals.map((visual) => visual.item.id), ["tl-beach", "tl-city"]);

  const topBeach = createProgramMonitorPlan({
    document: { ...base, tracks: [lowerTrack, topTrack] },
    currentTime: 3,
  });
  assert.equal(topBeach.activeVisual?.item.id, "tl-beach");

  const imageOnTop: ImageOverlayTimelineItem = {
    id: "top-image",
    type: "image",
    mediaId: "top-image-media",
    timelineStart: 2,
    duration: 10,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    opacity: 0.6,
    layerOrder: 0,
  };
  const imagePlan = createProgramMonitorPlan({
    document: {
      ...base,
      media: {
        ...base.media,
        "top-image-media": {
          id: "top-image-media",
          kind: "image",
          name: "Top image",
          width: 1920,
          height: 1080,
          objectUrls: { proxy: "/bff/media/top-image-media/object/proxy?v=top" },
        },
      },
      tracks: [{ ...topTrack, items: [imageOnTop] }, lowerTrack],
    },
    currentTime: 3,
  });
  assert.deepEqual(imagePlan.visuals.map((visual) => visual.item.id), ["tl-beach", "top-image"]);
  assert.equal(imagePlan.activeVisual?.item.id, "top-image");
  assert.equal(imagePlan.activeVideo?.item.id, "tl-beach");
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

function assertSourceTimeMapsBackToTimelineTime(): void {
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

  assert.equal(mediaSourceTimeToTimelineTime(item, 4), 10);
  assert.equal(mediaSourceTimeToTimelineTime(item, 10), 13);
  assert.equal(mediaSourceTimeToTimelineTime(item, 16), 16);
  assert.equal(mediaSourceTimeToTimelineTime(item, 2), 10);
  assert.equal(mediaSourceTimeToTimelineTime(item, 30), 16);

  const trimmedBeyondDuration: VideoClipTimelineItem = {
    ...item,
    timelineStart: 20,
    duration: 3,
    sourceIn: 4,
    sourceOut: 12,
    speed: 2,
  };
  assert.equal(mediaSourceTimeToTimelineTime(trimmedBeyondDuration, 12), 23);
  assert.equal(mediaSourceTimeToTimelineTime(trimmedBeyondDuration, 99), 23);
}

function assertSourceAndTimelineTimeRoundTrip(): void {
  const item: AudioTimelineItem = {
    id: "music",
    type: "audio",
    mediaId: "audio-music",
    timelineStart: 5,
    duration: 8,
    sourceIn: 2,
    sourceOut: 10,
    volume: 1,
    muted: false,
    fades: {
      fadeInDuration: 0,
      fadeOutDuration: 0,
    },
  };

  for (const timelineTime of [5, 7.5, 13]) {
    const sourceTime = timelineTimeToMediaSourceTime(item, timelineTime);
    assert.equal(mediaSourceTimeToTimelineTime(item, sourceTime), timelineTime);
  }
}

function assertImageAndTextOverlaysResolveInActiveRange(): void {
  const imageItem: ImageOverlayTimelineItem = {
    id: "tl-logo",
    type: "overlay",
    mediaId: "image-logo",
    timelineStart: 5,
    duration: 5,
    transform: { x: 420, y: -280, scaleX: 0.5, scaleY: 0.5, rotation: 0 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
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
