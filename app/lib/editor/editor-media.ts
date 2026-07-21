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
  VideoTransform,
  VideoTrack,
  VideoTrackKind,
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

const browserDurationCache = new Map<string, Promise<number>>();

export function mediaDtoToVideoMediaReference(media: MediaDto): VideoMediaReference {
  const objectUrls = objectUrlsForMedia(media);
  const source = sourceObjectForMedia(media, objectUrls);
  const duration = durationForMedia(media);
  const thumbnail = media.thumbnailStorageKey
    ? `/bff/media/${encodeURIComponent(media.id)}/object/thumbnail?v=${encodeURIComponent(media.thumbnailStorageKey)}`
    : undefined;

  return omitUndefined({
    id: media.id,
    kind: videoMediaKind(media),
    name: media.filename,
    duration: duration ?? undefined,
    width: positiveNumberOrUndefined(media.width),
    height: positiveNumberOrUndefined(media.height),
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

export function isBuiltInEditorElementMedia(media: MediaDto): boolean {
  return media.ownerId === "elements-library" && media.id.startsWith("el_");
}

export async function hydrateMediaDurationFromBrowserMetadata(media: MediaDto): Promise<MediaDto> {
  if (media.kind === MediaKind.Image || durationForMedia(media) !== null) {
    return media;
  }

  const source = sourceObjectForMedia(media, objectUrlsForMedia(media));
  if (!source) {
    return media;
  }

  const duration = await loadBrowserMediaDuration(source.url, media.kind);
  return duration > 0 ? { ...media, durationSeconds: roundTime(duration) } : media;
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
    const transform = defaultImageTransformForMedia(document, media);
    const item: ImageOverlayTimelineItem = {
      id: itemId,
      type: targetTrack.kind === "overlay" ? "overlay" : "image",
      mediaId: media.id,
      timelineStart,
      duration,
      transform,
      crop: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
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
    if (preferredTrackId) {
      return findCompatibleTrack(document, "image", preferredTrackId);
    }
    if (isElementOverlayMedia(media)) {
      return createDedicatedOverlayTrack(document);
    }
    return findCompatibleTrack(document, "image");
  }

  return findCompatibleTrack(document, "video", preferredTrackId);
}

function durationForMedia(media: MediaDto): number | null {
  if (media.kind === MediaKind.Image) return 5;
  const duration = numberOrUndefined(media.durationSeconds);
  return duration && duration > 0 ? roundTime(duration) : null;
}

async function loadBrowserMediaDuration(url: string, kind: MediaDto["kind"]): Promise<number> {
  if (typeof document === "undefined") return 0;

  const cached = browserDurationCache.get(url);
  if (cached) return cached;

  const promise = loadElementMediaDuration(url, kind).finally(() => {
    void browserDurationCache.delete(url);
  });
  browserDurationCache.set(url, promise);
  return promise;
}

function loadElementMediaDuration(url: string, kind: MediaDto["kind"]): Promise<number> {
  return new Promise<number>((resolve) => {
    const element = document.createElement(kind === MediaKind.Audio ? "audio" : "video");
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      element.removeAttribute("src");
      element.load();
      element.onloadedmetadata = null;
      element.ondurationchange = null;
      element.ontimeupdate = null;
      element.onerror = null;
      if (timeout) clearTimeout(timeout);
    };

    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      const duration = typeof value === "number" || typeof value === "string"
        ? numberOrUndefined(value)
        : undefined;
      cleanup();
      resolve(duration && duration > 0 ? duration : 0);
    };

    const resolveIndeterminateAudioDuration = () => {
      if (kind !== MediaKind.Audio || Number.isFinite(element.duration)) return;
      const previousTime = element.currentTime;
      element.ontimeupdate = () => {
        element.ontimeupdate = null;
        finish(element.duration);
        try {
          element.currentTime = previousTime;
        } catch {
          // The element is being torn down after duration discovery.
        }
      };
      try {
        element.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        finish(0);
      }
    };

    element.preload = "metadata";
    element.onloadedmetadata = () => {
      if (kind === MediaKind.Audio && !Number.isFinite(element.duration)) {
        resolveIndeterminateAudioDuration();
        return;
      }
      finish(element.duration);
    };
    element.ondurationchange = () => {
      if (numberOrUndefined(element.duration)) {
        finish(element.duration);
      } else {
        resolveIndeterminateAudioDuration();
      }
    };
    element.onerror = () => finish(0);
    timeout = setTimeout(() => finish(0), 8000);
    element.src = url;
    element.load();
  });
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

/**
 * Creates a new overlay track with a unique ID.
 * The track is a virtual placeholder — it will be materialised by the
 * operation application layer when the item is actually added.
 */
function createDedicatedOverlayTrack(document: VideoProjectDocument): VideoTrack {
  const overlayCount = document.tracks.filter((track) => track.kind === "overlay").length;
  return {
    id: `o-${crypto.randomUUID()}`,
    kind: "overlay" as VideoTrackKind,
    label: `O${overlayCount + 1}`,
    locked: false,
    hidden: false,
    muted: false,
    items: [],
  };
}

function defaultImageTransformForMedia(document: VideoProjectDocument, media: MediaDto): VideoTransform {
  const transform = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };

  if (!isElementOverlayMedia(media)) {
    return transform;
  }

  const mediaWidth = positiveNumberOrUndefined(media.width) ?? 100;
  const mediaHeight = positiveNumberOrUndefined(media.height) ?? 100;
  const projectWidth = positiveNumberOrUndefined(document.settings.width) ?? 1920;
  const projectHeight = positiveNumberOrUndefined(document.settings.height) ?? 1080;
  const fitScale = Math.min(projectWidth / mediaWidth, projectHeight / mediaHeight);
  const targetLongSide = Math.min(180, Math.max(96, Math.min(projectWidth, projectHeight) * 0.16));
  const iconScale = fitScale > 0
    ? targetLongSide / (Math.max(mediaWidth, mediaHeight) * fitScale)
    : 1;

  return {
    ...transform,
    scaleX: roundTime(Math.max(0.01, iconScale)),
    scaleY: roundTime(Math.max(0.01, iconScale)),
  };
}

function isElementOverlayMedia(media: MediaDto): boolean {
  return (
    (media.ownerId === "iconify" && media.id.startsWith("iconify_")) ||
    media.id.startsWith("el_")
  );
}

function objectUrlsForMedia(media: MediaDto): Partial<Record<"proxy" | "canonical" | "raw", string>> {
  return omitUndefined({
    proxy: media.proxyStorageKey
      ? objectUrlForStorageKey(media.id, "proxy", media.proxyStorageKey)
      : undefined,
    canonical: media.canonicalStorageKey
      ? objectUrlForStorageKey(media.id, "canonical", media.canonicalStorageKey)
      : undefined,
    raw: media.storageKey
      ? objectUrlForStorageKey(media.id, "raw", media.storageKey)
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
    url: objectUrls[candidate.variant] ?? objectUrlForStorageKey(media.id, candidate.variant, candidate.key),
  };
}

function objectUrlForStorageKey(
  mediaId: string,
  variant: "proxy" | "canonical" | "raw",
  storageKey: string,
): string {
  if (isDirectMediaUrl(storageKey)) return storageKey;
  return `/bff/media/${encodeURIComponent(mediaId)}/object/${variant}?v=${encodeURIComponent(storageKey)}`;
}

function isDirectMediaUrl(value: string): boolean {
  return /^(?:https?:|data:|blob:)/i.test(value);
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function positiveNumberOrUndefined(value: number | string | null | undefined): number | undefined {
  const numeric = numberOrUndefined(value);
  return numeric !== undefined && numeric > 0 ? numeric : undefined;
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

export interface DraggedMediaInfo {
  id: string;
  kind: number;
}

let activeDraggedMedia: DraggedMediaInfo | null = null;

export function setActiveDraggedMedia(media: DraggedMediaInfo | null) {
  activeDraggedMedia = media;
}

export function getActiveDraggedMedia(): DraggedMediaInfo | null {
  return activeDraggedMedia;
}
