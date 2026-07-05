export type MediaDurationValue = number | string | null | undefined;

export function mediaDurationSeconds(value: MediaDurationValue): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export function resolvePlayableMediaDuration(
  metadataDuration: MediaDurationValue,
  loadedDuration: MediaDurationValue,
): number {
  return mediaDurationSeconds(loadedDuration) || mediaDurationSeconds(metadataDuration);
}

export function formatMediaDuration(value: MediaDurationValue): string {
  const seconds = mediaDurationSeconds(value);
  if (seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
