import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  createMockVideoProjectDocument,
  type VideoEditorSelection,
  type VideoMediaReference,
  type VideoPlaybackState,
  type VideoProjectDocument,
  type VideoTimelineItem,
  type VideoTrack,
  type VideoTransition,
  validateVideoProjectDocument,
} from "~/lib/editor/video-document";
import { stepPreviewTime } from "~/lib/editor/editor-preview";
import type {
  EditorLoadConflict,
  EditorLoadDocumentSource,
  EditorLoadSyncStatus,
} from "~/lib/editor/editor-load";
import {
  buildAddTextItemOperation,
  buildDuplicateTextOperations,
  type TextPreset,
} from "~/lib/editor/editor-text";
import {
  applyVideoOperationBatch,
  createVideoOperationBatch,
  type VideoHistoryEntry,
  type VideoOperation,
  type VideoOperationApplyResult,
  type VideoOperationBatch,
  type VideoOperationUndoPayload,
} from "~/lib/editor/video-operations";
import {
  buildAddRetrievedShotToTimelineOperation,
  buildAddMediaToTimelineOperation,
  mediaDtoToVideoMediaReference,
} from "~/lib/editor/editor-media";
import type { MediaDto, ProjectMediaDto } from "~/lib/api";
import type {
  VideoEditorShotSearchResult,
  VideoRetrievalModality,
  VideoRetrievalStatus,
} from "~/lib/editor/video-retrieval";
import {
  editorToolDefinitions,
  isEnabledEditorToolId,
  isTimelineEditorToolId,
  type EditorToolId,
  type TimelineEditorToolId,
} from "~/lib/editor/editor-tools";
import type { CachedCommandHistoryRecord } from "~/lib/editor/editor-cache";
import type { VideoAiCommandStatus } from "~/lib/editor/video-ai-command-planner";
import type { VideoAiCommandSuggestion } from "~/lib/editor/video-ai-command-suggestions";

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

export type ProjectMediaAvailabilityState = Pick<
  ProjectMediaDto,
  "mediaId" | "kind" | "availability" | "filename" | "status" | "shotCount"
>;

export type SemanticMediaReadinessStatus = "ready" | "processing" | "failed" | "unavailable";

export interface SemanticMediaReadiness {
  mediaId: string;
  status: SemanticMediaReadinessStatus;
  ready: boolean;
  shotCount: number | null;
  reason: string;
}

export interface SemanticShotReference {
  shotId: string;
  mediaId: string;
  startSeconds: number;
  endSeconds: number;
  existingItemId?: string;
}

export type InspectorSubject =
  | {
      kind: "item";
      item: VideoTimelineItem;
      track: VideoTrack;
      media?: VideoMediaReference;
      selectedCount: number;
      linkedAudioItems: Array<{ item: Extract<VideoTimelineItem, { type: "audio" }>; track: VideoTrack }>;
    }
  | {
      kind: "transition";
      transition: VideoTransition;
      selectedCount: number;
    }
  | {
      kind: "project";
      document: VideoProjectDocument | null;
      selectedCount: number;
    };

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

export interface VideoEditorHistoryFrame {
  id: string;
  historyEntry: VideoHistoryEntry;
  beforeDocument: VideoProjectDocument;
  afterDocument: VideoProjectDocument;
  affectedEntityIds: string[];
  label: string;
  source: VideoHistoryEntry["source"];
  timestamp: string;
  operationIds: string[];
  undo: VideoOperationUndoPayload;
  batch: VideoOperationBatch;
  result: VideoOperationApplyResult;
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
  serverTimelineId: string | null;
  serverRevisionNumber: number | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  lastError: string | null;
  loadedRevision: number | null;
  lastSavedRevision: number | null;
  lastAppliedOperationIds: string[];
  undoStack: VideoEditorHistoryFrame[];
  redoStack: VideoEditorHistoryFrame[];
  lastHistoryFrame: VideoEditorHistoryFrame | null;
  lastHistoryAction: "edit" | "undo" | "redo" | null;
  historyMutationCount: number;
  selection: VideoEditorSelection;
  playback: VideoPlaybackState;
  ui: EditorUiSessionState;
  assistantMessages: MockAssistantMessage[];
  aiCommandStatus: VideoAiCommandStatus;
  aiCommandError: string | null;
  aiLastSummary: string | null;
  aiLastWarnings: string[];
  aiSuggestions: VideoAiCommandSuggestion[];
  aiAutocompleteOpen: boolean;
  aiActiveSuggestionIndex: number;
  semanticSearchStatus: VideoRetrievalStatus;
  semanticSearchQuery: string;
  semanticSearchModalities: VideoRetrievalModality[];
  semanticSearchResults: VideoEditorShotSearchResult[];
  semanticSearchWarnings: string[];
  semanticSearchError: string | null;
  selectedSemanticReference: SemanticShotReference | null;
  semanticReadinessByMediaId: Record<string, SemanticMediaReadiness>;
  recentCommandHistory: CachedCommandHistoryRecord[];
  projectMediaById: Record<string, ProjectMediaAvailabilityState>;
}

type ProjectOpenedPayload = string | { projectId: string; projectName?: string };
type EditorDocumentLoadedPayload = {
  document: VideoProjectDocument;
  source: EditorLoadDocumentSource;
  syncStatus: EditorLoadSyncStatus;
  pendingSyncCount?: number;
  conflict?: EditorLoadConflict | null;
  serverRevisionNumber?: number | null;
  serverTimelineId?: string | null;
  lastSyncedAt?: string | null;
  warnings?: string[];
};
type TextItemCreatedPayload = {
  preset?: TextPreset;
  trackId?: string;
  timelineStart?: number;
  text?: string;
  now?: string;
};
type SelectedTextItemsDuplicatedPayload = {
  now?: string;
  timelineOffset?: number;
};
type RootEditorState = { editor: EditorState };

const timelinePixelsPerSecond = 10;
const maxVideoHistoryFrames = 50;

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
  serverTimelineId: null,
  serverRevisionNumber: null,
  lastSyncedAt: null,
  syncError: null,
  lastError: null,
  loadedRevision: null,
  lastSavedRevision: null,
  lastAppliedOperationIds: [],
  undoStack: [],
  redoStack: [],
  lastHistoryFrame: null,
  lastHistoryAction: null,
  historyMutationCount: 0,
  selection: initialSelection,
  playback: initialPlayback,
  ui: initialUi,
  assistantMessages: [],
  aiCommandStatus: "idle",
  aiCommandError: null,
  aiLastSummary: null,
  aiLastWarnings: [],
  aiSuggestions: [],
  aiAutocompleteOpen: false,
  aiActiveSuggestionIndex: -1,
  semanticSearchStatus: "idle",
  semanticSearchQuery: "",
  semanticSearchModalities: ["transcript", "ocr"],
  semanticSearchResults: [],
  semanticSearchWarnings: [],
  semanticSearchError: null,
  selectedSemanticReference: null,
  semanticReadinessByMediaId: {},
  recentCommandHistory: [],
  projectMediaById: {},
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
      state.serverTimelineId = null;
      state.serverRevisionNumber = null;
      state.syncError = null;
      state.lastError = null;
      state.lastAppliedOperationIds = [];
      state.projectMediaById = {};
      state.semanticReadinessByMediaId = {};
      resetSemanticSearchState(state);
      resetVideoHistoryState(state);
      resetAiCommandState(state);
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

      state.document = withDocumentHistoryAvailability(validation.document, false, false);
      state.projectId = validation.document.projectId;
      state.documentStatus = "ready";
      state.syncStatus = action.payload.syncStatus;
      state.loadSource = action.payload.source;
      state.pendingSyncCount = action.payload.pendingSyncCount ?? 0;
      state.conflict = action.payload.conflict ?? null;
      state.serverTimelineId = action.payload.serverTimelineId ?? null;
      state.serverRevisionNumber = action.payload.serverRevisionNumber ?? null;
      state.lastSyncedAt = action.payload.lastSyncedAt ?? null;
      state.syncError = null;
      state.lastError = action.payload.warnings?.join(" ") || null;
      state.loadedRevision = validation.document.history.revision;
      state.lastSavedRevision = validation.document.history.revision;
      state.lastAppliedOperationIds = [];
      resetVideoHistoryState(state);
      resetAiCommandState(state);
      resetSemanticSearchState(state);
      state.selection = sanitizeSelection(state.selection, state.document);
      state.playback.currentTime = clampTime(state.playback.currentTime, state.document);
      state.ui.selectedMediaId = state.ui.selectedMediaId ?? firstMediaId(state.document);
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
      state.syncError = action.payload.message;
      state.ui.toastMessage = "Editor load failed";
    },
    projectMediaAvailabilityLoaded(state, action: PayloadAction<ProjectMediaDto[]>) {
      state.projectMediaById = mergeProjectMediaAvailability(state.projectMediaById, action.payload);
      state.semanticReadinessByMediaId = mergeSemanticReadiness(state.semanticReadinessByMediaId, action.payload);
    },
    editorBackendSyncStarted(state) {
      if (state.syncStatus !== "server-changed") {
        state.syncStatus = "syncing";
      }
      state.syncError = null;
    },
    editorBackendSyncSucceeded(
      state,
      action: PayloadAction<{ revisionNumber: number; syncedAt: string; pendingSyncCount?: number; timelineId?: string | null }>,
    ) {
      state.serverTimelineId = action.payload.timelineId ?? state.serverTimelineId;
      state.serverRevisionNumber = action.payload.revisionNumber;
      state.lastSyncedAt = action.payload.syncedAt;
      state.lastSavedRevision = state.document?.history.revision ?? state.lastSavedRevision;
      state.pendingSyncCount = action.payload.pendingSyncCount ?? 0;
      state.syncStatus = "synced";
      state.syncError = null;
      state.conflict = null;
      state.ui.toastMessage = "Timeline synced";
    },
    editorBackendSyncFailed(state, action: PayloadAction<{ error: string; pendingSyncCount?: number }>) {
      state.syncStatus = "sync-failed";
      state.syncError = action.payload.error;
      state.lastError = action.payload.error;
      state.pendingSyncCount = action.payload.pendingSyncCount ?? state.pendingSyncCount;
      state.ui.toastMessage = "Timeline sync failed";
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
      state.syncError = null;
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
      state.serverTimelineId = null;
      state.serverRevisionNumber = null;
      state.lastSyncedAt = null;
      state.syncError = null;
      state.lastError = null;
      state.loadedRevision = document.history.revision;
      state.lastSavedRevision = document.history.revision;
      state.lastAppliedOperationIds = [];
      resetVideoHistoryState(state);
      resetAiCommandState(state);
      resetSemanticSearchState(state);
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

      state.document = withDocumentHistoryAvailability(validation.document, false, false);
      state.projectId = validation.document.projectId;
      state.documentStatus = "ready";
      state.syncStatus = "clean";
      state.loadSource = "draft";
      state.pendingSyncCount = 0;
      state.conflict = null;
      state.serverTimelineId = null;
      state.serverRevisionNumber = null;
      state.lastSyncedAt = null;
      state.syncError = null;
      state.lastError = null;
      state.loadedRevision = validation.document.history.revision;
      state.lastSavedRevision = validation.document.history.revision;
      state.lastAppliedOperationIds = [];
      resetVideoHistoryState(state);
      resetAiCommandState(state);
      resetSemanticSearchState(state);
      state.selection = sanitizeSelection(state.selection, state.document);
      state.playback.currentTime = clampTime(state.playback.currentTime, state.document);
      state.ui.selectedMediaId = state.ui.selectedMediaId ?? firstMediaId(state.document);
    },
    videoOperationApplied(state, action: PayloadAction<VideoOperation | VideoOperationBatch>) {
      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const beforeDocument = cloneJson(state.document);
      const batch = normalizeVideoOperationPayload(action.payload);
      const result = applyVideoOperationBatch(state.document, batch);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Video operation failed.";
        state.ui.toastMessage = "Edit could not be applied";
        return;
      }

      applySuccessfulVideoEdit(state, {
        beforeDocument,
        batch,
        result,
        toastMessage: result.warnings[0] ?? "Edit applied",
      });
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

      const beforeDocument = cloneJson(state.document);
      const batch = normalizeVideoOperationPayload(build.operation);
      const result = applyVideoOperationBatch(documentWithMedia, batch);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Media could not be added.";
        state.ui.toastMessage = "Media could not be added";
        return;
      }

      applySuccessfulVideoEdit(state, {
        beforeDocument,
        batch,
        result,
        toastMessage: "Media added to timeline",
        selectAfterApply: (selection) => ({
          ...selection,
          selectedItemIds: [build.operation.item.id],
          activeItemId: build.operation.item.id,
        }),
      });
      state.ui.selectedMediaId = media.id;
    },
    textItemCreated(state, action: PayloadAction<TextItemCreatedPayload | undefined>) {
      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const build = buildAddTextItemOperation({
        document: state.document,
        now: action.payload?.now ?? new Date().toISOString(),
        preset: action.payload?.preset ?? "caption",
        trackId: action.payload?.trackId,
        timelineStart: action.payload?.timelineStart ?? state.playback.currentTime,
        text: action.payload?.text,
      });

      if (!build.ok) {
        state.lastError = build.reason;
        state.ui.toastMessage = build.reason;
        return;
      }

      const beforeDocument = cloneJson(state.document);
      const batch = normalizeVideoOperationPayload(build.operation);
      const result = applyVideoOperationBatch(state.document, batch);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Text could not be added.";
        state.ui.toastMessage = "Text could not be added";
        return;
      }

      applySuccessfulVideoEdit(state, {
        beforeDocument,
        batch,
        result,
        toastMessage: "Text added to timeline",
        selectAfterApply: (selection) => ({
          ...selection,
          selectedItemIds: [build.operation.item.id],
          activeItemId: build.operation.item.id,
        }),
      });
      state.ui.editorMode = "manual";
      state.ui.activeToolId = "select";
    },
    selectedTextItemsDuplicated(state, action: PayloadAction<SelectedTextItemsDuplicatedPayload | undefined>) {
      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const build = buildDuplicateTextOperations({
        document: state.document,
        selectedItemIds: state.selection.selectedItemIds,
        now: action.payload?.now ?? new Date().toISOString(),
        timelineOffset: action.payload?.timelineOffset,
      });

      if (!build.ok) {
        state.lastError = build.reason;
        state.ui.toastMessage = build.reason;
        return;
      }

      const beforeDocument = cloneJson(state.document);
      const batch = createVideoOperationBatch({
        source: "manual",
        timestamp: action.payload?.now,
        label: "Duplicate text",
        operations: build.operations,
      });
      const result = applyVideoOperationBatch(state.document, batch);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Text could not be duplicated.";
        state.ui.toastMessage = "Text could not be duplicated";
        return;
      }

      applySuccessfulVideoEdit(state, {
        beforeDocument,
        batch,
        result,
        toastMessage: "Text duplicated",
        selectAfterApply: (selection) => ({
          ...selection,
          selectedItemIds: build.duplicateItemIds,
          activeItemId: build.duplicateItemIds[build.duplicateItemIds.length - 1],
        }),
      });
      state.ui.editorMode = "manual";
      state.ui.activeToolId = "select";
    },
    videoUndoRequested(state) {
      const frame = state.undoStack[state.undoStack.length - 1];
      if (!frame) {
        state.ui.toastMessage = "Nothing to undo";
        return;
      }

      const undoStack = state.undoStack.slice(0, -1);
      const redoStack = pushBoundedHistoryFrame(state.redoStack, frame);
      const document = withDocumentHistoryAvailability(frame.beforeDocument, undoStack.length > 0, redoStack.length > 0);

      state.document = document;
      state.documentStatus = "ready";
      state.syncStatus = "dirty";
      state.lastError = null;
      state.lastAppliedOperationIds = [`undo:${frame.id}`];
      state.undoStack = undoStack;
      state.redoStack = redoStack;
      state.lastHistoryFrame = frame;
      state.lastHistoryAction = "undo";
      state.historyMutationCount += 1;
      state.selection = sanitizeSelection(state.selection, document);
      state.playback.currentTime = clampTime(state.playback.currentTime, document);
      state.ui.toastMessage = `Undid ${frame.label}`;
    },
    videoRedoRequested(state) {
      const frame = state.redoStack[state.redoStack.length - 1];
      if (!frame) {
        state.ui.toastMessage = "Nothing to redo";
        return;
      }

      const redoStack = state.redoStack.slice(0, -1);
      const undoStack = pushBoundedHistoryFrame(state.undoStack, frame);
      const document = withDocumentHistoryAvailability(frame.afterDocument, undoStack.length > 0, redoStack.length > 0);

      state.document = document;
      state.documentStatus = "ready";
      state.syncStatus = "dirty";
      state.lastError = null;
      state.lastAppliedOperationIds = [`redo:${frame.id}`];
      state.undoStack = undoStack;
      state.redoStack = redoStack;
      state.lastHistoryFrame = frame;
      state.lastHistoryAction = "redo";
      state.historyMutationCount += 1;
      state.selection = sanitizeSelection(state.selection, document);
      state.playback.currentTime = clampTime(state.playback.currentTime, document);
      state.ui.toastMessage = `Redid ${frame.label}`;
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
      state.ui.libraryWidth = Math.min(360, Math.max(240, action.payload));
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
      state.aiActiveSuggestionIndex = -1;
    },
    aiSuggestionsLoaded(state, action: PayloadAction<VideoAiCommandSuggestion[]>) {
      state.aiSuggestions = action.payload;
      if (action.payload.length === 0) {
        state.aiActiveSuggestionIndex = -1;
      } else if (state.aiActiveSuggestionIndex >= action.payload.length) {
        state.aiActiveSuggestionIndex = action.payload.length - 1;
      }
    },
    aiAutocompleteOpened(state) {
      state.aiAutocompleteOpen = true;
    },
    aiAutocompleteClosed(state) {
      state.aiAutocompleteOpen = false;
      state.aiActiveSuggestionIndex = -1;
    },
    aiSuggestionHighlighted(state, action: PayloadAction<number>) {
      if (state.aiSuggestions.length === 0) {
        state.aiActiveSuggestionIndex = -1;
        return;
      }
      state.aiActiveSuggestionIndex = clampSuggestionIndex(action.payload, state.aiSuggestions.length);
      state.aiAutocompleteOpen = true;
    },
    aiSuggestionInserted(state, action: PayloadAction<VideoAiCommandSuggestion>) {
      state.ui.commandInput = action.payload.command;
      state.aiAutocompleteOpen = false;
      state.aiActiveSuggestionIndex = -1;
      state.ui.toastMessage = "Suggestion loaded";
    },
    aiCommandStarted(state, action: PayloadAction<{ commandId: string; prompt: string }>) {
      state.aiCommandStatus = "planning";
      state.aiCommandError = null;
      state.aiLastSummary = null;
      state.aiLastWarnings = [];
      state.aiAutocompleteOpen = false;
      state.aiActiveSuggestionIndex = -1;
      state.assistantMessages.push({
        id: `user-${action.payload.commandId}`,
        role: "user",
        text: action.payload.prompt,
      });
    },
    aiCommandApplied(
      state,
      action: PayloadAction<{
        commandId: string;
        summary: string;
        warnings?: string[];
        operationBatchId: string;
      }>,
    ) {
      state.aiCommandStatus = "applied";
      state.aiCommandError = null;
      state.aiLastSummary = action.payload.summary;
      state.aiLastWarnings = action.payload.warnings ?? [];
      state.assistantMessages.push({
        id: `assistant-${action.payload.commandId}`,
        role: "assistant",
        text: summaryWithWarnings(action.payload.summary, action.payload.warnings ?? []),
      });
      state.ui.toastMessage = "AI edit applied";
    },
    aiCommandFailed(
      state,
      action: PayloadAction<{
        commandId: string;
        prompt: string;
        error: string;
        warnings?: string[];
      }>,
    ) {
      state.aiCommandStatus = "failed";
      state.aiCommandError = action.payload.error;
      state.aiLastSummary = null;
      state.aiLastWarnings = action.payload.warnings ?? [];
      state.assistantMessages.push({
        id: `assistant-${action.payload.commandId}`,
        role: "assistant",
        text: action.payload.error,
      });
      state.ui.toastMessage = "AI command failed";
    },
    aiCommandHistoryLoaded(state, action: PayloadAction<CachedCommandHistoryRecord[]>) {
      state.recentCommandHistory = action.payload.slice(0, 20);
    },
    aiCommandHistoryEntrySaved(state, action: PayloadAction<CachedCommandHistoryRecord>) {
      state.recentCommandHistory = upsertCommandHistoryRecord(state.recentCommandHistory, action.payload).slice(0, 20);
    },
    semanticSearchStarted(
      state,
      action: PayloadAction<{ query: string; modalities?: VideoRetrievalModality[] }>,
    ) {
      state.semanticSearchStatus = "searching";
      state.semanticSearchQuery = action.payload.query;
      state.semanticSearchModalities = action.payload.modalities ?? ["transcript", "ocr"];
      state.semanticSearchError = null;
      state.semanticSearchWarnings = [];
    },
    semanticSearchSucceeded(
      state,
      action: PayloadAction<{
        query: string;
        results: VideoEditorShotSearchResult[];
        warnings?: string[];
      }>,
    ) {
      state.semanticSearchStatus = "succeeded";
      state.semanticSearchQuery = action.payload.query;
      state.semanticSearchResults = action.payload.results;
      state.semanticSearchWarnings = action.payload.warnings ?? [];
      state.semanticSearchError = null;
    },
    semanticSearchFailed(
      state,
      action: PayloadAction<{ query: string; error: string; warnings?: string[] }>,
    ) {
      state.semanticSearchStatus = "failed";
      state.semanticSearchQuery = action.payload.query;
      state.semanticSearchError = action.payload.error;
      state.semanticSearchWarnings = action.payload.warnings ?? [];
    },
    semanticReferenceSelected(state, action: PayloadAction<VideoEditorShotSearchResult | null>) {
      const result = action.payload;
      if (!result) {
        state.selectedSemanticReference = null;
        return;
      }

      const item = state.document ? findItemByShotId(state.document, result.shotId) : undefined;
      state.selectedSemanticReference = {
        shotId: result.shotId,
        mediaId: result.mediaId,
        startSeconds: result.startSeconds,
        endSeconds: result.endSeconds,
        existingItemId: item?.id,
      };
      if (item) {
        state.selection.selectedItemIds = [item.id];
        state.selection.activeItemId = item.id;
      }
    },
    semanticShotAddedToTimeline(
      state,
      action: PayloadAction<{
        result: VideoEditorShotSearchResult;
        media: MediaDto;
        canWrite?: boolean;
        trackId?: string;
        timelineStart?: number;
        now?: string;
      }>,
    ) {
      if (action.payload.canWrite === false) {
        state.ui.toastMessage = "View only: you cannot edit this timeline";
        return;
      }

      if (!state.document) {
        state.lastError = "No active video document.";
        state.ui.toastMessage = "No active video document";
        return;
      }

      const mediaReference = mediaDtoToVideoMediaReference(action.payload.media);
      const documentWithMedia = {
        ...state.document,
        media: {
          ...state.document.media,
          [mediaReference.id]: mediaReference,
        },
      };
      const build = buildAddRetrievedShotToTimelineOperation({
        document: documentWithMedia,
        result: action.payload.result,
        mediaReference,
        now: action.payload.now ?? new Date().toISOString(),
        placement: {
          trackId: action.payload.trackId,
          timelineStart: action.payload.timelineStart ?? state.playback.currentTime,
        },
      });

      if (!build.ok) {
        state.lastError = build.reason;
        state.ui.toastMessage = build.reason;
        return;
      }

      const beforeDocument = cloneJson(state.document);
      const batch = normalizeVideoOperationPayload(build.operation);
      const result = applyVideoOperationBatch(documentWithMedia, batch);

      if (!result.ok) {
        state.lastError = result.errors?.join(" ") ?? "Retrieved shot could not be added.";
        state.ui.toastMessage = "Retrieved shot could not be added";
        return;
      }

      applySuccessfulVideoEdit(state, {
        beforeDocument,
        batch,
        result,
        toastMessage: "Shot added to timeline",
        selectAfterApply: (selection) => ({
          ...selection,
          selectedItemIds: [build.operation.item.id],
          activeItemId: build.operation.item.id,
        }),
      });
      state.selectedSemanticReference = {
        shotId: action.payload.result.shotId,
        mediaId: action.payload.result.mediaId,
        startSeconds: action.payload.result.startSeconds,
        endSeconds: action.payload.result.endSeconds,
        existingItemId: build.operation.item.id,
      };
      state.ui.selectedMediaId = action.payload.media.id;
    },
    assistantMessageAdded(state, action: PayloadAction<MockAssistantMessage>) {
      state.assistantMessages.push(action.payload);
    },
    assistantSuggestionChosen(state, action: PayloadAction<string>) {
      state.ui.commandInput = action.payload;
      state.aiAutocompleteOpen = false;
      state.aiActiveSuggestionIndex = -1;
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
  projectMediaAvailabilityLoaded,
  editorBackendSyncStarted,
  editorBackendSyncSucceeded,
  editorBackendSyncFailed,
  editorServerChangedDetected,
  editorConflictResolved,
  projectOpened,
  documentLoaded,
  videoOperationApplied,
  videoUndoRequested,
  videoRedoRequested,
  mediaAssetAddedToTimeline,
  textItemCreated,
  selectedTextItemsDuplicated,
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
  aiSuggestionsLoaded,
  aiAutocompleteOpened,
  aiAutocompleteClosed,
  aiSuggestionHighlighted,
  aiSuggestionInserted,
  aiCommandStarted,
  aiCommandApplied,
  aiCommandFailed,
  aiCommandHistoryLoaded,
  aiCommandHistoryEntrySaved,
  semanticSearchStarted,
  semanticSearchSucceeded,
  semanticSearchFailed,
  semanticReferenceSelected,
  semanticShotAddedToTimeline,
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
const selectAiCommandStatus = (state: RootEditorState) => state.editor.aiCommandStatus;
const selectAiCommandError = (state: RootEditorState) => state.editor.aiCommandError;
const selectAiLastSummary = (state: RootEditorState) => state.editor.aiLastSummary;
const selectAiLastWarnings = (state: RootEditorState) => state.editor.aiLastWarnings;
const selectAiSuggestions = (state: RootEditorState) => state.editor.aiSuggestions;
const selectAiAutocompleteOpen = (state: RootEditorState) => state.editor.aiAutocompleteOpen;
const selectAiActiveSuggestionIndex = (state: RootEditorState) => state.editor.aiActiveSuggestionIndex;
const selectSemanticSearchStatus = (state: RootEditorState) => state.editor.semanticSearchStatus;
const selectSemanticSearchQuery = (state: RootEditorState) => state.editor.semanticSearchQuery;
const selectSemanticSearchResults = (state: RootEditorState) => state.editor.semanticSearchResults;
const selectSemanticSearchWarnings = (state: RootEditorState) => state.editor.semanticSearchWarnings;
const selectSemanticSearchError = (state: RootEditorState) => state.editor.semanticSearchError;
const selectSelectedSemanticReference = (state: RootEditorState) => state.editor.selectedSemanticReference;
const selectRecentCommandHistory = (state: RootEditorState) => state.editor.recentCommandHistory;
const selectUndoStack = (state: RootEditorState) => state.editor.undoStack;
const selectRedoStack = (state: RootEditorState) => state.editor.redoStack;
const selectLastHistoryFrame = (state: RootEditorState) => state.editor.lastHistoryFrame;
const selectLastHistoryAction = (state: RootEditorState) => state.editor.lastHistoryAction;
const selectHistoryMutationCount = (state: RootEditorState) => state.editor.historyMutationCount;
export const selectVideoHistoryState = createSelector(
  [
    selectUndoStack,
    selectRedoStack,
    selectLastHistoryFrame,
    selectLastHistoryAction,
    selectHistoryMutationCount,
  ],
  (undoStack, redoStack, lastHistoryFrame, lastHistoryAction, historyMutationCount) => ({
    undoStack,
    redoStack,
    lastHistoryFrame,
    lastHistoryAction,
    historyMutationCount,
  }),
);
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
export const selectProjectMediaAvailabilityById = (state: RootEditorState) => state.editor.projectMediaById;
export const selectSemanticReadinessByMediaId = (state: RootEditorState) => state.editor.semanticReadinessByMediaId;
export const selectSemanticSearchState = createSelector(
  [
    selectSemanticSearchStatus,
    selectSemanticSearchQuery,
    selectSemanticSearchResults,
    selectSemanticSearchWarnings,
    selectSemanticSearchError,
    selectSelectedSemanticReference,
    selectSemanticReadinessByMediaId,
  ],
  (
    status,
    query,
    results,
    warnings,
    error,
    selectedReference,
    readinessByMediaId,
  ) => ({
    status,
    query,
    results,
    warnings,
    error,
    selectedReference,
    readinessByMediaId,
  }),
);
export const selectCanUndo = (state: RootEditorState) => state.editor.undoStack.length > 0;
export const selectCanRedo = (state: RootEditorState) => state.editor.redoStack.length > 0;
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
  syncError: editor.syncError,
  serverRevisionNumber: editor.serverRevisionNumber,
  serverTimelineId: editor.serverTimelineId,
  lastSyncedAt: editor.lastSyncedAt,
}));
export const selectOverlayState = createSelector([selectEditorUi], (ui) => ({
  toastMessage: ui.toastMessage,
  activeModal: ui.activeModal,
  activePopover: ui.activePopover,
}));
export const selectAssistantState = createSelector(
  [
    selectEditorUi,
    selectAssistantMessages,
    selectAiCommandStatus,
    selectAiCommandError,
    selectAiLastSummary,
    selectAiLastWarnings,
    selectAiSuggestions,
    selectAiAutocompleteOpen,
    selectAiActiveSuggestionIndex,
    selectSemanticSearchState,
    selectRecentCommandHistory,
  ],
  (
    ui,
    messages,
    aiCommandStatus,
    aiCommandError,
    aiLastSummary,
    aiLastWarnings,
    aiSuggestions,
    aiAutocompleteOpen,
    aiActiveSuggestionIndex,
    semanticSearch,
    recentCommandHistory,
  ) => ({
    commandInput: ui.commandInput,
    messages,
    aiCommandStatus,
    aiCommandError,
    aiLastSummary,
    aiLastWarnings,
    aiSuggestions,
    aiAutocompleteOpen,
    aiActiveSuggestionIndex,
    semanticSearch,
    recentCommandHistory,
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
export const selectVideoInspectorState = createSelector(
  [selectVideoDocument, selectEditorSelection],
  (document, selection): InspectorSubject => {
    const selectedCount = selection.selectedItemIds.length;
    if (!document) {
      return { kind: "project", document, selectedCount };
    }

    if (selection.selectedTransitionIds.length > 0) {
      const transition = document.transitions.find((candidate) => candidate.id === selection.selectedTransitionIds[0]);
      if (transition) {
        return { kind: "transition", transition, selectedCount };
      }
    }

    if (selection.activeItemId) {
      const location = findTimelineItemLocation(document, selection.activeItemId);
      if (location) {
        const media = "mediaId" in location.item ? document.media[location.item.mediaId] : undefined;
        const linkedAudioItems = location.item.type === "video" && location.item.linkedGroupId
          ? findLinkedAudioItems(document, location.item.linkedGroupId, location.item.id)
          : [];

        return {
          kind: "item",
          item: location.item,
          track: location.track,
          media,
          selectedCount,
          linkedAudioItems,
        };
      }
    }

    return { kind: "project", document, selectedCount };
  },
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

function resetVideoHistoryState(state: EditorState): void {
  state.undoStack = [];
  state.redoStack = [];
  state.lastHistoryFrame = null;
  state.lastHistoryAction = null;
  state.historyMutationCount = 0;
}

function resetAiCommandState(state: EditorState): void {
  state.aiCommandStatus = "idle";
  state.aiCommandError = null;
  state.aiLastSummary = null;
  state.aiLastWarnings = [];
  state.aiSuggestions = [];
  state.aiAutocompleteOpen = false;
  state.aiActiveSuggestionIndex = -1;
  state.recentCommandHistory = [];
}

function resetSemanticSearchState(state: EditorState): void {
  state.semanticSearchStatus = "idle";
  state.semanticSearchQuery = "";
  state.semanticSearchModalities = ["transcript", "ocr"];
  state.semanticSearchResults = [];
  state.semanticSearchWarnings = [];
  state.semanticSearchError = null;
  state.selectedSemanticReference = null;
}

function clampSuggestionIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

function summaryWithWarnings(summary: string, warnings: string[]): string {
  return warnings.length > 0 ? `${summary} ${warnings.join(" ")}` : summary;
}

function upsertCommandHistoryRecord(
  records: CachedCommandHistoryRecord[],
  record: CachedCommandHistoryRecord,
): CachedCommandHistoryRecord[] {
  return [record, ...records.filter((candidate) => candidate.id !== record.id)]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function applySuccessfulVideoEdit(
  state: EditorState,
  input: {
    beforeDocument: VideoProjectDocument;
    batch: VideoOperationBatch;
    result: VideoOperationApplyResult;
    toastMessage: string;
    selectAfterApply?: (selection: VideoEditorSelection) => VideoEditorSelection;
  },
): void {
  if (!input.result.historyEntry || !input.result.undo) {
    state.lastError = "Video operation did not return history metadata.";
    state.ui.toastMessage = "Edit could not be applied";
    return;
  }

  const provisionalAfterDocument = cloneJson(input.result.document);
  const provisionalFrame = createHistoryFrame({
    beforeDocument: input.beforeDocument,
    afterDocument: provisionalAfterDocument,
    batch: input.batch,
    result: input.result,
    historyEntry: input.result.historyEntry,
    undo: input.result.undo,
  });
  const undoStack = pushBoundedHistoryFrame(state.undoStack, provisionalFrame);
  const afterDocument = withDocumentHistoryAvailability(provisionalAfterDocument, undoStack.length > 0, false);
  const result = {
    ...input.result,
    document: afterDocument,
  };
  const historyEntry = {
    ...input.result.historyEntry,
    revision: afterDocument.history.revision,
  };
  const frame = {
    ...provisionalFrame,
    historyEntry,
    afterDocument,
    result: {
      ...result,
      historyEntry,
    },
  };

  undoStack[undoStack.length - 1] = frame;
  state.document = afterDocument;
  state.documentStatus = "ready";
  state.syncStatus = "dirty";
  state.lastError = input.result.warnings[0] ?? null;
  state.lastAppliedOperationIds = input.result.appliedOperationIds;
  state.undoStack = undoStack;
  state.redoStack = [];
  state.lastHistoryFrame = frame;
  state.lastHistoryAction = "edit";
  state.historyMutationCount += 1;

  const sanitizedSelection = sanitizeSelection(state.selection, afterDocument);
  state.selection = input.selectAfterApply ? input.selectAfterApply(sanitizedSelection) : sanitizedSelection;
  state.playback.currentTime = clampTime(state.playback.currentTime, afterDocument);
  state.ui.toastMessage = input.toastMessage;
}

function createHistoryFrame(input: {
  beforeDocument: VideoProjectDocument;
  afterDocument: VideoProjectDocument;
  batch: VideoOperationBatch;
  result: VideoOperationApplyResult;
  historyEntry: VideoHistoryEntry;
  undo: VideoOperationUndoPayload;
}): VideoEditorHistoryFrame {
  return {
    id: input.historyEntry.id,
    historyEntry: input.historyEntry,
    beforeDocument: cloneJson(input.beforeDocument),
    afterDocument: cloneJson(input.afterDocument),
    affectedEntityIds: [...input.historyEntry.affectedEntityIds],
    label: input.historyEntry.label,
    source: input.historyEntry.source,
    timestamp: input.historyEntry.timestamp,
    operationIds: [...input.historyEntry.operationIds],
    undo: cloneJson(input.undo),
    batch: cloneJson(input.batch),
    result: cloneJson(input.result),
  };
}

function normalizeVideoOperationPayload(payload: VideoOperation | VideoOperationBatch): VideoOperationBatch {
  if ("operations" in payload) return payload;

  return createVideoOperationBatch({
    id: payload.id,
    source: payload.source,
    timestamp: payload.timestamp,
    label: payload.label,
    operations: [payload],
    affectedEntityIds: payload.affectedEntityIds,
    commandId: payload.commandId,
    forceCheckpoint: payload.forceCheckpoint,
  });
}

function pushBoundedHistoryFrame(
  stack: VideoEditorHistoryFrame[],
  frame: VideoEditorHistoryFrame,
): VideoEditorHistoryFrame[] {
  const next = [...stack, frame];
  return next.length > maxVideoHistoryFrames ? next.slice(next.length - maxVideoHistoryFrames) : next;
}

function withDocumentHistoryAvailability(
  document: VideoProjectDocument,
  canUndo: boolean,
  canRedo: boolean,
): VideoProjectDocument {
  return {
    ...cloneJson(document),
    history: {
      ...document.history,
      canUndo,
      canRedo,
    },
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeProjectMediaAvailability(
  current: Record<string, ProjectMediaAvailabilityState>,
  rows: ProjectMediaDto[],
): Record<string, ProjectMediaAvailabilityState> {
  const next = { ...current };
  for (const row of rows) {
    if (!row.mediaId) continue;
    next[row.mediaId] = {
      mediaId: row.mediaId,
      kind: row.kind,
      availability: row.availability,
      filename: row.filename,
      status: row.status,
      shotCount: row.shotCount,
    };
  }
  return next;
}

function mergeSemanticReadiness(
  current: Record<string, SemanticMediaReadiness>,
  rows: ProjectMediaDto[],
): Record<string, SemanticMediaReadiness> {
  const next = { ...current };
  for (const row of rows) {
    if (!row.mediaId) continue;
    if (row.kind !== 0) {
      delete next[row.mediaId];
      continue;
    }
    next[row.mediaId] = semanticReadinessForProjectMedia(row);
  }
  return next;
}

function semanticReadinessForProjectMedia(row: ProjectMediaDto): SemanticMediaReadiness {
  const status = (row.status ?? "").toLowerCase();
  if (row.availability !== "available") {
    return {
      mediaId: row.mediaId,
      status: row.availability === "failed" ? "failed" : "unavailable",
      ready: false,
      shotCount: row.shotCount ?? null,
      reason: "Media is not available in this project.",
    };
  }

  if (status !== "ready") {
    return {
      mediaId: row.mediaId,
      status: status === "failed" ? "failed" : "processing",
      ready: false,
      shotCount: row.shotCount ?? null,
      reason: "Video analysis is still processing.",
    };
  }

  if (row.shotCount === 0) {
    return {
      mediaId: row.mediaId,
      status: "ready",
      ready: false,
      shotCount: 0,
      reason: "No semantic shots were reported for this video.",
    };
  }

  return {
    mediaId: row.mediaId,
    status: "ready",
    ready: true,
    shotCount: row.shotCount ?? null,
    reason: row.shotCount === undefined || row.shotCount === null
      ? "Ready; shot count will update when realtime analysis reports it."
      : "Ready for semantic retrieval.",
  };
}

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
  return findTimelineItemLocation(document, itemId)?.item;
}

function findTimelineItemLocation(
  document: VideoProjectDocument,
  itemId: string,
): { track: VideoTrack; item: VideoTimelineItem } | undefined {
  for (const track of document.tracks) {
    const item = track.items.find((timelineItem) => timelineItem.id === itemId);
    if (item) return { track, item };
  }

  return undefined;
}

function findLinkedAudioItems(
  document: VideoProjectDocument,
  linkedGroupId: string,
  activeItemId: string,
): Array<{ item: Extract<VideoTimelineItem, { type: "audio" }>; track: VideoTrack }> {
  return document.tracks.flatMap((track) =>
    track.items.flatMap((item) =>
      item.id !== activeItemId && item.type === "audio" && item.linkedGroupId === linkedGroupId
        ? [{ item, track }]
        : [],
    ),
  );
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
