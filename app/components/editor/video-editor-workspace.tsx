import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { MediaKind, OwnerKind, type MediaDto, type ProjectDto, type ProjectMediaDto } from "~/lib/api";
import type { HeaderActionUser, HeaderNotifications } from "~/routes/dashboard/header-bar";
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
  saveEditorBootstrap,
  saveMediaAssets,
  saveProjectSnapshot,
  saveVideoTimelineDraft,
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
import {
  mediaDtoToVideoMediaReference,
} from "~/lib/editor/editor-media";
import { getVideoTimelineFromBff } from "~/lib/editor/video-timeline-api.client";
import {
  projectMediaToMediaDto,
} from "~/lib/editor/project-media-api.client";
import {
  createVideoEditorPerformanceMetric,
  queueVideoEditorPerformanceMetric,
} from "~/lib/editor/video-performance.client";
import { useLiveMedia } from "~/lib/media-realtime";
import { uploadMediaFile } from "~/lib/media-upload.client";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  aiCommandHistoryLoaded,
  editorDocumentLoaded,
  editorModeChanged,
  editorLoadFailed,
  editorLoadStarted,
  mediaPreparationRequested,
  pendingTimelineInsertionAdded,
  modalClosed,
  projectMediaAvailabilityLoaded,
  libraryOpenChanged,
  selectChromeState,
  selectEditorConflict,
  selectEditorState,
  selectEditorMode,
  selectOverlayState,
  selectTimelinePanelState,
  selectVideoDocument,
  selectVideoHistoryState,
  toastShown,
  timelineOpenChanged,
  textItemCreated,
  selectInspectorPanelState,
  selectHasUnsyncedChanges,
  inspectorOpenChanged,
  activeInspectorSectionChanged,
  type VideoEditorHistoryFrame,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorPanelErrorBoundary } from "./editor-panel-error-boundary";
import { EditorExitGuard } from "./editor-exit-guard";
import { EditorIcon } from "./editor-ui";
import { EditorModalLayer, EditorPopoverLayer, EditorToast } from "./editor-overlays";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import { PreviewPanel } from "./panels/preview-panel";
import { TimelinePanel } from "./panels/timeline-panel";
import { ToolRail } from "./tool-rail";
import { useVideoAutosave } from "./use-video-autosave";
import { useVideoKeyboardShortcuts } from "./use-video-keyboard-shortcuts";
import { insertionPreparationRequest, useMediaPreparation } from "./use-media-preparation";
import { VideoExportModal } from "./video-export-modal";
import { VideoInspectorPanel } from "./video-inspector-panel";
import type { VideoMediaKind, VideoMediaReference, VideoProjectDocument, VideoTimelineItem } from "~/lib/editor/video-document";

interface VideoEditorWorkspaceProps {
  project: ProjectDto;
  userId: string;
  user: HeaderActionUser;
  notifications?: HeaderNotifications;
  media: MediaDto[];
  projectMedia: ProjectMediaDto[];
  mediaLoadError: string | null;
  mediaRetrying?: boolean;
  onRetryMediaLoad?: () => void;
  canWrite: boolean;
}

type NarrowManualPane = "preview" | "timeline";
type ResponsiveManualDrawer = "library" | "inspector" | null;

/**
 * Video editor UI. Client-only: it lives under the route's Redux `<Provider>`
 * and never renders on the server.
 */
export function VideoEditorWorkspace({
  project,
  userId,
  user,
  notifications,
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
  const [attachedProjectMediaIds, setAttachedProjectMediaIds] = useState(() => projectMedia.map((item) => item.mediaId));
  const [draftRecovery, setDraftRecovery] = useState<DraftRecoveryState>({ state: "none" });
  const [narrowManualPane, setNarrowManualPane] = useState<NarrowManualPane>("preview");
  const [responsiveDrawer, setResponsiveDrawer] = useState<ResponsiveManualDrawer>(null);
  const { open: desktopInspectorOpen, activeSection: activeInspectorSection } = useAppSelector(selectInspectorPanelState);
  const [activeRailTab, setActiveRailTab] = useState("media");
  const responsiveDrawerReturnFocusRef = useRef<HTMLElement | null>(null);
  const editor = useAppSelector(selectEditorState);
  const hasUnsyncedChanges = useAppSelector(selectHasUnsyncedChanges);
  const editorMode = useAppSelector(selectEditorMode);
  const { libraryOpen } = useAppSelector(selectChromeState);
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
    attachedProjectMediaIds,
    onProjectMediaAttached: (attached) => {
      setProjectMediaRows((current) => mergeProjectMediaRows(current, attached));
      setAttachedProjectMediaIds((current) => Array.from(new Set([...current, ...attached.map((item) => item.mediaId)])));
      dispatch(projectMediaAvailabilityLoaded(attached));
    },
  });
  useVideoKeyboardShortcuts(editorRootRef, { onSave: autosave.syncNow });
  useMediaPreparation(project.id);

  useEffect(() => {
    setProjectMediaRows(projectMedia);
    setAttachedProjectMediaIds(projectMedia.map((item) => item.mediaId));
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
          getVideoTimelineFromBff(project.id, { correlationId }),
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

        if (serverTimeline.status === "unavailable") {
          logVideoEditorEvent("editor.load.failure", {
            projectId: project.id,
            correlationId,
            source: "server",
            reason: serverTimeline.message,
          }, "warn");
        }

        const resolution = resolveCachedEditorDocument({
          project,
          cachedProject,
          cachedSnapshot,
          draft,
          draftRecord,
          pendingSync,
          serverTimeline,
        });
        if (resolution.status === "failure") {
          dispatch(editorLoadFailed({ message: resolution.message }));
          return;
        }
        const resolved = resolution.value;
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

        if (serverTimeline.status !== "unavailable") {
          const server = serverTimeline.status === "found" ? serverTimeline.timeline : null;
          const serverDocument = server?.document ?? (resolved.source === "empty" ? resolved.document : null);
          const serverRevisionNumber = server?.revisionNumber ?? 0;
          const serverUpdatedAt = server?.updatedAt ?? project.updatedAt;
          await Promise.all([
            saveProjectMetadata(project, cacheScope),
            saveEditorBootstrap({
              scope: cacheScope,
              projectId: project.id,
              project,
              canWrite,
              media,
              projectMedia,
              serverRevisionNumber,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            }),
            ...(serverDocument ? [saveProjectSnapshot({
              scope: cacheScope,
              projectId: project.id,
              snapshot: JSON.parse(JSON.stringify(serverDocument)),
              documentSchemaVersion: serverDocument.schemaVersion,
              revision: serverRevisionNumber,
              projectUpdatedAt: project.updatedAt,
            })] : []),
            ...(serverDocument && (resolved.source === "server" || resolved.source === "empty")
              ? [saveVideoTimelineDraft(serverDocument, cacheScope, {
                serverRevisionNumber,
                lastSyncedAt: serverUpdatedAt,
                hasUnsyncedChanges: false,
                syncError: null,
              })]
              : []),
          ]);
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
  }, [cacheScope, canWrite, dispatch, media, project, projectMedia]);

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

  const closeResponsiveDrawer = useCallback(() => {
    setResponsiveDrawer(null);
    const returnTarget = responsiveDrawerReturnFocusRef.current;
    responsiveDrawerReturnFocusRef.current = null;
    if (!returnTarget || typeof window === "undefined") return;
    window.requestAnimationFrame(() => returnTarget.focus());
  }, []);

  const openResponsiveDrawer = useCallback((
    drawer: Exclude<ResponsiveManualDrawer, null>,
    trigger: HTMLElement,
  ) => {
    responsiveDrawerReturnFocusRef.current = trigger;
    if (drawer === "library") {
      dispatch(libraryOpenChanged(true));
    }
    setResponsiveDrawer(drawer);
  }, [dispatch]);

  useEffect(() => {
    if (!responsiveDrawer) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeResponsiveDrawer();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeResponsiveDrawer, responsiveDrawer]);

  useEffect(() => {
    if (!responsiveDrawer || typeof window === "undefined") return;
    const label = responsiveDrawer === "library" ? "Media library" : "Inspector";
    const frame = window.requestAnimationFrame(() => {
      const panel = editorRootRef.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`);
      panel?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex='0']")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [responsiveDrawer]);

  useEffect(() => {
    if (editorMode !== "manual" && responsiveDrawer) {
      closeResponsiveDrawer();
    }
  }, [closeResponsiveDrawer, editorMode, responsiveDrawer]);

  const prepareMediaForTimeline = useCallback((item: MediaDto) => {
    if (!canWrite) {
      dispatch(toastShown("View only: you cannot place media on this timeline"));
      return false;
    }

    const localRow = projectMediaRowFromMedia(item);
    setProjectMediaRows((current) => mergeProjectMediaRows(current, [localRow]));
    dispatch(projectMediaAvailabilityLoaded([localRow]));
    return true;
  }, [canWrite, dispatch]);

  const queuePendingInsertion = useCallback((
    item: MediaDto,
    placement: { trackId?: string; timelineStart: number },
  ) => {
    const request = insertionPreparationRequest(
      item,
      placement.timelineStart,
      document?.settings.previewQuality ?? "balanced",
    );
    if (!request) {
      dispatch(toastShown("Media has no editor-ready object"));
      return;
    }
    const knownDuration = Number(item.durationSeconds);
    const provisionalDuration = item.kind === MediaKind.Image
      ? 5
      : Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 3;
    const id = `pending-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch(pendingTimelineInsertionAdded({
      id,
      projectId: project.id,
      media: item,
      trackId: placement.trackId,
      timelineStart: placement.timelineStart,
      provisionalDuration,
      resourceKey: request.key,
      status: "queued",
      createdAt: performance.now(),
    }));
    dispatch(mediaPreparationRequested(request));
  }, [dispatch, document?.settings.previewQuality, project.id]);

  const addMediaToTimeline = useCallback((item: MediaDto) => {
    if (!prepareMediaForTimeline(item)) return;
    queuePendingInsertion(item, { timelineStart: editor.playback.currentTime });
  }, [editor.playback.currentTime, prepareMediaForTimeline, queuePendingInsertion]);

  const addDroppedMediaToTimeline = useCallback((mediaId: string, placement?: { trackId?: string; timelineStart: number }) => {
    const item = live.media.find((candidate) => candidate.id === mediaId);
    if (!item) {
      dispatch(toastShown("Media is no longer available"));
      return;
    }

    if (!prepareMediaForTimeline(item)) return;
    queuePendingInsertion(item, placement ?? { timelineStart: editor.playback.currentTime });
  }, [editor.playback.currentTime, prepareMediaForTimeline, live.media, queuePendingInsertion]);

  const handleUploaded = useCallback(async (item: MediaDto) => {
    live.mergeMedia(item);
    await saveMediaAssets([item], cacheScope);
    dispatch(assetSelected(item.id));
    dispatch(toastShown("Media imported"));
  }, [cacheScope, dispatch, live]);

  const importDroppedFiles = useCallback(async (files: File[]) => {
    if (!canWrite) {
      dispatch(toastShown("View only: you cannot import media"));
      return;
    }

    const supportedFiles = files.flatMap((file) => {
      const kind = mediaKindForFile(file);
      return kind === null ? [] : [{ file, kind }];
    });
    if (supportedFiles.length === 0) {
      dispatch(toastShown("Drop video, image, or audio files to import"));
      return;
    }

    dispatch(toastShown(`Importing ${supportedFiles.length} file${supportedFiles.length === 1 ? "" : "s"}`));
    for (const { file, kind } of supportedFiles) {
      try {
        const uploaded = await uploadMediaFile({
          file,
          kind,
          filename: file.name,
          studioId,
        });
        await handleUploaded(uploaded);
      } catch (error) {
        dispatch(toastShown(error instanceof Error ? error.message : `Could not import ${file.name}`));
      }
    }
  }, [canWrite, dispatch, handleUploaded, studioId]);

  return (
    <div
      ref={editorRootRef}
      data-video-editor-root
      data-editor-shortcuts="scope"
      tabIndex={-1}
      className="video-editor-theme flex h-dvh w-full flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-on-background"
      style={
        {
          "--editor-timeline-space": `${timelineOpen ? timelineHeight : 40}px`,
        } as CSSProperties
      }
    >
      <EditorExitGuard
        hasUnsyncedChanges={hasUnsyncedChanges}
        flushLocalDraft={autosave.flushLocalDraft}
        syncNow={autosave.syncNow}
      />
      <EditorTopBar
        project={project}
        user={user}
        notifications={notifications}
        onSync={autosave.syncNow}
        conflict={Boolean(conflict)}
        onKeepLocal={autosave.keepLocalEdits}
        onReloadServer={autosave.reloadServerCopy}
      />
      {conflict ? null : draftRecovery.state !== "none" ? (
        <DraftRecoveryBanner
          recovery={draftRecovery}
          onContinue={() => setDraftRecovery({ state: "none" })}
          onReloadServer={async () => {
            await autosave.reloadServerCopy();
            setDraftRecovery({ state: "none" });
          }}
        />
      ) : editor.localSaveStatus === "failed" ? (
        <EditorSyncFailureBanner
          error={editor.localSaveError ?? "Local save failed. This page cannot be left safely yet."}
          onRetry={() => void autosave.flushLocalDraft().catch(() => undefined)}
          retrying={false}
        />
      ) : editor.syncStatus === "sync-failed" ? (
        <EditorSyncFailureBanner
          error={editor.syncError}
          onRetry={autosave.retryNow}
          retrying={syncRetrying}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {editorMode === "manual" ? (
          <ResponsiveManualControls
            activePane={narrowManualPane}
            drawer={responsiveDrawer}
            onPaneChange={(pane) => {
              if (pane === "timeline") dispatch(timelineOpenChanged(true));
              setNarrowManualPane(pane);
            }}
            onOpenDrawer={openResponsiveDrawer}
          />
        ) : null}

        <div
          className={`relative flex min-h-0 flex-1 overflow-hidden ${editorMode === "manual" && narrowManualPane === "timeline"
              ? "max-[759px]:hidden"
              : ""
            }`}
        >
          <ManualNavigationRail activeTab={activeRailTab} onTabChange={setActiveRailTab} />
          {!libraryOpen ? (
            <button
              type="button"
              aria-label="Open media library"
              title="Open media library"
              className="group relative z-40 hidden h-full w-10 shrink-0 items-center justify-center border-r border-outline-variant bg-surface text-on-surface-variant transition-colors duration-150 hover:border-primary/35 hover:bg-surface-container-high hover:text-on-surface motion-reduce:transition-none min-[1180px]:flex"
              onClick={() => dispatch(libraryOpenChanged(true))}
            >
              <EditorIcon className="text-[22px] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none">
                chevron_right
              </EditorIcon>
            </button>
          ) : null}
          <EditorPanelErrorBoundary label="Media library">
            <MediaLibraryPanel
              activeTab={activeRailTab}
              media={live.media}
              updatesById={live.updatesById}
              mediaLoadError={mediaLoadError}
              mediaRetrying={mediaRetrying}
              usingCachedMedia={Boolean(mediaLoadError && media.length === 0 && live.media.length > 0)}
              canPlaceMedia={canWrite}
              onRetryMediaLoad={onRetryMediaLoad}
              onAddMedia={addMediaToTimeline}
              onImportFiles={(files) => void importDroppedFiles(files)}
              onRequestClose={closeResponsiveDrawer}
              className={
                responsiveDrawer === "library"
                  ? "absolute inset-y-0 left-0 z-40 flex w-[min(320px,88vw)] shadow-2xl min-[1180px]:relative min-[1180px]:shadow-none"
                  : "hidden min-[1180px]:flex"
              }
            />
          </EditorPanelErrorBoundary>
          <EditorPanelErrorBoundary label="Preview">
            <PreviewPanel
              onMediaDrop={addDroppedMediaToTimeline}
            />
          </EditorPanelErrorBoundary>
          {editorMode === "ai" ? (
            <>
              <EditorPanelErrorBoundary label="Assistant">
                <AiAssistantPanel
                  projectId={project.id}
                  cacheScope={cacheScope}
                  media={live.media}
                  canPlanCommands={canWrite}
                />
              </EditorPanelErrorBoundary>
              <ToolRail
                showLabels
                inspectorOpen={desktopInspectorOpen}
                onInspectorToggle={() => dispatch(inspectorOpenChanged(!desktopInspectorOpen))}
                activeSection={activeInspectorSection}
                onSectionChange={(section) => {
                  dispatch(editorModeChanged("manual"));
                  dispatch(activeInspectorSectionChanged(section));
                  dispatch(inspectorOpenChanged(true));
                }}
                className="z-40 hidden h-full w-16 shrink-0 flex-col border-l border-outline-variant bg-surface min-[1180px]:flex"
              />
            </>
          ) : (
            <EditorPanelErrorBoundary label="Inspector">
              <ToolRail
                showLabels
                inspectorOpen={desktopInspectorOpen}
                onInspectorToggle={() => dispatch(inspectorOpenChanged(!desktopInspectorOpen))}
                activeSection={activeInspectorSection}
                onSectionChange={(section) => {
                  if (desktopInspectorOpen && activeInspectorSection === section) {
                    dispatch(inspectorOpenChanged(false));
                  } else {
                    dispatch(activeInspectorSectionChanged(section));
                    dispatch(inspectorOpenChanged(true));
                  }
                }}
                className="z-40 hidden h-full w-16 shrink-0 flex-col border-l border-outline-variant bg-surface min-[1180px]:flex"
              />
              <VideoInspectorPanel
                activeSection={activeInspectorSection}
                onSectionChange={(section) => dispatch(activeInspectorSectionChanged(section))}
                onRequestClose={() => {
                  dispatch(inspectorOpenChanged(false));
                  closeResponsiveDrawer();
                }}
                visibilityClassName={
                  responsiveDrawer === "inspector"
                    ? "absolute inset-y-0 right-0 z-40 flex shadow-2xl min-[1180px]:relative min-[1180px]:shadow-none"
                    : desktopInspectorOpen
                      ? "hidden min-[1180px]:flex"
                      : "hidden"
                }
              />
            </EditorPanelErrorBoundary>
          )}
          {editorMode === "manual" && responsiveDrawer ? (
            <button
              type="button"
              aria-label="Close editor panel"
              onClick={closeResponsiveDrawer}
              className="absolute inset-0 z-20 bg-black/45 min-[1180px]:hidden"
            />
          ) : null}
        </div>
      </div>

      <EditorPanelErrorBoundary label="Timeline">
        <TimelinePanel
          onMediaDrop={addDroppedMediaToTimeline}
          className={
            editorMode === "manual"
              ? `${narrowManualPane === "preview" ? "max-[759px]:hidden" : ""} max-[759px]:!h-full max-[759px]:!min-h-0 max-[759px]:!max-h-none max-[759px]:flex-1`
              : ""
          }
        />
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

function ResponsiveManualControls({
  activePane,
  drawer,
  onPaneChange,
  onOpenDrawer,
}: {
  activePane: NarrowManualPane;
  drawer: ResponsiveManualDrawer;
  onPaneChange: (pane: NarrowManualPane) => void;
  onOpenDrawer: (drawer: Exclude<ResponsiveManualDrawer, null>, trigger: HTMLElement) => void;
}) {
  const dispatch = useAppDispatch();
  const { open: desktopInspectorOpen, activeSection: activeInspectorSection } = useAppSelector(selectInspectorPanelState);

  return (
    <div
      data-responsive-manual-controls
      className="z-40 hidden shrink-0 flex-col border-b border-outline-variant bg-surface max-[1179px]:flex"
    >
      <div className="flex min-h-12 items-center gap-2 px-2">
        <button
          type="button"
          aria-label="Open media library"
          aria-pressed={drawer === "library"}
          onClick={(event) => onOpenDrawer("library", event.currentTarget)}
          className={`flex h-11 items-center gap-2 rounded-[4px] px-3 text-label-md font-semibold transition-colors motion-reduce:transition-none ${drawer === "library"
              ? "bg-surface-container-highest text-primary"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
        >
          <EditorIcon className="text-[19px]">perm_media</EditorIcon>
          <span className="hidden min-[520px]:inline">Media</span>
        </button>

        <div
          role="tablist"
          aria-label="Manual editor view"
          className="mx-auto hidden items-center rounded-[6px] border border-outline-variant bg-surface-container-low p-0.5 max-[759px]:flex"
        >
          {(["preview", "timeline"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={activePane === pane}
              onClick={() => onPaneChange(pane)}
              className={`h-10 rounded-[4px] px-3 text-label-md font-semibold capitalize transition-colors motion-reduce:transition-none ${activePane === pane
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              {pane}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Open inspector"
          aria-pressed={drawer === "inspector"}
          onClick={(event) => onOpenDrawer("inspector", event.currentTarget)}
          className={`ml-auto flex h-11 items-center gap-2 rounded-[4px] px-3 text-label-md font-semibold transition-colors motion-reduce:transition-none max-[759px]:ml-0 ${drawer === "inspector"
              ? "bg-surface-container-highest text-primary"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
        >
          <span className="hidden min-[520px]:inline">Inspector</span>
          <EditorIcon className="text-[19px]">tune</EditorIcon>
        </button>
      </div>
      <ToolRail
        orientation="horizontal"
        inspectorOpen={desktopInspectorOpen}
        onInspectorToggle={() => dispatch(inspectorOpenChanged(!desktopInspectorOpen))}
        activeSection={activeInspectorSection}
        onSectionChange={(section) => {
          if (desktopInspectorOpen && activeInspectorSection === section) {
            dispatch(inspectorOpenChanged(false));
          } else {
            dispatch(activeInspectorSectionChanged(section));
            dispatch(inspectorOpenChanged(true));
          }
        }}
        className="w-full shrink-0 overflow-x-auto border-t border-outline-variant bg-surface-container-lowest"
      />
    </div>
  );
}

function ManualNavigationRail({ activeTab, onTabChange }: { activeTab: string, onTabChange: (id: string) => void }) {
  const dispatch = useAppDispatch();
  const editorMode = useAppSelector(selectEditorMode);
  const items = [
    { id: "media", label: "Media", icon: "perm_media", enabled: true },
    { id: "text", label: "Text", icon: "title", enabled: true },
    { id: "effects", label: "Effects", icon: "auto_fix_normal", enabled: true },
    { id: "transitions", label: "Transitions", icon: "movie_edit", enabled: true },
    { id: "brand_kits", label: "Brand Kits", icon: "branding_watermark", enabled: true },
    { id: "elements", label: "Elements", icon: "category", enabled: true },
    { id: "ai_tools", label: "AI Tools", icon: "smart_toy", enabled: true },
  ] as const;

  return (
    <nav
      aria-label="Editor categories"
      className="z-40 hidden h-full w-[72px] shrink-0 flex-col items-center border-r border-outline-variant bg-surface py-3 min-[1180px]:flex"
    >
      <div className="flex w-full flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.enabled}
            aria-label={item.label}
            aria-pressed={item.id === activeTab || undefined}
            onClick={() => {
              onTabChange(item.id);
              dispatch(libraryOpenChanged(true));
            }}
            className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 text-[9px] font-semibold transition-colors motion-reduce:transition-none ${item.id === activeTab
                ? "bg-primary/10 text-primary"
                : item.enabled
                  ? "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  : "cursor-not-allowed text-on-surface-variant/30"
              }`}
          >
            <EditorIcon className="text-[21px]">{item.icon}</EditorIcon>
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => dispatch(editorModeChanged("ai"))}
        className={`mt-auto hidden flex min-h-14 w-full flex-col items-center justify-center gap-1 border-t border-outline-variant pt-2 text-[9px] font-bold text-primary hover:bg-primary/10 ${editorMode === "ai" ? "bg-primary/10" : ""
          }`}
        aria-label="Open AI tools"
        aria-pressed={editorMode === "ai"}
      >
        <EditorIcon className="text-[21px]">smart_toy</EditorIcon>
        AI Tools
      </button>
    </nav>
  );
}

function mediaKindForFile(file: File): number | null {
  if (file.type.startsWith("video/")) return MediaKind.Video;
  if (file.type.startsWith("image/")) return MediaKind.Image;
  if (file.type.startsWith("audio/")) return MediaKind.Audio;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && ["mp4", "mov", "webm", "mkv"].includes(extension)) return MediaKind.Video;
  if (extension && ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) return MediaKind.Image;
  if (extension && ["mp3", "wav", "m4a", "aac", "ogg"].includes(extension)) return MediaKind.Audio;
  return null;
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

function projectMediaRowFromMedia(media: MediaDto): ProjectMediaDto {
  return {
    mediaId: media.id,
    kind: media.kind,
    availability: media.status.toLowerCase() === "failed" ? "failed" : media.status.toLowerCase() === "ready" ? "available" : "processing",
    filename: media.filename,
    ownerId: media.ownerId,
    ownerKind: media.ownerKind,
    status: media.status,
    storageKey: media.storageKey,
    sizeBytes: nullableNumber(media.sizeBytes),
    canonicalStorageKey: media.canonicalStorageKey,
    proxyStorageKey: media.proxyStorageKey,
    thumbnailStorageKey: media.thumbnailStorageKey,
    errorMessage: media.errorMessage,
    durationSeconds: nullableNumber(media.durationSeconds),
    width: nullableNumber(media.width),
    height: nullableNumber(media.height),
    codec: media.codec,
    frameRate: nullableNumber(media.frameRate),
    shotCount: null,
    createdAt: media.createdAt,
  };
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
      className={`z-40 flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 2xl:px-4 ${isPrompt
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
