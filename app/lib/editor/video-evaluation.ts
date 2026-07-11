import type {
  VideoAnimatableValue,
  VideoClipTimelineItem,
  VideoCrop,
  VideoFreezeFrameSegment,
  VideoKeyframe,
  VideoTimelineItem,
  VideoTransform,
} from "./video-document";

export interface EvaluatedVisualState {
  transform: VideoTransform;
  crop?: VideoCrop;
  opacity: number;
}

export function evaluateAnimatableNumber(
  property: VideoAnimatableValue<number> | undefined,
  itemTime: number,
  fallback: number,
): number {
  if (!property) return fallback;
  const keyframes = [...(property.keyframes ?? [])].sort((left, right) => left.time - right.time);
  if (keyframes.length === 0) return property.value;
  if (itemTime <= keyframes[0].time) return keyframes[0].value;
  if (itemTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

  const rightIndex = keyframes.findIndex((keyframe) => keyframe.time >= itemTime);
  const left = keyframes[rightIndex - 1];
  const right = keyframes[rightIndex];
  const progress = (itemTime - left.time) / Math.max(Number.EPSILON, right.time - left.time);
  return left.value + (right.value - left.value) * evaluateEasing(progress, right);
}

export function evaluateVisualState(item: VideoTimelineItem, timelineTime: number): EvaluatedVisualState | null {
  if (item.type === "audio") return null;
  const itemTime = clamp(timelineTime - item.timelineStart, 0, item.duration);
  const advanced = item.advanced;
  const transform = item.transform;
  const evaluatedTransform: VideoTransform = {
    x: evaluateAnimatableNumber(advanced?.transform?.x, itemTime, transform.x),
    y: evaluateAnimatableNumber(advanced?.transform?.y, itemTime, transform.y),
    scaleX: evaluateAnimatableNumber(advanced?.transform?.scaleX, itemTime, transform.scaleX),
    scaleY: evaluateAnimatableNumber(advanced?.transform?.scaleY, itemTime, transform.scaleY),
    rotation: evaluateAnimatableNumber(advanced?.transform?.rotation, itemTime, transform.rotation),
    anchorX: evaluateAnimatableNumber(advanced?.transform?.anchorX, itemTime, transform.anchorX ?? 0.5),
    anchorY: evaluateAnimatableNumber(advanced?.transform?.anchorY, itemTime, transform.anchorY ?? 0.5),
  };
  const opacity = "opacity" in item
    ? evaluateAnimatableNumber(advanced?.opacity, itemTime, item.opacity)
    : evaluateAnimatableNumber(advanced?.opacity, itemTime, 1);

  if (item.type === "text") return { transform: evaluatedTransform, opacity };
  return {
    transform: evaluatedTransform,
    opacity,
    crop: {
      top: evaluateAnimatableNumber(advanced?.crop?.top, itemTime, item.crop.top),
      right: evaluateAnimatableNumber(advanced?.crop?.right, itemTime, item.crop.right),
      bottom: evaluateAnimatableNumber(advanced?.crop?.bottom, itemTime, item.crop.bottom),
      left: evaluateAnimatableNumber(advanced?.crop?.left, itemTime, item.crop.left),
    },
  };
}

export function evaluateVideoSourceTime(item: VideoClipTimelineItem, timelineTime: number): number {
  const itemTime = clamp(timelineTime - item.timelineStart, 0, item.duration);
  const freeze = activeFreezeFrame(item.advanced?.freezeFrames, itemTime);
  if (freeze) return clamp(freeze.sourceTime, item.sourceIn, item.sourceOut);

  const points = item.advanced?.timeRemap?.points;
  if (points && points.length >= 2) {
    const sorted = [...points].sort((left, right) => left.timelineTime - right.timelineTime);
    if (itemTime <= sorted[0].timelineTime) return clamp(sorted[0].sourceTime, item.sourceIn, item.sourceOut);
    if (itemTime >= sorted[sorted.length - 1].timelineTime) return clamp(sorted[sorted.length - 1].sourceTime, item.sourceIn, item.sourceOut);
    const rightIndex = sorted.findIndex((point) => point.timelineTime >= itemTime);
    const left = sorted[rightIndex - 1];
    const right = sorted[rightIndex];
    const progress = (itemTime - left.timelineTime) / Math.max(Number.EPSILON, right.timelineTime - left.timelineTime);
    return clamp(left.sourceTime + (right.sourceTime - left.sourceTime) * progress, item.sourceIn, item.sourceOut);
  }

  return clamp(item.sourceIn + itemTime * item.speed, item.sourceIn, item.sourceOut);
}

function activeFreezeFrame(segments: VideoFreezeFrameSegment[] | undefined, itemTime: number): VideoFreezeFrameSegment | null {
  return segments?.find((segment) => itemTime >= segment.timelineStart && itemTime < segment.timelineStart + segment.duration) ?? null;
}

function evaluateEasing(progress: number, keyframe: VideoKeyframe<number>): number {
  const easing = keyframe.easing;
  if (!easing) return progress;
  const [, y1, , y2] = easing;
  const inverse = 1 - progress;
  return 3 * inverse * inverse * progress * y1 + 3 * inverse * progress * progress * y2 + progress * progress * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
