import assert from "node:assert/strict";

import { MediaKind, OwnerKind, type MediaDto } from "../app/lib/api";
import {
  buildAddMediaToTimelineOperation,
  hydrateMediaDurationFromBrowserMetadata,
  isBuiltInEditorElementMedia,
  isMediaReadyForTimeline,
  mediaDtoToVideoMediaReference,
  mediaLibraryKind,
} from "../app/lib/editor/editor-media";
import {
  createEmptyVideoProjectDocument,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";
import {
  applyVideoOperationBatch,
  createVideoOperationBatch,
} from "../app/lib/editor/video-operations";

async function main(): Promise<void> {
  assertMediaReferenceMapping();
  assertReadinessClassification();
  assertBuiltInEditorElementClassification();
  assertVideoImageAndAudioOperations();
  assertIconifyElementsUseTightInitialBounds();
  assertIconifyElementsCreateDedicatedOverlayTracks();
  assertNonReadyMediaIsNonDestructive();
  assertImageFallsBackToVideoTrack();
  await assertBrowserDurationHydration();
}

function assertMediaReferenceMapping(): void {
  const media = mediaDto({
    id: "video-1",
    kind: MediaKind.Video,
    filename: "clip.mp4",
    durationSeconds: "12.5",
    width: "1920",
    height: "1080",
    proxyStorageKey: "proxy.mp4",
    thumbnailStorageKey: "thumb.jpg",
  });
  const reference = mediaDtoToVideoMediaReference(media);

  assert.deepEqual(reference, {
    id: "video-1",
    kind: "video",
    name: "clip.mp4",
    duration: 12.5,
    width: 1920,
    height: 1080,
    sourceUrl: "/bff/media/video-1/object/proxy?v=proxy.mp4",
    thumbnailUrl: "/bff/media/video-1/object/thumbnail?v=thumb.jpg",
    objectUrls: {
      proxy: "/bff/media/video-1/object/proxy?v=proxy.mp4",
      raw: "/bff/media/video-1/object/raw?v=raw",
    },
  });
  assert.equal(mediaLibraryKind(media), "clips");
}

function assertReadinessClassification(): void {
  assert.equal(isMediaReadyForTimeline(mediaDto({ status: "Ready" })), true);
  assert.equal(isMediaReadyForTimeline(mediaDto({ status: "Processing" })), false);
  assert.equal(isMediaReadyForTimeline(mediaDto({ status: "Failed", errorMessage: "bad" })), false);
}

function assertBuiltInEditorElementClassification(): void {
  assert.equal(isBuiltInEditorElementMedia(mediaDto({
    id: "el_watercolor_blue_test",
    ownerId: "elements-library",
    kind: MediaKind.Image,
  })), true);
  assert.equal(isBuiltInEditorElementMedia(mediaDto({
    id: "el_user_media_test",
    ownerId: "user-1",
    kind: MediaKind.Image,
  })), false);
  assert.equal(isBuiltInEditorElementMedia(mediaDto({
    id: "ordinary-media-id",
    ownerId: "elements-library",
    kind: MediaKind.Image,
  })), false);
}

function assertVideoImageAndAudioOperations(): void {
  const document = documentWithOverlay();
  const now = "2026-03-01T12:00:00.000Z";

  const video = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "video-1", kind: MediaKind.Video, durationSeconds: 8 })),
    media: mediaDto({ id: "video-1", kind: MediaKind.Video, durationSeconds: 8 }),
    now,
  });
  assert.equal(video.ok, true);
  assert.equal(video.ok && video.operation.type, "addMediaToTimeline");
  assert.equal(video.ok && video.operation.trackId, "v1");
  assert.equal(video.ok && video.operation.item.duration, 8);

  const image = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "image-1", kind: MediaKind.Image, filename: "still.png" })),
    media: mediaDto({ id: "image-1", kind: MediaKind.Image, filename: "still.png" }),
    now,
  });
  assert.equal(image.ok, true);
  assert.equal(image.ok && image.operation.trackId, "v1");
  assert.equal(image.ok && image.operation.item.type, "image");
  assert.equal(image.ok && image.operation.item.duration, 5);

  const audio = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "audio-1", kind: MediaKind.Audio, durationSeconds: 11 })),
    media: mediaDto({ id: "audio-1", kind: MediaKind.Audio, durationSeconds: 11 }),
    now,
  });
  assert.equal(audio.ok, true);
  assert.equal(audio.ok && audio.operation.type, "addAudioItem");
  assert.equal(audio.ok && audio.operation.trackId, "a1");
  assert.equal(audio.ok && audio.operation.item.duration, 11);
  assert.equal(audio.ok && audio.operation.item.type === "audio" ? audio.operation.item.volume : undefined, 1);
  assert.equal(audio.ok && audio.operation.item.type === "audio" ? audio.operation.item.muted : undefined, false);
  assert.equal(audio.ok && audio.operation.item.type === "audio" ? audio.operation.item.linkedGroupId : "unexpected", undefined);

  const highPrecisionVideo = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "video-precise", kind: MediaKind.Video, durationSeconds: 13.255555 })),
    media: mediaDto({ id: "video-precise", kind: MediaKind.Video, durationSeconds: 13.255555 }),
    now,
  });
  assert.equal(highPrecisionVideo.ok, true);
  assert.equal(highPrecisionVideo.ok && highPrecisionVideo.mediaReference.duration, 13.256);
  assert.equal(highPrecisionVideo.ok && highPrecisionVideo.operation.item.duration, 13.256);
  assert.equal(
    highPrecisionVideo.ok && highPrecisionVideo.operation.item.type === "video"
      ? highPrecisionVideo.operation.item.sourceOut
      : undefined,
    13.256,
  );

  const zeroDimensionMedia = mediaDto({
    id: "video-zero-dimensions",
    kind: MediaKind.Video,
    durationSeconds: 7,
    width: 0,
    height: 0,
  });
  const zeroDimensionVideo = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, zeroDimensionMedia),
    media: zeroDimensionMedia,
    now,
  });
  assert.equal(zeroDimensionVideo.ok, true);
  assert.equal(zeroDimensionVideo.ok && zeroDimensionVideo.mediaReference.width, undefined);
  assert.equal(zeroDimensionVideo.ok && zeroDimensionVideo.mediaReference.height, undefined);
  const zeroDimensionApply = zeroDimensionVideo.ok
    ? applyVideoOperationBatch(
        {
          ...document,
          media: {
            ...document.media,
            [zeroDimensionVideo.mediaReference.id]: zeroDimensionVideo.mediaReference,
          },
        },
        createVideoOperationBatch({
          id: zeroDimensionVideo.operation.id,
          source: zeroDimensionVideo.operation.source,
          timestamp: zeroDimensionVideo.operation.timestamp,
          label: zeroDimensionVideo.operation.label,
          operations: [zeroDimensionVideo.operation],
          affectedEntityIds: zeroDimensionVideo.operation.affectedEntityIds,
        }),
      )
    : null;
  assert.equal(zeroDimensionApply?.ok, true);

  const preferredAudio = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "audio-2", kind: MediaKind.Audio, durationSeconds: 9 })),
    media: mediaDto({ id: "audio-2", kind: MediaKind.Audio, durationSeconds: 9 }),
    now,
    placement: { trackId: "a1", timelineStart: 3.4567 },
  });
  assert.equal(preferredAudio.ok, true);
  assert.equal(preferredAudio.ok && preferredAudio.operation.trackId, "a1");
  assert.equal(preferredAudio.ok && preferredAudio.operation.item.timelineStart, 3.457);
}

function assertIconifyElementsUseTightInitialBounds(): void {
  const document = createEmptyVideoProjectDocument({ id: "project-1", name: "Project" });
  const icon = mediaDto({
    id: "iconify_lucide_heart_test",
    ownerId: "iconify",
    ownerDisplayName: "Iconify",
    kind: MediaKind.Image,
    filename: "lucide:heart",
    width: 100,
    height: 100,
    storageKey: "https://api.iconify.design/lucide/heart.svg?color=%23f1f2fb",
    canonicalStorageKey: "https://api.iconify.design/lucide/heart.svg?color=%23f1f2fb",
  });
  const built = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, icon),
    media: icon,
    now: "2026-03-01T12:00:00.000Z",
    placement: { trackId: "o1", timelineStart: 1 },
  });

  assert.equal(built.ok, true);
  assert.equal(built.ok && built.operation.type, "addMediaToTimeline");
  assert.equal(built.ok && built.operation.trackId, "o1");
  assert.equal(built.ok && built.operation.item.type, "overlay");
  assert.equal(built.ok && built.operation.item.type === "overlay" ? built.operation.item.transform.scaleX : undefined, 0.16);
  assert.equal(built.ok && built.operation.item.type === "overlay" ? built.operation.item.transform.scaleY : undefined, 0.16);
}

function assertIconifyElementsCreateDedicatedOverlayTracks(): void {
  const document = createEmptyVideoProjectDocument({ id: "project-1", name: "Project" });
  const firstIcon = mediaDto({
    id: "iconify_lucide_heart_first",
    ownerId: "iconify",
    ownerDisplayName: "Iconify",
    kind: MediaKind.Image,
    filename: "lucide:heart",
    width: 100,
    height: 100,
    storageKey: "https://api.iconify.design/lucide/heart.svg",
    canonicalStorageKey: "https://api.iconify.design/lucide/heart.svg",
  });
  const first = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, firstIcon),
    media: firstIcon,
    now: "2026-03-01T12:00:00.000Z",
  });

  assert.equal(first.ok, true);
  assert.equal(first.ok && first.operation.item.type, "overlay");
  assert.notEqual(first.ok && first.operation.trackId, "o1");
  assert.match(first.ok ? first.operation.trackId : "", /^o-/);

  const firstApplied = first.ok
    ? applyVideoOperationBatch(
        upsertMedia(document, firstIcon),
        createVideoOperationBatch({
          id: first.operation.id,
          source: first.operation.source,
          timestamp: first.operation.timestamp,
          label: first.operation.label,
          operations: [first.operation],
          affectedEntityIds: first.operation.affectedEntityIds,
        }),
      )
    : null;
  assert.equal(firstApplied?.ok, true);

  const secondIcon = mediaDto({
    id: "iconify_lucide_star_second",
    ownerId: "iconify",
    ownerDisplayName: "Iconify",
    kind: MediaKind.Image,
    filename: "lucide:star",
    width: 100,
    height: 100,
    storageKey: "https://api.iconify.design/lucide/star.svg",
    canonicalStorageKey: "https://api.iconify.design/lucide/star.svg",
  });
  const second = firstApplied?.ok
    ? buildAddMediaToTimelineOperation({
        document: upsertMedia(firstApplied.document, secondIcon),
        media: secondIcon,
        now: "2026-03-01T12:00:01.000Z",
      })
    : { ok: false as const, reason: "first icon did not apply" };

  assert.equal(second.ok, true);
  assert.notEqual(second.ok && first.ok && second.operation.trackId, first.ok && first.operation.trackId);

  const preferred = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, firstIcon),
    media: firstIcon,
    now: "2026-03-01T12:00:02.000Z",
    placement: { trackId: "o1", timelineStart: 2 },
  });
  assert.equal(preferred.ok, true);
  assert.equal(preferred.ok && preferred.operation.trackId, "o1");

  const shape = mediaDto({
    id: "el_arrow_test",
    kind: MediaKind.Image,
    filename: "Arrow",
    width: 100,
    height: 100,
    storageKey: "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100'></svg>",
    canonicalStorageKey: "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100'></svg>",
  });
  const shapeBuilt = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, shape),
    media: shape,
    now: "2026-03-01T12:00:03.000Z",
  });
  assert.equal(shapeBuilt.ok, true);
  assert.equal(shapeBuilt.ok && shapeBuilt.operation.item.type, "overlay");
  assert.match(shapeBuilt.ok ? shapeBuilt.operation.trackId : "", /^o-/);
  assert.equal(shapeBuilt.ok && shapeBuilt.operation.item.type === "overlay" ? shapeBuilt.operation.item.transform.scaleX : undefined, 0.16);
}

function assertNonReadyMediaIsNonDestructive(): void {
  const document = createEmptyVideoProjectDocument({ id: "project-1", name: "Project" });
  const processing = buildAddMediaToTimelineOperation({
    document,
    media: mediaDto({ status: "Processing" }),
    now: "2026-03-01T12:00:00.000Z",
  });

  assert.equal(processing.ok, false);
  assert.deepEqual(document.media, {});
  assert.equal(document.tracks.every((track) => track.items.length === 0), true);

  const missingDuration = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, mediaDto({ id: "audio-missing-duration", kind: MediaKind.Audio, durationSeconds: null })),
    media: mediaDto({ id: "audio-missing-duration", kind: MediaKind.Audio, durationSeconds: null }),
    now: "2026-03-01T12:00:00.000Z",
  });
  assert.equal(missingDuration.ok, false);
  assert.equal(missingDuration.ok ? "" : missingDuration.reason, "Ready media is missing a usable duration.");

  const lockedAudioDocument = {
    ...document,
    tracks: document.tracks.map((track) => track.kind === "audio" ? { ...track, locked: true } : track),
  };
  const lockedAudio = buildAddMediaToTimelineOperation({
    document: upsertMedia(lockedAudioDocument, mediaDto({ id: "audio-locked", kind: MediaKind.Audio, durationSeconds: 6 })),
    media: mediaDto({ id: "audio-locked", kind: MediaKind.Audio, durationSeconds: 6 }),
    now: "2026-03-01T12:00:00.000Z",
  });
  assert.equal(lockedAudio.ok, false);
  assert.ok((lockedAudio.ok ? "" : lockedAudio.reason).includes("No compatible audio track"));
}

function assertImageFallsBackToVideoTrack(): void {
  const document = {
    ...createEmptyVideoProjectDocument({ id: "project-1", name: "Project" }),
    tracks: createEmptyVideoProjectDocument({ id: "project-1", name: "Project" }).tracks.filter((track) => track.kind !== "overlay"),
  };
  const media = mediaDto({ id: "image-1", kind: MediaKind.Image, filename: "still.png" });
  const built = buildAddMediaToTimelineOperation({
    document: upsertMedia(document, media),
    media,
    now: "2026-03-01T12:00:00.000Z",
  });

  assert.equal(built.ok, true);
  assert.equal(built.ok && built.operation.trackId, "v1");
}

async function assertBrowserDurationHydration(): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const fakeDocument = {
    createElement: (tagName: string) => {
      let duration = tagName === "audio" ? Infinity : 13.255555;
      let currentTime = 0;
      return {
        preload: "",
        src: "",
        onloadedmetadata: null as (() => void) | null,
        ondurationchange: null as (() => void) | null,
        ontimeupdate: null as (() => void) | null,
        onerror: null as (() => void) | null,
        get duration() {
          return duration;
        },
        get currentTime() {
          return currentTime;
        },
        set currentTime(value: number) {
          currentTime = value;
          if (tagName === "audio" && value === Number.MAX_SAFE_INTEGER) {
            duration = 21.75555;
            this.ontimeupdate?.();
          }
        },
        load() {
          if (this.src) this.onloadedmetadata?.();
        },
        removeAttribute(name: string) {
          if (name === "src") this.src = "";
        },
      };
    },
  };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });

  try {
    const hydrated = await hydrateMediaDurationFromBrowserMetadata(mediaDto({
      id: "video-needs-duration",
      kind: MediaKind.Video,
      durationSeconds: 0,
      canonicalStorageKey: "canonical.mp4",
    }));
    assert.equal(hydrated.durationSeconds, 13.256);

    const hydratedAudio = await hydrateMediaDurationFromBrowserMetadata(mediaDto({
      id: "audio-needs-duration",
      kind: MediaKind.Audio,
      durationSeconds: 0,
      canonicalStorageKey: "canonical.opus",
    }));
    assert.equal(hydratedAudio.durationSeconds, 21.756);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "document", descriptor);
    } else {
      delete (globalThis as { document?: unknown }).document;
    }
  }
}

function documentWithOverlay(): VideoProjectDocument {
  return createEmptyVideoProjectDocument({ id: "project-1", name: "Project" });
}

function upsertMedia(document: VideoProjectDocument, media: MediaDto): VideoProjectDocument {
  const reference = mediaDtoToVideoMediaReference(media);
  return {
    ...document,
    media: {
      ...document.media,
      [reference.id]: reference,
    },
  };
}

function mediaDto(overrides: Partial<MediaDto> = {}): MediaDto {
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
    status: "Ready",
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
      stage: String(overrides.status ?? "Ready").toLowerCase() === "failed" ? "failed" : String(overrides.status ?? "Ready").toLowerCase() === "ready" ? "ready" : "ingesting",
      label: String(overrides.status ?? "Ready"),
      detail: "",
      step: String(overrides.status ?? "Ready").toLowerCase() === "ready" ? 4 : 2,
      stepCount: 4,
      terminal: ["ready", "failed"].includes(String(overrides.status ?? "Ready").toLowerCase()),
    },
    ...overrides,
  };
}

await main();
