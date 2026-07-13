import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  TextTimelineItem,
  VideoClipTimelineItem,
  VideoCrop,
  VideoMediaReference,
  VideoPreviewQuality,
  VideoProjectDocument,
  VideoProjectSettings,
  VideoTimelineItem,
  VideoTransform,
} from "./video-document";
import { audioItemRole, computeAudioFadeGain, effectiveAudioVolume, type AudioItemRole } from "./editor-audio";
import { evaluateVideoSourceTime, evaluateVisualState } from "./video-evaluation";
import { videoStackOrderMap } from "./video-stack";

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

export interface PreviewPoint {
  x: number;
  y: number;
}

export type VisualResizeCorner = "nw" | "ne" | "sw" | "se";
export type CropEdge = "top" | "right" | "bottom" | "left";
export type VisualTransformPreset = "fit" | "fill" | "center" | "reset" | "original-size";

export interface CroppedSourceGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropTransformResult {
  crop: VideoCrop;
  transform: VideoTransform;
}

export interface ProjectMediaGeometry {
  center: PreviewPoint;
  width: number;
  height: number;
  rotation: number;
  corners: Record<VisualResizeCorner, PreviewPoint>;
  edgeCenters: {
    top: PreviewPoint;
    right: PreviewPoint;
    bottom: PreviewPoint;
    left: PreviewPoint;
  };
}

export interface PreviewMediaGeometry extends ProjectMediaGeometry {
  bounds: PreviewRect;
}

export interface InteractiveHandlePlacement {
  actual: PreviewPoint;
  reachable: PreviewPoint;
  pointerOffset: PreviewPoint;
}

export interface PreviewVisualPlan {
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
  trackIndex: number;
  media: VideoMediaReference;
  objectUrl: string | null;
  objectVariant: PreviewObjectVariant | null;
  sourceTime: number | null;
  stackOrder: number;
  audioMuted?: boolean;
  audioVolume?: number;
}

export interface PreviewTextOverlayPlan {
  kind: "text";
  item: TextTimelineItem;
  stackOrder: number;
  opacity: number;
}

export interface PreviewMediaOverlayPlan {
  kind: "media";
  item: ImageOverlayTimelineItem;
  media: VideoMediaReference;
  objectUrl: string | null;
  objectVariant: PreviewObjectVariant | null;
  stackOrder: number;
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
  visuals: PreviewVisualPlan[];
  activeVisual: PreviewVisualPlan | null;
  activeVideo: PreviewVisualPlan | null;
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
  const stackOrderByItemId = videoStackOrderMap(document);

  document.tracks.forEach((track, trackIndex) => {
    if (track.hidden) {
      return;
    }

    for (const item of track.items) {
      if (!isTimelineItemActive(item, currentTime)) {
        continue;
      }

      if (item.type === "text") {
        const evaluated = evaluateVisualState(item, currentTime);
        overlays.push({
          kind: "text",
          item: evaluated ? { ...item, transform: evaluated.transform } : item,
          stackOrder: stackOrderByItemId.get(item.id) ?? 0,
          opacity: evaluated?.opacity ?? 1,
        });
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
          item: evaluatedVisualItem(item, currentTime),
          trackIndex,
          media,
          objectUrl: object.url,
          objectVariant: object.variant,
          sourceTime: evaluateVideoSourceTime(item, currentTime),
          stackOrder: stackOrderByItemId.get(item.id) ?? 0,
          audioMuted: previewMuted || track.muted || (hasSoloedAudioTrack && !soloedAudioTracks.has(track.id)),
          audioVolume: Math.max(0, Math.min(1, previewVolume)),
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
          item: evaluatedVisualItem(item, currentTime),
          media,
          objectUrl: object.url,
          objectVariant: object.variant,
          stackOrder: stackOrderByItemId.get(item.id) ?? 0,
        };

        if (item.type === "image" && track.kind === "video") {
          visualCandidates.push({
            item: overlay.item,
            trackIndex,
            media,
            objectUrl: object.url,
            objectVariant: object.variant,
            sourceTime: null,
            stackOrder: stackOrderByItemId.get(item.id) ?? 0,
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

  });

  const activeAudio = audioCandidates;

  const visuals = sortVisualStack(visualCandidates);
  return {
    document,
    settings: document.settings,
    currentTime,
    timelineDuration: getTimelineDuration(document),
    visuals,
    activeVisual: visuals.at(-1) ?? null,
    activeVideo: topVideoVisual(visuals),
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

  if (media.sourceUrl && isDirectPreviewUrl(media.sourceUrl)) {
    return { url: media.sourceUrl, variant: null };
  }

  for (const variant of preferredVariants(preference)) {
    const url = urls[variant];
    if (url && isBffMediaObjectUrl(url, media.id)) {
      return { url, variant };
    }

    if (url && isDirectPreviewUrl(url)) {
      return { url, variant };
    }
  }

  return { url: null, variant: null };
}

export function timelineTimeToMediaSourceTime(
  item: VideoClipTimelineItem | AudioTimelineItem,
  currentTime: number,
): number {
  if (item.type === "video") return evaluateVideoSourceTime(item, currentTime);
  const sourceTime = item.sourceIn + Math.max(0, currentTime - item.timelineStart);
  return Math.min(item.sourceOut, Math.max(item.sourceIn, sourceTime));
}

function evaluatedVisualItem<T extends VideoClipTimelineItem | ImageOverlayTimelineItem>(item: T, currentTime: number): T {
  const evaluated = evaluateVisualState(item, currentTime);
  if (!evaluated) return item;
  return {
    ...item,
    transform: evaluated.transform,
    opacity: evaluated.opacity,
    ...(evaluated.crop ? { crop: evaluated.crop } : {}),
  } as T;
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
  crop,
}: {
  frameBounds: PreviewRect;
  frameWidth: number;
  frameHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  transform: VideoTransform;
  crop?: VideoCrop;
}): PreviewRect {
  return computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth,
    frameHeight,
    mediaWidth,
    mediaHeight,
    transform,
    crop,
  }).bounds;
}

export function computeCenterOriginMediaGeometry({
  frameBounds,
  frameWidth,
  frameHeight,
  mediaWidth,
  mediaHeight,
  transform,
  crop,
}: {
  frameBounds: PreviewRect;
  frameWidth: number;
  frameHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  transform: VideoTransform;
  crop?: VideoCrop;
}): PreviewMediaGeometry {
  const projectGeometry = computeProjectMediaGeometry({
    projectWidth: frameWidth,
    projectHeight: frameHeight,
    mediaWidth,
    mediaHeight,
    transform,
    crop,
  });
  const frameScale = frameBounds.width / frameWidth;
  const center = projectPointToPreviewPoint(projectGeometry.center, frameBounds, frameWidth, frameHeight);
  const width = projectGeometry.width * frameScale;
  const height = projectGeometry.height * frameScale;
  const corners = mapPointRecord(projectGeometry.corners, (point) =>
    projectPointToPreviewPoint(point, frameBounds, frameWidth, frameHeight),
  );
  const edgeCenters = mapPointRecord(projectGeometry.edgeCenters, (point) =>
    projectPointToPreviewPoint(point, frameBounds, frameWidth, frameHeight),
  );

  return {
    center,
    width,
    height,
    rotation: projectGeometry.rotation,
    corners,
    edgeCenters,
    bounds: {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    },
  };
}

export function computeProjectMediaGeometry({
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  transform,
  crop,
}: {
  projectWidth: number;
  projectHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  transform: VideoTransform;
  crop?: VideoCrop;
}): ProjectMediaGeometry {
  const sourceWidth = mediaWidth && mediaWidth > 0 ? mediaWidth : projectWidth;
  const sourceHeight = mediaHeight && mediaHeight > 0 ? mediaHeight : projectHeight;
  const croppedSource = computeCroppedSourceGeometry(sourceWidth, sourceHeight, crop);
  const safeProjectWidth = Math.max(0, projectWidth);
  const safeProjectHeight = Math.max(0, projectHeight);
  const baseScale = sourceWidth > 0 && sourceHeight > 0
    ? Math.min(safeProjectWidth / croppedSource.width, safeProjectHeight / croppedSource.height)
    : 0;
  const width = croppedSource.width * baseScale * Math.abs(transform.scaleX);
  const height = croppedSource.height * baseScale * Math.abs(transform.scaleY);
  const center = {
    x: safeProjectWidth / 2 + transform.x,
    y: safeProjectHeight / 2 + transform.y,
  };
  const rotation = normalizeRotation(transform.rotation);
  const corners = rotatedMediaCorners(center, width, height, rotation);

  return {
    center,
    width,
    height,
    rotation,
    corners,
    edgeCenters: {
      top: midpoint(corners.nw, corners.ne),
      right: midpoint(corners.ne, corners.se),
      bottom: midpoint(corners.sw, corners.se),
      left: midpoint(corners.nw, corners.sw),
    },
  };
}

export function computeCroppedSourceGeometry(
  mediaWidth: number,
  mediaHeight: number,
  crop: VideoCrop = zeroCrop(),
): CroppedSourceGeometry {
  const width = Math.max(0, mediaWidth);
  const height = Math.max(0, mediaHeight);
  return {
    x: width * crop.left,
    y: height * crop.top,
    width: width * Math.max(0, 1 - crop.left - crop.right),
    height: height * Math.max(0, 1 - crop.top - crop.bottom),
  };
}

export function cropSourcePixelDensity({
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  crop,
  transform,
}: {
  projectWidth: number;
  projectHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  crop: VideoCrop;
  transform: VideoTransform;
}): PreviewPoint {
  const source = computeCroppedSourceGeometry(mediaWidth, mediaHeight, crop);
  const baseScale = Math.min(projectWidth / source.width, projectHeight / source.height);
  return {
    x: baseScale * Math.abs(transform.scaleX),
    y: baseScale * Math.abs(transform.scaleY),
  };
}

export function resizeCropFromOppositeEdge({
  crop,
  transform,
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  edge,
  pointer,
}: {
  crop: VideoCrop;
  transform: VideoTransform;
  projectWidth: number;
  projectHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  edge: CropEdge;
  pointer: PreviewPoint;
}): CropTransformResult {
  const geometry = computeProjectMediaGeometry({
    projectWidth,
    projectHeight,
    mediaWidth,
    mediaHeight,
    transform,
    crop,
  });
  const density = cropSourcePixelDensity({ projectWidth, projectHeight, mediaWidth, mediaHeight, crop, transform });
  const horizontal = edge === "left" || edge === "right";
  const oppositePoint = geometry.edgeCenters[oppositeCropEdge(edge)];
  const localPointer = rotatePointAround(pointer, oppositePoint, -geometry.rotation);
  const direction = edge === "right" || edge === "bottom" ? 1 : -1;
  const requestedProjectSpan = horizontal
    ? direction * (localPointer.x - oppositePoint.x)
    : direction * (localPointer.y - oppositePoint.y);
  const axisDensity = horizontal ? density.x : density.y;
  const sourceDimension = horizontal ? mediaWidth : mediaHeight;
  const minimumProjectSpan = axisDensity;
  const nextSourceSpan = Math.min(
    sourceDimension * (horizontal
      ? 1 - (edge === "left" ? crop.right : crop.left)
      : 1 - (edge === "top" ? crop.bottom : crop.top)),
    Math.max(1, Math.max(minimumProjectSpan, requestedProjectSpan) / axisDensity),
  );
  const normalizedSpan = nextSourceSpan / sourceDimension;
  const nextCrop: VideoCrop = { ...crop };
  if (edge === "left") nextCrop.left = 1 - crop.right - normalizedSpan;
  if (edge === "right") nextCrop.right = 1 - crop.left - normalizedSpan;
  if (edge === "top") nextCrop.top = 1 - crop.bottom - normalizedSpan;
  if (edge === "bottom") nextCrop.bottom = 1 - crop.top - normalizedSpan;

  const nextSource = computeCroppedSourceGeometry(mediaWidth, mediaHeight, nextCrop);
  const nextBaseScale = Math.min(projectWidth / nextSource.width, projectHeight / nextSource.height);
  const nextWidth = nextSource.width * density.x;
  const nextHeight = nextSource.height * density.y;
  const localCenterOffset = horizontal
    ? { x: direction * nextWidth / 2, y: 0 }
    : { x: 0, y: direction * nextHeight / 2 };
  const rotatedCenterOffset = rotateVector(localCenterOffset, geometry.rotation);
  const center = {
    x: oppositePoint.x + rotatedCenterOffset.x,
    y: oppositePoint.y + rotatedCenterOffset.y,
  };

  return {
    crop: nextCrop,
    transform: {
      ...transform,
      x: center.x - projectWidth / 2,
      y: center.y - projectHeight / 2,
      scaleX: density.x / nextBaseScale,
      scaleY: density.y / nextBaseScale,
    },
  };
}

export function panCropSourceWindow({
  crop,
  transform,
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  projectDelta,
}: {
  crop: VideoCrop;
  transform: VideoTransform;
  projectWidth: number;
  projectHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  projectDelta: PreviewPoint;
}): VideoCrop {
  const density = cropSourcePixelDensity({ projectWidth, projectHeight, mediaWidth, mediaHeight, crop, transform });
  const localDelta = rotateVector(projectDelta, -normalizeRotation(transform.rotation));
  const horizontalSpan = 1 - crop.left - crop.right;
  const verticalSpan = 1 - crop.top - crop.bottom;
  const left = clampNumber(crop.left - localDelta.x / density.x / mediaWidth, 0, 1 - horizontalSpan);
  const top = clampNumber(crop.top - localDelta.y / density.y / mediaHeight, 0, 1 - verticalSpan);
  return {
    left,
    right: 1 - horizontalSpan - left,
    top,
    bottom: 1 - verticalSpan - top,
  };
}

export function applyEvaluatedCropTransformDeltasToRaw({
  rawCrop,
  rawTransform,
  evaluatedCrop,
  evaluatedTransform,
  nextEvaluatedCrop,
  nextEvaluatedTransform,
}: {
  rawCrop: VideoCrop;
  rawTransform: VideoTransform;
  evaluatedCrop: VideoCrop;
  evaluatedTransform: VideoTransform;
  nextEvaluatedCrop: VideoCrop;
  nextEvaluatedTransform: VideoTransform;
}): CropTransformResult {
  return {
    crop: {
      top: rawCrop.top + nextEvaluatedCrop.top - evaluatedCrop.top,
      right: rawCrop.right + nextEvaluatedCrop.right - evaluatedCrop.right,
      bottom: rawCrop.bottom + nextEvaluatedCrop.bottom - evaluatedCrop.bottom,
      left: rawCrop.left + nextEvaluatedCrop.left - evaluatedCrop.left,
    },
    transform: {
      ...rawTransform,
      x: rawTransform.x + nextEvaluatedTransform.x - evaluatedTransform.x,
      y: rawTransform.y + nextEvaluatedTransform.y - evaluatedTransform.y,
      scaleX: rawTransform.scaleX * nextEvaluatedTransform.scaleX / Math.max(0.01, Math.abs(evaluatedTransform.scaleX)),
      scaleY: rawTransform.scaleY * nextEvaluatedTransform.scaleY / Math.max(0.01, Math.abs(evaluatedTransform.scaleY)),
    },
  };
}

export function roundCropForCommit(crop: VideoCrop, mediaWidth?: number, mediaHeight?: number): VideoCrop {
  const rounded = {
    top: roundTo(crop.top, 6),
    right: roundTo(crop.right, 6),
    bottom: roundTo(crop.bottom, 6),
    left: roundTo(crop.left, 6),
  };
  return mediaWidth && mediaHeight ? clampCropToSourcePixels(rounded, mediaWidth, mediaHeight) : rounded;
}

export function clampCropToSourcePixels(crop: VideoCrop, mediaWidth: number, mediaHeight: number): VideoCrop {
  const minimumWidth = 1 / mediaWidth;
  const minimumHeight = 1 / mediaHeight;
  const left = clampNumber(crop.left, 0, 1 - minimumWidth);
  const right = clampNumber(crop.right, 0, 1 - minimumWidth - left);
  const top = clampNumber(crop.top, 0, 1 - minimumHeight);
  const bottom = clampNumber(crop.bottom, 0, 1 - minimumHeight - top);
  return { top, right, bottom, left };
}

export function rotatedMediaCorners(
  center: PreviewPoint,
  width: number,
  height: number,
  rotation: number,
): Record<VisualResizeCorner, PreviewPoint> {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return {
    nw: rotatePointAround({ x: center.x - halfWidth, y: center.y - halfHeight }, center, rotation),
    ne: rotatePointAround({ x: center.x + halfWidth, y: center.y - halfHeight }, center, rotation),
    sw: rotatePointAround({ x: center.x - halfWidth, y: center.y + halfHeight }, center, rotation),
    se: rotatePointAround({ x: center.x + halfWidth, y: center.y + halfHeight }, center, rotation),
  };
}

export function resizeVisualFromOppositeCorner({
  transform,
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  corner,
  pointer,
  linked,
  minimumScale = 0.01,
}: {
  transform: VideoTransform;
  projectWidth: number;
  projectHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  corner: VisualResizeCorner;
  pointer: PreviewPoint;
  linked: boolean;
  minimumScale?: number;
}): VideoTransform {
  const geometry = computeProjectMediaGeometry({ projectWidth, projectHeight, mediaWidth, mediaHeight, transform });
  const opposite = oppositeResizeCorner(corner);
  const anchor = geometry.corners[opposite];
  const horizontalSign = corner.endsWith("e") ? 1 : -1;
  const verticalSign = corner.startsWith("s") ? 1 : -1;
  const localPointer = rotatePointAround(pointer, anchor, -geometry.rotation);
  const startScaleX = Math.max(minimumScale, Math.abs(transform.scaleX));
  const startScaleY = Math.max(minimumScale, Math.abs(transform.scaleY));
  let nextScaleX: number;
  let nextScaleY: number;

  if (linked) {
    const startVector = {
      x: horizontalSign * geometry.width,
      y: verticalSign * geometry.height,
    };
    const pointerVector = { x: localPointer.x - anchor.x, y: localPointer.y - anchor.y };
    const denominator = startVector.x ** 2 + startVector.y ** 2;
    const requestedMultiplier = denominator > 0
      ? (pointerVector.x * startVector.x + pointerVector.y * startVector.y) / denominator
      : 1;
    const minimumMultiplier = Math.max(minimumScale / startScaleX, minimumScale / startScaleY);
    const multiplier = Math.max(minimumMultiplier, requestedMultiplier);
    nextScaleX = startScaleX * multiplier;
    nextScaleY = startScaleY * multiplier;
  } else {
    const baseWidth = geometry.width / startScaleX;
    const baseHeight = geometry.height / startScaleY;
    const requestedWidth = horizontalSign * (localPointer.x - anchor.x);
    const requestedHeight = verticalSign * (localPointer.y - anchor.y);
    nextScaleX = Math.max(minimumScale, baseWidth > 0 ? requestedWidth / baseWidth : startScaleX);
    nextScaleY = Math.max(minimumScale, baseHeight > 0 ? requestedHeight / baseHeight : startScaleY);
  }

  const nextWidth = geometry.width * (nextScaleX / startScaleX);
  const nextHeight = geometry.height * (nextScaleY / startScaleY);
  const unrotatedCenter = {
    x: anchor.x + horizontalSign * nextWidth / 2,
    y: anchor.y + verticalSign * nextHeight / 2,
  };
  const nextCenter = rotatePointAround(unrotatedCenter, anchor, geometry.rotation);
  return {
    ...transform,
    x: nextCenter.x - projectWidth / 2,
    y: nextCenter.y - projectHeight / 2,
    scaleX: nextScaleX,
    scaleY: nextScaleY,
  };
}

export function previewPointToProjectPoint(
  point: PreviewPoint,
  frameBounds: PreviewRect,
  projectWidth: number,
  projectHeight: number,
): PreviewPoint {
  const scale = frameBounds.width > 0 && projectWidth > 0 ? projectWidth / frameBounds.width : 0;
  return {
    x: (point.x - frameBounds.x) * scale,
    y: (point.y - frameBounds.y) * (frameBounds.height > 0 ? projectHeight / frameBounds.height : scale),
  };
}

export function projectPointToPreviewPoint(
  point: PreviewPoint,
  frameBounds: PreviewRect,
  projectWidth: number,
  projectHeight: number,
): PreviewPoint {
  return {
    x: frameBounds.x + point.x * (projectWidth > 0 ? frameBounds.width / projectWidth : 0),
    y: frameBounds.y + point.y * (projectHeight > 0 ? frameBounds.height / projectHeight : 0),
  };
}

export function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) return 0;
  const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function snapRotation(rotation: number, increment = 15): number {
  if (!Number.isFinite(increment) || increment <= 0) return normalizeRotation(rotation);
  return normalizeRotation(Math.round(rotation / increment) * increment);
}

export function rotationForPointer({
  center,
  startPointer,
  pointer,
  startRotation,
  snap = false,
}: {
  center: PreviewPoint;
  startPointer: PreviewPoint;
  pointer: PreviewPoint;
  startRotation: number;
  snap?: boolean;
}): number {
  const startAngle = Math.atan2(startPointer.y - center.y, startPointer.x - center.x) * 180 / Math.PI;
  const pointerAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180 / Math.PI;
  const rotation = normalizeRotation(startRotation + normalizeRotation(pointerAngle - startAngle));
  return snap ? snapRotation(rotation) : rotation;
}

export function clampInteractiveHandle(
  actual: PreviewPoint,
  stageBounds: PreviewRect,
  margin = 8,
): InteractiveHandlePlacement {
  const minX = stageBounds.x + margin;
  const maxX = stageBounds.x + Math.max(margin, stageBounds.width - margin);
  const minY = stageBounds.y + margin;
  const maxY = stageBounds.y + Math.max(margin, stageBounds.height - margin);
  const reachable = {
    x: Math.min(maxX, Math.max(minX, actual.x)),
    y: Math.min(maxY, Math.max(minY, actual.y)),
  };
  return {
    actual,
    reachable,
    pointerOffset: { x: actual.x - reachable.x, y: actual.y - reachable.y },
  };
}

export function applyHandlePointerOffset(pointer: PreviewPoint, placement: InteractiveHandlePlacement): PreviewPoint {
  return {
    x: pointer.x + placement.pointerOffset.x,
    y: pointer.y + placement.pointerOffset.y,
  };
}

export function roundVisualTransformForCommit(transform: VideoTransform): VideoTransform {
  return {
    ...transform,
    x: Math.round(transform.x),
    y: Math.round(transform.y),
    scaleX: roundTo(Math.max(0.01, Math.abs(transform.scaleX)), 6),
    scaleY: roundTo(Math.max(0.01, Math.abs(transform.scaleY)), 6),
    rotation: roundTo(normalizeRotation(transform.rotation), 1),
  };
}

export function computeVisualTransformPreset({
  preset,
  transform,
  projectWidth,
  projectHeight,
  mediaWidth,
  mediaHeight,
  crop,
}: {
  preset: VisualTransformPreset;
  transform: VideoTransform;
  projectWidth: number;
  projectHeight: number;
  mediaWidth?: number;
  mediaHeight?: number;
  crop?: VideoCrop;
}): VideoTransform | null {
  if (preset === "center") {
    return { ...transform, x: 0, y: 0 };
  }

  if (preset === "reset") {
    return {
      ...transform,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };
  }

  if (
    !isPositiveDimension(projectWidth) ||
    !isPositiveDimension(projectHeight) ||
    !isPositiveDimension(mediaWidth) ||
    !isPositiveDimension(mediaHeight)
  ) {
    return null;
  }

  const croppedSource = computeCroppedSourceGeometry(mediaWidth, mediaHeight, crop);
  const visibleWidth = croppedSource.width;
  const visibleHeight = croppedSource.height;
  const baseScale = Math.min(projectWidth / visibleWidth, projectHeight / visibleHeight);
  if (!isPositiveDimension(baseScale)) return null;
  const baseWidth = visibleWidth * baseScale;
  const baseHeight = visibleHeight * baseScale;
  const radians = normalizeRotation(transform.rotation) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  let uniformScale: number;

  if (preset === "fit") {
    const rotatedWidth = cosine * baseWidth + sine * baseHeight;
    const rotatedHeight = sine * baseWidth + cosine * baseHeight;
    uniformScale = Math.min(projectWidth / rotatedWidth, projectHeight / rotatedHeight);
  } else if (preset === "fill") {
    uniformScale = Math.max(
      (cosine * projectWidth + sine * projectHeight) / baseWidth,
      (sine * projectWidth + cosine * projectHeight) / baseHeight,
    );
  } else {
    uniformScale = 1 / baseScale;
  }

  if (!isPositiveDimension(uniformScale)) return null;
  return {
    ...transform,
    x: 0,
    y: 0,
    scaleX: roundTo(Math.max(0.01, uniformScale), 6),
    scaleY: roundTo(Math.max(0.01, uniformScale), 6),
    rotation: roundTo(normalizeRotation(transform.rotation), 1),
  };
}

function oppositeResizeCorner(corner: VisualResizeCorner): VisualResizeCorner {
  const opposite: Record<VisualResizeCorner, VisualResizeCorner> = {
    nw: "se",
    ne: "sw",
    sw: "ne",
    se: "nw",
  };
  return opposite[corner];
}

function rotatePointAround(point: PreviewPoint, center: PreviewPoint, rotation: number): PreviewPoint {
  const radians = rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;
  return {
    x: center.x + deltaX * cosine - deltaY * sine,
    y: center.y + deltaX * sine + deltaY * cosine,
  };
}

function rotateVector(vector: PreviewPoint, rotation: number): PreviewPoint {
  const radians = rotation * Math.PI / 180;
  return {
    x: vector.x * Math.cos(radians) - vector.y * Math.sin(radians),
    y: vector.x * Math.sin(radians) + vector.y * Math.cos(radians),
  };
}

function oppositeCropEdge(edge: CropEdge): CropEdge {
  return ({ top: "bottom", right: "left", bottom: "top", left: "right" } as const)[edge];
}

function zeroCrop(): VideoCrop {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function midpoint(left: PreviewPoint, right: PreviewPoint): PreviewPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function mapPointRecord<T extends string>(
  points: Record<T, PreviewPoint>,
  map: (point: PreviewPoint) => PreviewPoint,
): Record<T, PreviewPoint> {
  return Object.fromEntries(
    Object.entries(points).map(([key, point]) => [key, map(point as PreviewPoint)]),
  ) as Record<T, PreviewPoint>;
}

function roundTo(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function isPositiveDimension(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function previewDeltaToProjectDelta(
  previewDelta: number,
  frameBounds: Pick<PreviewRect, "width">,
  projectWidth: number,
): number {
  if (!Number.isFinite(previewDelta) || frameBounds.width <= 0 || projectWidth <= 0) {
    return 0;
  }

  return previewDelta / (frameBounds.width / projectWidth);
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

function sortVisualStack(candidates: PreviewVisualPlan[]): PreviewVisualPlan[] {
  return candidates.sort((left, right) => left.stackOrder - right.stackOrder);
}

function topVideoVisual(candidates: PreviewVisualPlan[]): PreviewVisualPlan | null {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index].item.type === "video") return candidates[index];
  }
  return null;
}

function compareOverlayOrder(left: PreviewOverlayPlan, right: PreviewOverlayPlan): number {
  return left.stackOrder - right.stackOrder;
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

function isDirectPreviewUrl(url: string): boolean {
  return /^(?:https?:|data:|blob:)/i.test(url);
}

function clampTime(value: number, timelineDuration: number): number {
  return Math.min(Math.max(0, timelineDuration), Math.max(0, value));
}
