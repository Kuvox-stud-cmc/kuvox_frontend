import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { createDefaultImageCompositionDocument } from "~/lib/editor/image/document/default-document";
import {
  applyImageOperation,
  imageLayerOperationAvailability,
  normalizeAdjustments,
  restoreImageDocumentSnapshot,
} from "~/lib/editor/image/document/operations";
import type {
  ImageCompositionDocument,
  ImageCompositionOperation,
  ImageHistoryEntry,
} from "~/lib/editor/image/document/types";
import type { RootState } from "~/store";

export type ImageEditorMode = "manual" | "ai";
export type ImageEditorTool = "select" | "text" | "image" | "shape" | "crop" | "adjust" | "hand" | "zoom";
export type ImageEditorPanelTab = "templates" | "media";
export type ImageSaveState = "saved-locally" | "syncing" | "synced" | "sync-failed" | "server-changed";
export type ImageAiCommandStatus = "idle" | "planning" | "applied" | "failed";

export interface ImageEditorPan {
  x: number;
  y: number;
}

export interface ImageConflictMetadata {
  message: string;
  serverRevisionNumber: number | null;
  serverUpdatedAt: string | null;
  updatedByUserId: string | null;
}

export interface ImageEditorState {
  projectId: string | null;
  projectName: string;
  document: ImageCompositionDocument;
  undoStack: ImageHistoryEntry[];
  redoStack: ImageHistoryEntry[];
  saveState: ImageSaveState;
  saveError: string | null;
  conflict: ImageConflictMetadata | null;
  editorMode: ImageEditorMode;
  activeTool: ImageEditorTool;
  zoom: number;
  pan: ImageEditorPan;
  activePanelTab: ImageEditorPanelTab;
  aiCommandInput: string;
  aiCommandStatus: ImageAiCommandStatus;
  aiCommandError: string | null;
  aiLastSummary: string | null;
  aiCommandHistory: { id: string; label: string; summary: string; prompt: string | null; createdAt: string }[];
}

const initialState: ImageEditorState = {
  projectId: null,
  projectName: "Untitled image",
  document: createDefaultImageCompositionDocument(),
  undoStack: [],
  redoStack: [],
  saveState: "synced",
  saveError: null,
  conflict: null,
  editorMode: "manual",
  activeTool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  activePanelTab: "templates",
  aiCommandInput: "",
  aiCommandStatus: "idle",
  aiCommandError: null,
  aiLastSummary: null,
  aiCommandHistory: [],
};

const imageEditorSlice = createSlice({
  name: "imageEditor",
  initialState,
  reducers: {
    imageProjectOpened(
      state,
      action: PayloadAction<{
        projectId: string;
        projectName?: string | null;
        document?: ImageCompositionDocument | null;
        baseRevisionNumber?: number;
        lastSyncedAt?: string | null;
      }>,
    ) {
      state.projectId = action.payload.projectId;
      state.projectName =
        action.payload.projectName?.trim() || `Image project ${action.payload.projectId.slice(0, 8)}`;
      state.document = normalizeLoadedDocument(
        action.payload.document ?? createDefaultImageCompositionDocument(),
        action.payload.projectId,
        action.payload.baseRevisionNumber ?? action.payload.document?.baseRevisionNumber ?? 0,
        action.payload.lastSyncedAt ?? action.payload.document?.lastSyncedAt ?? null,
      );
      state.undoStack = [...state.document.operationHistory];
      state.redoStack = [];
      state.saveState = state.document.lastSyncedAt ? "synced" : "saved-locally";
      state.saveError = null;
      state.conflict = null;
      state.editorMode = "manual";
      state.activeTool = "select";
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
      state.activePanelTab = "templates";
      state.aiCommandInput = "";
      state.aiCommandStatus = "idle";
      state.aiCommandError = null;
      state.aiLastSummary = null;
      state.aiCommandHistory = [];
    },
    imageEditorModeChanged(state, action: PayloadAction<ImageEditorMode>) {
      state.editorMode = action.payload;
    },
    imageActiveToolChanged(state, action: PayloadAction<ImageEditorTool>) {
      state.activeTool = action.payload;
    },
    imageLayerSelected(state, action: PayloadAction<string>) {
      state.document.selectedLayerId = action.payload;
    },
    imageSelectionCleared(state) {
      state.document.selectedLayerId = null;
    },
    imageDocumentOperationApplied(state, action: PayloadAction<ImageCompositionOperation>) {
      const previousHistoryLength = state.document.operationHistory.length;
      state.document = applyImageOperation(state.document, action.payload);
      const entry = state.document.operationHistory.at(previousHistoryLength);
      if (entry) {
        state.undoStack.push(entry);
        state.redoStack = [];
        if (state.saveState !== "server-changed") {
          state.saveState = "saved-locally";
        }
        state.saveError = null;
      }
      if (
        action.payload.type === "add-layer" ||
        (action.payload.type === "group-operation" &&
          action.payload.childOperations.some((operation) => operation.type === "add-layer"))
      ) {
        state.activeTool = "select";
      }
    },
    imageUndoRequested(state) {
      const entry = state.undoStack.pop();
      if (!entry) return;
      state.redoStack.push(entry);
      state.document = restoreImageDocumentSnapshot(
        entry.before,
        state.document.operationHistory.filter((item) => item.id !== entry.id),
      );
      if (state.saveState !== "server-changed") {
        state.saveState = "saved-locally";
      }
      state.saveError = null;
    },
    imageRedoRequested(state) {
      const entry = state.redoStack.pop();
      if (!entry) return;
      state.undoStack.push(entry);
      state.document = restoreImageDocumentSnapshot(entry.after, [
        ...state.document.operationHistory,
        entry,
      ]);
      if (state.saveState !== "server-changed") {
        state.saveState = "saved-locally";
      }
      state.saveError = null;
    },
    imageDraftLoaded(
      state,
      action: PayloadAction<{
        document: ImageCompositionDocument;
        baseRevisionNumber: number;
        lastSyncedAt?: string | null;
      }>,
    ) {
      state.document = normalizeLoadedDocument(
        action.payload.document,
        state.projectId,
        action.payload.baseRevisionNumber,
        action.payload.lastSyncedAt ?? null,
      );
      state.undoStack = [...state.document.operationHistory];
      state.redoStack = [];
      state.saveState = "saved-locally";
      state.saveError = null;
      state.conflict = null;
    },
    imageSaveStateChanged(
      state,
      action: PayloadAction<{ state: ImageSaveState; error?: string | null }>,
    ) {
      state.saveState = action.payload.state;
      state.saveError = action.payload.error ?? null;
      if (action.payload.state !== "server-changed" && action.payload.state !== "syncing") {
        state.conflict = null;
      }
    },
    imageBackendSyncSucceeded(
      state,
      action: PayloadAction<{ revisionNumber: number; syncedAt: string; updatedAt?: string | null }>,
    ) {
      state.document.baseRevisionNumber = action.payload.revisionNumber;
      state.document.lastSyncedAt = action.payload.syncedAt;
      state.saveState = "synced";
      state.saveError = null;
      state.conflict = null;
    },
    imageBackendSyncFailed(
      state,
      action: PayloadAction<{
        conflict?: boolean;
        error?: string | null;
        serverRevisionNumber?: number | null;
        serverUpdatedAt?: string | null;
        updatedByUserId?: string | null;
      }>,
    ) {
      state.saveState = action.payload.conflict ? "server-changed" : "sync-failed";
      state.saveError = action.payload.error ?? null;
      state.conflict = action.payload.conflict
        ? {
            message: action.payload.error || "The server has a newer image version.",
            serverRevisionNumber: action.payload.serverRevisionNumber ?? null,
            serverUpdatedAt: action.payload.serverUpdatedAt ?? null,
            updatedByUserId: action.payload.updatedByUserId ?? null,
          }
        : null;
    },
    imageServerVersionLoaded(
      state,
      action: PayloadAction<{
        document?: ImageCompositionDocument | null;
        baseRevisionNumber: number;
        lastSyncedAt?: string | null;
      }>,
    ) {
      state.document = normalizeLoadedDocument(
        action.payload.document ?? createDefaultImageCompositionDocument(),
        state.projectId,
        action.payload.baseRevisionNumber,
        action.payload.lastSyncedAt ?? null,
      );
      state.undoStack = [...state.document.operationHistory];
      state.redoStack = [];
      state.saveState = action.payload.lastSyncedAt ? "synced" : "saved-locally";
      state.saveError = null;
      state.conflict = null;
    },
    imageZoomChanged(state, action: PayloadAction<number>) {
      state.zoom = Math.min(4, Math.max(0.1, action.payload));
    },
    imagePanChanged(state, action: PayloadAction<ImageEditorPan>) {
      state.pan = action.payload;
    },
    imagePanelTabChanged(state, action: PayloadAction<ImageEditorPanelTab>) {
      state.activePanelTab = action.payload;
    },
    imageAiCommandInputChanged(state, action: PayloadAction<string>) {
      state.aiCommandInput = action.payload;
    },
    imageAiCommandStarted(state) {
      state.aiCommandStatus = "planning";
      state.aiCommandError = null;
    },
    imageAiCommandApplied(state, action: PayloadAction<{ summary: string; prompt?: string }>) {
      state.aiCommandStatus = "applied";
      state.aiCommandError = null;
      state.aiLastSummary = action.payload.summary;
      state.aiCommandHistory.push({
        id: `image-ai-cmd-${Date.now()}`,
        label: `AI Plan`,
        summary: action.payload.summary,
        prompt: action.payload.prompt ?? state.aiCommandInput ?? null,
        createdAt: new Date().toISOString(),
      });
    },
    imageAiCommandFailed(state, action: PayloadAction<string>) {
      state.aiCommandStatus = "failed";
      state.aiCommandError = action.payload;
    },
  },
});

export const {
  imageProjectOpened,
  imageEditorModeChanged,
  imageActiveToolChanged,
  imageLayerSelected,
  imageSelectionCleared,
  imageDocumentOperationApplied,
  imageUndoRequested,
  imageRedoRequested,
  imageDraftLoaded,
  imageSaveStateChanged,
  imageBackendSyncSucceeded,
  imageBackendSyncFailed,
  imageServerVersionLoaded,
  imageZoomChanged,
  imagePanChanged,
  imagePanelTabChanged,
  imageAiCommandInputChanged,
  imageAiCommandStarted,
  imageAiCommandApplied,
  imageAiCommandFailed,
} = imageEditorSlice.actions;

export const imageEditorReducer = imageEditorSlice.reducer;

export const selectImageEditor = (state: RootState) => state.imageEditor;
export const selectImageDocument = (state: RootState) => state.imageEditor.document;
export const selectCanUndo = (state: RootState) => state.imageEditor.undoStack.length > 0;
export const selectCanRedo = (state: RootState) => state.imageEditor.redoStack.length > 0;
export const selectSelectedImageLayer = (state: RootState) => {
  const document = state.imageEditor.document;
  return document.layers.find((layer) => layer.id === document.selectedLayerId) ?? null;
};
export const selectOrderedVisibleImageLayers = (state: RootState) =>
  state.imageEditor.document.layers.filter((layer) => layer.visible);
export const selectImageLayerEditableState = (state: RootState) => {
  const layer = selectSelectedImageLayer(state);
  return {
    selectedLayer: layer,
    canEdit: Boolean(layer && !layer.locked && layer.visible),
  };
};
export const selectImageOperationAvailability = (state: RootState) =>
  imageLayerOperationAvailability(
    state.imageEditor.document,
    state.imageEditor.document.selectedLayerId,
  );

function normalizeLoadedDocument(
  document: ImageCompositionDocument,
  projectId: string | null,
  baseRevisionNumber: number,
  lastSyncedAt: string | null,
): ImageCompositionDocument {
  return {
    ...document,
    projectId,
    documentId: document.documentId ?? `image-document-${projectId ?? "local"}`,
    updatedAt: document.updatedAt ?? lastSyncedAt ?? null,
    baseRevisionNumber,
    lastSyncedAt,
    adjustments: normalizeAdjustments(document.adjustments),
    layers: [...document.layers],
    operationHistory: document.operationHistory ?? [],
  };
}
