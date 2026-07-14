import { Suspense, lazy, useState, type DragEvent } from "react";

import { EditorIcon } from "../editor-ui";
import {
  createCenteredTextLayer,
  createImageLayerFromMedia,
  createImageOperation,
  createImageDocumentId,
} from "~/lib/editor/image/document/operations";
import { ImageEditorToolbar } from "./image-editor-toolbar";
import { ImageExportModal } from "./export-modal";
import { LayersPanel } from "./layers-panel";
import { MediaTemplatePanel } from "./media-template-panel";
import { PropertiesPanel } from "./properties-panel";
import { imageCompositionCanExport } from "~/lib/editor/image/export/types";
import type {
  ImageCompositionOperation,
  ImageLayerStylePatch,
  ImageLayerTransform,
} from "~/lib/editor/image/document/types";
import type { ServerImageComposition } from "~/lib/editor/image/image-composition-payload";
import type { MediaDto } from "~/lib/api";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  imageActiveToolChanged,
  imageDocumentOperationApplied,
  imageEditorModeChanged,
  imageLayerSelected,
  imagePanelTabChanged,
  imageRedoRequested,
  imageSelectionCleared,
  imageUndoRequested,
  type ImageEditorMode,
  type ImageSaveState,
  type ImageEditorTool,
} from "~/store/slices/image-editor-slice";
import { useImageAutosave } from "./use-image-autosave";
import { useImageKeyboardShortcuts } from "./use-image-keyboard-shortcuts";
import { useImageMediaUpload } from "./use-image-media-upload";
import { useImageProjectDraft } from "./use-image-project-draft";

const ImageCanvas = lazy(() =>
  import("./image-canvas").then((module) => ({ default: module.ImageCanvas })),
);

interface ImageEditorWorkspaceProps {
  projectId: string;
  projectName?: string | null;
  uploadStudioId?: string | null;
  backendComposition?: ServerImageComposition | null;
  imageMedia?: MediaDto[];
  mediaError?: string | null;
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [narrowPanel, setNarrowPanel] = useState<"canvas" | "properties">("canvas");
  const [dragTarget, setDragTarget] = useState<"assets" | "canvas" | null>(null);
  const initializedProject = useImageProjectDraft({
    projectId,
    projectName,
    backendComposition,
  });
  const { conflictAction, handleReloadServerVersion, handleKeepLocalEdits } = useImageAutosave({
    projectId,
    imageEditor,
    initializedProject,
  });
  useImageKeyboardShortcuts();

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

  const { editorImageMedia, uploadQueue, uploadImageFiles } = useImageMediaUpload({
    imageMedia,
    uploadStudioId,
    onAddUploadedMedia: handleAddMedia,
  });

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
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-on-surface">
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

      <div className="hidden h-10 shrink-0 items-center gap-2 border-b border-outline-variant/50 bg-surface-container px-2 max-[1180px]:flex">
        <button
          type="button"
          title={assetsOpen ? "Hide assets" : "Show assets"}
          aria-label={assetsOpen ? "Hide assets" : "Show assets"}
          onClick={() => setAssetsOpen((current) => !current)}
          className={`flex h-8 items-center gap-2 rounded-[4px] px-2 text-label-md font-semibold ${
            assetsOpen ? "bg-hover text-on-surface" : "text-on-surface/60 hover:bg-hover hover:text-on-surface"
          }`}
        >
          <EditorIcon className="text-[17px]">perm_media</EditorIcon>
          Assets
        </button>
        <div className="ml-auto hidden items-center gap-1 rounded-[6px] border border-outline-variant bg-black/20 p-1 max-[760px]:flex">
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
                <div className="flex h-full items-center justify-center bg-background text-label-md text-on-surface/45">
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
            <div className="pointer-events-none absolute inset-3 z-20 rounded-[6px] border border-dashed border-primary/70 bg-primary/10" />
          ) : null}
        </main>

        <aside
          className={`min-h-0 border-l border-outline-variant bg-surface-container-low max-[760px]:border-l-0 ${
            narrowPanel === "canvas" ? "max-[760px]:hidden" : ""
          }`}
        >
          <div className="flex h-12 items-center gap-2 border-b border-outline-variant px-3">
            <EditorIcon className="text-[18px] text-primary">layers</EditorIcon>
            <h2 className="min-w-0 truncate text-label-md font-semibold uppercase tracking-wide text-on-surface/70">
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
    <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-outline-variant/30 bg-surface-container-high px-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-primary/10 text-primary">
          <EditorIcon className="text-[20px]">image</EditorIcon>
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-body-sm font-semibold text-on-surface">{projectName}</h1>
          <p className="text-label-sm uppercase tracking-wide text-on-surface-variant/65">Image editor</p>
        </div>
      </div>

      <div className="flex items-center rounded-[6px] border border-outline-variant bg-black/20 p-1">
        {(["manual", "ai"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`flex h-8 items-center gap-1 rounded-[4px] px-3 text-label-md font-semibold transition-colors max-[520px]:px-2 ${
              editorMode === mode
                ? "bg-hover text-on-surface"
                : "text-on-surface/55 hover:text-on-surface"
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
          className="mr-1 hidden h-8 w-8 items-center justify-center rounded-[4px] text-on-surface/70 hover:bg-hover hover:text-on-surface max-[1180px]:flex"
        >
          <EditorIcon className="text-[18px]">perm_media</EditorIcon>
        </button>
        <span className="mr-2 min-w-0 max-w-28 truncate text-right text-label-sm uppercase tracking-wide text-on-surface-variant/45 max-[640px]:hidden">
          {saveStateLabel(saveState)}
        </span>
        <TopBarButton icon="undo" label="Undo" disabled={!canUndo} onClick={onUndo} />
        <TopBarButton icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
        <button
          type="button"
          disabled={!canExport}
          title="Export"
          onClick={onExport}
          className="ml-2 inline-flex h-8 items-center justify-center gap-2 rounded-[4px] border border-primary/30 bg-primary/10 px-3 text-label-md font-semibold text-primary hover:bg-primary/20 disabled:pointer-events-none disabled:border-outline-variant/30 disabled:bg-surface-container/20 disabled:text-on-surface/25 max-[640px]:w-8 max-[640px]:px-0"
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
    <section className="flex shrink-0 flex-wrap items-center gap-2 border-b border-warning/20 bg-warning/10 px-3 py-2 text-label-md text-warning">
      <EditorIcon className="shrink-0 text-[18px] text-warning">sync_problem</EditorIcon>
      <p className="min-w-[220px] flex-1 whitespace-normal break-words text-warning/85">
        {message || "The server has a newer image version."}
        {serverRevisionNumber !== null ? ` Revision ${serverRevisionNumber}.` : ""}
        {serverUpdatedAt ? ` Updated ${formatConflictTimestamp(serverUpdatedAt)}.` : ""}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onReloadServerVersion}
          className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-warning/20 bg-warning/5 px-2 text-label-md font-semibold text-warning hover:bg-warning/15 disabled:pointer-events-none disabled:opacity-55"
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
          className="inline-flex h-8 items-center gap-2 rounded-[4px] bg-primary px-2 text-label-md font-semibold text-on-primary hover:bg-primary-fixed disabled:pointer-events-none disabled:opacity-55"
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

function formatConflictTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
