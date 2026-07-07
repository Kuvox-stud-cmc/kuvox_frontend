import { MediaKind, type MediaDto } from "~/lib/api";
import { resolveMediaPipeline } from "~/lib/media-pipeline";

import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  VideoClipTimelineItem,
  VideoMediaKind,
  VideoMediaReference,
  VideoProjectDocument,
  VideoTimelineItem,
  VideoTrack,
} from "./video-document";
import { findCompatibleTrack, roundTime } from "./editor-timeline";
import type { VideoEditorShotSearchResult } from "./video-retrieval";
import type {
  AddAudioItemOperation,
  AddMediaToTimelineOperation,
} from "./video-operations";

export type MediaLibraryKind = "clips" | "audio" | "stills";
export type MediaReadiness = "ready" | "processing" | "failed";

export type AddMediaToTimelineBuildResult =
  | {
      ok: true;
      operation: AddMediaToTimelineOperation | AddAudioItemOperation;
      mediaReference: VideoMediaReference;
    }
  | { ok: false; reason: string };

export function mediaDtoToVideoMediaReference(media: MediaDto): VideoMediaReference {
  const objectUrls = objectUrlsForMedia(media);
  const source = sourceObjectForMedia(media, objectUrls);
  const thumbnail = media.thumbnailStorageKey
    ? `/bff/media/${encodeURIComponent(media.id)}/object/thumbnail?v=${encodeURIComponent(media.thumbnailStorageKey)}`
    : undefined;

  return omitUndefined({
    id: media.id,
    kind: videoMediaKind(media),
    name: media.filename,
    duration: numberOrUndefined(media.durationSeconds),
    width: numberOrUndefined(media.width),
    height: numberOrUndefined(media.height),
    sourceUrl: source?.url,
    thumbnailUrl: thumbnail,
    objectUrls: Object.keys(objectUrls).length > 0 ? objectUrls : undefined,
  });
}

export function isMediaReadyForTimeline(media: MediaDto): boolean {
  return mediaReadiness(media) === "ready";
}

export function mediaReadiness(media: MediaDto): MediaReadiness {
  const pipeline = resolveMediaPipeline(media);
  if (pipeline.stage === "failed") return "failed";
  if (pipeline.stage === "ready") return "ready";
  return pipeline.terminal ? "failed" : "processing";
}

export function mediaLibraryKind(media: MediaDto): MediaLibraryKind {
  if (media.kind === MediaKind.Audio) return "audio";
  if (media.kind === MediaKind.Image) return "stills";
  return "clips";
}

export function buildAddMediaToTimelineOperation({
  document,
  media,
  now,
  placement,
}: {
  document: VideoProjectDocument;
  media: MediaDto;
  now: string | Date;
  placement?: {
    trackId?: string;
    timelineStart?: number;
  };
}): AddMediaToTimelineBuildResult {
  if (!isMediaReadyForTimeline(media)) {
    return { ok: false, reason: "Media is not ready for timeline placement." };
  }

  const mediaReference = mediaDtoToVideoMediaReference(media);
  const timestamp = typeof now === "string" ? now : now.toISOString();
  const targetTrack = targetTrackForMedia(document, media, placement?.trackId);
  if (!targetTrack) {
    return { ok: false, reason: `No compatible ${mediaKindLabel(media)} track is available.` };
  }

  const duration = durationForMedia(media);
  if (duration === null) {
    return { ok: false, reason: "Ready media is missing a usable duration." };
  }

  const timelineStart = roundTime(placement?.timelineStart ?? trackEnd(targetTrack));
  const itemId = createTimelineItemId(media, timestamp);
  const base = {
    id: `add-media-${media.id}-${slugTimestamp(timestamp)}`,
    source: "manual" as const,
    timestamp,
    label: `Add ${media.filename}`,
    affectedEntityIds: [media.id, itemId],
  };

  if (media.kind === MediaKind.Audio) {
    const item: AudioTimelineItem = {
      id: itemId,
      type: "audio",
      mediaId: media.id,
      timelineStart,
      duration,
      sourceIn: 0,
      sourceOut: duration,
      volume: 1,
      muted: false,
      fades: {
        fadeInDuration: 0,
        fadeOutDuration: 0,
      },
    };

    return {
      ok: true,
      mediaReference,
      operation: {
        ...base,
        type: "addAudioItem",
        trackId: targetTrack.id,
        item,
      },
    };
  }

  if (media.kind === MediaKind.Image) {
    const item: ImageOverlayTimelineItem = {
      id: itemId,
      type: targetTrack.kind === "overlay" ? "overlay" : "image",
      mediaId: media.id,
      timelineStart,
      duration,
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      opacity: 1,
      layerOrder: nextLayerOrder(document),
    };

    return {
      ok: true,
      mediaReference,
      operation: {
        ...base,
        type: "addMediaToTimeline",
        trackId: targetTrack.id,
        item,
      },
    };
  }

  const item: VideoClipTimelineItem = {
    id: itemId,
    type: "video",
    mediaId: media.id,
    timelineStart,
    duration,
    sourceIn: 0,
    sourceOut: duration,
    speed: 1,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    opacity: 1,
  };

  return {
    ok: true,
    mediaReference,
    operation: {
      ...base,
      type: "addMediaToTimeline",
      trackId: targetTrack.id,
      item,
    },
  };
}

export function buildAddRetrievedShotToTimelineOperation({
  document,
  result,
  mediaReference,
  now,
  placement,
}: {
  document: VideoProjectDocument;
  result: VideoEditorShotSearchResult;
  mediaReference: VideoMediaReference;
  now: string | Date;
  placement?: {
    trackId?: string;
    timelineStart?: number;
  };
}): AddMediaToTimelineBuildResult {
  if (mediaReference.kind !== "video") {
    return { ok: false, reason: "Retrieved shots can only be added from video media." };
  }

  if (result.endSeconds <= result.startSeconds) {
    return { ok: false, reason: "Retrieved shot timing is invalid." };
  }

  if (mediaReference.duration !== undefined && result.endSeconds > mediaReference.duration) {
    return { ok: false, reason: "Retrieved shot extends beyond the source media duration." };
  }

  const timestamp = typeof now === "string" ? now : now.toISOString();
  const documentWithMedia = {
    ...document,
    media: {
      ...document.media,
      [mediaReference.id]: mediaReference,
    },
  };
  const targetTrack = findCompatibleTrack(documentWithMedia, "video", placement?.trackId);
  if (!targetTrack) {
    return { ok: false, reason: "No compatible video track is available." };
  }

  const duration = roundTime(result.endSeconds - result.startSeconds);
  const itemId = createShotTimelineItemId(result, timestamp);
  const item: VideoClipTimelineItem = {
    id: itemId,
    type: "video",
    mediaId: mediaReference.id,
    shotId: result.shotId,
    timelineStart: roundTime(placement?.timelineStart ?? 0),
    duration,
    sourceIn: roundTime(result.startSeconds),
    sourceOut: roundTime(result.endSeconds),
    speed: 1,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    crop: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    opacity: 1,
  };

  return {
    ok: true,
    mediaReference,
    operation: {
      id: `add-shot-${slugId(result.shotId)}-${slugTimestamp(timestamp)}`,
      source: "ai",
      timestamp,
      label: `Add semantic shot ${result.shotId}`,
      affectedEntityIds: [mediaReference.id, result.shotId, itemId],
      forceCheckpoint: true,
      type: "addMediaToTimeline",
      trackId: targetTrack.id,
      item,
    },
  };
}

function videoMediaKind(media: MediaDto): VideoMediaKind {
  if (media.kind === MediaKind.Audio) return "audio";
  if (media.kind === MediaKind.Image) return "image";
  return "video";
}

function targetTrackForMedia(document: VideoProjectDocument, media: MediaDto, preferredTrackId?: string): VideoTrack | null {
  if (media.kind === MediaKind.Audio) {
    return findCompatibleTrack(document, "audio", preferredTrackId);
  }

  if (media.kind === MediaKind.Image) {
    if (!preferredTrackId) {
      const overlayTrack = document.tracks.find((track) => !track.locked && track.kind === "overlay");
      if (overlayTrack) return overlayTrack;
    }
    return findCompatibleTrack(document, "image", preferredTrackId);
  }

  return findCompatibleTrack(document, "video", preferredTrackId);
}

function durationForMedia(media: MediaDto): number | null {
  if (media.kind === MediaKind.Image) return 5;
  const duration = numberOrUndefined(media.durationSeconds);
  return duration && duration > 0 ? duration : null;
}

function trackEnd(track: VideoTrack): number {
  return track.items.reduce(
    (end, item) => Math.max(end, item.timelineStart + item.duration),
    0,
  );
}

function nextLayerOrder(document: VideoProjectDocument): number {
  return document.tracks.reduce((maxOrder, track) => {
    const trackMax = track.items.reduce((innerMax, item: VideoTimelineItem) => {
      return "layerOrder" in item ? Math.max(innerMax, item.layerOrder) : innerMax;
    }, 0);
    return Math.max(maxOrder, trackMax);
  }, 0) + 1;
}

function objectUrlsForMedia(media: MediaDto): Partial<Record<"proxy" | "canonical" | "raw", string>> {
  return omitUndefined({
    proxy: media.proxyStorageKey
      ? `/bff/media/${encodeURIComponent(media.id)}/object/proxy?v=${encodeURIComponent(media.proxyStorageKey)}`
      : undefined,
    canonical: media.canonicalStorageKey
      ? `/bff/media/${encodeURIComponent(media.id)}/object/canonical?v=${encodeURIComponent(media.canonicalStorageKey)}`
      : undefined,
    raw: media.storageKey
      ? `/bff/media/${encodeURIComponent(media.id)}/object/raw?v=${encodeURIComponent(media.storageKey)}`
      : undefined,
  });
}

function sourceObjectForMedia(
  media: MediaDto,
  objectUrls: Partial<Record<"proxy" | "canonical" | "raw", string>>,
): { variant: "proxy" | "canonical" | "raw"; key: string; url: string } | null {
  const candidate =
    media.proxyStorageKey
      ? { variant: "proxy" as const, key: media.proxyStorageKey }
      : media.canonicalStorageKey
        ? { variant: "canonical" as const, key: media.canonicalStorageKey }
        : media.storageKey
          ? { variant: "raw" as const, key: media.storageKey }
          : null;

  if (!candidate) return null;

  return {
    ...candidate,
    url: objectUrls[candidate.variant] ?? `/bff/media/${encodeURIComponent(media.id)}/object/${candidate.variant}?v=${encodeURIComponent(candidate.key)}`,
  };
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function createTimelineItemId(media: MediaDto, timestamp: string): string {
  return `tl-${videoMediaKind(media)}-${media.id}-${slugTimestamp(timestamp)}`;
}

function createShotTimelineItemId(result: VideoEditorShotSearchResult, timestamp: string): string {
  return `tl-shot-${slugId(result.shotId)}-${slugTimestamp(timestamp)}`;
}

function slugId(value: string): string {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return compact || "shot";
}

function slugTimestamp(timestamp: string): string {
  const compact = timestamp.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return compact || "now";
}

function mediaKindLabel(media: MediaDto): string {
  if (media.kind === MediaKind.Audio) return "audio";
  if (media.kind === MediaKind.Image) return "image";
  return "video";
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
