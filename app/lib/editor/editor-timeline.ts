import { MediaKind, type MediaDto } from "~/lib/api";

import type {
  AudioTimelineItem,
  VideoClipTimelineItem,
  VideoProjectDocument,
  VideoTimelineItem,
  VideoTrack,
  VideoTrackKind,
} from "./video-document";
import type { SplitItemOperation, TrimItemOperation, VideoOperationMetadata } from "./video-operations";

export const TIMELINE_HEADER_HEIGHT = 32;
export const TIMELINE_TRACK_HEADER_WIDTH = 168;
export const TIMELINE_MIN_ITEM_WIDTH = 18;
export const TIMELINE_FRAME_FLOOR_SECONDS = 1 / 120;

export interface TimelineScale {
  zoom: number;
  pixelsPerSecond: number;
}

export interface TimelineTrackLayout {
  track: VideoTrack;
  trackIndex: number;
  top: number;
  height: number;
  hidden: boolean;
  locked: boolean;
}

export interface TimelineItemLayout {
  trackId: string;
  trackIndex: number;
  item: VideoTimelineItem;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TimelineHit {
  trackId: string | null;
  itemId: string | null;
  edge: "start" | "end" | "body" | null;
}

export interface SnapTarget {
  time: number;
  kind: "zero" | "playhead" | "item-start" | "item-end";
  itemId?: string;
}

export interface SnapResult {
  time: number;
  snapped: boolean;
  target?: SnapTarget;
}

export interface DropPlacement {
  trackId: string;
  timelineStart: number;
}

export type DropPlan =
  | { ok: true; placement: DropPlacement; track: VideoTrack }
  | { ok: false; reason: string; trackId?: string; timelineStart?: number };

export interface TrimPlan {
  operation: Omit<TrimItemOperation, keyof VideoOperationMetadata>;
}

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function timelineScale(zoom: number): TimelineScale {
  const normalized = Math.min(100, Math.max(1, zoom));
  return {
    zoom: normalized,
    pixelsPerSecond: 6 + ((normalized - 1) / 99) * 54,
  };
}

export function timeToPixel(time: number, scale: TimelineScale): number {
  return time * scale.pixelsPerSecond;
}

export function pixelToTime(pixel: number, scale: TimelineScale): number {
  return Math.max(0, pixel / scale.pixelsPerSecond);
}

export function timelineDuration(document: VideoProjectDocument, floor = 60): number {
  const duration = document.tracks.reduce((maxDuration, track) => {
    const trackDuration = track.items.reduce(
      (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
      0,
    );
    return Math.max(maxDuration, trackDuration);
  }, 0);
  return Math.max(floor, Math.ceil(duration + 4));
}

export function createTrackLayouts(document: VideoProjectDocument): TimelineTrackLayout[] {
  let top = 0;
  return document.tracks.map((track, trackIndex) => {
    const height = trackHeight(track.kind);
    const layout: TimelineTrackLayout = {
      track,
      trackIndex,
      top,
      height,
      hidden: track.hidden,
      locked: track.locked,
    };
    top += height;
    return layout;
  });
}

export function createItemLayouts(
  document: VideoProjectDocument,
  scale: TimelineScale,
): TimelineItemLayout[] {
  const trackLayouts = createTrackLayouts(document);
  return trackLayouts.flatMap((trackLayout) =>
    trackLayout.track.items.map((item) => ({
      trackId: trackLayout.track.id,
      trackIndex: trackLayout.trackIndex,
      item,
      left: timeToPixel(item.timelineStart, scale),
      top: trackLayout.top + 5,
      width: Math.max(TIMELINE_MIN_ITEM_WIDTH, timeToPixel(item.duration, scale)),
      height: Math.max(28, trackLayout.height - 10),
    })),
  );
}

export function hitTestTimeline(
  x: number,
  y: number,
  trackLayouts: TimelineTrackLayout[],
  itemLayouts: TimelineItemLayout[],
): TimelineHit {
  const track = trackLayouts.find((layout) => y >= layout.top && y < layout.top + layout.height);
  const item = itemLayouts
    .filter((layout) => layout.trackId === track?.track.id)
    .slice()
    .reverse()
    .find((layout) => x >= layout.left && x <= layout.left + layout.width && y >= layout.top && y <= layout.top + layout.height);

  if (!track) {
    return { trackId: null, itemId: null, edge: null };
  }

  if (!item) {
    return { trackId: track.track.id, itemId: null, edge: null };
  }

  const handleWidth = Math.min(10, Math.max(5, item.width / 4));
  const edge = x - item.left <= handleWidth
    ? "start"
    : item.left + item.width - x <= handleWidth
      ? "end"
      : "body";

  return { trackId: track.track.id, itemId: item.item.id, edge };
}

export function snapTime({
  time,
  document,
  playheadTime,
  enabled,
  scale,
  excludeItemIds = [],
  thresholdPixels = 8,
}: {
  time: number;
  document: VideoProjectDocument;
  playheadTime: number;
  enabled: boolean;
  scale: TimelineScale;
  excludeItemIds?: string[];
  thresholdPixels?: number;
}): SnapResult {
  const clamped = Math.max(0, time);
  if (!enabled) return { time: clamped, snapped: false };

  const excluded = new Set(excludeItemIds);
  const targets: SnapTarget[] = [
    { time: 0, kind: "zero" },
    { time: playheadTime, kind: "playhead" },
  ];

  for (const track of document.tracks) {
    for (const item of track.items) {
      if (excluded.has(item.id)) continue;
      targets.push({ time: item.timelineStart, kind: "item-start", itemId: item.id });
      targets.push({ time: item.timelineStart + item.duration, kind: "item-end", itemId: item.id });
    }
  }

  let best: { target: SnapTarget; distancePixels: number } | null = null;
  for (const target of targets) {
    const distancePixels = Math.abs(timeToPixel(target.time - clamped, scale));
    if (distancePixels <= thresholdPixels && (!best || distancePixels < best.distancePixels)) {
      best = { target, distancePixels };
    }
  }

  return best
    ? { time: Math.max(0, best.target.time), snapped: true, target: best.target }
    : { time: clamped, snapped: false };
}

export function findCompatibleTrack(
  document: VideoProjectDocument,
  itemType: VideoTimelineItem["type"],
  preferredTrackId?: string,
): VideoTrack | null {
  const preferred = preferredTrackId ? document.tracks.find((track) => track.id === preferredTrackId) : undefined;
  if (preferred && !preferred.locked && isItemAllowedOnTrack(itemType, preferred.kind)) {
    return preferred;
  }

  return document.tracks.find((track) => !track.locked && isItemAllowedOnTrack(itemType, track.kind)) ?? null;
}

export function planMediaDrop({
  document,
  media,
  trackId,
  timelineStart,
}: {
  document: VideoProjectDocument;
  media: MediaDto;
  trackId?: string | null;
  timelineStart: number;
}): DropPlan {
  const itemType = itemTypeForMedia(media);
  const track = findCompatibleTrack(document, itemType, trackId ?? undefined);

  if (!track) {
    return { ok: false, reason: `No compatible ${mediaKindLabel(media)} track is available.`, trackId: trackId ?? undefined, timelineStart };
  }

  if (track.locked) {
    return { ok: false, reason: `${track.label} is locked.`, trackId: track.id, timelineStart };
  }

  return {
    ok: true,
    track,
    placement: {
      trackId: track.id,
      timelineStart: Math.max(0, timelineStart),
    },
  };
}

export function buildTrimPlan({
  item,
  edge,
  pointerTime,
  frameRate,
  mediaDuration,
}: {
  item: VideoTimelineItem;
  edge: "start" | "end";
  pointerTime: number;
  frameRate: number;
  mediaDuration?: number;
}): TrimPlan | null {
  const minDuration = 1 / Math.max(1, frameRate);
  const itemEnd = item.timelineStart + item.duration;

  if (edge === "start") {
    const maxStart = itemEnd - minDuration;
    const nextStart = Math.min(maxStart, Math.max(0, pointerTime));
    const delta = nextStart - item.timelineStart;
    const duration = Math.max(minDuration, item.duration - delta);
    const mediaFields = mediaTrimFields(item, "start", delta, duration, mediaDuration);
    if (!mediaFields) return null;
    return {
      operation: {
        type: "trimItem",
        itemId: item.id,
        edge,
        timelineStart: roundTime(nextStart),
        duration: roundTime(duration),
        ...mediaFields,
      },
    };
  }

  const minEnd = item.timelineStart + minDuration;
  const nextEnd = Math.max(minEnd, pointerTime);
  const duration = nextEnd - item.timelineStart;
  const mediaFields = mediaTrimFields(item, "end", 0, duration, mediaDuration);
  if (!mediaFields) return null;
  return {
    operation: {
      type: "trimItem",
      itemId: item.id,
      edge,
      timelineStart: roundTime(item.timelineStart),
      duration: roundTime(duration),
      ...mediaFields,
    },
  };
}

export function buildSplitOperation({
  item,
  playheadTime,
  frameRate,
  metadata,
}: {
  item: VideoTimelineItem;
  playheadTime: number;
  frameRate: number;
  metadata: VideoOperationMetadata;
}): SplitItemOperation | null {
  const frame = 1 / Math.max(1, frameRate);
  const localTime = playheadTime - item.timelineStart;
  if (localTime <= frame / 2 || localTime >= item.duration - frame / 2) {
    return null;
  }

  const firstDuration = roundTime(localTime);
  const secondDuration = roundTime(item.duration - localTime);
  const first = cloneItem(item, `${item.id}-a`, item.timelineStart, firstDuration);
  const second = cloneItem(item, `${item.id}-b`, playheadTime, secondDuration);

  if (isMediaTimelineItem(first) && isMediaTimelineItem(second) && isMediaTimelineItem(item)) {
    const sourceSplit = item.sourceIn + localTime * ("speed" in item ? item.speed : 1);
    first.sourceOut = roundTime(sourceSplit);
    second.sourceIn = roundTime(sourceSplit);
  }

  return {
    ...metadata,
    type: "splitItem",
    itemId: item.id,
    items: [first, second],
  };
}

export function expandLinkedItemIds(
  document: VideoProjectDocument,
  selectedItemIds: string[],
  clipsLinked: boolean,
): string[] {
  if (!clipsLinked) return selectedItemIds;

  const selected = new Set(selectedItemIds);
  const linkedGroups = new Set<string>();
  for (const item of document.tracks.flatMap((track) => track.items)) {
    if (selected.has(item.id) && "linkedGroupId" in item && item.linkedGroupId) {
      linkedGroups.add(item.linkedGroupId);
    }
  }

  if (linkedGroups.size === 0) return selectedItemIds;

  for (const item of document.tracks.flatMap((track) => track.items)) {
    if ("linkedGroupId" in item && item.linkedGroupId && linkedGroups.has(item.linkedGroupId)) {
      selected.add(item.id);
    }
  }

  return Array.from(selected);
}

export function selectRangeWithinTrack(
  document: VideoProjectDocument,
  anchorItemId: string | undefined,
  targetItemId: string,
): string[] {
  for (const track of document.tracks) {
    const ids = track.items.map((item) => item.id);
    const targetIndex = ids.indexOf(targetItemId);
    if (targetIndex === -1) continue;
    const anchorIndex = anchorItemId ? ids.indexOf(anchorItemId) : -1;
    if (anchorIndex === -1) return [targetItemId];
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    return ids.slice(start, end + 1);
  }

  return [];
}

export function marqueeSelectItems(
  itemLayouts: TimelineItemLayout[],
  rect: MarqueeRect,
): string[] {
  const normalized = normalizeRect(rect);
  return itemLayouts
    .filter((layout) =>
      rectanglesIntersect(normalized, {
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }),
    )
    .map((layout) => layout.item.id);
}

export function isItemAllowedOnTrack(itemType: VideoTimelineItem["type"], trackKind: VideoTrackKind): boolean {
  if (trackKind === "video") return itemType === "video" || itemType === "image";
  if (trackKind === "audio") return itemType === "audio";
  if (trackKind === "text") return itemType === "text";
  return itemType === "overlay" || itemType === "image" || itemType === "text";
}

export function trackHeight(kind: VideoTrackKind): number {
  if (kind === "text") return 50;
  if (kind === "audio") return 62;
  return 68;
}

export function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function itemTypeForMedia(media: MediaDto): VideoTimelineItem["type"] {
  if (media.kind === MediaKind.Audio) return "audio";
  if (media.kind === MediaKind.Image) return "image";
  return "video";
}

function mediaKindLabel(media: MediaDto): string {
  if (media.kind === MediaKind.Audio) return "audio";
  if (media.kind === MediaKind.Image) return "image";
  return "video";
}

function mediaTrimFields(
  item: VideoTimelineItem,
  edge: "start" | "end",
  sourceDelta: number,
  duration: number,
  mediaDuration?: number,
): { sourceIn?: number; sourceOut?: number } | null {
  if (!isMediaTimelineItem(item)) return {};

  if (edge === "start") {
    const nextSourceIn = item.sourceIn + sourceDelta * ("speed" in item ? item.speed : 1);
    if (nextSourceIn < 0 || nextSourceIn >= item.sourceOut) return null;
    return {
      sourceIn: roundTime(nextSourceIn),
      sourceOut: roundTime(item.sourceOut),
    };
  }

  const nextSourceOut = item.sourceIn + duration * ("speed" in item ? item.speed : 1);
  const boundedSourceOut = mediaDuration === undefined ? nextSourceOut : Math.min(nextSourceOut, mediaDuration);
  if (boundedSourceOut <= item.sourceIn) return null;
  return {
    sourceIn: roundTime(item.sourceIn),
    sourceOut: roundTime(boundedSourceOut),
  };
}

function cloneItem(
  item: VideoTimelineItem,
  id: string,
  timelineStart: number,
  duration: number,
): VideoTimelineItem {
  return {
    ...structuredClone(item),
    id,
    timelineStart: roundTime(timelineStart),
    duration: roundTime(duration),
  } as VideoTimelineItem;
}

function isMediaTimelineItem(item: VideoTimelineItem): item is VideoClipTimelineItem | AudioTimelineItem {
  return item.type === "video" || item.type === "audio";
}

function normalizeRect(rect: MarqueeRect): MarqueeRect {
  const left = rect.width < 0 ? rect.left + rect.width : rect.left;
  const top = rect.height < 0 ? rect.top + rect.height : rect.top;
  return {
    left,
    top,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

function rectanglesIntersect(left: MarqueeRect, right: MarqueeRect): boolean {
  return (
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top
  );
}
