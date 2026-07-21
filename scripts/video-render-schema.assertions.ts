import assert from "node:assert/strict";

import { MediaKind, OwnerKind, type MediaDto } from "../app/lib/api";
import {
  buildVideoRenderManifest,
  createDefaultVideoExportSettings,
  validateVideoExport,
  type VideoExportSettings,
} from "../app/lib/editor/video-export";
import {
  createMockVideoProjectDocument,
  type AudioTimelineItem,
  type ImageOverlayTimelineItem,
  type VideoMediaReference,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";

function main(): void {
  assertManifestIncludesRenderableSubset();
  assertMissingCanonicalSourceBlocksExport();
  assertUnsupportedFeaturesBlockManifest();
  assertUnsupportedNonDefaultControlsBlockManifest();
  assertSupportedAnimationIsNormalized();
  assertMissingDimensionsBlockExport();
}

function assertManifestIncludesRenderableSubset(): void {
  const document = renderableDocument();
  const styledBeach = document.tracks[0].items.find((item) => item.id === "tl-beach");
  if (styledBeach?.type !== "video") throw new Error("Expected beach video fixture");
  styledBeach.properties = {
    adjust: { exposure: { value: 12 }, temperature: { value: 8 } },
    filters: {
      builtIn: { value: "Cinematic" },
      intensity: { value: 50 },
      blend: { value: 80 },
    },
    animation: { fadeIn: { value: 1.25 }, fadeOut: { value: 2.5 } },
  };
  const media = readyMediaForDocument(document);
  const result = buildVideoRenderManifest({
    document,
    media,
    settings: settings(document),
  });

  assert.equal(result.ok, true);
  const manifest = result.manifest;
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.projectId, document.projectId);
  assert.deepEqual(manifest.logicalCanvas, {
    width: document.settings.width,
    height: document.settings.height,
  });
  assert.equal(manifest.settings.destinationLabel, "Renderable h264-1080p");
  assert.equal(manifest.durationSeconds, 66.4);
  assert.deepEqual(manifest.mediaSources.map((source) => source.mediaId), [
    "audio-main",
    "audio-music",
    "clip-beach",
    "clip-city",
    "clip-mountain",
    "still-poster",
  ]);
  assert.equal(manifest.mediaSources[0].canonical.variant, "canonical");
  assert.equal(manifest.mediaSources[0].canonical.storageKey, "media/audio-main/canonical");
  assert.equal(manifest.mediaSources[0].canonical.url, "/bff/media/audio-main/object/canonical?v=media%2Faudio-main%2Fcanonical");
  assert.ok(!JSON.stringify(manifest).includes("proxy"));
  assert.ok(!JSON.stringify(manifest).includes("raw"));

  const beach = manifest.visualItems.find((item) => item.itemId === "tl-beach");
  assert.ok(beach);
  assert.equal(beach.shotId, undefined);
  assert.equal(beach.sourceIn, 0);
  assert.equal(beach.sourceOut, 21);
  assert.equal(beach.speed, 1);
  assert.deepEqual(beach.crop, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.deepEqual(beach.fades, { fadeInDuration: 1.25, fadeOutDuration: 2.5 });
  assert.equal(beach.style.registryVersion, 1);
  assert.equal(beach.style.preset, "Cinematic");
  assert.equal(beach.style.adjustments.exposure, 10.4);
  assert.equal(typeof beach.stackOrder, "number");

  const city = manifest.visualItems.find((item) => item.itemId === "tl-city");
  assert.equal(city?.shotId, "shot-city-middle");
  const image = manifest.visualItems.find((item) => item.type === "image" && item.itemId === "image-1");
  assert.ok(image);
  assert.deepEqual(image.crop, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.ok(manifest.audioItems.some((item) =>
    item.itemId === "tl-audio-main"
    && item.volume === 1
    && item.sourceOwner === "audio-item"
    && item.linkedGroupId === "linked-beach"
  ));
  assert.equal(manifest.audioItems.some((item) => item.itemId === "tl-beach" && item.sourceOwner === "embedded-video"), false);
  assert.ok(manifest.audioItems.some((item) => item.itemId === "tl-city" && item.sourceOwner === "embedded-video"));
  assert.ok(manifest.audioItems.some((item) => item.itemId === "tl-mountain" && item.sourceOwner === "embedded-video"));
  assert.equal(manifest.audioItems.some((item) => item.itemId === "muted-audio"), false);
  assert.ok(manifest.textOverlays.some((item) =>
    item.itemId === "tl-caption"
    && item.text === "Welcome to summer"
    && item.fades.fadeInDuration === 0
  ));
  assert.equal(manifest.visualItems.some((item) => item.itemId === "hidden-video"), false);
  assert.ok(result.warnings.some((issue) => issue.code === "hidden-track-excluded"));
  assert.ok(result.warnings.some((issue) => issue.code === "muted-audio-item-excluded"));

  const serialized = JSON.stringify(manifest);
  assert.ok(!serialized.includes("operationsJson"));
  assert.ok(!serialized.includes("selection"));
  assert.ok(!serialized.includes("semanticSearch"));
  assert.ok(!serialized.includes("history"));

  const validation = validateVideoExport(document, media, settings(document));
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.manifest, manifest);
}

function assertUnsupportedNonDefaultControlsBlockManifest(): void {
  const scenarios = [
    { label: "mask", properties: { mask: { shape: { value: "Circle" } } } },
    { label: "grain", properties: { color: { grain: { value: 20 } } } },
    { label: "reverse", properties: { speedSettings: { reverse: { value: true } } } },
    { label: "audio DSP", properties: { audioSettings: { compressor: { value: true } } } },
  ];
  for (const scenario of scenarios) {
    const document = renderableDocument();
    const beach = document.tracks[0].items.find((item) => item.id === "tl-beach");
    if (beach?.type !== "video") throw new Error("Expected beach fixture");
    beach.properties = scenario.properties as never;
    const result = buildVideoRenderManifest({
      document,
      media: readyMediaForDocument(document),
      settings: settings(document),
    });
    assert.equal(result.ok, false, scenario.label);
    assert.ok(result.errors.some((issue) => issue.code === "unsupported-item-state"), scenario.label);
  }
}

function assertSupportedAnimationIsNormalized(): void {
  const document = renderableDocument();
  const beach = document.tracks[0].items.find((item) => item.id === "tl-beach");
  if (beach?.type !== "video") throw new Error("Expected video fixture");
  beach.advanced = {
    transform: {
      x: {
        value: 0,
        keyframes: [
          { id: "start", time: 0, value: 0 },
          { id: "end", time: 2, value: 120, easing: [0.42, 0, 0.58, 1] },
        ],
      },
    },
    crop: {
      left: { value: 0, keyframes: [{ id: "c0", time: 0, value: 0 }, { id: "c1", time: 2, value: 0.2 }] },
    },
    opacity: { value: 1, keyframes: [{ id: "o0", time: 0, value: 1 }, { id: "o1", time: 2, value: 0.5 }] },
  };
  const result = buildVideoRenderManifest({ document, media: readyMediaForDocument(document), settings: settings(document) });
  assert.equal(result.ok, true);
  const rendered = result.manifest.visualItems.find((item) => item.itemId === beach.id);
  assert.deepEqual(rendered?.animation?.transform?.x?.keyframes.map((keyframe) => keyframe.time), [0, 2]);
  assert.equal(rendered?.animation?.crop?.left?.keyframes[1].value, 0.2);
  assert.equal(rendered?.animation?.opacity?.keyframes[1].value, 0.5);
}

function assertMissingDimensionsBlockExport(): void {
  const document = renderableDocument();
  delete document.media["still-poster"].width;
  const result = buildVideoRenderManifest({ document, media: readyMediaForDocument(document), settings: settings(document) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-source-dimensions"));
}

function assertMissingCanonicalSourceBlocksExport(): void {
  const document = renderableDocument();
  const media = readyMediaForDocument(document).map((item) =>
    item.id === "clip-beach" ? { ...item, canonicalStorageKey: null } : item,
  );

  const result = validateVideoExport(document, media, settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-canonical-source" && issue.mediaId === "clip-beach"));
  assert.equal(result.manifest, undefined);
}

function assertUnsupportedFeaturesBlockManifest(): void {
  const document = renderableDocument();
  document.transitions = [
    {
      id: "transition-1",
      type: "crossfade",
      targetItemIds: ["tl-beach", "tl-city"],
      duration: 0.25,
    },
  ];
  document.effects = [
    {
      id: "effect-1",
      type: "blur",
      targetItemIds: ["tl-city"],
      enabled: true,
      parameters: {},
    },
    {
      id: "effect-disabled",
      type: "grade",
      targetItemIds: ["tl-beach"],
      enabled: false,
      parameters: {},
    },
  ];

  const result = buildVideoRenderManifest({
    document,
    media: readyMediaForDocument(document),
    settings: settings(document),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-transition"));
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-effect"));
  assert.equal(result.errors.some((issue) => issue.message.includes("effect-disabled")), false);
}

function renderableDocument(): VideoProjectDocument {
  const document = createMockVideoProjectDocument("project-render-schema", "Renderable");
  document.transitions = [];
  document.effects = [];
  const beach = document.tracks[0].items.find((item) => item.id === "tl-beach");
  if (beach?.type === "video") delete beach.shotId;

  document.media["still-poster"] = mediaReference("still-poster", "image", "Poster.png", 5);
  document.media["hidden-clip"] = mediaReference("hidden-clip", "video", "Hidden.mp4", 4);
  document.tracks.push({
    id: "o1",
    kind: "overlay",
    label: "O1",
    locked: false,
    hidden: false,
    muted: false,
    items: [imageItem("image-1", "still-poster")],
  });
  document.tracks.push({
    id: "v-hidden",
    kind: "video",
    label: "Hidden",
    locked: false,
    hidden: true,
    muted: false,
    items: [
      {
        id: "hidden-video",
        type: "video",
        mediaId: "hidden-clip",
        timelineStart: 0,
        duration: 4,
        sourceIn: 0,
        sourceOut: 4,
        speed: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        opacity: 1,
      },
    ],
  });
  document.tracks[1].items.push(audioItem("muted-audio", "audio-main"));

  return document;
}

function settings(document: VideoProjectDocument): VideoExportSettings {
  return createDefaultVideoExportSettings(document, document.name);
}

function readyMediaForDocument(document: VideoProjectDocument): MediaDto[] {
  return Object.values(document.media).map((item) => {
    const kind = item.kind === "audio"
      ? MediaKind.Audio
      : item.kind === "image"
        ? MediaKind.Image
        : MediaKind.Video;
    return mediaDto(item.id, kind);
  });
}

function mediaReference(
  id: string,
  kind: VideoMediaReference["kind"],
  name: string,
  duration: number,
): VideoMediaReference {
  return {
    id,
    kind,
    name,
    duration,
    width: kind === "audio" ? undefined : 1920,
    height: kind === "audio" ? undefined : 1080,
    mimeType: kind === "audio" ? "audio/wav" : kind === "image" ? "image/png" : "video/mp4",
  };
}

function imageItem(id: string, mediaId: string): ImageOverlayTimelineItem {
  return {
    id,
    type: "image",
    mediaId,
    timelineStart: 1,
    duration: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    opacity: 1,
    layerOrder: 2,
  };
}

function audioItem(id: string, mediaId: string): AudioTimelineItem {
  return {
    id,
    type: "audio",
    mediaId,
    timelineStart: 4,
    duration: 5,
    sourceIn: 0,
    sourceOut: 5,
    volume: 1,
    muted: true,
    fades: {
      fadeInDuration: 0,
      fadeOutDuration: 0,
    },
  };
}

function mediaDto(id: string, kind: number): MediaDto {
  return {
    id,
    ownerId: "owner-1",
    ownerKind: OwnerKind.User,
    ownerEmail: "owner@example.com",
    ownerDisplayName: "Owner",
    kind,
    filename: `${id}.${kind === MediaKind.Audio ? "wav" : kind === MediaKind.Image ? "png" : "mp4"}`,
    storageKey: `media/${id}/raw`,
    sizeBytes: 1024,
    status: "ready",
    canonicalStorageKey: `media/${id}/canonical`,
    proxyStorageKey: `media/${id}/proxy`,
    thumbnailStorageKey: `media/${id}/thumbnail`,
    errorMessage: null,
    durationSeconds: kind === MediaKind.Image ? null : 8,
    width: kind === MediaKind.Audio ? null : 1920,
    height: kind === MediaKind.Audio ? null : 1080,
    codec: null,
    frameRate: kind === MediaKind.Video ? 30 : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    pipeline: {
      stage: "ready",
      label: "ready",
      detail: "ready",
      step: 4,
      stepCount: 4,
      terminal: true,
    },
  };
}

main();
