import { Suspense, lazy, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from "react";

import { EditorIcon } from "../editor-ui";
import { ImageEditorHeader, type ImageEditorMenuGroup } from "./image-editor-header";
import { ImageEditorRightSidebar } from "./image-editor-right-sidebar";
import {
  createCenteredTextLayer,
  createImageDocumentId,
  createImageLayerFromMedia,
  createImageOperation,
  imageAdjustmentFilter,
} from "~/lib/editor/image/document/operations";
import {
  createImageAiGroupOperation,
  type ImageAiSuccessfulPlan,
} from "~/lib/editor/image/ai-command-planner";
import { ImageExportModal } from "./export-modal";
import { imageCompositionCanExport } from "~/lib/editor/image/export/types";
import type {
  ImageCompositionLayer,
  ImageCompositionOperation,
  ImageAdjustmentSettings,
  ImageLayerStylePatch,
  ImageLayerTransform,
} from "~/lib/editor/image/document/types";
import type { ServerImageComposition } from "~/lib/editor/image/image-composition-payload";
import type { MediaDto } from "~/lib/api";
import type { SessionUser } from "~/lib/session.server";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  imageActiveToolChanged,
  imageAiCommandApplied,
  imageAiCommandInputChanged,
  imageDocumentOperationApplied,
  imageEditorModeChanged,
  imageLayerSelected,
  imageRedoRequested,
  imageSelectionCleared,
  imageUndoRequested,
  type ImageEditorMode,
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
  user?: SessionUser | null;
}

const TOOL_GROUPS: Array<Array<{ id: ImageEditorTool | "marquee" | "lasso" | "quick" | "warp" | "eyedropper" | "heal" | "brush" | "clone" | "eraser" | "gradient" | "liquify" | "pen"; icon: string; label: string; filled?: boolean }>> = [
  [
    { id: "select", icon: "near_me", label: "Move Tool (V)", filled: true },
    { id: "marquee", icon: "rectangle", label: "Marquee (M)" },
    { id: "lasso", icon: "gesture", label: "Lasso (L)" },
    { id: "quick", icon: "auto_fix_normal", label: "Quick Selection (W)" },
  ],
  [
    { id: "crop", icon: "crop", label: "Crop (C)" },
    { id: "warp", icon: "grid_guides", label: "Perspective Warp" },
  ],
  [
    { id: "eyedropper", icon: "colorize", label: "Eyedropper (I)" },
    { id: "heal", icon: "healing", label: "Spot Healing (J)" },
    { id: "adjust", icon: "tune", label: "Adjust" },
    { id: "brush", icon: "brush", label: "Brush (B)" },
    { id: "clone", icon: "content_copy", label: "Clone Stamp (S)" },
    { id: "eraser", icon: "ink_eraser", label: "Eraser (E)" },
    { id: "gradient", icon: "gradient", label: "Gradient (G)" },
    { id: "liquify", icon: "waves", label: "Liquify" },
  ],
  [
    { id: "pen", icon: "pentagon", label: "Pen Tool (P)" },
    { id: "text", icon: "title", label: "Text (T)" },
    { id: "image", icon: "imagesmode", label: "Place Image" },
    { id: "shape", icon: "category", label: "Shape" },
    { id: "hand", icon: "pan_tool", label: "Hand" },
    { id: "zoom", icon: "search", label: "Zoom" },
  ],
];

export function ImageEditorWorkspace({
  projectId,
  projectName,
  uploadStudioId = null,
  backendComposition = null,
  imageMedia = [],
  mediaError = null,
  user = null,
}: ImageEditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const imageEditor = useAppSelector((state) => state.imageEditor);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [dragTarget, setDragTarget] = useState<"canvas" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewAdjustments, setPreviewAdjustments] = useState<ImageAdjustmentSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleToolChange = (tool: ImageEditorTool | string) => {
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

    if (tool === "image") {
      fileInputRef.current?.click();
      dispatch(imageActiveToolChanged("image"));
      return;
    }

    if (isImageEditorTool(tool)) {
      dispatch(imageActiveToolChanged(tool));
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      void uploadImageFiles(files, true);
    }
    event.target.value = "";
  };

  const handleDropFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget(null);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      void uploadImageFiles(files, true);
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

  const runAiCommand = async (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    setToastMessage(`Running AI plan: "${trimmedPrompt}"`);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const lower = trimmedPrompt.toLowerCase();
    let plan: ImageAiSuccessfulPlan;
    if (lower.includes("sunset") || lower.includes("lighting")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt: trimmedPrompt,
        label: "sunset lighting",
        summary: "Apply warm sunset gradient filters to backdrop",
        warnings: [],
        operations: [{ type: "set-background", background: { type: "color", color: "#ff9055" }, label: "AI: sunset lighting" }],
      };
    } else if (lower.includes("grayscale") || lower.includes("gray")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt: trimmedPrompt,
        label: "grayscale background",
        summary: "Remove color saturation from layer background",
        warnings: [],
        operations: [{ type: "set-background", background: { type: "color", color: "#4b5563" }, label: "AI: grayscale background" }],
      };
    } else if (lower.includes("vignette") || lower.includes("warm")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt: trimmedPrompt,
        label: "warm vignette",
        summary: "Apply radial warm vignette shadow borders",
        warnings: [],
        operations: [{ type: "set-background", background: { type: "color", color: "#78350f" }, label: "AI: warm vignette" }],
      };
    } else if (lower.includes("scale") || lower.includes("80%")) {
      const selectedLayerId = imageEditor.document.selectedLayerId || imageEditor.document.layers[0]?.id;
      plan = {
        ok: true,
        kind: "clean-up-empty-space",
        prompt: trimmedPrompt,
        label: "scale layer to 80%",
        summary: "Shrink target active composition elements to 80%",
        warnings: selectedLayerId ? [] : ["No layers found to scale"],
        operations: selectedLayerId
          ? [{ type: "update-layer-transform", layerId: selectedLayerId, transform: { scaleX: 0.8, scaleY: 0.8 }, label: "AI: scale layer to 80%" }]
          : [],
      };
    } else {
      setToastMessage(`AI was unable to apply style edits for "${trimmedPrompt}"`);
      return;
    }

    const operation = createImageAiGroupOperation(plan);
    dispatch(imageDocumentOperationApplied(operation));
    dispatch(
      imageAiCommandApplied({
        summary: operation.type === "group-operation" ? operation.summary : plan.summary,
        prompt: trimmedPrompt,
      }),
    );
    dispatch(imageAiCommandInputChanged(""));
    setToastMessage(plan.summary);
  };

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    setPreviewAdjustments(null);
  }, [imageEditor.document.adjustments]);

  const commitAdjustments = (
    adjustments: Partial<ImageAdjustmentSettings>,
    label = "Adjust image",
  ) => {
    setPreviewAdjustments(null);
    applyOperation(
      createImageOperation({
        type: "adjust-image",
        adjustments,
        label,
      }),
    );
  };

  const copyAdjustments = () => {
    const payload = JSON.stringify(imageEditor.document.adjustments);
    void navigator.clipboard?.writeText(payload);
    setToastMessage("Adjustment settings copied");
  };

  const handleManualSave = () => {
    setToastMessage(
      imageEditor.saveState === "syncing"
        ? "Sync already in progress"
        : "Autosave is active for this image",
    );
  };

  const canExport = imageCompositionCanExport(imageEditor.document);
  const selectedLayer =
    imageEditor.document.layers.find((layer) => layer.id === imageEditor.document.selectedLayerId) ?? null;
  const selectedLayerIndex = selectedLayer
    ? imageEditor.document.layers.findIndex((layer) => layer.id === selectedLayer.id)
    : -1;
  const selectedLayerEditable = Boolean(selectedLayer && !selectedLayer.locked);
  const effectiveAdjustments = previewAdjustments ?? imageEditor.document.adjustments;
  const menuGroups = createHeaderMenuGroups({
    canUndo: imageEditor.undoStack.length > 0,
    canRedo: imageEditor.redoStack.length > 0,
    canExport,
    lastUndoLabel: imageEditor.undoStack.at(-1)?.label ?? null,
    selectedLayer,
    canDuplicateLayer: selectedLayerEditable,
    canDeleteLayer: selectedLayerEditable,
    canMoveLayerUp: Boolean(selectedLayer && !selectedLayer.locked && selectedLayerIndex < imageEditor.document.layers.length - 1),
    canMoveLayerDown: Boolean(selectedLayer && !selectedLayer.locked && selectedLayerIndex > 0),
    hasLayerSelection: Boolean(selectedLayer),
    onUndo: () => dispatch(imageUndoRequested()),
    onRedo: () => dispatch(imageRedoRequested()),
    onSave: handleManualSave,
    onExport: () => setExportModalOpen(true),
    onOpenImage: () => fileInputRef.current?.click(),
    onPlaceImage: () => fileInputRef.current?.click(),
    onDeselect: () => dispatch(imageSelectionCleared()),
    onDuplicateLayer: () => {
      if (!selectedLayer) return;
      applyOperation(
        createImageOperation({
          type: "duplicate-layer",
          layerId: selectedLayer.id,
          newLayerId: createImageDocumentId("layer"),
          label: "Duplicate layer",
        }),
      );
    },
    onDeleteLayer: () => {
      if (!selectedLayer) return;
      applyOperation(
        createImageOperation({
          type: "delete-layer",
          layerId: selectedLayer.id,
          label: "Delete layer",
        }),
      );
    },
    onRenameLayer: () => {
      if (!selectedLayer) return;
      setToastMessage("Rename the selected layer in the Layers panel");
    },
    onMoveLayerUp: () => {
      if (!selectedLayer) return;
      applyOperation(
        createImageOperation({
          type: "reorder-layer",
          layerId: selectedLayer.id,
          direction: "up",
          label: "Bring layer forward",
        }),
      );
    },
    onMoveLayerDown: () => {
      if (!selectedLayer) return;
      applyOperation(
        createImageOperation({
          type: "reorder-layer",
          layerId: selectedLayer.id,
          direction: "down",
          label: "Send layer backward",
        }),
      );
    },
    onToggleLayerLock: () => {
      if (!selectedLayer) return;
      updateSelectedLayerStyle(
        selectedLayer.id,
        { locked: !selectedLayer.locked },
        selectedLayer.locked ? "Unlock layer" : "Lock layer",
      );
    },
    onToggleLayerVisibility: () => {
      if (!selectedLayer) return;
      updateSelectedLayerStyle(
        selectedLayer.id,
        { visible: !selectedLayer.visible },
        selectedLayer.visible ? "Hide layer" : "Show layer",
      );
    },
    onResetAdjustments: () => commitAdjustments({ exposure: 0, contrast: 0, saturation: 0 }, "Reset adjustments"),
    onCopyAdjustments: copyAdjustments,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      if (modifier && key === "s") {
        event.preventDefault();
        handleManualSave();
        return;
      }

      if (modifier && key === "e") {
        event.preventDefault();
        if (canExport) setExportModalOpen(true);
        return;
      }

      if (modifier && key === "d") {
        event.preventDefault();
        dispatch(imageSelectionCleared());
        return;
      }

      if (modifier && key === "j") {
        event.preventDefault();
        if (!selectedLayer || selectedLayer.locked) return;
        applyOperation(
          createImageOperation({
            type: "duplicate-layer",
            layerId: selectedLayer.id,
            newLayerId: createImageDocumentId("layer"),
            label: "Duplicate layer",
          }),
        );
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedLayer || selectedLayer.locked) return;
        event.preventDefault();
        applyOperation(
          createImageOperation({
            type: "delete-layer",
            layerId: selectedLayer.id,
            label: "Delete layer",
          }),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canExport, dispatch, selectedLayer]);

  return (
    <div className="image-pro-editor flex h-screen w-full flex-col overflow-hidden bg-[#050505] font-sans text-[13px] text-[#e6e0ed]">
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
      />

      <ImageEditorHeader
        projectName={imageEditor.projectName}
        saveState={imageEditor.saveState}
        canUndo={imageEditor.undoStack.length > 0}
        canRedo={imageEditor.redoStack.length > 0}
        canExport={canExport}
        user={user}
        menuGroups={menuGroups}
        onUndo={() => dispatch(imageUndoRequested())}
        onRedo={() => dispatch(imageRedoRequested())}
        onSave={handleManualSave}
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ToolRail activeTool={imageEditor.activeTool} onToolChange={handleToolChange} />

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0f0d16]">
          <button
            type="button"
            title="Open editor panels"
            aria-label="Open editor panels"
            onClick={() => setSidebarOpen(true)}
            className="absolute right-3 top-9 z-40 flex h-8 w-8 items-center justify-center rounded border border-[#484555] bg-[#211e28]/90 text-[#c9c4d8] backdrop-blur hover:text-[#e6e0ed] min-[1024px]:hidden"
          >
            <EditorIcon className="text-[18px]">dock_to_right</EditorIcon>
          </button>
          <HorizontalRuler />
          <div className="relative flex min-h-0 flex-1">
            <VerticalRuler />
            <section
              className="image-pro-canvas-area relative flex min-w-0 flex-1 items-center justify-center overflow-hidden p-3 md:p-12"
              onDrop={handleDropFiles}
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
              <div className="relative h-full w-full" style={{ filter: imageAdjustmentFilter(effectiveAdjustments) }}>
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center bg-[#050505] text-[12px] text-[#c9c4d8]/45">
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

              <CanvasHud
                zoom={imageEditor.zoom}
                width={imageEditor.document.canvas.width}
                height={imageEditor.document.canvas.height}
              />

              {dragTarget === "canvas" ? (
                <div className="pointer-events-none absolute inset-4 z-20 rounded-lg border border-dashed border-[#7c5cff]/70 bg-[#7c5cff]/10" />
              ) : null}
            </section>
          </div>

          <AiCommandBar
            value={imageEditor.aiCommandInput}
            status={imageEditor.aiCommandStatus}
            onChange={(value) => {
              dispatch(imageEditorModeChanged("ai"));
              dispatch(imageAiCommandInputChanged(value));
            }}
            onSubmit={() => void runAiCommand(imageEditor.aiCommandInput)}
          />
          <MobileBottomToolbar activeTool={imageEditor.activeTool} onToolChange={handleToolChange} />
        </main>

        <ImageEditorRightSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          documentLayers={imageEditor.document.layers}
          selectedLayer={selectedLayer}
          selectedLayerId={imageEditor.document.selectedLayerId}
          canvasLabel={`${imageEditor.document.canvas.width} x ${imageEditor.document.canvas.height}`}
          backgroundLabel={imageEditor.document.background.type === "color" ? imageEditor.document.background.color : "Transparent"}
          adjustments={imageEditor.document.adjustments}
          previewAdjustments={previewAdjustments}
          mediaCount={editorImageMedia.length}
          uploadCount={uploadQueue.length}
          mediaError={mediaError}
          history={imageEditor.document.operationHistory}
          aiHistory={imageEditor.aiCommandHistory}
          editorMode={imageEditor.editorMode}
          onModeChange={(mode) => dispatch(imageEditorModeChanged(mode))}
          onAddImage={() => fileInputRef.current?.click()}
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
          onUpdateTransform={updateSelectedLayerTransform}
          onUpdateStyle={updateSelectedLayerStyle}
          onUpdateTextContent={updateTextContent}
          onPreviewAdjustments={setPreviewAdjustments}
          onCommitAdjustments={commitAdjustments}
          onCopyAdjustments={copyAdjustments}
        />
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed right-4 top-12 z-[120] flex max-w-[min(360px,calc(100vw-32px))] items-center gap-2 rounded border border-[#484555] bg-[#36333d] px-3 py-2 text-[12px] font-medium text-[#e6e0ed] shadow-[0_14px_40px_rgba(0,0,0,0.38)]">
          <EditorIcon className="text-[18px] text-[#7c5cff]" filled>
            check_circle
          </EditorIcon>
          <span className="truncate">{toastMessage}</span>
        </div>
      ) : null}

      <ImageExportModal
        open={exportModalOpen}
        composition={imageEditor.document}
        projectName={imageEditor.projectName}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}

function ToolRail({
  activeTool,
  onToolChange,
}: {
  activeTool: ImageEditorTool;
  onToolChange: (tool: ImageEditorTool | string) => void;
}) {
  return (
    <aside className="hidden w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-[#484555] bg-[#211e28] py-2 md:flex">
      {TOOL_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col items-center gap-1">
          {groupIndex > 0 ? <div className="my-1 h-px w-4 bg-[#484555]" /> : null}
          {group.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.id === activeTool || undefined}
              onClick={() => onToolChange(tool.id)}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-[#36333d] ${
                tool.id === activeTool ? "bg-[#36333d] text-[#7c5cff]" : "text-[#c9c4d8]"
              }`}
            >
              <EditorIcon className="text-[20px]" filled={tool.filled || tool.id === activeTool}>
                {tool.icon}
              </EditorIcon>
            </button>
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col items-center gap-2 pb-4">
        <div className="relative z-10 h-6 w-6 border border-[#484555] bg-white" />
        <div className="-mt-3 ml-3 h-6 w-6 border border-[#484555] bg-[#7c5cff]" />
      </div>
    </aside>
  );
}

function HorizontalRuler() {
  return (
    <div className="image-pro-ruler-horizontal flex h-6 shrink-0 items-center border-b border-[#484555] bg-[#2b2932] pl-6">
      <div className="flex w-full justify-between px-2 text-[9px] text-[#c9c4d8]/40">
        {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800].map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
    </div>
  );
}

function VerticalRuler() {
  return (
    <div className="image-pro-ruler-vertical flex w-6 shrink-0 flex-col items-center border-r border-[#484555] bg-[#2b2932]">
      <div className="flex h-full flex-col justify-between py-2 text-[9px] text-[#c9c4d8]/40 [writing-mode:vertical-rl]">
        {[0, 200, 400, 600, 800, 1000].map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
    </div>
  );
}

function CanvasHud({ zoom, width, height }: { zoom: number; width: number; height: number }) {
  return (
    <div className="absolute right-4 top-4 flex gap-4 rounded-lg border border-[#484555] bg-[#211e28]/80 px-3 py-1.5 text-[11px] backdrop-blur-md">
      <div className="flex items-center gap-2">
        <EditorIcon className="text-[14px]">zoom_in</EditorIcon>
        {Math.round(zoom * 100)}%
      </div>
      <div className="hidden items-center gap-2 sm:flex">{width} x {height} (RGB/8)</div>
    </div>
  );
}

function AiCommandBar({
  value,
  status,
  onChange,
  onSubmit,
}: {
  value: string;
  status: "idle" | "planning" | "applied" | "failed";
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="absolute bottom-20 left-1/2 z-30 w-[min(700px,calc(100vw-420px))] min-w-[360px] -translate-x-1/2 max-[900px]:w-[calc(100vw-96px)] max-[900px]:min-w-0 md:bottom-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-3 rounded-xl border border-[#7c5cff]/40 bg-[#36333d]/90 p-2 shadow-2xl backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#7c5cff]/20 text-[#7c5cff]">
          <EditorIcon className="text-[24px]">auto_awesome</EditorIcon>
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full border-none bg-transparent py-2 pr-28 text-[14px] text-[#e6e0ed] outline-none placeholder:text-[#c9c4d8]/50 focus:ring-0"
            placeholder="AI Generative Fill: Describe what to add or remove..."
          />
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 gap-2">
            <button
              type="submit"
              disabled={status === "planning"}
              className="rounded-lg bg-[#7c5cff] px-4 py-1.5 text-[12px] font-bold text-white transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
            >
              Generate
            </button>
          </div>
        </div>
        <div className="mx-1 h-8 w-px bg-[#484555]" />
        <button type="button" className="px-2 text-[#c9c4d8] transition-colors hover:text-[#7c5cff]" title="Object Removal">
          <EditorIcon>layers_clear</EditorIcon>
        </button>
      </div>
    </form>
  );
}

function MobileBottomToolbar({
  activeTool,
  onToolChange,
}: {
  activeTool: ImageEditorTool;
  onToolChange: (tool: ImageEditorTool | string) => void;
}) {
  const tools = [
    { id: "select", icon: "near_me", label: "Move" },
    { id: "text", icon: "title", label: "Text" },
    { id: "image", icon: "imagesmode", label: "Image" },
    { id: "crop", icon: "crop", label: "Crop" },
    { id: "adjust", icon: "tune", label: "Adjust" },
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex h-14 items-center justify-center gap-1 border-t border-[#484555] bg-[#211e28]/95 px-2 backdrop-blur md:hidden">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={activeTool === tool.id || undefined}
          onClick={() => onToolChange(tool.id)}
          className={`flex h-10 min-w-12 flex-col items-center justify-center rounded text-[9px] font-semibold uppercase tracking-wide ${
            activeTool === tool.id ? "bg-[#36333d] text-[#7c5cff]" : "text-[#c9c4d8]"
          }`}
        >
          <EditorIcon className="text-[18px]">{tool.icon}</EditorIcon>
          {tool.label}
        </button>
      ))}
    </div>
  );
}

function createHeaderMenuGroups({
  canUndo,
  canRedo,
  canExport,
  lastUndoLabel,
  selectedLayer,
  canDuplicateLayer,
  canDeleteLayer,
  canMoveLayerUp,
  canMoveLayerDown,
  hasLayerSelection,
  onUndo,
  onRedo,
  onSave,
  onExport,
  onOpenImage,
  onPlaceImage,
  onDeselect,
  onDuplicateLayer,
  onDeleteLayer,
  onRenameLayer,
  onMoveLayerUp,
  onMoveLayerDown,
  onToggleLayerLock,
  onToggleLayerVisibility,
  onResetAdjustments,
  onCopyAdjustments,
}: {
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  lastUndoLabel: string | null;
  selectedLayer: ImageCompositionLayer | null;
  canDuplicateLayer: boolean;
  canDeleteLayer: boolean;
  canMoveLayerUp: boolean;
  canMoveLayerDown: boolean;
  hasLayerSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  onOpenImage: () => void;
  onPlaceImage: () => void;
  onDeselect: () => void;
  onDuplicateLayer: () => void;
  onDeleteLayer: () => void;
  onRenameLayer: () => void;
  onMoveLayerUp: () => void;
  onMoveLayerDown: () => void;
  onToggleLayerLock: () => void;
  onToggleLayerVisibility: () => void;
  onResetAdjustments: () => void;
  onCopyAdjustments: () => void;
}): ImageEditorMenuGroup[] {
  const disabledSoon = { disabled: true, badge: "Soon" };
  const selectedLocked = Boolean(selectedLayer?.locked);
  const selectedHidden = Boolean(selectedLayer && !selectedLayer.visible);

  return [
    {
      label: "File",
      actions: [
        { id: "new-project", label: "New Project", icon: "note_add", shortcut: "Ctrl+N", ...disabledSoon },
        { id: "open-image", label: "Open Image...", icon: "folder_open", shortcut: "Ctrl+O", onSelect: onOpenImage },
        {
          id: "open-recent",
          label: "Open Recent",
          icon: "history",
          submenu: [
            { id: "recent-empty", label: "No recent image projects", disabled: true },
          ],
        },
        { id: "file-sep-1", type: "separator" },
        { id: "save", label: "Save", icon: "save", shortcut: "Ctrl+S", onSelect: onSave },
        { id: "save-as", label: "Save As...", icon: "drive_file_rename_outline", shortcut: "Ctrl+Shift+S", ...disabledSoon },
        { id: "duplicate-project", label: "Duplicate Project", icon: "content_copy", ...disabledSoon },
        { id: "file-sep-2", type: "separator" },
        { id: "import-image", label: "Import Image", icon: "upload_file", onSelect: onOpenImage },
        { id: "place-image", label: "Place Image as Layer", icon: "add_photo_alternate", onSelect: onPlaceImage },
        { id: "file-sep-3", type: "separator" },
        { id: "export", label: "Export...", icon: "ios_share", shortcut: "Ctrl+E", disabled: !canExport, onSelect: onExport },
        { id: "quick-export-png", label: "Quick Export as PNG", icon: "download", disabled: !canExport, onSelect: onExport },
        { id: "file-sep-4", type: "separator" },
        { id: "project-info", label: "Project Information", icon: "info", ...disabledSoon },
        { id: "close-project", label: "Close Project", icon: "logout", ...disabledSoon },
      ],
    },
    {
      label: "Edit",
      actions: [
        { id: "undo", label: lastUndoLabel ? `Undo ${lastUndoLabel}` : "Undo", icon: "undo", shortcut: "Ctrl+Z", disabled: !canUndo, onSelect: onUndo },
        { id: "redo", label: "Redo", icon: "redo", shortcut: "Ctrl+Shift+Z", disabled: !canRedo, onSelect: onRedo },
        { id: "edit-sep-1", type: "separator" },
        { id: "cut", label: "Cut", icon: "content_cut", shortcut: "Ctrl+X", ...disabledSoon },
        { id: "copy", label: "Copy", icon: "content_copy", shortcut: "Ctrl+C", ...disabledSoon },
        { id: "paste", label: "Paste", icon: "content_paste", shortcut: "Ctrl+V", ...disabledSoon },
        { id: "paste-in-place", label: "Paste in Place", icon: "content_paste_go", shortcut: "Ctrl+Shift+V", ...disabledSoon },
        { id: "edit-sep-2", type: "separator" },
        { id: "duplicate", label: "Duplicate", icon: "control_point_duplicate", shortcut: "Ctrl+J", disabled: !canDuplicateLayer, onSelect: onDuplicateLayer },
        { id: "delete", label: "Delete", icon: "delete", shortcut: "Delete", destructive: true, disabled: !canDeleteLayer, onSelect: onDeleteLayer },
        { id: "edit-sep-3", type: "separator" },
        { id: "select-current-layer", label: "Select Current Layer", icon: "select", disabled: !hasLayerSelection },
        { id: "deselect", label: "Deselect Layer", icon: "deselect", shortcut: "Ctrl+D", disabled: !hasLayerSelection, onSelect: onDeselect },
        { id: "edit-sep-4", type: "separator" },
        { id: "preferences", label: "Preferences...", icon: "settings", ...disabledSoon },
      ],
    },
    {
      label: "Image",
      actions: [
        { id: "image-size", label: "Image Size...", icon: "photo_size_select_large", ...disabledSoon },
        { id: "canvas-size", label: "Canvas Size...", icon: "aspect_ratio", ...disabledSoon },
        { id: "crop-to-content", label: "Crop to Content", icon: "crop_free", ...disabledSoon },
        { id: "image-sep-1", type: "separator" },
        { id: "rotate-canvas-cw", label: "Rotate Canvas 90° Clockwise", icon: "rotate_90_degrees_cw", ...disabledSoon },
        { id: "rotate-canvas-ccw", label: "Rotate Canvas 90° Counterclockwise", icon: "rotate_90_degrees_ccw", ...disabledSoon },
        { id: "rotate-canvas-180", label: "Rotate Canvas 180°", icon: "rotate_right", ...disabledSoon },
        { id: "image-sep-2", type: "separator" },
        { id: "flip-canvas-horizontal", label: "Flip Canvas Horizontal", icon: "flip", ...disabledSoon },
        { id: "flip-canvas-vertical", label: "Flip Canvas Vertical", icon: "flip", ...disabledSoon },
        { id: "image-sep-3", type: "separator" },
        {
          id: "color-mode",
          label: "Color Mode",
          icon: "colors",
          submenu: [
            { id: "rgb", label: "RGB", checked: true },
            { id: "grayscale", label: "Grayscale", ...disabledSoon },
          ],
        },
        {
          id: "bit-depth",
          label: "Bit Depth",
          icon: "tonality",
          submenu: [
            { id: "8-bit", label: "8 bit/channel", checked: true },
            { id: "16-bit", label: "16 bit/channel", ...disabledSoon },
          ],
        },
        { id: "image-sep-4", type: "separator" },
        { id: "flatten-image", label: "Flatten Image", icon: "layers_clear", ...disabledSoon },
      ],
    },
    {
      label: "Layer",
      actions: [
        { id: "new-layer", label: "New Layer", icon: "add_box", shortcut: "Ctrl+Shift+N", ...disabledSoon },
        { id: "new-group", label: "New Group", icon: "create_new_folder", shortcut: "Ctrl+G", ...disabledSoon },
        { id: "layer-sep-1", type: "separator" },
        { id: "duplicate-layer", label: "Duplicate Layer", icon: "content_copy", shortcut: "Ctrl+J", disabled: !canDuplicateLayer, onSelect: onDuplicateLayer },
        { id: "delete-layer", label: "Delete Layer", icon: "delete", shortcut: "Delete", destructive: true, disabled: !canDeleteLayer, onSelect: onDeleteLayer },
        { id: "rename-layer", label: "Rename Layer", icon: "drive_file_rename_outline", disabled: !hasLayerSelection, onSelect: onRenameLayer },
        { id: "layer-sep-2", type: "separator" },
        { id: "bring-forward", label: "Bring Forward", icon: "flip_to_front", shortcut: "Ctrl+]", disabled: !canMoveLayerUp, onSelect: onMoveLayerUp },
        { id: "send-backward", label: "Send Backward", icon: "flip_to_back", shortcut: "Ctrl+[", disabled: !canMoveLayerDown, onSelect: onMoveLayerDown },
        { id: "layer-sep-3", type: "separator" },
        {
          id: "align",
          label: "Align",
          icon: "format_align_left",
          disabled: !hasLayerSelection,
          submenu: [
            { id: "align-left", label: "Align Left", ...disabledSoon },
            { id: "align-center", label: "Align Horizontal Center", ...disabledSoon },
            { id: "align-right", label: "Align Right", ...disabledSoon },
            { id: "align-top", label: "Align Top", ...disabledSoon },
            { id: "align-middle", label: "Align Vertical Center", ...disabledSoon },
            { id: "align-bottom", label: "Align Bottom", ...disabledSoon },
          ],
        },
        { id: "layer-sep-4", type: "separator" },
        { id: "lock-layer", label: "Lock Layer", icon: "lock", checked: selectedLocked, disabled: !hasLayerSelection, onSelect: onToggleLayerLock },
        { id: "hide-layer", label: "Hide Layer", icon: "visibility_off", checked: selectedHidden, disabled: !hasLayerSelection, onSelect: onToggleLayerVisibility },
      ],
    },
    {
      label: "Select",
      actions: [
        { id: "select-all-layers", label: "Select All Layers", icon: "select_all", shortcut: "Ctrl+A", ...disabledSoon },
        { id: "deselect-layer", label: "Deselect Layer", icon: "deselect", shortcut: "Ctrl+D", disabled: !hasLayerSelection, onSelect: onDeselect },
        { id: "select-current-layer", label: "Select Current Layer", icon: "filter_center_focus", disabled: !hasLayerSelection },
        { id: "select-sep-1", type: "separator" },
        { id: "reselect", label: "Reselect", ...disabledSoon },
        { id: "invert-selection", label: "Invert Selection", shortcut: "Ctrl+Shift+I", ...disabledSoon },
        { id: "select-sep-2", type: "separator" },
        { id: "select-subject", label: "Select Subject", icon: "person_search", ...disabledSoon },
        { id: "select-background", label: "Select Background", icon: "background_replace", ...disabledSoon },
        { id: "select-by-color", label: "Select by Color...", icon: "palette", ...disabledSoon },
      ],
    },
    {
      label: "Filter",
      actions: [
        { id: "repeat-last-filter", label: "Repeat Last Filter", icon: "repeat", shortcut: "Ctrl+F", ...disabledSoon },
        { id: "filter-sep-1", type: "separator" },
        { id: "auto-enhance", label: "Auto Enhance", icon: "auto_fix_high", ...disabledSoon },
        { id: "filter-sep-2", type: "separator" },
        {
          id: "blur",
          label: "Blur",
          icon: "blur_on",
          submenu: [
            { id: "gaussian-blur", label: "Gaussian Blur...", ...disabledSoon },
            { id: "motion-blur", label: "Motion Blur...", ...disabledSoon },
            { id: "lens-blur", label: "Lens Blur...", ...disabledSoon },
          ],
        },
        {
          id: "sharpen",
          label: "Sharpen",
          icon: "filter_vintage",
          submenu: [
            { id: "sharpen-basic", label: "Sharpen", ...disabledSoon },
            { id: "unsharp-mask", label: "Unsharp Mask...", ...disabledSoon },
            { id: "smart-sharpen", label: "Smart Sharpen...", ...disabledSoon },
          ],
        },
        {
          id: "noise",
          label: "Noise",
          icon: "grain",
          submenu: [
            { id: "add-noise", label: "Add Noise...", ...disabledSoon },
            { id: "reduce-noise", label: "Reduce Noise...", ...disabledSoon },
          ],
        },
        { id: "filter-sep-3", type: "separator" },
        { id: "reset-adjustments", label: "Reset Adjustments", icon: "restart_alt", onSelect: onResetAdjustments },
        { id: "copy-adjustments", label: "Copy Adjustments", icon: "content_copy", onSelect: onCopyAdjustments },
        { id: "filter-sep-4", type: "separator" },
        { id: "remove-background", label: "Remove Background", icon: "person_remove", ...disabledSoon },
        { id: "remove-object", label: "Remove Object...", icon: "layers_clear", ...disabledSoon },
        { id: "ai-upscale", label: "AI Upscale...", icon: "high_res", ...disabledSoon },
        { id: "ai-skin-retouch", label: "AI Skin Retouch...", icon: "face_retouching_natural", ...disabledSoon },
      ],
    },
    {
      label: "View",
      actions: [
        { id: "zoom-in", label: "Zoom In", icon: "zoom_in", shortcut: "Ctrl++", ...disabledSoon },
        { id: "zoom-out", label: "Zoom Out", icon: "zoom_out", shortcut: "Ctrl+-", ...disabledSoon },
        { id: "fit-screen", label: "Fit to Screen", icon: "fit_screen", shortcut: "Ctrl+0", ...disabledSoon },
        { id: "actual-pixels", label: "Actual Pixels", icon: "center_focus_strong", shortcut: "Ctrl+1", ...disabledSoon },
        { id: "view-sep-1", type: "separator" },
        { id: "show-rulers", label: "Show Rulers", icon: "straighten", checked: true, disabled: true },
        { id: "show-grid", label: "Show Grid", icon: "grid_on", checked: true, disabled: true },
        { id: "show-transform-controls", label: "Show Transform Controls", icon: "open_with", checked: true, disabled: true },
        { id: "view-sep-2", type: "separator" },
        { id: "fullscreen", label: "Fullscreen", icon: "fullscreen", ...disabledSoon },
        { id: "reset-workspace", label: "Reset Workspace", icon: "restart_alt", ...disabledSoon },
      ],
    },
    {
      label: "Window",
      actions: [
        { id: "adjustments", label: "Adjustments", icon: "tune", checked: true, disabled: true },
        { id: "layers", label: "Layers", icon: "layers", checked: true, disabled: true },
        { id: "properties", label: "Properties", icon: "manufacturing", checked: true, disabled: true },
        { id: "history", label: "History", icon: "history", checked: true, disabled: true },
        { id: "window-sep-1", type: "separator" },
        { id: "hide-right-sidebar", label: "Hide Right Sidebar", ...disabledSoon },
        { id: "hide-toolbar", label: "Hide Toolbar", ...disabledSoon },
      ],
    },
    {
      label: "Help",
      actions: [
        { id: "getting-started", label: "Getting Started", icon: "flag", ...disabledSoon },
        { id: "interactive-tutorial", label: "Interactive Tutorial", icon: "school", ...disabledSoon },
        { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", icon: "keyboard", shortcut: "Ctrl+/", ...disabledSoon },
        { id: "documentation", label: "Documentation", icon: "article", ...disabledSoon },
        { id: "help-sep-1", type: "separator" },
        { id: "report-bug", label: "Report a Bug", icon: "bug_report", ...disabledSoon },
        { id: "send-feedback", label: "Send Feedback", icon: "feedback", ...disabledSoon },
        { id: "help-sep-2", type: "separator" },
        { id: "whats-new", label: "What's New", icon: "new_releases", ...disabledSoon },
        { id: "about", label: "About Kuvox", icon: "info", ...disabledSoon },
      ],
    },
  ];
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
    <section className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e7b548]/20 bg-[#e7b548]/10 px-3 py-2 text-[12px] text-[#e7b548]">
      <EditorIcon className="shrink-0 text-[18px]">sync_problem</EditorIcon>
      <p className="min-w-[220px] flex-1 whitespace-normal break-words">
        {message || "The server has a newer image version."}
        {serverRevisionNumber !== null ? ` Revision ${serverRevisionNumber}.` : ""}
        {serverUpdatedAt ? ` Updated ${formatConflictTimestamp(serverUpdatedAt)}.` : ""}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onReloadServerVersion}
          className="inline-flex h-8 items-center gap-2 rounded border border-[#e7b548]/20 bg-[#e7b548]/5 px-2 font-semibold hover:bg-[#e7b548]/15 disabled:pointer-events-none disabled:opacity-55"
        >
          <EditorIcon className="text-[16px]">{busyAction === "reload" ? "progress_activity" : "download"}</EditorIcon>
          Reload server version
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onKeepLocalEdits}
          className="inline-flex h-8 items-center gap-2 rounded bg-[#7c5cff] px-2 font-semibold text-white hover:brightness-110 disabled:pointer-events-none disabled:opacity-55"
        >
          <EditorIcon className="text-[16px]">{busyAction === "keep-local" ? "progress_activity" : "upload"}</EditorIcon>
          Keep local edits
        </button>
      </div>
    </section>
  );
}

function isImageEditorTool(value: string): value is ImageEditorTool {
  return ["select", "text", "image", "shape", "crop", "adjust", "hand", "zoom"].includes(value);
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function formatConflictTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

