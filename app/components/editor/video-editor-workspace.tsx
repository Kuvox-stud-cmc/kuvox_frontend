import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { MediaKind, OwnerKind, type MediaDto, type ProjectDto, type ProjectMediaDto } from "~/lib/api";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import {
  appendOperationLog,
  cleanupEditorCache,
  getProjectMetadata,
  getProjectSnapshot,
  getVideoTimelineDraft,
  getVideoTimelineDraftRecord,
  listCommandHistory,
  listMediaAssets,
  listPendingSync,
  saveProjectMetadata,
  saveMediaAssets,
  saveUndoCheckpoint,
} from "~/lib/editor/editor-cache";
import {
  buildEditorCacheScopeFromProject,
  resolveCachedEditorDocument,
} from "~/lib/editor/editor-load";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
} from "~/lib/editor/editor-observability.client";
import type { DraftRecoveryState } from "~/lib/editor/editor-recovery";
import { mediaDtoToVideoMediaReference } from "~/lib/editor/editor-media";
import { getVideoTimelineFromBff } from "~/lib/editor/video-timeline-api.client";
import {
  attachProjectMediaFromBff,
  projectMediaToMediaDto,
} from "~/lib/editor/project-media-api.client";
import {
  createVideoEditorPerformanceMetric,
  queueVideoEditorPerformanceMetric,
} from "~/lib/editor/video-performance.client";
import { useLiveMedia } from "~/lib/media-realtime";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  aiCommandHistoryLoaded,
  editorDocumentLoaded,
  editorLoadFailed,
  editorLoadStarted,
  mediaAssetAddedToTimeline,
  modalClosed,
  projectMediaAvailabilityLoaded,
  selectEditorConflict,
  selectEditorState,
  selectEditorMode,
  selectOverlayState,
  selectTimelinePanelState,
  selectVideoDocument,
  selectVideoHistoryState,
  toastShown,
  type VideoEditorHistoryFrame,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorPanelErrorBoundary } from "./editor-panel-error-boundary";
import { EditorModalLayer, EditorPopoverLayer, EditorToast } from "./editor-overlays";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import {
  assistantMessages,
  editorProject,
} from "./mock-editor-data";
import { PreviewPanel } from "./panels/preview-panel";
import { TimelinePanel } from "./panels/timeline-panel";
import { ToolRail } from "./tool-rail";
import { useVideoAutosave } from "./use-video-autosave";
import { useVideoKeyboardShortcuts } from "./use-video-keyboard-shortcuts";
import { VideoExportModal } from "./video-export-modal";
import { VideoInspectorPanel } from "./video-inspector-panel";
import type { VideoMediaKind, VideoMediaReference, VideoProjectDocument, VideoTimelineItem } from "~/lib/editor/video-document";

interface VideoEditorWorkspaceProps {
  project: ProjectDto;
  userId: string;
  media: MediaDto[];
  projectMedia: ProjectMediaDto[];
  mediaLoadError: string | null;
  mediaRetrying?: boolean;
  onRetryMediaLoad?: () => void;
  canWrite: boolean;
}

/**
 * Video editor UI. Client-only: it lives under the route's Redux `<Provider>`
 * and never renders on the server.
 */
export function VideoEditorWorkspace({
  project,
  userId,
  media,
  projectMedia,
  mediaLoadError,
  mediaRetrying = false,
  onRetryMediaLoad,
  canWrite,
}: VideoEditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const overlayFocusReturnRef = useRef<HTMLElement | null>(null);
  const editorOpenedAt = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const firstUsableRecorded = useRef(false);
  const [projectMediaRows, setProjectMediaRows] = useState(projectMedia);
  const [draftRecovery, setDraftRecovery] = useState<DraftRecoveryState>({ state: "none" });
  const editor = useAppSelector(selectEditorState);
  const editorMode = useAppSelector(selectEditorMode);
  const conflict = useAppSelector(selectEditorConflict);
  const document = useAppSelector(selectVideoDocument);
  const videoHistory = useAppSelector(selectVideoHistoryState);
  const { activeModal, activePopover } = useAppSelector(selectOverlayState);
  const { height: timelineHeight, open: timelineOpen } = useAppSelector(selectTimelinePanelState);
  const cacheScope = useMemo(
    () => buildEditorCacheScopeFromProject(userId, project),
    [project, userId],
  );
  const live = useLiveMedia(media);
  const studioId = project.ownerKind === OwnerKind.Studio ? project.ownerId : null;
  const syncRetrying: boolean = editor.syncStatus === "syncing";
  const autosave = useVideoAutosave({
    projectId: project.id,
    projectName: project.name,
    cacheScope,
    editor,
  });
  useVideoKeyboardShortcuts(editorRootRef);

  useEffect(() => {
    setProjectMediaRows(projectMedia);
    dispatch(projectMediaAvailabilityLoaded(projectMedia));
  }, [dispatch, projectMedia]);

  useEffect(() => {
    if (projectMediaRows.length === 0) return;
    const liveProjectMedia = projectMediaRows.flatMap((item) => projectMediaToMediaDto(item) ?? []);
    if (liveProjectMedia.length === 0) return;
    liveProjectMedia.forEach((item) => live.mergeMedia(item));
  }, [projectMediaRows]);

  useEffect(() => {
    if (projectMediaRows.length === 0) return;
    const rowsWithShotCounts = projectMediaRows.map((row) => {
      const shotCount = live.updatesById[row.mediaId]?.shotCount;
      return shotCount === undefined ? row : { ...row, shotCount };
    });
    dispatch(projectMediaAvailabilityLoaded(rowsWithShotCounts));
  }, [dispatch, live.updatesById, projectMediaRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditor() {
      const loadStartedAt = typeof performance !== "undefined" ? performance.now() : 0;
      const correlationId = createEditorCorrelationId("editor-load");
      logVideoEditorEvent("editor.load.start", { projectId: project.id, correlationId });
      dispatch(editorLoadStarted({ projectId: project.id }));

      try {
        const [cachedProject, cachedSnapshot, draft, draftRecord, pendingSync, serverTimeline, commandHistory] = await Promise.all([
          getProjectMetadata(cacheScope, project.id),
          getProjectSnapshot(cacheScope, project.id),
          getVideoTimelineDraft(cacheScope, project.id),
          getVideoTimelineDraftRecord(cacheScope, project.id),
          listPendingSync(cacheScope, project.id),
          getVideoTimelineFromBff(project.id, { correlationId }).catch((error) => {
            logVideoEditorEvent("editor.load.failure", {
              projectId: project.id,
              correlationId,
              source: "server",
              reason: error instanceof Error ? error.message : "Server timeline could not be loaded.",
            }, "warn");
            return null;
          }),
          listCommandHistory(cacheScope, project.id),
        ]);

        if (cancelled) return;
        logEditorCacheResults(project.id, correlationId, {
          cachedProject,
          cachedSnapshot,
          draft,
          draftRecord,
          pendingSync,
          commandHistory,
        });

        const resolved = resolveCachedEditorDocument({
          project,
          cachedProject,
          cachedSnapshot,
          draft,
          draftRecord,
          pendingSync,
          serverTimeline,
        });
        const document = hydrateProjectMediaPlaceholders(resolved.document, projectMedia);
        setDraftRecovery(resolved.draftRecovery);

        dispatch(editorDocumentLoaded({
          document,
          source: resolved.source,
          syncStatus: resolved.syncStatus,
          pendingSyncCount: resolved.pendingSyncCount,
          conflict: resolved.conflict,
          serverTimelineId: resolved.serverTimelineId,
          serverRevisionNumber: resolved.serverRevisionNumber,
          lastSyncedAt: resolved.lastSyncedAt,
          warnings: resolved.warnings,
        }));
        logVideoEditorEvent("editor.load.success", {
          projectId: project.id,
          correlationId,
          selectedSource: resolved.source,
          serverTimelineId: resolved.serverTimelineId,
          revisionNumber: resolved.serverRevisionNumber,
          pendingSyncCount: resolved.pendingSyncCount,
          warningCount: resolved.warnings.length,
          durationMs: Math.round(performance.now() - loadStartedAt),
        });

        if (!firstUsableRecorded.current) {
          firstUsableRecorded.current = true;
          queueVideoEditorPerformanceMetric(
            project.id,
            createVideoEditorPerformanceMetric("first-usable-editor", performance.now() - loadStartedAt, {
              document,
            }),
          );
          queueVideoEditorPerformanceMetric(
            project.id,
            createVideoEditorPerformanceMetric("editor-open", performance.now() - editorOpenedAt.current, {
              document,
            }),
          );
        }

        if (!resolved.conflict) {
          await saveProjectMetadata(project, cacheScope);
        }

        if (commandHistory.ok) {
          dispatch(aiCommandHistoryLoaded(commandHistory.value.slice(0, 20)));
        }
      } catch (error) {
        if (!cancelled) {
          logVideoEditorEvent("editor.load.failure", {
            projectId: project.id,
            correlationId,
            reason: error instanceof Error ? error.message : String(error),
          }, "error");
          dispatch(editorLoadFailed({ message: error instanceof Error ? error.message : String(error) }));
        }
      }
    }

    void loadEditor();

    return () => {
      cancelled = true;
    };
  }, [cacheScope, dispatch, project, projectMedia]);

  useEffect(() => {
    if (media.length === 0) return;
    void saveMediaAssets(media, cacheScope);
  }, [cacheScope, media]);

  useEffect(() => {
    if (!document || !videoHistory.lastHistoryFrame || !videoHistory.lastHistoryAction) return;

    const frame = videoHistory.lastHistoryFrame;
    const action = videoHistory.lastHistoryAction;

    async function persistHistoryMutation() {
      if (action === "edit") {
        await appendOperationLog({
          scope: cacheScope,
          projectId: project.id,
          batch: frame.batch,
          result: frame.result,
        });

        if (shouldSaveUndoCheckpoint(frame)) {
          await saveUndoCheckpoint({
            scope: cacheScope,
            projectId: project.id,
            operationId: frame.id,
            timestamp: frame.timestamp,
            checkpoint: frame.undo.type === "checkpoint" ? frame.undo.checkpoint : frame.beforeDocument,
            undo: frame.undo,
            historyEntry: frame.historyEntry,
          });
        }

        await cleanupEditorCache({ operationLogLimit: 500, undoCheckpointLimit: 20 });
      }
    }

    void persistHistoryMutation();
  }, [
    cacheScope,
    document,
    project.id,
    videoHistory.historyMutationCount,
    videoHistory.lastHistoryAction,
    videoHistory.lastHistoryFrame,
  ]);

  useEffect(() => {
    if (!mediaLoadError || media.length > 0) return;

    let cancelled = false;
    async function restoreCachedMedia() {
      const cached = await listMediaAssets(cacheScope);
      if (cancelled || !cached.ok || cached.value.length === 0) return;

      cached.value.forEach((item) => live.mergeMedia(item));
      dispatch(toastShown("Using cached media while the library refresh failed"));
    }

    void restoreCachedMedia();

    return () => {
      cancelled = true;
    };
  }, [cacheScope, dispatch, media.length, mediaLoadError]);

  useEffect(() => {
    const overlayActive = Boolean(activeModal || activePopover);
    if (overlayActive) {
      if (!overlayFocusReturnRef.current && typeof window !== "undefined") {
        const activeElement = window.document.activeElement;
        overlayFocusReturnRef.current = activeElement instanceof HTMLElement ? activeElement : null;
      }
      return;
    }

    const returnTarget = overlayFocusReturnRef.current;
    overlayFocusReturnRef.current = null;
    if (!returnTarget || typeof window === "undefined" || !window.document.contains(returnTarget)) return;

    window.requestAnimationFrame(() => returnTarget.focus());
  }, [activeModal, activePopover]);

  const attachMediaForTimeline = useCallback(async (item: MediaDto) => {
    if (!canWrite) {
      dispatch(toastShown("View only: you cannot place media on this timeline"));
      return false;
    }

    try {
      const attached = await attachProjectMediaFromBff(project.id, [item.id]);
      setProjectMediaRows((current) => mergeProjectMediaRows(current, attached));
      dispatch(projectMediaAvailabilityLoaded(attached));
      return true;
    } catch (error) {
      dispatch(toastShown(error instanceof Error ? error.message : "Media could not be attached to this project"));
      return false;
    }
  }, [canWrite, dispatch, project.id]);

  const addMediaToTimeline = useCallback(async (item: MediaDto) => {
    if (!await attachMediaForTimeline(item)) return;
    dispatch(mediaAssetAddedToTimeline(item));
  }, [attachMediaForTimeline, dispatch]);

  const addDroppedMediaToTimeline = useCallback(async (mediaId: string, placement?: { trackId: string; timelineStart: number }) => {
    const item = live.media.find((candidate) => candidate.id === mediaId);
    if (!item) {
      dispatch(toastShown("Media is no longer available"));
      return;
    }

    if (!await attachMediaForTimeline(item)) return;
    dispatch(mediaAssetAddedToTimeline(placement ? { media: item, ...placement } : item));
  }, [attachMediaForTimeline, dispatch, live.media]);

  const handleUploaded = useCallback(async (item: MediaDto) => {
    live.mergeMedia(item);
    await saveMediaAssets([item], cacheScope);
    dispatch(assetSelected(item.id));
    dispatch(toastShown("Media imported"));
  }, [cacheScope, dispatch, live]);

  return (
    <div
      ref={editorRootRef}
      data-video-editor-root
      data-editor-shortcuts="scope"
      tabIndex={-1}
      className="flex h-screen w-full flex-col overflow-hidden bg-background text-on-background"
      style={
        {
          "--editor-timeline-space": `${timelineOpen ? timelineHeight : 40}px`,
        } as CSSProperties
      }
    >
      <EditorTopBar project={{ ...editorProject, id: project.id, name: project.name }} />
      {conflict ? (
        <EditorConflictBanner
          onKeepLocal={autosave.keepLocalEdits}
          onReloadServer={autosave.reloadServerCopy}
        />
      ) : draftRecovery.state !== "none" ? (
        <DraftRecoveryBanner
          recovery={draftRecovery}
          onContinue={() => setDraftRecovery({ state: "none" })}
          onReloadServer={async () => {
            await autosave.reloadServerCopy();
            setDraftRecovery({ state: "none" });
          }}
        />
      ) : editor.syncStatus === "sync-failed" ? (
        <EditorSyncFailureBanner
          error={editor.syncError}
          onRetry={autosave.retryNow}
          retrying={syncRetrying}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-50 rounded-[4px] border border-outline-variant bg-surface/95 px-3 py-2 text-center text-label-md font-semibold text-on-surface-variant lg:hidden">
          Use a wider screen for full editing. Preview and timeline remain available here.
        </div>
        <EditorPanelErrorBoundary label="Media library">
          <MediaLibraryPanel
            media={live.media}
            updatesById={live.updatesById}
            mediaLoadError={mediaLoadError}
            mediaRetrying={mediaRetrying}
            usingCachedMedia={Boolean(mediaLoadError && media.length === 0 && live.media.length > 0)}
            canPlaceMedia={canWrite}
            onRetryMediaLoad={onRetryMediaLoad}
            onAddMedia={addMediaToTimeline}
          />
        </EditorPanelErrorBoundary>
        <EditorPanelErrorBoundary label="Preview">
          <PreviewPanel project={editorProject} />
        </EditorPanelErrorBoundary>
        {editorMode === "ai" ? (
          <EditorPanelErrorBoundary label="Assistant">
            <AiAssistantPanel
              messages={assistantMessages}
              projectId={project.id}
              cacheScope={cacheScope}
              media={live.media}
              canPlanCommands={canWrite}
            />
          </EditorPanelErrorBoundary>
        ) : (
          <EditorPanelErrorBoundary label="Inspector">
            <ToolRail />
            <VideoInspectorPanel />
          </EditorPanelErrorBoundary>
        )}
      </div>

      <EditorPanelErrorBoundary label="Timeline">
        <TimelinePanel onMediaDrop={addDroppedMediaToTimeline} />
      </EditorPanelErrorBoundary>
      <EditorPanelErrorBoundary label="Popover layer">
        <EditorPopoverLayer />
      </EditorPanelErrorBoundary>
      <EditorPanelErrorBoundary label="Modal layer">
        <MediaUploadModal
          open={activeModal === "import-media"}
          onClose={() => dispatch(modalClosed())}
          studioId={studioId}
          onUploaded={handleUploaded}
        />
        <VideoExportModal
          open={activeModal === "export"}
          document={document}
          media={live.media}
          projectMedia={projectMediaRows}
          projectName={project.name}
          onClose={() => dispatch(modalClosed())}
          flushForExport={autosave.flushForExport}
        />
        <EditorModalLayer />
        <EditorToast />
      </EditorPanelErrorBoundary>
    </div>
  );
}

function logEditorCacheResults(
  projectId: string,
  correlationId: string,
  results: Record<string, { ok: boolean; reason?: string } | undefined>,
): void {
  for (const [cacheName, result] of Object.entries(results)) {
    if (!result || result.ok) continue;
    if (result.reason === "miss") {
      logVideoEditorEvent("editor.cache.miss", { projectId, correlationId, cacheName }, "warn");
      continue;
    }
    if (result.reason === "corrupt") {
      logVideoEditorEvent("editor.cache.corrupt", { projectId, correlationId, cacheName }, "warn");
      continue;
    }
    if (result.reason === "unavailable") {
      logVideoEditorEvent("editor.cache.unavailable", { projectId, correlationId, cacheName }, "warn");
    }
  }
}

function shouldSaveUndoCheckpoint(frame: VideoEditorHistoryFrame): boolean {
  return (
    frame.source === "ai" ||
    frame.batch.operations.length > 1 ||
    frame.undo.type === "checkpoint" ||
    frame.batch.forceCheckpoint === true ||
    frame.batch.operations.some((operation) =>
      operation.forceCheckpoint === true ||
      operation.type === "deleteItem" ||
      operation.type === "splitItem",
    ) ||
    frame.historyEntry.revision % 10 === 0
  );
}

function hydrateProjectMediaPlaceholders(
  document: VideoProjectDocument,
  projectMedia: ProjectMediaDto[],
): VideoProjectDocument {
  const projectMediaById = new Map(projectMedia.map((item) => [item.mediaId, item]));
  const media = { ...document.media };
  for (const item of mediaBackedItems(document)) {
    const row = projectMediaById.get(item.mediaId);
    const liveMedia = row ? projectMediaToMediaDto(row) : null;
    if (liveMedia) {
      media[item.mediaId] = mediaDtoToVideoMediaReference(liveMedia);
      continue;
    }

    if (row && row.availability !== "available" && row.availability !== "processing" && row.availability !== "failed") {
      media[item.mediaId] = placeholderMediaReference(item.mediaId, row.filename, mediaKindForProjectRow(row, item));
      continue;
    }

    if (!media[item.mediaId]) {
      media[item.mediaId] = placeholderMediaReference(item.mediaId, null, mediaKindForTimelineItem(item));
    }
  }

  return { ...document, media };
}

function mediaBackedItems(document: VideoProjectDocument): Array<Extract<VideoTimelineItem, { mediaId: string }>> {
  return document.tracks.flatMap((track) =>
    track.items.filter((item): item is Extract<VideoTimelineItem, { mediaId: string }> => "mediaId" in item),
  );
}

function placeholderMediaReference(
  mediaId: string,
  filename: string | null | undefined,
  kind: VideoMediaKind,
): VideoMediaReference {
  return {
    id: mediaId,
    kind,
    name: filename ?? `Unavailable media ${mediaId.slice(0, 8)}`,
  };
}

function mediaKindForProjectRow(
  row: ProjectMediaDto,
  item: Extract<VideoTimelineItem, { mediaId: string }>,
): VideoMediaKind {
  if (row.kind === MediaKind.Audio) return "audio";
  if (row.kind === MediaKind.Image) return "image";
  if (row.kind === MediaKind.Video) return "video";
  return mediaKindForTimelineItem(item);
}

function mediaKindForTimelineItem(item: Extract<VideoTimelineItem, { mediaId: string }>): VideoMediaKind {
  if (item.type === "audio") return "audio";
  if (item.type === "image" || item.type === "overlay") return "image";
  return "video";
}

function mergeProjectMediaRows(current: ProjectMediaDto[], rows: ProjectMediaDto[]): ProjectMediaDto[] {
  const byId = new Map(current.map((item) => [item.mediaId, item]));
  for (const row of rows) {
    byId.set(row.mediaId, row);
  }
  return Array.from(byId.values());
}

function EditorConflictBanner({
  onKeepLocal,
  onReloadServer,
}: {
  onKeepLocal: () => void | Promise<void>;
  onReloadServer: () => void | Promise<void>;
}) {
  return (
    <div className="z-40 flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-error-container px-3 text-on-error-container 2xl:px-4">
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold">Server changed while local edits are saved</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void onKeepLocal()}
          className="h-8 rounded-[4px] border border-on-error-container/30 px-3 text-label-md font-semibold hover:bg-on-error-container/10"
        >
          Keep local edits
        </button>
        <button
          type="button"
          onClick={() => void onReloadServer()}
          className="h-8 rounded-[4px] bg-on-error-container px-3 text-label-md font-semibold text-error-container hover:opacity-90"
        >
          Reload server copy
        </button>
      </div>
    </div>
  );
}

function EditorSyncFailureBanner({
  error,
  onRetry,
  retrying,
}: {
  error: string | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="z-40 flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-error-container px-3 text-on-error-container 2xl:px-4">
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold">{error ?? "Timeline sync failed. Local edits are saved."}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="h-8 shrink-0 rounded-[4px] bg-on-error-container px-3 text-label-md font-semibold text-error-container hover:opacity-90"
      >
        {retrying ? "Retrying" : "Retry"}
      </button>
    </div>
  );
}

function DraftRecoveryBanner({
  recovery,
  onContinue,
  onReloadServer,
}: {
  recovery: Exclude<DraftRecoveryState, { state: "none" }>;
  onContinue: () => void;
  onReloadServer: () => void | Promise<void>;
}) {
  const isPrompt = recovery.state === "prompt";

  return (
    <div
      data-editor-draft-recovery-banner={recovery.state}
      className={`z-40 flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 2xl:px-4 ${
        isPrompt
          ? "bg-tertiary-container text-on-tertiary-container"
          : "bg-surface-container-high text-on-surface"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold">{recovery.message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isPrompt ? (
          <>
            <button
              type="button"
              onClick={onContinue}
              className="h-8 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90"
            >
              Continue local draft
            </button>
            <button
              type="button"
              onClick={() => void onReloadServer()}
              className="h-8 rounded-[4px] border border-on-tertiary-container/30 px-3 text-label-md font-semibold hover:bg-on-tertiary-container/10"
            >
              Reload server copy
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="h-8 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold hover:bg-surface-container-highest"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
