import { useCallback, useEffect, useMemo, type CSSProperties } from "react";

import { OwnerKind, type MediaDto, type ProjectDto } from "~/lib/api";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import {
  deletePendingSync,
  deleteVideoTimelineDraft,
  getProjectMetadata,
  getProjectSnapshot,
  getVideoTimelineDraft,
  listMediaAssets,
  listPendingSync,
  saveProjectMetadata,
  saveMediaAssets,
} from "~/lib/editor/editor-cache";
import {
  buildEditorCacheScopeFromProject,
  resolveCachedEditorDocument,
} from "~/lib/editor/editor-load";
import { createEmptyVideoProjectDocument } from "~/lib/editor/video-document";
import { useLiveMedia } from "~/lib/media-realtime";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  editorConflictResolved,
  editorDocumentLoaded,
  editorLoadFailed,
  editorLoadStarted,
  mediaAssetAddedToTimeline,
  modalClosed,
  selectEditorConflict,
  selectEditorMode,
  selectOverlayState,
  selectTimelinePanelState,
  toastShown,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorModalLayer, EditorPopoverLayer, EditorToast } from "./editor-overlays";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import {
  assistantMessages,
  assistantSuggestions,
  editorProject,
} from "./mock-editor-data";
import { PreviewPanel } from "./panels/preview-panel";
import { TimelinePanel } from "./panels/timeline-panel";
import { ToolRail } from "./tool-rail";

interface VideoEditorWorkspaceProps {
  project: ProjectDto;
  userId: string;
  media: MediaDto[];
  mediaLoadError: string | null;
}

/**
 * Video editor UI. Client-only: it lives under the route's Redux `<Provider>`
 * and never renders on the server.
 */
export function VideoEditorWorkspace({ project, userId, media, mediaLoadError }: VideoEditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const editorMode = useAppSelector(selectEditorMode);
  const conflict = useAppSelector(selectEditorConflict);
  const activeModal = useAppSelector((state) => selectOverlayState(state).activeModal);
  const { height: timelineHeight, open: timelineOpen } = useAppSelector(selectTimelinePanelState);
  const cacheScope = useMemo(
    () => buildEditorCacheScopeFromProject(userId, project),
    [project, userId],
  );
  const live = useLiveMedia(media);
  const studioId = project.ownerKind === OwnerKind.Studio ? project.ownerId : null;

  useEffect(() => {
    let cancelled = false;

    async function loadEditor() {
      dispatch(editorLoadStarted({ projectId: project.id }));

      try {
        const [cachedProject, cachedSnapshot, draft, pendingSync] = await Promise.all([
          getProjectMetadata(cacheScope, project.id),
          getProjectSnapshot(cacheScope, project.id),
          getVideoTimelineDraft(cacheScope, project.id),
          listPendingSync(cacheScope, project.id),
        ]);

        if (cancelled) return;

        const resolved = resolveCachedEditorDocument({
          project,
          cachedProject,
          cachedSnapshot,
          draft,
          pendingSync,
        });

        dispatch(editorDocumentLoaded({
          document: resolved.document,
          source: resolved.source,
          syncStatus: resolved.syncStatus,
          pendingSyncCount: resolved.pendingSyncCount,
          conflict: resolved.conflict,
          warnings: resolved.warnings,
        }));

        if (!resolved.conflict) {
          await saveProjectMetadata(project, cacheScope);
        }
      } catch (error) {
        if (!cancelled) {
          dispatch(editorLoadFailed({ message: error instanceof Error ? error.message : String(error) }));
        }
      }
    }

    void loadEditor();

    return () => {
      cancelled = true;
    };
  }, [cacheScope, dispatch, project]);

  useEffect(() => {
    if (media.length === 0) return;
    void saveMediaAssets(media, cacheScope);
  }, [cacheScope, media]);

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

  const keepLocalEdits = useCallback(async () => {
    dispatch(editorConflictResolved({ resolution: "keep-local" }));
    await saveProjectMetadata(project, cacheScope);
  }, [cacheScope, dispatch, project]);

  const reloadServerCopy = useCallback(async () => {
    dispatch(editorConflictResolved({ resolution: "reload-server" }));
    await deleteVideoTimelineDraft(cacheScope, project.id);

    const pending = await listPendingSync(cacheScope, project.id);
    if (pending.ok) {
      await Promise.all(pending.value.map((entry) => deletePendingSync(entry.id)));
    }

    const document = createEmptyVideoProjectDocument({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });

    dispatch(editorDocumentLoaded({
      document,
      source: "empty",
      syncStatus: "clean",
      pendingSyncCount: 0,
      conflict: null,
    }));
    await saveProjectMetadata(project, cacheScope);
  }, [cacheScope, dispatch, project]);

  const addMediaToTimeline = useCallback((item: MediaDto) => {
    dispatch(mediaAssetAddedToTimeline(item));
  }, [dispatch]);

  const addDroppedMediaToTimeline = useCallback((mediaId: string, placement?: { trackId: string; timelineStart: number }) => {
    const item = live.media.find((candidate) => candidate.id === mediaId);
    if (!item) {
      dispatch(toastShown("Media is no longer available"));
      return;
    }

    dispatch(mediaAssetAddedToTimeline(placement ? { media: item, ...placement } : item));
  }, [dispatch, live.media]);

  const handleUploaded = useCallback(async (item: MediaDto) => {
    live.mergeMedia(item);
    await saveMediaAssets([item], cacheScope);
    dispatch(assetSelected(item.id));
    dispatch(toastShown("Media imported"));
  }, [cacheScope, dispatch, live]);

  return (
    <div
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
          onKeepLocal={keepLocalEdits}
          onReloadServer={reloadServerCopy}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <MediaLibraryPanel
          media={live.media}
          updatesById={live.updatesById}
          mediaLoadError={mediaLoadError}
          usingCachedMedia={Boolean(mediaLoadError && media.length === 0 && live.media.length > 0)}
          onAddMedia={addMediaToTimeline}
        />
        <PreviewPanel project={editorProject} />
        {editorMode === "ai" ? (
          <AiAssistantPanel messages={assistantMessages} suggestions={assistantSuggestions} />
        ) : (
          <ToolRail />
        )}
      </div>

      <TimelinePanel onMediaDrop={addDroppedMediaToTimeline} />
      <EditorPopoverLayer />
      <MediaUploadModal
        open={activeModal === "import-media"}
        onClose={() => dispatch(modalClosed())}
        studioId={studioId}
        onUploaded={handleUploaded}
      />
      <EditorModalLayer />
      <EditorToast />
    </div>
  );
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
