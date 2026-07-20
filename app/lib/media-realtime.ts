import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRevalidator } from "react-router";

import type { MediaDto } from "./api";
import { isMediaInProgress, type MediaPipeline } from "./media-pipeline";
import { getRealtimeConnection } from "./realtime-connection.client";

const OPTIMISTIC_TTL_MS = 5 * 60 * 1000;

export interface MediaRealtimeUpdate {
  media: MediaDto;
  phase: "uploaded" | "processing" | "ready" | "failed" | string;
  occurredAt: string;
  pipeline?: MediaPipeline | null;
  shotCount?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface LiveMediaOptions {
  kind?: number;
  routeRevalidation?: boolean;
}

export function useLiveMedia(initialMedia: MediaDto[], options: LiveMediaOptions = {}) {
  const revalidator = useRevalidator();
  const initialSignature = useMemo(() => mediaSignature(initialMedia), [initialMedia]);
  const loaderIdsRef = useRef(new Set(initialMedia.map((item) => item.id)));
  const optimisticAddedAtRef = useRef<Record<string, number>>({});
  const [media, setMedia] = useState(initialMedia);
  const [updatesById, setUpdatesById] = useState<Record<string, MediaRealtimeUpdate>>({});
  const routeRevalidation = options.routeRevalidation !== false;

  const revalidateIfIdle = useCallback(() => {
    if (routeRevalidation && revalidator.state === "idle") {
      revalidator.revalidate();
    }
  }, [revalidator, routeRevalidation]);

  const replaceMedia = useCallback((nextMedia: MediaDto[]) => {
    const filtered = options.kind === undefined
      ? nextMedia
      : nextMedia.filter((item) => item.kind === options.kind);
    const loaderIds = new Set(filtered.map((item) => item.id));
    const now = Date.now();
    loaderIdsRef.current = loaderIds;

    for (const id of Object.keys(optimisticAddedAtRef.current)) {
      if (loaderIds.has(id)) delete optimisticAddedAtRef.current[id];
    }

    setMedia((current) => {
      const preserved = current.filter((item) => {
        if (loaderIds.has(item.id)) return false;
        const addedAt = optimisticAddedAtRef.current[item.id];
        return Boolean(addedAt && now - addedAt < OPTIMISTIC_TTL_MS && isMediaInProgress(item));
      });
      return [...preserved, ...filtered];
    });

    setUpdatesById((current) => {
      const next: Record<string, MediaRealtimeUpdate> = {};
      const ids = new Set([...loaderIds, ...Object.keys(optimisticAddedAtRef.current)]);
      for (const [id, update] of Object.entries(current)) {
        if (ids.has(id)) next[id] = update;
      }
      return next;
    });
  }, [options.kind]);

  useEffect(() => {
    replaceMedia(initialMedia);
  }, [initialSignature, replaceMedia]);

  useEffect(() => {
    const connection = connectMediaRealtime((update) => {
      if (options.kind !== undefined && update.media.kind !== options.kind) return;

      setMedia((current) => mergeMedia(current, update.media));
      setUpdatesById((current) => ({ ...current, [update.media.id]: update }));
      if (isMediaInProgress(update.media)) {
        revalidateIfIdle();
      }
    });

    return () => connection.stop();
  }, [options.kind, revalidateIfIdle]);

  useEffect(() => {
    if (!routeRevalidation || !media.some(isMediaInProgress)) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [media, revalidator, routeRevalidation]);

  return {
    media,
    updatesById,
    replaceMedia,
    mergeMedia: (next: MediaDto) => {
      if (options.kind !== undefined && next.kind !== options.kind) return;

      if (!loaderIdsRef.current.has(next.id)) {
        optimisticAddedAtRef.current[next.id] = Date.now();
      }

      setMedia((current) => mergeMedia(current, next));
      setUpdatesById((current) => ({
        ...current,
        [next.id]: {
          media: next,
          phase: phaseFromMedia(next),
          occurredAt: new Date().toISOString(),
          pipeline: next.pipeline,
        },
      }));

      if (isMediaInProgress(next)) {
        revalidateIfIdle();
      }
    },
    removeMedia: (id: string) => {
      delete optimisticAddedAtRef.current[id];
      setMedia((current) => current.filter((item) => item.id !== id));
      setUpdatesById((current) => {
        const { [id]: _removed, ...next } = current;
        return next;
      });
    },
  };
}

export function connectMediaRealtime(onUpdate: (update: MediaRealtimeUpdate) => void) {
  const unsubscribe = getRealtimeConnection().subscribe("mediaUpdated", (update) => {
    if (isMediaUpdate(update)) onUpdate(update);
  });

  return {
    stop: unsubscribe,
  };
}

function isMediaUpdate(value: unknown): value is MediaRealtimeUpdate {
  return Boolean(
    value &&
      typeof value === "object" &&
      "media" in value &&
      typeof (value as MediaRealtimeUpdate).media?.id === "string",
  );
}

function mergeMedia(current: MediaDto[], next: MediaDto): MediaDto[] {
  const index = current.findIndex((item) => item.id === next.id);
  if (index === -1) return [next, ...current];
  const copy = [...current];
  copy[index] = { ...next, isFavorite: current[index].isFavorite || next.isFavorite };
  return copy;
}

function mediaSignature(items: MediaDto[]): string {
  return items
    .map((item) =>
      [
        item.id,
        item.kind,
        item.filename,
        item.status,
        item.sizeBytes,
        item.canonicalStorageKey,
        item.proxyStorageKey,
        item.thumbnailStorageKey,
        item.errorMessage,
        item.durationSeconds,
        item.width,
        item.height,
        item.codec,
        item.frameRate,
        item.createdAt,
        item.isFavorite,
        item.pipeline?.stage,
        item.pipeline?.label,
        item.pipeline?.detail,
        item.pipeline?.step,
        item.pipeline?.stepCount,
        item.pipeline?.terminal,
      ].join("\x1f"),
    )
    .join("\x1e");
}

function phaseFromMedia(media: MediaDto): MediaRealtimeUpdate["phase"] {
  const stage = media.pipeline?.stage;
  if (stage === "failed" || stage === "ready") return stage;
  const status = media.status.trim().toLowerCase();
  if (status === "failed" || status === "ready" || status === "processing" || status === "uploaded") {
    return status;
  }
  return stage || status || "uploaded";
}
