import { Suspense, lazy, useEffect, useRef, useState, type DragEvent } from "react";

import { EditorIcon } from "../editor-ui";
import {
  createCenteredTextLayer,
  createImageLayerFromMedia,
  createImageOperation,
  createImageDocumentId,
} from "./document/operations";
import { ImageEditorToolbar } from "./image-editor-toolbar";
import { ImageExportModal } from "./export-modal";
import { LayersPanel } from "./layers-panel";
import { MediaTemplatePanel } from "./media-template-panel";
import { PropertiesPanel } from "./properties-panel";
import { imageCompositionCanExport } from "./export/types";
import type {
  ImageCompositionOperation,
  ImageCompositionDocument,
  ImageHistoryEntry,
  ImageLayerStylePatch,
  ImageLayerTransform,
} from "./document/types";
import { MediaKind, type MediaDto } from "~/lib/api";
import { uploadMediaFile } from "~/lib/media-upload.client";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  imageActiveToolChanged,
  imageDocumentOperationApplied,
  imageDraftLoaded,
  imageEditorModeChanged,
  imageBackendSyncFailed,
  imageBackendSyncSucceeded,
  imageLayerSelected,
  imagePanelTabChanged,
  imageProjectOpened,
  imageRedoRequested,
  imageSaveStateChanged,
  imageSelectionCleared,
  imageServerVersionLoaded,
  imageUndoRequested,
  type ImageEditorMode,
  type ImageSaveState,
  type ImageEditorTool,
} from "~/store/slices/image-editor-slice";

const ImageCanvas = lazy(() =>
  import("./image-canvas").then((module) => ({ default: module.ImageCanvas })),
);

interface ImageEditorWorkspaceProps {
  projectId: string;
  projectName?: string | null;
  uploadStudioId?: string | null;
  backendComposition?: {
    document: ImageCompositionDocument | null;
    revisionNumber: number;
    updatedAt: string | null;
    updatedByUserId: string | null;
  } | null;
  imageMedia?: MediaDto[];
  mediaError?: string | null;
}

type UploadQueueStatus = "queued" | "uploading" | "uploaded" | "failed";

interface UploadQueueItem {
  id: string;
  fileName: string;
  progress: number;
  status: UploadQueueStatus;
  error: string | null;
  uploadedMedia: MediaDto | null;
}

export function ImageEditorWorkspace({
  projectId,
  projectName,
  uploadStudioId = null,
  backendComposition = null,
  imageMedia = [],
  mediaError = null,
}: ImageEditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const imageEditor = useAppSelector((state) => state.imageEditor);
  const latestDocumentUpdatedAt = useRef<string | null>(null);
  const initializedProject = useRef<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editorImageMedia, setEditorImageMedia] = useState<MediaDto[]>(imageMedia);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [narrowPanel, setNarrowPanel] = useState<"canvas" | "properties">("canvas");
  const [dragTarget, setDragTarget] = useState<"assets" | "canvas" | null>(null);
  const [conflictAction, setConflictAction] = useState<"reload" | "keep-local" | null>(null);

  useEffect(() => {
    dispatch(
      imageProjectOpened({
        projectId,
        projectName,
        document: backendComposition?.document ?? null,
        baseRevisionNumber: backendComposition?.revisionNumber ?? 0,
        lastSyncedAt: backendComposition?.updatedAt ?? null,
      }),
    );
    initializedProject.current = projectId;
  }, [backendComposition, dispatch, projectId, projectName]);

  useEffect(() => {
    setEditorImageMedia((current) => mergeMediaLists(imageMedia, current));
  }, [imageMedia]);

  useEffect(() => {
    let cancelled = false;
    import("./persistence/image-editor-cache.client").then(async (cache) => {
      const draft = await cache.loadNewestImageCompositionDraft(projectId);
      if (cancelled || !draft?.hasUnsyncedChanges) return;

      const serverUpdatedAt = backendComposition?.updatedAt
        ? Date.parse(backendComposition.updatedAt)
        : 0;
      const draftUpdatedAt = Date.parse(draft.updatedAt);
      if (!Number.isFinite(draftUpdatedAt) || draftUpdatedAt < serverUpdatedAt) return;

      dispatch(
        imageDraftLoaded({
          document: draft.document,
          baseRevisionNumber: draft.baseRevisionNumber,
          lastSyncedAt: draft.lastSyncedAt,
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [backendComposition?.updatedAt, dispatch, projectId]);

  useEffect(() => {
    latestDocumentUpdatedAt.current = imageEditor.document.updatedAt ?? null;
  }, [imageEditor.document.updatedAt]);

  useEffect(() => {
    if (imageEditor.projectId !== projectId || initializedProject.current !== projectId) return;
    const documentUpdatedAt = imageEditor.document.updatedAt;
    if (!documentUpdatedAt) return;

    const unsyncedOperations = getUnsyncedImageOperations(imageEditor.document);
    const baseRevisionNumber = imageEditor.document.baseRevisionNumber ?? 0;
    const documentChangedSinceSync = imageEditor.document.lastSyncedAt
      ? Date.parse(documentUpdatedAt) > Date.parse(imageEditor.document.lastSyncedAt)
      : imageEditor.document.operationHistory.length > 0;
    if (!documentChangedSinceSync && unsyncedOperations.length === 0) return;

    import("./persistence/image-editor-cache.client").then((cache) => {
      cache.saveImageCompositionDraft({
        projectId,
        document: imageEditor.document,
        baseRevisionNumber,
        operations: unsyncedOperations,
      }).catch((error: unknown) => {
        dispatch(
          imageSaveStateChanged({
            state: "sync-failed",
            error: error instanceof Error ? error.message : "Local draft could not be saved.",
          }),
        );
      });
    });

    if (imageEditor.saveState === "server-changed" || conflictAction) return;

    const timeoutId = window.setTimeout(async () => {
      dispatch(imageSaveStateChanged({ state: "syncing" }));
      try {
        const response = await fetch(
          `/bff/projects/${encodeURIComponent(projectId)}/image-composition`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentJson: imageEditor.document,
              operationsJson: unsyncedOperations.map((entry) => ({
                id: entry.id,
                type: entry.operation.type,
                label: entry.label,
                source: entry.source,
                createdAt: entry.createdAt,
              })),
              baseRevisionNumber,
            }),
          },
        );

        if (response.status === 409) {
          const message = await readSaveError(response, "The server has a newer version.");
          const serverComposition = await fetchServerComposition(projectId).catch(() => null);
          const cache = await import("./persistence/image-editor-cache.client");
          await cache.markImageCompositionSyncFailed({ projectId, error: message });
          dispatch(
            imageBackendSyncFailed({
              conflict: true,
              error: message,
              serverRevisionNumber: serverComposition?.revisionNumber ?? null,
              serverUpdatedAt: serverComposition?.updatedAt ?? null,
              updatedByUserId: serverComposition?.updatedByUserId ?? null,
            }),
          );
          return;
        }

        if (!response.ok) {
          throw new Error(await readSaveError(response, "Image composition sync failed."));
        }

        const saved = (await response.json()) as { revisionNumber: number | string; updatedAt: string | null };
        if (latestDocumentUpdatedAt.current !== documentUpdatedAt) return;

        const syncedAt = saved.updatedAt ?? new Date().toISOString();
        const revisionNumber = Number(saved.revisionNumber) || baseRevisionNumber + 1;
        const cache = await import("./persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncSucceeded({ projectId, revisionNumber, syncedAt });
        dispatch(imageBackendSyncSucceeded({ revisionNumber, syncedAt, updatedAt: saved.updatedAt }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image composition sync failed.";
        const cache = await import("./persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncFailed({ projectId, error: message });
        dispatch(imageBackendSyncFailed({ error: message }));
      }
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [
    dispatch,
    imageEditor.document,
    imageEditor.projectId,
    imageEditor.saveState,
    conflictAction,
    projectId,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch(imageUndoRequested());
        return;
      }

      if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault();
        dispatch(imageRedoRequested());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  const applyOperation = (operation: ImageCompositionOperation) => {
    dispatch(imageDocumentOperationApplied(operation));
  };

  const handleToolChange = (tool: ImageEditorTool) => {
    if (tool === "text") {
      const layer = createCenteredTextLayer(imageEditor.document.canvas);
      applyOperation(
        createImageOperation({
          type: "add-layer",
          layer,
          label: "Add text layer",
        }),
      );
      return;
    }

    dispatch(imageActiveToolChanged(tool));
  };

  const handleAddMedia = (media: MediaDto) => {
    const layer = createImageLayerFromMedia(media, imageEditor.document.canvas);
    applyOperation(
      createImageOperation({
        type: "add-layer",
        layer,
        label: `Add ${media.filename}`,
      }),
    );
  };

  const handleReloadServerVersion = async () => {
    if (conflictAction) return;
    setConflictAction("reload");
    dispatch(imageSaveStateChanged({ state: "syncing" }));
    try {
      const serverComposition = await fetchServerComposition(projectId);
      dispatch(
        imageServerVersionLoaded({
          document: serverComposition.document,
          baseRevisionNumber: serverComposition.revisionNumber,
          lastSyncedAt: serverComposition.updatedAt,
        }),
      );
      const cache = await import("./persistence/image-editor-cache.client");
      await cache.clearImageCompositionDraft(projectId);
    } catch (error) {
      dispatch(
        imageBackendSyncFailed({
          conflict: true,
          error: error instanceof Error ? error.message : "Server version could not be loaded.",
          serverRevisionNumber: imageEditor.conflict?.serverRevisionNumber ?? null,
          serverUpdatedAt: imageEditor.conflict?.serverUpdatedAt ?? null,
          updatedByUserId: imageEditor.conflict?.updatedByUserId ?? null,
        }),
      );
    } finally {
      setConflictAction(null);
    }
  };

  const handleKeepLocalEdits = async () => {
    if (conflictAction) return;
    const localDocument = imageEditor.document;
    const unsyncedOperations = getUnsyncedImageOperations(localDocument);
    setConflictAction("keep-local");
    dispatch(imageSaveStateChanged({ state: "syncing" }));

    try {
      const latestServer = await fetchServerComposition(projectId);
      const baseRevisionNumber = latestServer.revisionNumber;
      const response = await fetch(
        `/bff/projects/${encodeURIComponent(projectId)}/image-composition`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentJson: {
              ...localDocument,
              projectId,
              baseRevisionNumber,
            },
            operationsJson: unsyncedOperations.map((entry) => ({
              id: entry.id,
              type: entry.operation.type,
              label: entry.label,
              source: entry.source,
              createdAt: entry.createdAt,
            })),
            baseRevisionNumber,
          }),
        },
      );

      if (response.status === 409) {
        const message = await readSaveError(response, "The server changed again.");
        const serverComposition = await fetchServerComposition(projectId).catch(() => null);
        const cache = await import("./persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncFailed({ projectId, error: message });
        dispatch(
          imageBackendSyncFailed({
            conflict: true,
            error: message,
            serverRevisionNumber: serverComposition?.revisionNumber ?? latestServer.revisionNumber,
            serverUpdatedAt: serverComposition?.updatedAt ?? latestServer.updatedAt,
            updatedByUserId: serverComposition?.updatedByUserId ?? latestServer.updatedByUserId,
          }),
        );
        return;
      }

      if (!response.ok) {
        throw new Error(await readSaveError(response, "Local edits could not be saved."));
      }

      const saved = normalizeServerCompositionPayload(await response.json());
      const syncedAt = saved.updatedAt ?? new Date().toISOString();
      const cache = await import("./persistence/image-editor-cache.client");
      await cache.replaceImageCompositionDraft({
        projectId,
        document: {
          ...localDocument,
          projectId,
          baseRevisionNumber: saved.revisionNumber,
          lastSyncedAt: syncedAt,
        },
        baseRevisionNumber: saved.revisionNumber,
        syncedAt,
      });
      dispatch(
        imageBackendSyncSucceeded({
          revisionNumber: saved.revisionNumber,
          syncedAt,
          updatedAt: saved.updatedAt,
        }),
      );
    } catch (error) {
      dispatch(
        imageBackendSyncFailed({
          conflict: true,
          error: error instanceof Error ? error.message : "Local edits could not be saved.",
          serverRevisionNumber: imageEditor.conflict?.serverRevisionNumber ?? null,
          serverUpdatedAt: imageEditor.conflict?.serverUpdatedAt ?? null,
          updatedByUserId: imageEditor.conflict?.updatedByUserId ?? null,
        }),
      );
    } finally {
      setConflictAction(null);
    }
  };

  const uploadImageFiles = async (files: File[], addLayerAfterUpload: boolean) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const rejectedFiles = files.filter((file) => !file.type.startsWith("image/"));

    if (rejectedFiles.length > 0) {
      setUploadQueue((current) => [
        ...rejectedFiles.map((file) => ({
          id: createImageDocumentId("upload"),
          fileName: file.name || "Unsupported file",
          progress: 0,
          status: "failed" as const,
          error: "Only image files can be imported.",
          uploadedMedia: null,
        })),
        ...current,
      ]);
    }

    for (const file of imageFiles) {
      const uploadId = createImageDocumentId("upload");
      setUploadQueue((current) => [
        {
          id: uploadId,
          fileName: file.name || "Untitled image",
          progress: 0,
          status: "queued",
          error: null,
          uploadedMedia: null,
        },
        ...current,
      ]);

      try {
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, { status: "uploading", progress: 1 }),
        );
        const uploadedMedia = await uploadMediaFile({
          file,
          kind: MediaKind.Image,
          filename: file.name,
          studioId: uploadStudioId,
          onProgress: (progress) => {
            setUploadQueue((current) =>
              updateUploadQueueItem(current, uploadId, {
                progress,
                status: "uploading",
              }),
            );
          },
        });

        setEditorImageMedia((current) => mergeMediaLists([uploadedMedia], current));
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, {
            status: "uploaded",
            progress: 100,
            uploadedMedia,
          }),
        );

        if (addLayerAfterUpload) {
          handleAddMedia(uploadedMedia);
        }
      } catch (error) {
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload failed.",
          }),
        );
      }
    }
  };

  const handleDropFiles = (
    event: DragEvent<HTMLElement>,
    target: "assets" | "canvas",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget(null);
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    void uploadImageFiles(files, target === "canvas");
    if (target === "assets") {
      dispatch(imagePanelTabChanged("media"));
    }
  };

  const updateSelectedLayerTransform = (
    layerId: string,
    transform: Partial<ImageLayerTransform>,
    label = "Transform layer",
  ) => {
    applyOperation(
      createImageOperation({
        type: "update-layer-transform",
        layerId,
        transform,
        label,
      }),
    );
  };

  const updateSelectedLayerStyle = (
    layerId: string,
    patch: ImageLayerStylePatch,
    label = "Update layer",
  ) => {
    applyOperation(
      createImageOperation({
        type: "update-layer-style",
        layerId,
        patch,
        label,
      }),
    );
  };

  const updateTextContent = (layerId: string, text: string) => {
    applyOperation(
      createImageOperation({
        type: "update-text-content",
        layerId,
        text,
        label: "Edit text",
      }),
    );
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#101215] text-[#f2f5f4]">
      <ImageEditorTopBar
        projectName={imageEditor.projectName}
        editorMode={imageEditor.editorMode}
        saveState={imageEditor.saveState}
        canExport={imageCompositionCanExport(imageEditor.document)}
        canUndo={imageEditor.undoStack.length > 0}
        canRedo={imageEditor.redoStack.length > 0}
        assetsOpen={assetsOpen}
        onModeChange={(mode) => dispatch(imageEditorModeChanged(mode))}
        onToggleAssets={() => setAssetsOpen((current) => !current)}
        onUndo={() => dispatch(imageUndoRequested())}
        onRedo={() => dispatch(imageRedoRequested())}
        onExport={() => setExportModalOpen(true)}
      />

      {imageEditor.saveState === "server-changed" || (conflictAction && imageEditor.conflict) ? (
        <ConflictBanner
          message={imageEditor.conflict?.message ?? imageEditor.saveError}
          serverRevisionNumber={imageEditor.conflict?.serverRevisionNumber ?? null}
          serverUpdatedAt={imageEditor.conflict?.serverUpdatedAt ?? null}
          busyAction={conflictAction}
          onReloadServerVersion={handleReloadServerVersion}
          onKeepLocalEdits={handleKeepLocalEdits}
        />
      ) : null}

      <div className="hidden h-10 shrink-0 items-center gap-2 border-b border-white/10 bg-[#15171b] px-2 max-[1180px]:flex">
        <button
          type="button"
          title={assetsOpen ? "Hide assets" : "Show assets"}
          aria-label={assetsOpen ? "Hide assets" : "Show assets"}
          onClick={() => setAssetsOpen((current) => !current)}
          className={`flex h-8 items-center gap-2 rounded-[4px] px-2 text-label-md font-semibold ${
            assetsOpen ? "bg-white/12 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          <EditorIcon className="text-[17px]">perm_media</EditorIcon>
          Assets
        </button>
        <div className="ml-auto hidden items-center gap-1 rounded-[6px] border border-white/10 bg-black/20 p-1 max-[760px]:flex">
          {(["canvas", "properties"] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setNarrowPanel(panel)}
              className={`h-7 rounded-[4px] px-2 text-label-md font-semibold capitalize ${
                narrowPanel === panel
                  ? "bg-white/12 text-white"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {panel}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(240px,280px)_minmax(360px,1fr)_minmax(286px,320px)] max-[1180px]:grid-cols-[minmax(0,1fr)_minmax(286px,320px)] max-[760px]:grid-cols-1">
        <MediaTemplatePanel
          className={`${
            assetsOpen
              ? "max-[1180px]:absolute max-[1180px]:inset-y-0 max-[1180px]:left-0 max-[1180px]:z-30 max-[1180px]:w-[min(320px,88vw)] max-[1180px]:shadow-2xl"
              : "max-[1180px]:hidden"
          }`}
          activeTab={imageEditor.activePanelTab}
          onTabChange={(tab) => dispatch(imagePanelTabChanged(tab))}
          imageMedia={editorImageMedia}
          mediaError={mediaError}
          uploadQueue={uploadQueue}
          dragActive={dragTarget === "assets"}
          onDropFiles={(event) => handleDropFiles(event, "assets")}
          onDragStateChange={(active) => setDragTarget(active ? "assets" : null)}
          onAddMedia={handleAddMedia}
        />

        {assetsOpen ? (
          <button
            type="button"
            aria-label="Close assets panel"
            onClick={() => setAssetsOpen(false)}
            className="absolute inset-0 z-20 hidden bg-black/35 max-[1180px]:block"
          />
        ) : null}

        <main
          className={`relative min-h-0 overflow-hidden ${
            narrowPanel === "properties" ? "max-[760px]:hidden" : ""
          }`}
          onDrop={(event) => handleDropFiles(event, "canvas")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragTarget("canvas");
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragTarget("canvas");
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragTarget(null);
          }}
        >
          <ImageEditorToolbar
            activeTool={imageEditor.activeTool}
            onToolChange={handleToolChange}
          />
          <div className="absolute inset-0 pt-11">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-[#0d0f12] text-label-md text-white/45">
                  Loading artboard
                </div>
              }
            >
              <ImageCanvas
                document={imageEditor.document}
                zoom={imageEditor.zoom}
                pan={imageEditor.pan}
                onSelectLayer={(layerId) => dispatch(imageLayerSelected(layerId))}
                onClearSelection={() => dispatch(imageSelectionCleared())}
                onTransformLayer={updateSelectedLayerTransform}
                onUpdateTextContent={updateTextContent}
              />
            </Suspense>
          </div>
          {dragTarget === "canvas" ? (
            <div className="pointer-events-none absolute inset-3 z-20 rounded-[6px] border border-dashed border-[#8fd6c8]/70 bg-[#8fd6c8]/10" />
          ) : null}
        </main>

        <aside
          className={`min-h-0 border-l border-white/10 bg-[#15171b] max-[760px]:border-l-0 ${
            narrowPanel === "canvas" ? "max-[760px]:hidden" : ""
          }`}
        >
          <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
            <EditorIcon className="text-[18px] text-[#8fd6c8]">layers</EditorIcon>
            <h2 className="min-w-0 truncate text-label-md font-semibold uppercase tracking-wide text-white/70">
              Layers and properties
            </h2>
          </div>
          <LayersPanel
            document={imageEditor.document}
            onSelectLayer={(layerId) => dispatch(imageLayerSelected(layerId))}
            onRenameLayer={(layerId, name) => updateSelectedLayerStyle(layerId, { name }, "Rename layer")}
            onToggleVisible={(layerId, visible) =>
              updateSelectedLayerStyle(layerId, { visible }, visible ? "Show layer" : "Hide layer")
            }
            onToggleLocked={(layerId, locked) =>
              updateSelectedLayerStyle(layerId, { locked }, locked ? "Lock layer" : "Unlock layer")
            }
            onMoveLayer={(layerId, direction) =>
              applyOperation(
                createImageOperation({
                  type: "reorder-layer",
                  layerId,
                  direction,
                  label: direction === "up" ? "Move layer up" : "Move layer down",
                }),
              )
            }
            onDuplicateLayer={(layerId) =>
              applyOperation(
                createImageOperation({
                  type: "duplicate-layer",
                  layerId,
                  newLayerId: createImageDocumentId("layer"),
                  label: "Duplicate layer",
                }),
              )
            }
            onDeleteLayer={(layerId) =>
              applyOperation(
                createImageOperation({
                  type: "delete-layer",
                  layerId,
                  label: "Delete layer",
                }),
              )
            }
          />
          <PropertiesPanel
            document={imageEditor.document}
            editorMode={imageEditor.editorMode}
            onUpdateTransform={updateSelectedLayerTransform}
            onUpdateStyle={updateSelectedLayerStyle}
            onUpdateTextContent={updateTextContent}
          />
        </aside>
      </div>

      <ImageExportModal
        open={exportModalOpen}
        composition={imageEditor.document}
        projectName={imageEditor.projectName}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}

function ImageEditorTopBar({
  projectName,
  editorMode,
  saveState,
  canExport,
  canUndo,
  canRedo,
  assetsOpen,
  onModeChange,
  onToggleAssets,
  onUndo,
  onRedo,
  onExport,
}: {
  projectName: string;
  editorMode: ImageEditorMode;
  saveState: ImageSaveState;
  canExport: boolean;
  canUndo: boolean;
  canRedo: boolean;
  assetsOpen: boolean;
  onModeChange: (mode: ImageEditorMode) => void;
  onToggleAssets: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}) {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 bg-[#191b20] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-[#8fd6c8]/12 text-[#8fd6c8]">
          <EditorIcon className="text-[20px]">image</EditorIcon>
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-body-sm font-semibold text-white">{projectName}</h1>
          <p className="text-label-sm uppercase tracking-wide text-white/40">Image editor</p>
        </div>
      </div>

      <div className="flex items-center rounded-[6px] border border-white/10 bg-black/20 p-1">
        {(["manual", "ai"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`flex h-8 items-center gap-1 rounded-[4px] px-3 text-label-md font-semibold transition-colors max-[520px]:px-2 ${
              editorMode === mode
                ? "bg-white/12 text-white"
                : "text-white/55 hover:text-white"
            }`}
          >
            {mode === "ai" ? <EditorIcon className="text-[16px]">auto_awesome</EditorIcon> : null}
            {mode === "ai" ? "AI" : "Manual"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          title={assetsOpen ? "Hide assets" : "Show assets"}
          aria-label={assetsOpen ? "Hide assets" : "Show assets"}
          onClick={onToggleAssets}
          className="mr-1 hidden h-8 w-8 items-center justify-center rounded-[4px] text-white/70 hover:bg-white/10 hover:text-white max-[1180px]:flex"
        >
          <EditorIcon className="text-[18px]">perm_media</EditorIcon>
        </button>
        <span className="mr-2 min-w-0 max-w-28 truncate text-right text-label-sm uppercase tracking-wide text-white/45 max-[640px]:hidden">
          {saveStateLabel(saveState)}
        </span>
        <TopBarButton icon="undo" label="Undo" disabled={!canUndo} onClick={onUndo} />
        <TopBarButton icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
        <button
          type="button"
          disabled={!canExport}
          title="Export"
          onClick={onExport}
          className="ml-2 inline-flex h-8 items-center justify-center gap-2 rounded-[4px] border border-[#8fd6c8]/30 bg-[#8fd6c8]/12 px-3 text-label-md font-semibold text-[#d8fff8] hover:bg-[#8fd6c8]/20 disabled:pointer-events-none disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/35 max-[640px]:w-8 max-[640px]:px-0"
        >
          <EditorIcon className="text-[16px]">ios_share</EditorIcon>
          <span className="max-[640px]:hidden">Export</span>
        </button>
      </div>
    </header>
  );
}

function TopBarButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white/70 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/25"
    >
      <EditorIcon className="text-[19px]">{icon}</EditorIcon>
    </button>
  );
}

function ConflictBanner({
  message,
  serverRevisionNumber,
  serverUpdatedAt,
  busyAction,
  onReloadServerVersion,
  onKeepLocalEdits,
}: {
  message: string | null | undefined;
  serverRevisionNumber: number | null;
  serverUpdatedAt: string | null;
  busyAction: "reload" | "keep-local" | null;
  onReloadServerVersion: () => void;
  onKeepLocalEdits: () => void;
}) {
  const busy = busyAction !== null;
  return (
    <section className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-300/20 bg-[#2a2214] px-3 py-2 text-label-md text-amber-50">
      <EditorIcon className="shrink-0 text-[18px] text-amber-200">sync_problem</EditorIcon>
      <p className="min-w-[220px] flex-1 whitespace-normal break-words text-amber-50/85">
        {message || "The server has a newer image version."}
        {serverRevisionNumber !== null ? ` Revision ${serverRevisionNumber}.` : ""}
        {serverUpdatedAt ? ` Updated ${formatConflictTimestamp(serverUpdatedAt)}.` : ""}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onReloadServerVersion}
          className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-amber-100/20 bg-amber-100/10 px-2 text-label-md font-semibold text-amber-50 hover:bg-amber-100/16 disabled:pointer-events-none disabled:opacity-55"
        >
          <EditorIcon className="text-[16px]">
            {busyAction === "reload" ? "progress_activity" : "download"}
          </EditorIcon>
          Reload server version
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onKeepLocalEdits}
          className="inline-flex h-8 items-center gap-2 rounded-[4px] bg-[#8fd6c8] px-2 text-label-md font-semibold text-[#062f2d] hover:bg-[#a8eadf] disabled:pointer-events-none disabled:opacity-55"
        >
          <EditorIcon className="text-[16px]">
            {busyAction === "keep-local" ? "progress_activity" : "upload"}
          </EditorIcon>
          Keep local edits
        </button>
      </div>
    </section>
  );
}

function saveStateLabel(saveState: ImageSaveState) {
  if (saveState === "syncing") return "Syncing";
  if (saveState === "synced") return "Synced";
  if (saveState === "sync-failed") return "Sync failed";
  if (saveState === "server-changed") return "Server changed";
  return "Saved locally";
}

async function readSaveError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body?.detail || body?.error || fallback;
  } catch {
    return fallback;
  }
}

interface ServerImageComposition {
  document: ImageCompositionDocument | null;
  revisionNumber: number;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

async function fetchServerComposition(projectId: string): Promise<ServerImageComposition> {
  const response = await fetch(
    `/bff/projects/${encodeURIComponent(projectId)}/image-composition`,
  );
  if (!response.ok) {
    throw new Error(await readSaveError(response, "Server version could not be loaded."));
  }
  return normalizeServerCompositionPayload(await response.json());
}

function normalizeServerCompositionPayload(value: unknown): ServerImageComposition {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    document: isImageCompositionDocument(body.documentJson) ? body.documentJson : null,
    revisionNumber: Number(body.revisionNumber) || 0,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
    updatedByUserId: typeof body.updatedByUserId === "string" ? body.updatedByUserId : null,
  };
}

function isImageCompositionDocument(value: unknown): value is ImageCompositionDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ImageCompositionDocument>;
  return document.version === 1 && Boolean(document.canvas) && Array.isArray(document.layers);
}

function getUnsyncedImageOperations(document: ImageCompositionDocument): ImageHistoryEntry[] {
  if (!document.lastSyncedAt) return document.operationHistory;
  const syncedAt = Date.parse(document.lastSyncedAt);
  if (!Number.isFinite(syncedAt)) return document.operationHistory;
  return document.operationHistory.filter((entry) => Date.parse(entry.createdAt) > syncedAt);
}

function updateUploadQueueItem(
  items: UploadQueueItem[],
  id: string,
  patch: Partial<UploadQueueItem>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function mergeMediaLists(primary: MediaDto[], secondary: MediaDto[]) {
  const seen = new Set<string>();
  const merged: MediaDto[] = [];
  for (const item of [...primary, ...secondary]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function formatConflictTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
