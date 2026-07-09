import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  TextTimelineItem,
  VideoClipTimelineItem,
  VideoMediaReference,
  VideoPreviewQuality,
  VideoProjectDocument,
  VideoProjectSettings,
  VideoTimelineItem,
  VideoTransform,
} from "./video-document";
import { audioItemRole, computeAudioFadeGain, effectiveAudioVolume, type AudioItemRole } from "./editor-audio";

export type PreviewObjectVariant = "proxy" | "canonical" | "raw";
export type PreviewQualityPreference = VideoPreviewQuality | PreviewObjectVariant;

export interface PreviewWarning {
  code: "missing-media" | "missing-object-url" | "unsupported-item" | "hidden-track";
  message: string;
  itemId?: string;
  mediaId?: string;
}

export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewVisualPlan {
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
  media: VideoMediaReference;
  objectUrl: string | null;
  objectVariant: PreviewObjectVariant | null;
  sourceTime: number | null;
}

export interface PreviewTextOverlayPlan {
  kind: "text";
  item: TextTimelineItem;
}

export interface PreviewMediaOverlayPlan {
  kind: "media";
  item: ImageOverlayTimelineItem;
  media: VideoMediaReference;
  objectUrl: string | null;
  objectVariant: PreviewObjectVariant | null;
}

export type PreviewOverlayPlan = PreviewTextOverlayPlan | PreviewMediaOverlayPlan;

export interface PreviewAudioPlan {
  item: AudioTimelineItem;
  trackId: string;
  role: AudioItemRole;
  media: VideoMediaReference;
  objectUrl: string | null;
  objectVariant: PreviewObjectVariant | null;
  sourceTime: number;
  volume: number;
  fadeGain: number;
  effectiveVolume: number;
  muted: boolean;
}

export interface ProgramMonitorPlan {
  document: VideoProjectDocument;
  settings: VideoProjectSettings;
  currentTime: number;
  timelineDuration: number;
  activeVisual: PreviewVisualPlan | null;
  overlays: PreviewOverlayPlan[];
  activeAudio: PreviewAudioPlan[];
  primaryAudio: PreviewAudioPlan | null;
  warnings: PreviewWarning[];
}

export function createProgramMonitorPlan({
  document,
  currentTime,
  previewQuality = document.settings.previewQuality,
  soloedAudioTrackIds = [],
  previewVolume = 1,
  previewMuted = false,
}: {
  document: VideoProjectDocument;
  currentTime: number;
  previewQuality?: PreviewQualityPreference;
  soloedAudioTrackIds?: string[];
  previewVolume?: number;
  previewMuted?: boolean;
}): ProgramMonitorPlan {
  const warnings: PreviewWarning[] = [];
  const visualCandidates: PreviewVisualPlan[] = [];
  const overlays: PreviewOverlayPlan[] = [];
  const audioCandidates: PreviewAudioPlan[] = [];
  const soloedAudioTracks = new Set(soloedAudioTrackIds);
  const hasSoloedAudioTrack = soloedAudioTracks.size > 0;

  document.tracks.forEach((track, trackIndex) => {
    if (track.hidden) {
      return;
    }

    for (const item of track.items) {
      if (!isTimelineItemActive(item, currentTime)) {
        continue;
      }

      if (item.type === "text") {
        overlays.push({ kind: "text", item });
        continue;
      }

      if (item.type === "audio") {
        if (hasSoloedAudioTrack && !soloedAudioTracks.has(track.id)) {
          continue;
        }

        const media = mediaForItem(document, item, warnings);
        if (!media) {
          continue;
        }

        const object = choosePreviewObjectUrl(media, previewQuality);
        warnIfMissingObject(object.url, item, media, warnings);
        const fadeGain = computeAudioFadeGain(item, currentTime);
        audioCandidates.push({
          item,
          trackId: track.id,
          role: audioItemRole(item),
          media,
          objectUrl: object.url,
          objectVariant: object.variant,
          sourceTime: timelineTimeToMediaSourceTime(item, currentTime),
          volume: item.volume,
          fadeGain,
          effectiveVolume: effectiveAudioVolume({
            globalVolume: previewVolume,
            itemVolume: item.volume,
            fadeGain,
          }),
          muted: previewMuted || item.muted || track.muted,
        });
        continue;
      }

      if (item.type === "video") {
        const media = mediaForItem(document, item, warnings);
        if (!media) {
          continue;
        }

        const object = choosePreviewObjectUrl(media, previewQuality);
        warnIfMissingObject(object.url, item, media, warnings);
        visualCandidates.push({
          item,
          media,
          objectUrl: object.url,
          objectVariant: object.variant,
          sourceTime: timelineTimeToMediaSourceTime(item, currentTime),
        });
        continue;
      }

      if (item.type === "image" || item.type === "overlay") {
        const media = mediaForItem(document, item, warnings);
        if (!media) {
          continue;
        }

        const object = choosePreviewObjectUrl(media, previewQuality);
        warnIfMissingObject(object.url, item, media, warnings);
        const overlay: PreviewMediaOverlayPlan = {
          kind: "media",
          item,
          media,
          objectUrl: object.url,
          objectVariant: object.variant,
        };

        if (item.type === "image" && track.kind === "video") {
          visualCandidates.push({
            item,
            media,
            objectUrl: object.url,
            objectVariant: object.variant,
            sourceTime: null,
          });
        } else {
          overlays.push(overlay);
        }
        continue;
      }

      warnings.push({
        code: "unsupported-item",
        message: `Timeline item ${item.id} cannot be previewed yet.`,
        itemId: item.id,
      });
    }

    visualCandidates.forEach((candidate) => {
      Object.assign(candidate, { trackIndex });
    });
  });

  const activeAudio = audioCandidates;

  return {
    document,
    settings: document.settings,
    currentTime,
    timelineDuration: getTimelineDuration(document),
    activeVisual: selectTopVisual(visualCandidates),
    overlays: overlays.sort(compareOverlayOrder),
    activeAudio,
    primaryAudio: activeAudio[0] ?? null,
    warnings,
  };
}

export function isTimelineItemActive(item: VideoTimelineItem, currentTime: number): boolean {
  return currentTime >= item.timelineStart && currentTime < item.timelineStart + item.duration;
}

export function choosePreviewObjectUrl(
  media: VideoMediaReference,
  preference: PreviewQualityPreference,
): { url: string | null; variant: PreviewObjectVariant | null } {
  const sourceVariant = variantFromBffObjectUrl(media.sourceUrl);
  const urls: Partial<Record<PreviewObjectVariant, string>> = {
    ...media.objectUrls,
  };

  if (media.sourceUrl && sourceVariant) {
    urls[sourceVariant] = urls[sourceVariant] ?? media.sourceUrl;
  }

  for (const variant of preferredVariants(preference)) {
    const url = urls[variant];
    if (url && isBffMediaObjectUrl(url, media.id)) {
      return { url, variant };
    }
  }

  return { url: null, variant: null };
}

export function timelineTimeToMediaSourceTime(
  item: VideoClipTimelineItem | AudioTimelineItem,
  currentTime: number,
): number {
  const sourceTime = item.sourceIn + Math.max(0, currentTime - item.timelineStart) * ("speed" in item ? item.speed : 1);
  return Math.min(item.sourceOut, Math.max(item.sourceIn, sourceTime));
}

export function mediaSourceTimeToTimelineTime(
  item: VideoClipTimelineItem | AudioTimelineItem,
  sourceTime: number,
): number {
  if (sourceTime <= item.sourceIn) {
    return item.timelineStart;
  }

  if (sourceTime >= item.sourceOut) {
    return item.timelineStart + item.duration;
  }

  const speed = "speed" in item && item.speed > 0 ? item.speed : 1;
  const timelineTime = item.timelineStart + (sourceTime - item.sourceIn) / speed;
  return Math.min(item.timelineStart + item.duration, Math.max(item.timelineStart, timelineTime));
}

export function stepPreviewTime({
  currentTime,
  direction,
  frameRate,
  timelineDuration,
  frames = 1,
}: {
  currentTime: number;
  direction: -1 | 1;
  frameRate: number;
  timelineDuration: number;
  frames?: number;
}): number {
  const frameDuration = 1 / Math.max(1, frameRate);
  const nextTime = currentTime + direction * frames * frameDuration;
  return clampTime(nextTime, timelineDuration);
}

export function getTimelineDuration(document: VideoProjectDocument): number {
  return document.tracks.reduce((duration, track) => {
    const trackDuration = track.items.reduce(
      (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
      0,
    );
    return Math.max(duration, trackDuration);
  }, 0);
}

export function computeFrameBounds(
  containerWidth: number,
  containerHeight: number,
  frameWidth: number,
  frameHeight: number,
): PreviewRect {
  if (containerWidth <= 0 || containerHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(containerWidth / frameWidth, containerHeight / frameHeight);
  const width = frameWidth * scale;
  const height = frameHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

export function computeMediaBounds({
  frameBounds,
  frameWidth,
  frameHeight,
  mediaWidth,
  mediaHeight,
  transform,
}: {
  frameBounds: PreviewRect;
  frameWidth: number;
  frameHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  transform: VideoTransform;
}): PreviewRect {
  const sourceWidth = mediaWidth && mediaWidth > 0 ? mediaWidth : frameWidth;
  const sourceHeight = mediaHeight && mediaHeight > 0 ? mediaHeight : frameHeight;
  const baseScale = Math.min(frameBounds.width / sourceWidth, frameBounds.height / sourceHeight);
  const frameScale = frameBounds.width / frameWidth;
  const width = sourceWidth * baseScale * transform.scaleX;
  const height = sourceHeight * baseScale * transform.scaleY;

  return {
    x: frameBounds.x + frameBounds.width / 2 + transform.x * frameScale - width / 2,
    y: frameBounds.y + frameBounds.height / 2 + transform.y * frameScale - height / 2,
    width,
    height,
  };
}

export function computeTextOverlayBounds({
  frameBounds,
  frameWidth,
  frameHeight,
  transform,
}: {
  frameBounds: PreviewRect;
  frameWidth: number;
  frameHeight: number;
  transform: VideoTransform;
}): PreviewRect {
  const frameScale = frameBounds.width / frameWidth;
  const baseWidth = frameBounds.width * 0.8;
  const baseHeight = frameHeight * 0.12 * frameScale;
  return {
    x: frameBounds.x + frameBounds.width * 0.1 + transform.x * frameScale,
    y: frameBounds.y + frameBounds.height / 2 + transform.y * frameScale,
    width: baseWidth * transform.scaleX,
    height: baseHeight * transform.scaleY,
  };
}

export function computeSafeGuides(frameBounds: PreviewRect): PreviewRect[] {
  const actionMarginX = frameBounds.width * 0.05;
  const actionMarginY = frameBounds.height * 0.05;
  const titleMarginX = frameBounds.width * 0.1;
  const titleMarginY = frameBounds.height * 0.1;

  return [
    {
      x: frameBounds.x + actionMarginX,
      y: frameBounds.y + actionMarginY,
      width: Math.max(0, frameBounds.width - actionMarginX * 2),
      height: Math.max(0, frameBounds.height - actionMarginY * 2),
    },
    {
      x: frameBounds.x + titleMarginX,
      y: frameBounds.y + titleMarginY,
      width: Math.max(0, frameBounds.width - titleMarginX * 2),
      height: Math.max(0, frameBounds.height - titleMarginY * 2),
    },
  ];
}

function mediaForItem(
  document: VideoProjectDocument,
  item: VideoClipTimelineItem | AudioTimelineItem | ImageOverlayTimelineItem,
  warnings: PreviewWarning[],
): VideoMediaReference | null {
  const media = document.media[item.mediaId];
  if (media) {
    return media;
  }

  warnings.push({
    code: "missing-media",
    message: `Timeline item ${item.id} references missing media ${item.mediaId}.`,
    itemId: item.id,
    mediaId: item.mediaId,
  });
  return null;
}

function warnIfMissingObject(
  objectUrl: string | null,
  item: VideoClipTimelineItem | AudioTimelineItem | ImageOverlayTimelineItem,
  media: VideoMediaReference,
  warnings: PreviewWarning[],
): void {
  if (objectUrl) {
    return;
  }

  warnings.push({
    code: "missing-object-url",
    message: `${media.name} does not have a preview object URL.`,
    itemId: item.id,
    mediaId: media.id,
  });
}

function selectTopVisual(candidates: PreviewVisualPlan[]): PreviewVisualPlan | null {
  return candidates.sort((left, right) => layerOrder(right.item) - layerOrder(left.item))[0] ?? null;
}

function compareOverlayOrder(left: PreviewOverlayPlan, right: PreviewOverlayPlan): number {
  return layerOrder(left.item) - layerOrder(right.item);
}

function layerOrder(item: VideoClipTimelineItem | ImageOverlayTimelineItem | TextTimelineItem): number {
  return "layerOrder" in item ? item.layerOrder : 0;
}

function preferredVariants(preference: PreviewQualityPreference): PreviewObjectVariant[] {
  if (preference === "full" || preference === "canonical") {
    return ["canonical", "proxy", "raw"];
  }

  if (preference === "raw") {
    return ["raw", "proxy", "canonical"];
  }

  return ["proxy", "canonical", "raw"];
}

function variantFromBffObjectUrl(url: string | undefined): PreviewObjectVariant | null {
  if (!url) {
    return null;
  }

  const match = /\/bff\/media\/[^/]+\/object\/(proxy|canonical|raw)(?:\?|$)/.exec(url);
  return match ? (match[1] as PreviewObjectVariant) : null;
}

function isBffMediaObjectUrl(url: string, mediaId: string): boolean {
  const escapedMediaId = encodeURIComponent(mediaId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/bff/media/${escapedMediaId}/object/(proxy|canonical|raw)(?:\\?|$)`).test(url);
}

function clampTime(value: number, timelineDuration: number): number {
  return Math.min(Math.max(0, timelineDuration), Math.max(0, value));
}
