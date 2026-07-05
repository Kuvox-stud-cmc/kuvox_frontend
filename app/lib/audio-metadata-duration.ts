import { useEffect, useMemo, useState } from "react";

import {
  mediaDurationSeconds,
  resolvePlayableMediaDuration,
  type MediaDurationValue,
} from "~/lib/media-duration";

export type AudioMetadataDurationTarget = {
  id: string;
  src: string | null | undefined;
  metadataDuration: MediaDurationValue;
};

const durationCacheBySource = new Map<string, number>();
const pendingDurationBySource = new Map<string, Promise<number>>();

function loadAudioMetadataDuration(src: string): Promise<number> {
  const cached = durationCacheBySource.get(src);
  if (cached != null) return Promise.resolve(cached);

  const pending = pendingDurationBySource.get(src);
  if (pending) return pending;

  if (typeof Audio === "undefined") {
    return Promise.resolve(0);
  }

  const promise = new Promise<number>((resolve) => {
    const audio = new Audio();
    let settled = false;

    const finish = (value: MediaDurationValue) => {
      if (settled) return;
      settled = true;
      const duration = mediaDurationSeconds(value);
      durationCacheBySource.set(src, duration);
      pendingDurationBySource.delete(src);
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.ondurationchange = () => {
      if (mediaDurationSeconds(audio.duration) > 0) {
        finish(audio.duration);
      }
    };
    audio.onerror = () => finish(0);
    audio.src = src;
    audio.load();
  });

  pendingDurationBySource.set(src, promise);
  return promise;
}

export function useAudioMetadataDurations(
  targets: AudioMetadataDurationTarget[],
): Record<string, number> {
  const targetKey = targets
    .map((target) => `${target.id}:${target.src ?? ""}:${target.metadataDuration ?? ""}`)
    .join("|");
  const stableTargets = useMemo(() => targets, [targetKey]);
  const [loadedDurationsBySource, setLoadedDurationsBySource] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const loadTargets = stableTargets.filter((target) => {
      return target.src && mediaDurationSeconds(target.metadataDuration) <= 0;
    });

    if (loadTargets.length === 0) return;

    Promise.all(
      loadTargets.map(async (target) => {
        const duration = await loadAudioMetadataDuration(target.src as string);
        return { src: target.src as string, duration };
      }),
    ).then((results) => {
      if (cancelled) return;
      setLoadedDurationsBySource((current) => {
        let changed = false;
        const next = { ...current };

        for (const result of results) {
          if (result.duration > 0 && next[result.src] !== result.duration) {
            next[result.src] = result.duration;
            changed = true;
          }
        }

        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [stableTargets]);

  return useMemo(() => {
    const durations: Record<string, number> = {};

    for (const target of stableTargets) {
      const loadedDuration = target.src
        ? loadedDurationsBySource[target.src] ?? durationCacheBySource.get(target.src)
        : undefined;
      durations[target.id] = resolvePlayableMediaDuration(target.metadataDuration, loadedDuration);
    }

    return durations;
  }, [stableTargets, loadedDurationsBySource]);
}
