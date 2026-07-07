import type { AudioTimelineItem } from "./video-document";

export type AudioItemRole = "linked" | "standalone";

export function audioItemRole(item: AudioTimelineItem): AudioItemRole {
  return item.linkedGroupId ? "linked" : "standalone";
}

export function computeAudioFadeGain(item: AudioTimelineItem, currentTime: number): number {
  if (currentTime < item.timelineStart || currentTime >= item.timelineStart + item.duration) {
    return 0;
  }

  const localTime = currentTime - item.timelineStart;
  const remaining = item.duration - localTime;
  const fadeInGain = item.fades.fadeInDuration > 0
    ? Math.min(1, Math.max(0, localTime / item.fades.fadeInDuration))
    : 1;
  const fadeOutGain = item.fades.fadeOutDuration > 0
    ? Math.min(1, Math.max(0, remaining / item.fades.fadeOutDuration))
    : 1;

  return roundUnit(Math.min(fadeInGain, fadeOutGain));
}

export function effectiveAudioVolume({
  globalVolume,
  itemVolume,
  fadeGain,
}: {
  globalVolume: number;
  itemVolume: number;
  fadeGain: number;
}): number {
  return roundUnit(clampUnit(globalVolume) * clampUnit(itemVolume) * clampUnit(fadeGain));
}

export function validateAudioFadesForDuration(
  item: Pick<AudioTimelineItem, "duration" | "fades">,
  path: string,
): string[] {
  const errors: string[] = [];
  const { fadeInDuration, fadeOutDuration } = item.fades;

  if (fadeInDuration > item.duration) {
    errors.push(`${path}.fadeInDuration must not exceed item duration.`);
  }
  if (fadeOutDuration > item.duration) {
    errors.push(`${path}.fadeOutDuration must not exceed item duration.`);
  }
  if (fadeInDuration + fadeOutDuration > item.duration) {
    errors.push(`${path}.fadeInDuration plus fadeOutDuration must not exceed item duration.`);
  }

  return errors;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundUnit(value: number): number {
  return Math.round(value * 1000) / 1000;
}
