import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Media-type sub-mode for the editor (the red "Video editing" / "Image editing"
 * nodes in the sitemap are modes within the editor page, not routes).
 */
export type MediaMode = "video" | "image";
export type EditorMode = "manual" | "ai";
export type LibraryTab = "clips" | "audio" | "stills";

/**
 * Minimal placeholder for a timeline operation. The real shape mirrors the
 * backend operation schema (trim, concat, transition, …) — kept loose here so
 * the scaffold compiles before the contract is wired up.
 */
export interface TimelineOperation {
  id: string;
  type: string;
  shotId: string;
}

export interface EditorState {
  projectId: string | null;
  mediaMode: MediaMode;
  editorMode: EditorMode;
  activeLibraryTab: LibraryTab;
  selectedShotId: string | null;
  selectedAssetId: string | null;
  selectedClipId: string | null;
  timelineZoom: number;
  timeline: TimelineOperation[];
}

const initialState: EditorState = {
  projectId: null,
  mediaMode: "video",
  editorMode: "manual",
  activeLibraryTab: "clips",
  selectedShotId: null,
  selectedAssetId: "clip-beach",
  selectedClipId: "tl-beach",
  timelineZoom: 50,
  timeline: [],
};

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    projectOpened(state, action: PayloadAction<string>) {
      state.projectId = action.payload;
    },
    mediaModeChanged(state, action: PayloadAction<MediaMode>) {
      state.mediaMode = action.payload;
    },
    editorModeChanged(state, action: PayloadAction<EditorMode>) {
      state.editorMode = action.payload;
    },
    libraryTabChanged(state, action: PayloadAction<LibraryTab>) {
      state.activeLibraryTab = action.payload;
    },
    assetSelected(state, action: PayloadAction<string | null>) {
      state.selectedAssetId = action.payload;
    },
    clipSelected(state, action: PayloadAction<string | null>) {
      state.selectedClipId = action.payload;
    },
    timelineZoomChanged(state, action: PayloadAction<number>) {
      state.timelineZoom = action.payload;
    },
    shotSelected(state, action: PayloadAction<string | null>) {
      state.selectedShotId = action.payload;
    },
    operationAdded(state, action: PayloadAction<TimelineOperation>) {
      state.timeline.push(action.payload);
    },
  },
});

export const {
  projectOpened,
  mediaModeChanged,
  editorModeChanged,
  libraryTabChanged,
  assetSelected,
  clipSelected,
  timelineZoomChanged,
  shotSelected,
  operationAdded,
} = editorSlice.actions;

export const editorReducer = editorSlice.reducer;
