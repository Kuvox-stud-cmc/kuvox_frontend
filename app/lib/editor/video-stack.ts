import type { VideoProjectDocument, VideoTimelineItem } from "./video-document";

export interface VideoStackEntry {
  itemId: string;
  stackOrder: number;
}

interface StackCandidate {
  item: Exclude<VideoTimelineItem, { type: "audio" }>;
  phase: 0 | 1;
  trackIndex: number;
  itemIndex: number;
  layerOrder: number;
}

export function planVideoStack(document: VideoProjectDocument): VideoStackEntry[] {
  const candidates: StackCandidate[] = [];

  document.tracks.forEach((track, trackIndex) => {
    if (track.hidden) return;
    track.items.forEach((item, itemIndex) => {
      if (item.type === "audio" || item.duration <= 0) return;
      const baseVisual = track.kind === "video" && (item.type === "video" || item.type === "image");
      candidates.push({
        item,
        phase: baseVisual ? 0 : 1,
        trackIndex,
        itemIndex,
        layerOrder: "layerOrder" in item ? item.layerOrder : 0,
      });
    });
  });

  candidates.sort((left, right) => {
    const phaseOrder = left.phase - right.phase;
    if (phaseOrder !== 0) return phaseOrder;
    const primaryOrder = left.phase === 0
      ? right.trackIndex - left.trackIndex
      : left.layerOrder - right.layerOrder;
    if (primaryOrder !== 0) return primaryOrder;
    const secondaryOrder = left.phase === 0
      ? left.layerOrder - right.layerOrder
      : left.trackIndex - right.trackIndex;
    return secondaryOrder || left.itemIndex - right.itemIndex || left.item.id.localeCompare(right.item.id);
  });

  return candidates.map((candidate, stackOrder) => ({ itemId: candidate.item.id, stackOrder }));
}

export function videoStackOrderMap(document: VideoProjectDocument): Map<string, number> {
  return new Map(planVideoStack(document).map((entry) => [entry.itemId, entry.stackOrder]));
}
