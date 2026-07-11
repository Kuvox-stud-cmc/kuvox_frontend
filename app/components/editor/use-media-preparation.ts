import { useEffect, useMemo, useRef } from "react";

import type { MediaDto } from "~/lib/api";
import { choosePreviewObjectUrl } from "~/lib/editor/editor-preview";
import { mediaDtoToVideoMediaReference } from "~/lib/editor/editor-media";
import {
  createTimelinePreparationRequests,
  mediaPreparationKey,
  selectPreparationBatch,
  type MediaPreparationRequest,
} from "~/lib/editor/media-preparation";
import { clearPreparedMediaCache, prepareMediaResource } from "~/lib/editor/media-preparation.client";
import { logVideoEditorEvent } from "~/lib/editor/editor-observability.client";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  mediaAssetAddedToTimeline,
  mediaPreparationFailed,
  mediaPreparationCoordinatorMounted,
  mediaPreparationRequested,
  mediaPreparationResourcesPruned,
  mediaPreparationStarted,
  mediaPreparationSucceeded,
  pendingTimelineInsertionRemoved,
  pendingTimelineInsertionUpdated,
  selectCurrentTimeSeconds,
  selectMediaPreparationState,
  selectPendingTimelineInsertions,
  selectPreviewBufferingState,
  selectVideoDocument,
} from "~/store/slices/editor-slice";

export function insertionPreparationRequest(
  media: MediaDto,
  timelineStart: number,
  previewQuality: Parameters<typeof choosePreviewObjectUrl>[1] = "balanced",
): MediaPreparationRequest | null {
  const reference = mediaDtoToVideoMediaReference(media);
  const object = choosePreviewObjectUrl(reference, previewQuality);
  if (!object.url) return null;
  return {
    key: mediaPreparationKey(reference.kind, object.url),
    mediaId: media.id,
    kind: reference.kind,
    objectUrl: object.url,
    sourceTime: 0,
    timelineStart,
    priority: "insertion",
  };
}

export function useMediaPreparation(projectId: string): void {
  const dispatch = useAppDispatch();
  const document = useAppSelector(selectVideoDocument);
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const resources = useAppSelector(selectMediaPreparationState);
  const pending = useAppSelector(selectPendingTimelineInsertions);
  const buffering = useAppSelector(selectPreviewBufferingState);
  const controllers = useRef(new Map<string, AbortController>());
  const committed = useRef(new Set<string>());

  useEffect(() => {
    dispatch(mediaPreparationCoordinatorMounted(true));
    return () => { dispatch(mediaPreparationCoordinatorMounted(false)); };
  }, [dispatch]);

  const timelineRequests = useMemo(
    () => document ? createTimelinePreparationRequests({ document, currentTime }) : [],
    [currentTime, document],
  );

  useEffect(() => {
    for (const request of timelineRequests) dispatch(mediaPreparationRequested(request));
  }, [dispatch, timelineRequests]);

  useEffect(() => {
    const desired = new Set([
      ...timelineRequests.map((request) => request.key),
      ...pending.map((insertion) => insertion.resourceKey),
      ...buffering.requiredResourceKeys,
    ]);
    for (const [key, controller] of controllers.current) {
      if (desired.has(key)) continue;
      controller.abort();
      controllers.current.delete(key);
    }
    dispatch(mediaPreparationResourcesPruned([...desired]));
  }, [buffering.requiredResourceKeys, dispatch, pending, timelineRequests]);

  useEffect(() => {
    const values = Object.values(resources);
    const active = values.filter((resource) => resource.status === "loading");
    const next = selectPreparationBatch(values, {
      activeCount: active.length,
      activeDecoderCount: active.filter((resource) => resource.kind !== "image").length,
    });

    for (const resource of next) {
      if (controllers.current.has(resource.key)) continue;
      const controller = new AbortController();
      controllers.current.set(resource.key, controller);
      const startedAt = performance.now();
      dispatch(mediaPreparationStarted({ key: resource.key, startedAt }));
      logVideoEditorEvent("editor.media.preparation.start", {
        projectId,
        mediaId: resource.mediaId,
        kind: resource.kind,
        queueDurationMs: Math.max(0, startedAt - resource.queuedAt),
      }, "debug");
      void prepareMediaResource(resource, controller.signal).then((metadata) => {
        if (controller.signal.aborted) return;
        controllers.current.delete(resource.key);
        const readyAt = performance.now();
        dispatch(mediaPreparationSucceeded({ key: resource.key, readyAt, metadata }));
        logVideoEditorEvent("editor.media.preparation.success", {
          projectId,
          mediaId: resource.mediaId,
          kind: resource.kind,
          durationMs: Math.max(0, readyAt - startedAt),
        }, "debug");
      }).catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        controllers.current.delete(resource.key);
        const message = error instanceof Error ? error.message : String(error);
        const retry = resource.attempts < 1;
        dispatch(mediaPreparationFailed({ key: resource.key, error: message, retry }));
        logVideoEditorEvent("editor.media.preparation.failure", {
          projectId,
          mediaId: resource.mediaId,
          kind: resource.kind,
          reason: message,
          automaticRetry: retry,
        }, retry ? "warn" : "error");
      });
    }
  }, [dispatch, projectId, resources]);

  useEffect(() => {
    for (const insertion of pending) {
      const resource = resources[insertion.resourceKey];
      if (!resource || resource.status !== "ready" || insertion.status === "committing" || committed.current.has(insertion.id)) continue;
      committed.current.add(insertion.id);
      dispatch(pendingTimelineInsertionUpdated({ id: insertion.id, status: "committing" }));
      const media = hydratePreparedMetadata(insertion.media, resource);
      dispatch(mediaAssetAddedToTimeline({
        media,
        trackId: insertion.trackId,
        timelineStart: insertion.timelineStart,
      }));
      dispatch(pendingTimelineInsertionRemoved(insertion.id));
    }
  }, [dispatch, pending, resources]);

  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    clearPreparedMediaCache();
  }, []);
}

function hydratePreparedMetadata(
  media: MediaDto,
  metadata: { duration?: number; width?: number; height?: number },
): MediaDto {
  return {
    ...media,
    durationSeconds: metadata.duration ?? media.durationSeconds,
    width: metadata.width ?? media.width,
    height: metadata.height ?? media.height,
  };
}
