import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  createMockVideoProjectDocument,
  type VideoEditorSelection,
  type VideoPlaybackState,
  type VideoProjectDocument,
  type VideoTimelineItem,
  validateVideoProjectDocument,
} from "~/lib/editor/video-document";
import { stepPreviewTime } from "~/lib/editor/editor-preview";
import type {
  EditorLoadConflict,
  EditorLoadDocumentSource,
  EditorLoadSyncStatus,
} from "~/lib/editor/editor-load";
import {
  applyVideoOperation,
  applyVideoOperationBatch,
  type VideoOperation,
  type VideoOperationBatch,
} from "~/lib/editor/video-operations";
import {
  buildAddMediaToTimelineOperation,
  mediaDtoToVideoMediaReference,
} from "~/lib/editor/editor-media";
import type { MediaDto } from "~/lib/api";
import {
  editorToolDefinitions,
  isEnabledEditorToolId,
  isTimelineEditorToolId,
  type EditorToolId,
  type TimelineEditorToolId,
} from "~/lib/editor/editor-tools";

/**
 * Legacy media-type flag retained while the video editor scaffold is refactored.
 * Video and image projects now have separate editor routes.
 */
export type MediaMode = "video" | "image";
export type EditorMode = "manual" | "ai";
export type LibraryTab = "clips" | "audio" | "stills";
export type ActiveModal = "import-media" | "export" | "fullscreen" | "settings" | null;
export type ActivePopover = "notifications" | "profile" | null;
export type EditorDocumentStatus = "idle" | "ready" | "invalid";
export type EditorSyncStatus =
  | "clean"
  | "dirty"
  | "saved-local"
  | "syncing"
  | "synced"
  | "failed"
  | "sync-failed"
  | "server-changed";

export interface MockAssistantMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: string[];
}

export interface TimelineClipViewModel {
  id: string;
  label: string;
  start: number;
  width: number;
  tone: "video" | "audio" | "text";
}

export interface TimelineTrackViewModel {
  id: string;
  label: string;
  icon: string;
  height: number;
  clips: TimelineClipViewModel[];
}

export interface MediaReferenceViewModel {
  id: string;
  type: LibraryTab;
  title: string;
  duration: string;
  icon: string;
  gradient: string;
}

export interface EditorUiSessionState {
  editorMode: EditorMode;
  libraryOpen: boolean;
  timelineOpen: boolean;
  libraryWidth: number;
  timelineHeight: number;
  activeLibraryTab: LibraryTab;
  selectedMediaId: string | null;
  timelineZoom: number;
  timelineScrollLeft: number;
  timelineScrollTop: number;
  soloedAudioTrackIds: string[];
  activeToolId: TimelineEditorToolId;
  snappingEnabled: boolean;
  clipsLinked: boolean;
  activeModal: ActiveModal;
  activePopover: ActivePopover;
  toastMessage: string | null;
  searchQuery: string;
  commandInput: string;
}

export interface EditorState {
  projectId: string | null;
  mediaMode: MediaMode;
  document: VideoProjectDocument | null;
  documentStatus: EditorDocumentStatus;
  syncStatus: EditorSyncStatus;
  loadSource: EditorLoadDocumentSource | null;
  pendingSyncCount: number;
  conflict: EditorLoadConflict | null;
  lastError: string | null;
  loadedRevision: number | null;
  lastSavedRevision: number | null;
  lastAppliedOperationIds: string[];
  selection: VideoEditorSelection;
  playback: VideoPlaybackState;
  ui: EditorUiSessionState;
  assistantMessages: MockAssistantMessage[];
}

type ProjectOpenedPayload = string | { projectId: string; projectName?: string };
type EditorDocumentLoadedPayload = {
  document: VideoProjectDocument;
  source: EditorLoadDocumentSource;
  syncStatus: EditorLoadSyncStatus;
  pendingSyncCount?: number;
  conflict?: EditorLoadConflict | null;
  warnings?: string[];
};
type RootEditorState = { editor: EditorState };

const timelinePixelsPerSecond = 10;

const initialSelection: VideoEditorSelection = {
  selectedTrackIds: [],
  selectedItemIds: ["tl-beach"],
  selectedTransitionIds: [],
  selectedEffectIds: [],
  activeItemId: "tl-beach",
};

const initialPlayback: VideoPlaybackState = {
  playing: false,
  currentTime: 83,
  volume: 1,
  muted: false,
  loop: false,
};

const initialUi: EditorUiSessionState = {
  editorMode: "manual",
  libraryOpen: true,
  timelineOpen: true,
  libraryWidth: 280,
  timelineHeight: 292,
  activeLibraryTab: "clips",
  selectedMediaId: "clip-beach",
  timelineZoom: 50,
  timelineScrollLeft: 0,
  timelineScrollTop: 0,
  soloedAudioTrackIds: [],
  activeToolId: "select",
  snappingEnabled: true,
  clipsLinked: false,
  activeModal: null,
  activePopover: null,
  toastMessage: null,
  searchQuery: "",
  commandInput: "Add cap",
};

const initialState: EditorState = {
  projectId: null,
  mediaMode: "video",
  document: null,
  documentStatus: "idle",
  syncStatus: "clean",
  loadSource: null,
  pendingSyncCount: 0,
  conflict: null,
  lastError: null,
  loadedRevision: null,
  lastSavedRevision: null,
  lastAppliedOperationIds: [],
  selection: initialSelection,
  playback: initialPlayback,
  ui: initialUi,
  assistantMessages: [],
};

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    editorLoadStarted(state, action: PayloadAction<{ projectId: string }>) {
      state.projectId = action.payload.projectId;
      state.documentStatus = "idle";
      state.syncStatus = "syncing";
      state.loadSource = null;
      state.pendingSyncCount = 0;
      state.conflict = null;
      state.lastError = null;
      state.lastAppliedOperationIds = [];
    },
    editorDocumentLoaded(state, action: PayloadAction<EditorDocumentLoadedPayload>) {
      const validation = validateVideoProjectDocument(action.payload.document);
      if (!validation.ok) {
        state.documentStatus = "invalid";
        state.syncStatus = "sync-failed";
        state.lastError = validation.errors.join(" ");
        state.ui.toastMessage = "Video document failed validation";
        return;
      }

      state.document = validation.document;
      state.projectId = validation.document.projectId;
      state.documentStatus = "ready";
      state.syncStatus = action.payload.syncStatus;
      state.loadSource = action.payload.source;
      state.pendingSyncCount = action.payload.pendingSyncCount ?? 0;
      state.conflict = action.payload.conflict ?? null;
      state.lastError = action.payload.warnings?.join(" ") || null;
      state.loadedRevision = validation.document.history.revision;
      state.lastSavedRevision = validation.document.history.revision;
      state.lastAppliedOperationIds = [];
      state.selection = sanitizeSelection(state.selection, validation.document);
      state.playback.currentTime = clampTime(state.playback.currentTime, validation.document);
      state.ui.selectedMediaId = state.ui.selectedMediaId ?? firstMediaId(validation.document);
      state.ui.toastMessage =
        action.payload.conflict
          ? "Server changed while local edits are saved"
          : action.payload.source === "draft"
            ? "Loaded local draft"
            : action.payload.warnings?.[0] ?? null;
    },
    editorLoadFailed(state, action: PayloadAction<{ message: string }>) {
      state.documentStatus = "invalid";
      state.syncStatus = "sync-failed";
      state.lastError = action.payload.message;
      state.ui.toastMessage = "Editor load failed";
    },
    editorServerChangedDetected(state, action: PayloadAction<EditorLoadConflict>) {
      state.syncStatus = "server-changed";
      state.conflict = action.payload;
      state.ui.toastMessage = "Server changed while local edits are saved";
    },
    editorConflictResolved(state, action: PayloadAction<{ resolution: "keep-local" | "reload-server" }>) {
      state.conflict = null;
      state.syncStatus = action.payload.resolution === "keep-local" ? "saved-local" : "syncing";
      state.pendingSyncCount = action.payload.resolution === "keep-local" ? state.pendingSyncCount : 0;
      state.ui.toastMessage = action.payload.resolution === "keep-local" ? "Keeping local edits" : "Reloading server copy";
    },
    projectOpened(state, action: PayloadAction<ProjectOpenedPayload>) {
      const projectId = typeof action.payload === "string" ? action.payload : action.payload.projectId;
      const projectName = typeof action.payload === "string" ? undefined : action.payload.projectName;
      const document = createMockVideoProjectDocument(projectId, projectName);

      state.projectId = projectId;
      state.document = document;
      state.documentStatus = "ready";
      state.syncStatus = "clean";
      state.loadSource = "empty";
      state.pendingSyncCount = 0;
      state.conflict = null;
      state.lastError = null;
      state.loadedRevision = document.history.revision;
      state.lastSavedRevision = document.history.revision;
      state.lastAppliedOperationIds = [];
      state.selection = {
        ...initialSelection,
        selectedItemIds: document.tracks[0]?.items[0]?.id ? [document.tracks[0].items[0].id] : [],
        activeItemId: document.tracks[0]?.items[0]?.id,
      };
      state.playback = { ...initialPlayback, currentTime: clampTime(initialPlayback.currentTime, document) };
      state.ui.selectedMediaId = firstMediaId(document);
    },
    documentLoaded(state, action: PayloadAction<VideoProjectDocument>) {
      const validation = validateVideoProjectDocument(action.payload);
      if (!validation.ok) {
        state.documentStatus = "invalid";
        state.lastError = validation.errors.join(" ");
        state.ui.toastMessage = "Video document failed validation";
        return;
      }

      state.document = validation.document;
      state.projectId = validation.document.projectId;
      state.documentStatus = "ready";
      state.syncStatus = "clean";
      state.loadSource = "draft";
      state.pendingSyncCount = 0;
      state.conflict = null;
      state.lastError = null;
      state.loadedRevision = validation.document.history.revision;
      state.lastSavedRevision = validation.document.history.revision;
      state.lastAppliedOperationIds = [];
      state.selection = sanitizeSelection(state.selection, validation.document);
      state.playback.currentTime = clampTime(state.playback.currentTime, validation.document);
      state.ui.selectedMediaId = state.ui.selectedMediaId ?? firstMediaId(validation.document);
    },
    videoOperationApplied(state, action: PayloadAction<VideoOperation | VideoOperationBatch>) {
      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const result = "operations" in action.payload
        ? applyVideoOperationBatch(state.document, action.payload)
        : applyVideoOperation(state.document, action.payload);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Video operation failed.";
        state.ui.toastMessage = "Edit could not be applied";
        return;
      }

      state.document = result.document;
      state.documentStatus = "ready";
      state.syncStatus = "dirty";
      state.lastError = result.warnings[0] ?? null;
      state.lastAppliedOperationIds = result.appliedOperationIds;
      state.selection = sanitizeSelection(state.selection, result.document);
      state.playback.currentTime = clampTime(state.playback.currentTime, result.document);
      state.ui.toastMessage = result.warnings[0] ?? "Edit applied";
    },
    mediaAssetAddedToTimeline(state, action: PayloadAction<MediaDto | { media: MediaDto; trackId?: string; timelineStart?: number }>) {
      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const media = "media" in action.payload ? action.payload.media : action.payload;
      const placement = "media" in action.payload
        ? { trackId: action.payload.trackId, timelineStart: action.payload.timelineStart }
        : undefined;
      const mediaReference = mediaDtoToVideoMediaReference(media);
      const documentWithMedia = {
        ...state.document,
        media: {
          ...state.document.media,
          [mediaReference.id]: mediaReference,
        },
      };
      const build = buildAddMediaToTimelineOperation({
        document: documentWithMedia,
        media,
        now: new Date().toISOString(),
        placement,
      });

      if (!build.ok) {
        state.lastError = build.reason;
        state.ui.toastMessage = build.reason;
        return;
      }

      const result = applyVideoOperation(documentWithMedia, build.operation);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Media could not be added.";
        state.ui.toastMessage = "Media could not be added";
        return;
      }

      state.document = result.document;
      state.documentStatus = "ready";
      state.syncStatus = "dirty";
      state.lastError = result.warnings[0] ?? null;
      state.lastAppliedOperationIds = result.appliedOperationIds;
      state.selection = {
        ...sanitizeSelection(state.selection, result.document),
        selectedItemIds: [build.operation.item.id],
        activeItemId: build.operation.item.id,
      };
      state.playback.currentTime = clampTime(state.playback.currentTime, result.document);
      state.ui.selectedMediaId = media.id;
      state.ui.toastMessage = "Media added to timeline";
    },
    mediaModeChanged(state, action: PayloadAction<MediaMode>) {
      state.mediaMode = action.payload;
    },
    editorModeChanged(state, action: PayloadAction<EditorMode>) {
      state.ui.editorMode = action.payload;
    },
    libraryOpenChanged(state, action: PayloadAction<boolean>) {
      state.ui.libraryOpen = action.payload;
    },
    libraryToggled(state) {
      state.ui.libraryOpen = !state.ui.libraryOpen;
    },
    timelineOpenChanged(state, action: PayloadAction<boolean>) {
      state.ui.timelineOpen = action.payload;
    },
    timelineToggled(state) {
      state.ui.timelineOpen = !state.ui.timelineOpen;
    },
    libraryWidthChanged(state, action: PayloadAction<number>) {
      state.ui.libraryWidth = Math.min(360, Math.max(220, action.payload));
    },
    timelineHeightChanged(state, action: PayloadAction<number>) {
      state.ui.timelineHeight = Math.min(420, Math.max(180, action.payload));
    },
    libraryTabChanged(state, action: PayloadAction<LibraryTab>) {
      state.ui.activeLibraryTab = action.payload;
    },
    assetSelected(state, action: PayloadAction<string | null>) {
      state.ui.selectedMediaId = action.payload;
      if (action.payload) {
        state.ui.toastMessage = "Preview updated with selected media";
      }
    },
    clipSelected(state, action: PayloadAction<string | null>) {
      state.selection.selectedItemIds = action.payload ? [action.payload] : [];
      state.selection.activeItemId = action.payload ?? undefined;
    },
    timelineItemsSelected(
      state,
      action: PayloadAction<{
        itemIds: string[];
        activeItemId?: string;
        mode?: "replace" | "toggle" | "add";
      }>,
    ) {
      const current = new Set(state.selection.selectedItemIds);
      const incoming = action.payload.itemIds;
      const mode = action.payload.mode ?? "replace";
      let selectedItemIds: string[];

      if (mode === "toggle") {
        for (const itemId of incoming) {
          if (current.has(itemId)) current.delete(itemId);
          else current.add(itemId);
        }
        selectedItemIds = Array.from(current);
      } else if (mode === "add") {
        selectedItemIds = Array.from(new Set([...state.selection.selectedItemIds, ...incoming]));
      } else {
        selectedItemIds = incoming;
      }

      state.selection.selectedItemIds = selectedItemIds;
      state.selection.activeItemId = action.payload.activeItemId ?? selectedItemIds[selectedItemIds.length - 1];
    },
    timelineSelectionCleared(state) {
      state.selection.selectedItemIds = [];
      state.selection.selectedTrackIds = [];
      state.selection.selectedTransitionIds = [];
      state.selection.selectedEffectIds = [];
      state.selection.activeItemId = undefined;
    },
    timelineZoomChanged(state, action: PayloadAction<number>) {
      state.ui.timelineZoom = Math.min(100, Math.max(1, action.payload));
    },
    timelineScrollChanged(state, action: PayloadAction<{ left: number; top: number }>) {
      state.ui.timelineScrollLeft = Math.max(0, action.payload.left);
      state.ui.timelineScrollTop = Math.max(0, action.payload.top);
    },
    trackSoloToggled(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      state.ui.soloedAudioTrackIds = state.ui.soloedAudioTrackIds.includes(trackId)
        ? state.ui.soloedAudioTrackIds.filter((candidate) => candidate !== trackId)
        : [...state.ui.soloedAudioTrackIds, trackId];
      state.ui.toastMessage = state.ui.soloedAudioTrackIds.length > 0 ? "Audio solo enabled" : "Audio solo cleared";
    },
    playbackToggled(state) {
      state.playback.playing = !state.playback.playing;
      state.ui.toastMessage = state.playback.playing ? "Playback started" : "Playback paused";
    },
    playbackPaused(state) {
      state.playback.playing = false;
    },
    playbackStepChanged(state, action: PayloadAction<number>) {
      state.playback.currentTime = clampTime(state.playback.currentTime + action.payload, state.document);
      state.playback.playing = false;
    },
    playbackFrameStepped(state, action: PayloadAction<-1 | 1>) {
      state.playback.currentTime = stepPreviewTime({
        currentTime: state.playback.currentTime,
        direction: action.payload,
        frameRate: state.document?.settings.frameRate ?? 30,
        timelineDuration: state.document ? getTimelineDuration(state.document) : 300,
      });
      state.playback.playing = false;
    },
    currentTimeChanged(state, action: PayloadAction<number>) {
      state.playback.currentTime = clampTime(action.payload, state.document);
    },
    muteToggled(state) {
      state.playback.muted = !state.playback.muted;
      state.ui.toastMessage = state.playback.muted ? "Preview muted" : "Preview audio enabled";
    },
    activeToolChanged(state, action: PayloadAction<EditorToolId>) {
      if (!isEnabledEditorToolId(action.payload)) {
        return;
      }

      if (action.payload === "ai") {
        state.ui.editorMode = "ai";
        return;
      }

      if (!isTimelineEditorToolId(action.payload)) {
        return;
      }

      state.ui.activeToolId = action.payload;
      state.ui.editorMode = "manual";
      state.ui.toastMessage = "Tool selected";
    },
    snappingToggled(state) {
      state.ui.snappingEnabled = !state.ui.snappingEnabled;
      state.ui.toastMessage = state.ui.snappingEnabled ? "Snapping enabled" : "Snapping disabled";
    },
    clipsLinkedToggled(state) {
      state.ui.clipsLinked = !state.ui.clipsLinked;
      state.ui.toastMessage = state.ui.clipsLinked ? "Clips linked" : "Clip linking disabled";
    },
    modalOpened(state, action: PayloadAction<Exclude<ActiveModal, null>>) {
      state.ui.activeModal = action.payload;
      state.ui.activePopover = null;
    },
    modalClosed(state) {
      state.ui.activeModal = null;
    },
    popoverToggled(state, action: PayloadAction<Exclude<ActivePopover, null>>) {
      state.ui.activePopover = state.ui.activePopover === action.payload ? null : action.payload;
      state.ui.activeModal = null;
    },
    popoverClosed(state) {
      state.ui.activePopover = null;
    },
    toastShown(state, action: PayloadAction<string>) {
      state.ui.toastMessage = action.payload;
    },
    toastCleared(state) {
      state.ui.toastMessage = null;
    },
    searchQueryChanged(state, action: PayloadAction<string>) {
      state.ui.searchQuery = action.payload;
    },
    commandInputChanged(state, action: PayloadAction<string>) {
      state.ui.commandInput = action.payload;
    },
    assistantMessageAdded(state, action: PayloadAction<MockAssistantMessage>) {
      state.assistantMessages.push(action.payload);
    },
    assistantSuggestionChosen(state, action: PayloadAction<string>) {
      state.ui.commandInput = action.payload;
      state.ui.toastMessage = "Suggestion loaded";
    },
    assistantActionResolved(state, action: PayloadAction<string>) {
      state.ui.toastMessage = `Assistant action: ${action.payload}`;
      state.assistantMessages.push({
        id: `assistant-action-${Date.now()}`,
        role: "assistant",
        text: `${action.payload} selected. I updated the mock edit plan so you can review the result.`,
      });
    },
    shotSelected(state, action: PayloadAction<string | null>) {
      const shotId = action.payload;
      const item = shotId && state.document ? findItemByShotId(state.document, shotId) : undefined;
      state.selection.selectedItemIds = item ? [item.id] : [];
      state.selection.activeItemId = item?.id;
    },
  },
});

export const {
  editorLoadStarted,
  editorDocumentLoaded,
  editorLoadFailed,
  editorServerChangedDetected,
  editorConflictResolved,
  projectOpened,
  documentLoaded,
  videoOperationApplied,
  mediaAssetAddedToTimeline,
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
  timelineItemsSelected,
  timelineSelectionCleared,
  timelineZoomChanged,
  timelineScrollChanged,
  trackSoloToggled,
  playbackToggled,
  playbackPaused,
  playbackStepChanged,
  playbackFrameStepped,
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
} = editorSlice.actions;

export const editorReducer = editorSlice.reducer;

export const selectEditorState = (state: RootEditorState) => state.editor;
export const selectVideoDocument = (state: RootEditorState) => state.editor.document;
const selectEditorUi = (state: RootEditorState) => state.editor.ui;
const selectEditorSelection = (state: RootEditorState) => state.editor.selection;
const selectLastSavedRevision = (state: RootEditorState) => state.editor.lastSavedRevision;
const selectAssistantMessages = (state: RootEditorState) => state.editor.assistantMessages;
export const selectDocumentStatus = (state: RootEditorState) => state.editor.documentStatus;
export const selectSyncStatus = (state: RootEditorState) => state.editor.syncStatus;
export const selectEditorConflict = (state: RootEditorState) => state.editor.conflict;
export const selectEditorMode = (state: RootEditorState) => state.editor.ui.editorMode;
export const selectTimelineZoom = (state: RootEditorState) => state.editor.ui.timelineZoom;
export const selectPlaybackState = (state: RootEditorState) => state.editor.playback;
export const selectCurrentTimeSeconds = (state: RootEditorState) => state.editor.playback.currentTime;
export const selectSelectedItemIds = (state: RootEditorState) => state.editor.selection.selectedItemIds;
export const selectVideoTracks = (state: RootEditorState) => state.editor.document?.tracks ?? [];
export const selectVideoMediaReferences = (state: RootEditorState) => state.editor.document?.media ?? {};
export const selectIsDirty = createSelector(
  [selectVideoDocument, selectLastSavedRevision],
  (document, lastSavedRevision) =>
    document !== null && document.history.revision !== (lastSavedRevision ?? document.history.revision),
);
export const selectTimelinePanelState = createSelector([selectEditorUi], (ui) => ({
  open: ui.timelineOpen,
  height: ui.timelineHeight,
  zoom: ui.timelineZoom,
  scrollLeft: ui.timelineScrollLeft,
  scrollTop: ui.timelineScrollTop,
  snappingEnabled: ui.snappingEnabled,
  clipsLinked: ui.clipsLinked,
  soloedAudioTrackIds: ui.soloedAudioTrackIds,
}));
export const selectLibraryPanelState = createSelector([selectEditorUi], (ui) => ({
  open: ui.libraryOpen,
  width: ui.libraryWidth,
  activeTab: ui.activeLibraryTab,
  selectedMediaId: ui.selectedMediaId,
  searchQuery: ui.searchQuery,
}));
export const selectChromeState = createSelector([selectEditorUi], (ui) => ({
  editorMode: ui.editorMode,
  searchQuery: ui.searchQuery,
  timelineOpen: ui.timelineOpen,
  libraryOpen: ui.libraryOpen,
}));
export const selectEditorSyncChromeState = createSelector([selectEditorState], (editor) => ({
  syncStatus: editor.syncStatus,
  loadSource: editor.loadSource,
  pendingSyncCount: editor.pendingSyncCount,
  conflict: editor.conflict,
}));
export const selectOverlayState = createSelector([selectEditorUi], (ui) => ({
  toastMessage: ui.toastMessage,
  activeModal: ui.activeModal,
  activePopover: ui.activePopover,
}));
export const selectAssistantState = createSelector(
  [selectEditorUi, selectAssistantMessages],
  (ui, messages) => ({
    commandInput: ui.commandInput,
    messages,
  }),
);
export const selectActiveToolId = (state: RootEditorState) => state.editor.ui.activeToolId;
export const selectToolRailState = createSelector([selectEditorUi], (ui) => ({
  activeToolId: ui.activeToolId,
  editorMode: ui.editorMode,
  tools: editorToolDefinitions.map((tool) => ({
    ...tool,
    active: tool.id === "ai" ? ui.editorMode === "ai" : ui.editorMode === "manual" && ui.activeToolId === tool.id,
    disabled: tool.availability === "disabled",
  })),
}));
export const selectSelectedMediaReference = createSelector(
  [selectVideoDocument, selectEditorUi],
  (document, ui) => (ui.selectedMediaId && document ? document.media[ui.selectedMediaId] : undefined),
);
export const selectSelectedTimelineItem = createSelector(
  [selectVideoDocument, selectEditorSelection],
  (document, selection) =>
    selection.activeItemId && document ? findTimelineItem(document, selection.activeItemId) : undefined,
);
export const selectTimelineDuration = createSelector(
  [selectVideoDocument],
  (document) => (document ? getTimelineDuration(document) : 0),
);
export const selectProgramMonitorState = createSelector(
  [selectVideoDocument, selectPlaybackState, selectTimelineDuration, selectEditorUi],
  (document, playback, timelineDuration, ui) => ({
    document,
    playback,
    timelineDuration,
    soloedAudioTrackIds: ui.soloedAudioTrackIds,
  }),
);
export const selectTimelineTrackViewModels = createSelector(
  [selectVideoDocument],
  (document) => (document ? createTimelineTrackViewModels(document) : []),
);
export const selectMediaReferenceViewModels = createSelector(
  [selectVideoDocument],
  (document) => (document ? createMediaReferenceViewModels(document) : []),
);

function sanitizeSelection(
  selection: VideoEditorSelection,
  document: VideoProjectDocument,
): VideoEditorSelection {
  const itemIds = new Set(document.tracks.flatMap((track) => track.items.map((item) => item.id)));
  const trackIds = new Set(document.tracks.map((track) => track.id));
  const transitionIds = new Set(document.transitions.map((transition) => transition.id));
  const effectIds = new Set(document.effects.map((effect) => effect.id));
  const selectedItemIds = selection.selectedItemIds.filter((itemId) => itemIds.has(itemId));
  const activeItemId = selection.activeItemId && itemIds.has(selection.activeItemId)
    ? selection.activeItemId
    : selectedItemIds[0];

  return {
    selectedTrackIds: selection.selectedTrackIds.filter((trackId) => trackIds.has(trackId)),
    selectedItemIds,
    selectedTransitionIds: selection.selectedTransitionIds.filter((transitionId) => transitionIds.has(transitionId)),
    selectedEffectIds: selection.selectedEffectIds.filter((effectId) => effectIds.has(effectId)),
    activeItemId,
  };
}

function firstMediaId(document: VideoProjectDocument): string | null {
  return Object.keys(document.media)[0] ?? null;
}

function clampTime(value: number, document: VideoProjectDocument | null): number {
  const duration = document ? getTimelineDuration(document) : 300;
  return Math.min(duration, Math.max(0, value));
}

function getTimelineDuration(document: VideoProjectDocument): number {
  return document.tracks.reduce((duration, track) => {
    const trackDuration = track.items.reduce(
      (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
      0,
    );
    return Math.max(duration, trackDuration);
  }, 0);
}

function createTimelineTrackViewModels(document: VideoProjectDocument): TimelineTrackViewModel[] {
  return document.tracks.map((track) => ({
    id: track.id,
    label: track.label,
    icon: trackIcon(track.kind),
    height: track.kind === "text" ? 48 : 64,
    clips: track.items.map((item) => ({
      id: item.id,
      label: timelineItemLabel(document, item),
      start: Math.round(item.timelineStart * timelinePixelsPerSecond),
      width: Math.max(24, Math.round(item.duration * timelinePixelsPerSecond)),
      tone: timelineItemTone(item),
    })),
  }));
}

function createMediaReferenceViewModels(document: VideoProjectDocument): MediaReferenceViewModel[] {
  return Object.values(document.media).map((media) => ({
    id: media.id,
    type: media.kind === "audio" ? "audio" : media.kind === "image" ? "stills" : "clips",
    title: media.name,
    duration: media.duration === undefined ? "Still" : formatDuration(media.duration),
    icon: media.kind === "audio" ? "graphic_eq" : media.kind === "image" ? "imagesmode" : "movie",
    gradient: mediaGradient(media.kind, media.id),
  }));
}

function timelineItemTone(item: VideoTimelineItem): TimelineClipViewModel["tone"] {
  if (item.type === "audio") return "audio";
  if (item.type === "text") return "text";
  return "video";
}

function timelineItemLabel(document: VideoProjectDocument, item: VideoTimelineItem): string {
  if (item.type === "text") return item.text;

  const media = document.media[item.mediaId];
  if (!media) return item.id;

  return item.type === "audio" ? media.name.replace(/\.[^/.]+$/, "") : media.name;
}

function trackIcon(kind: string): string {
  if (kind === "audio") return "graphic_eq";
  if (kind === "text") return "subtitles";
  if (kind === "overlay") return "filter";
  return "video_camera_front";
}

function mediaGradient(kind: string, mediaId: string): string {
  if (kind === "audio") {
    return "linear-gradient(135deg, #0f2a23 0%, #1f6b56 55%, #435f51 100%)";
  }

  if (kind === "image") {
    return "linear-gradient(135deg, #3d2818 0%, #805b32 48%, #a28555 100%)";
  }

  if (mediaId.includes("city")) {
    return "linear-gradient(135deg, #11131b 0%, #30324a 54%, #6e4b7e 100%)";
  }

  if (mediaId.includes("mountain")) {
    return "linear-gradient(135deg, #15191d 0%, #3f4a52 55%, #89909a 100%)";
  }

  return "linear-gradient(135deg, #102a33 0%, #2f6c7c 55%, #9b7b4b 100%)";
}

function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function findTimelineItem(document: VideoProjectDocument, itemId: string): VideoTimelineItem | undefined {
  for (const track of document.tracks) {
    const item = track.items.find((timelineItem) => timelineItem.id === itemId);
    if (item) return item;
  }

  return undefined;
}

function findItemByShotId(document: VideoProjectDocument, shotId: string): VideoTimelineItem | undefined {
  for (const track of document.tracks) {
    const item = track.items.find(
      (timelineItem) => "shotId" in timelineItem && timelineItem.shotId === shotId,
    );
    if (item) return item;
  }

  return undefined;
}
