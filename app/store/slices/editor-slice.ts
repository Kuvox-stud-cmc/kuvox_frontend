import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Media-type sub-mode for the editor (the red "Video editing" / "Image editing"
 * nodes in the sitemap are modes within the editor page, not routes).
 */
export type MediaMode = "video" | "image";
export type EditorMode = "manual" | "ai";
export type LibraryTab = "clips" | "audio" | "stills";
export type ActiveModal = "import-media" | "export" | "fullscreen" | "settings" | null;
export type ActivePopover = "notifications" | "profile" | null;

export interface MockAssistantMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: string[];
}

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
  libraryOpen: boolean;
  timelineOpen: boolean;
  libraryWidth: number;
  timelineHeight: number;
  activeLibraryTab: LibraryTab;
  selectedShotId: string | null;
  selectedAssetId: string | null;
  selectedClipId: string | null;
  timelineZoom: number;
  isPlaying: boolean;
  isMuted: boolean;
  currentTimeSeconds: number;
  activeToolId: string;
  snappingEnabled: boolean;
  clipsLinked: boolean;
  activeModal: ActiveModal;
  activePopover: ActivePopover;
  toastMessage: string | null;
  searchQuery: string;
  commandInput: string;
  assistantMessages: MockAssistantMessage[];
  timeline: TimelineOperation[];
}

const initialState: EditorState = {
  projectId: null,
  mediaMode: "video",
  editorMode: "manual",
  libraryOpen: true,
  timelineOpen: true,
  libraryWidth: 280,
  timelineHeight: 292,
  activeLibraryTab: "clips",
  selectedShotId: null,
  selectedAssetId: "clip-beach",
  selectedClipId: "tl-beach",
  timelineZoom: 50,
  isPlaying: false,
  isMuted: false,
  currentTimeSeconds: 83,
  activeToolId: "trim",
  snappingEnabled: true,
  clipsLinked: false,
  activeModal: null,
  activePopover: null,
  toastMessage: null,
  searchQuery: "",
  commandInput: "Add cap",
  assistantMessages: [],
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
    libraryOpenChanged(state, action: PayloadAction<boolean>) {
      state.libraryOpen = action.payload;
    },
    libraryToggled(state) {
      state.libraryOpen = !state.libraryOpen;
    },
    timelineOpenChanged(state, action: PayloadAction<boolean>) {
      state.timelineOpen = action.payload;
    },
    timelineToggled(state) {
      state.timelineOpen = !state.timelineOpen;
    },
    libraryWidthChanged(state, action: PayloadAction<number>) {
      state.libraryWidth = Math.min(360, Math.max(220, action.payload));
    },
    timelineHeightChanged(state, action: PayloadAction<number>) {
      state.timelineHeight = Math.min(420, Math.max(180, action.payload));
    },
    libraryTabChanged(state, action: PayloadAction<LibraryTab>) {
      state.activeLibraryTab = action.payload;
    },
    assetSelected(state, action: PayloadAction<string | null>) {
      state.selectedAssetId = action.payload;
      if (action.payload) {
        state.toastMessage = "Preview updated with selected media";
      }
    },
    clipSelected(state, action: PayloadAction<string | null>) {
      state.selectedClipId = action.payload;
    },
    timelineZoomChanged(state, action: PayloadAction<number>) {
      state.timelineZoom = action.payload;
    },
    playbackToggled(state) {
      state.isPlaying = !state.isPlaying;
      state.toastMessage = state.isPlaying ? "Playback started" : "Playback paused";
    },
    playbackStepChanged(state, action: PayloadAction<number>) {
      state.currentTimeSeconds = Math.min(300, Math.max(0, state.currentTimeSeconds + action.payload));
      state.isPlaying = false;
    },
    currentTimeChanged(state, action: PayloadAction<number>) {
      state.currentTimeSeconds = Math.min(300, Math.max(0, action.payload));
    },
    muteToggled(state) {
      state.isMuted = !state.isMuted;
      state.toastMessage = state.isMuted ? "Preview muted" : "Preview audio enabled";
    },
    activeToolChanged(state, action: PayloadAction<string>) {
      state.activeToolId = action.payload;
      state.toastMessage = "Tool selected";
    },
    snappingToggled(state) {
      state.snappingEnabled = !state.snappingEnabled;
      state.toastMessage = state.snappingEnabled ? "Snapping enabled" : "Snapping disabled";
    },
    clipsLinkedToggled(state) {
      state.clipsLinked = !state.clipsLinked;
      state.toastMessage = state.clipsLinked ? "Clips linked" : "Clip linking disabled";
    },
    modalOpened(state, action: PayloadAction<Exclude<ActiveModal, null>>) {
      state.activeModal = action.payload;
      state.activePopover = null;
    },
    modalClosed(state) {
      state.activeModal = null;
    },
    popoverToggled(state, action: PayloadAction<Exclude<ActivePopover, null>>) {
      state.activePopover = state.activePopover === action.payload ? null : action.payload;
      state.activeModal = null;
    },
    popoverClosed(state) {
      state.activePopover = null;
    },
    toastShown(state, action: PayloadAction<string>) {
      state.toastMessage = action.payload;
    },
    toastCleared(state) {
      state.toastMessage = null;
    },
    searchQueryChanged(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    commandInputChanged(state, action: PayloadAction<string>) {
      state.commandInput = action.payload;
    },
    assistantMessageAdded(state, action: PayloadAction<MockAssistantMessage>) {
      state.assistantMessages.push(action.payload);
    },
    assistantSuggestionChosen(state, action: PayloadAction<string>) {
      state.commandInput = action.payload;
      state.toastMessage = "Suggestion loaded";
    },
    assistantActionResolved(state, action: PayloadAction<string>) {
      state.toastMessage = `Assistant action: ${action.payload}`;
      state.assistantMessages.push({
        id: `assistant-action-${Date.now()}`,
        role: "assistant",
        text: `${action.payload} selected. I updated the mock edit plan so you can review the result.`,
      });
    },
    shotSelected(state, action: PayloadAction<string | null>) {
      state.selectedShotId = action.payload;
    },
    operationAdded(state, action: PayloadAction<TimelineOperation>) {
      state.timeline.push(action.payload);
      state.toastMessage = "Timeline operation added";
    },
  },
});

export const {
  projectOpened,
  mediaModeChanged,
  editorModeChanged,
  libraryOpenChanged,
  libraryToggled,
  timelineOpenChanged,
  timelineToggled,
  libraryWidthChanged,
  timelineHeightChanged,
  libraryTabChanged,
  assetSelected,
  clipSelected,
  timelineZoomChanged,
  playbackToggled,
  playbackStepChanged,
  currentTimeChanged,
  muteToggled,
  activeToolChanged,
  snappingToggled,
  clipsLinkedToggled,
  modalOpened,
  modalClosed,
  popoverToggled,
  popoverClosed,
  toastShown,
  toastCleared,
  searchQueryChanged,
  commandInputChanged,
  assistantMessageAdded,
  assistantSuggestionChosen,
  assistantActionResolved,
  shotSelected,
  operationAdded,
} = editorSlice.actions;

export const editorReducer = editorSlice.reducer;
