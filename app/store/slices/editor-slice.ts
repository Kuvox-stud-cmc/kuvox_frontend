import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Media-type sub-mode for the editor (the red "Video editing" / "Image editing"
 * nodes in the sitemap are modes within the editor page, not routes).
 */
export type MediaMode = "video" | "image";

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
  selectedShotId: string | null;
  timeline: TimelineOperation[];
}

const initialState: EditorState = {
  projectId: null,
  mediaMode: "video",
  selectedShotId: null,
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
    shotSelected(state, action: PayloadAction<string | null>) {
      state.selectedShotId = action.payload;
    },
    operationAdded(state, action: PayloadAction<TimelineOperation>) {
      state.timeline.push(action.payload);
    },
  },
});

export const { projectOpened, mediaModeChanged, shotSelected, operationAdded } =
  editorSlice.actions;

export const editorReducer = editorSlice.reducer;
