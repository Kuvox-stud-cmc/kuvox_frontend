import type { VideoMediaKind, VideoProjectDocument } from "./video-document";
import { choosePreviewObjectUrl, type PreviewQualityPreference } from "./editor-preview";

export type MediaPreparationStatus = "queued" | "loading" | "ready" | "failed";
export type MediaPreparationPriority = "insertion" | "playhead" | "nearby" | "background";

export interface MediaPreparationRequest {
  key: string;
  mediaId: string;
  kind: VideoMediaKind;
  objectUrl: string;
  sourceTime: number;
  timelineStart: number;
  priority: MediaPreparationPriority;
}

export interface MediaPreparationResourceState extends MediaPreparationRequest {
  status: MediaPreparationStatus;
  attempts: number;
  queuedAt: number;
  startedAt?: number;
  readyAt?: number;
  error?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface PreparedMediaMetadata {
  duration?: number;
  width?: number;
  height?: number;
}

const priorityRank: Record<MediaPreparationPriority, number> = {
  insertion: 0,
  playhead: 1,
  nearby: 2,
  background: 3,
};

export function mediaPreparationKey(kind: VideoMediaKind, objectUrl: string): string {
  return `${kind}:${objectUrl}`;
}

export function compareMediaPreparationRequests(
  left: Pick<MediaPreparationRequest, "priority" | "timelineStart" | "key">,
  right: Pick<MediaPreparationRequest, "priority" | "timelineStart" | "key">,
): number {
  return priorityRank[left.priority] - priorityRank[right.priority]
    || left.timelineStart - right.timelineStart
    || left.key.localeCompare(right.key);
}

export function selectPreparationBatch(
  resources: MediaPreparationResourceState[],
  options: { activeCount: number; activeDecoderCount: number; maxConcurrent?: number; maxDecoders?: number },
): MediaPreparationResourceState[] {
  let slots = Math.max(0, (options.maxConcurrent ?? 4) - options.activeCount);
  let decoderSlots = Math.max(0, (options.maxDecoders ?? 2) - options.activeDecoderCount);
  const selected: MediaPreparationResourceState[] = [];

  for (const resource of resources.filter((candidate) => candidate.status === "queued").sort(compareMediaPreparationRequests)) {
    if (slots <= 0) break;
    const decoder = resource.kind === "video" || resource.kind === "audio";
    if (decoder && decoderSlots <= 0) continue;
    selected.push(resource);
    slots -= 1;
    if (decoder) decoderSlots -= 1;
  }

  return selected;
}

export function createTimelinePreparationRequests({
  document,
  currentTime,
  previewQuality,
}: {
  document: VideoProjectDocument;
  currentTime: number;
  previewQuality?: PreviewQualityPreference;
}): MediaPreparationRequest[] {
  const requests = new Map<string, MediaPreparationRequest>();
  for (const track of document.tracks) {
    for (const item of track.items) {
      if (!("mediaId" in item)) continue;
      const media = document.media[item.mediaId];
      if (!media) continue;
      const object = choosePreviewObjectUrl(media, previewQuality ?? document.settings.previewQuality);
      if (!object.url) continue;
      const active = currentTime >= item.timelineStart && currentTime < item.timelineStart + item.duration;
      const nearby = item.timelineStart + item.duration >= currentTime - 10 && item.timelineStart <= currentTime + 30;
      const sourceTime = item.type === "video" || item.type === "audio"
        ? Math.max(item.sourceIn, Math.min(item.sourceOut, item.sourceIn + Math.max(0, currentTime - item.timelineStart)))
        : 0;
      const request: MediaPreparationRequest = {
        key: mediaPreparationKey(media.kind, object.url),
        mediaId: media.id,
        kind: media.kind,
        objectUrl: object.url,
        sourceTime,
        timelineStart: item.timelineStart,
        priority: active ? "playhead" : nearby ? "nearby" : "background",
      };
      const previous = requests.get(request.key);
      if (!previous || compareMediaPreparationRequests(request, previous) < 0) requests.set(request.key, request);
    }
  }
  return [...requests.values()].sort(compareMediaPreparationRequests);
}

export function mediaItemPreparationStatus(
  mediaId: string,
  resources: Record<string, MediaPreparationResourceState>,
): MediaPreparationStatus {
  const matches = Object.values(resources).filter((resource) => resource.mediaId === mediaId);
  if (matches.some((resource) => resource.status === "ready")) return "ready";
  if (matches.some((resource) => resource.status === "failed")) return "failed";
  if (matches.some((resource) => resource.status === "loading")) return "loading";
  return "queued";
}
