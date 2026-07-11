import { useCallback, useEffect, useRef } from "react";
import type { ProjectMediaDto } from "~/lib/api";

import {
  deletePendingSync,
  deleteVideoTimelineDraft,
  listPendingSync,
  persistVideoTimelineMutation,
  saveProjectSnapshot,
  saveVideoTimelineDraft,
  type CachedPendingSyncRecord,
  type EditorCacheScope,
} from "~/lib/editor/editor-cache";
import { attachProjectMediaFromBff } from "~/lib/editor/project-media-api.client";
import { flushVideoEditorPerformanceMetrics } from "~/lib/editor/video-performance.client";
import {
  createSaveVideoTimelineRequest,
  getVideoTimelineFromBff,
  saveVideoTimelineToBff,
  type VideoTimelineSyncOperationEntry,
} from "~/lib/editor/video-timeline-api.client";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
} from "~/lib/editor/editor-observability.client";
import {
  createEmptyVideoProjectDocument,
  type JsonValue,
  type VideoProjectDocument,
} from "~/lib/editor/video-document";
import { useAppDispatch } from "~/store/hooks";
import {
  editorBackendSyncFailed,
  editorBackendSyncStarted,
  editorBackendSyncSucceeded,
  editorConflictResolved,
  editorDocumentLoaded,
  editorLocalMutationPersisted,
  editorLocalSaveFailed,
  editorServerChangedDetected,
  editorSyncBaseUpdated,
  hasUnsyncedEditorChanges,
  type EditorState,
  type VideoEditorHistoryFrame,
} from "~/store/slices/editor-slice";

interface UseVideoAutosaveInput {
  projectId: string;
  projectName: string;
  cacheScope: EditorCacheScope;
  editor: EditorState;
  attachedProjectMediaIds?: readonly string[];
  onProjectMediaAttached?: (media: ProjectMediaDto[]) => void;
}

export type VideoSyncResult =
  | { status: "success"; timelineId: string; revisionNumber: number }
  | { status: "conflict"; message: string }
  | { status: "failure"; message: string };

export type VideoExportFlushResult = VideoSyncResult;

const videoTimelineAutosaveIntervalMs = 15 * 60 * 1000;

export function useVideoAutosave({
  projectId,
  projectName,
  cacheScope,
  editor,
  attachedProjectMediaIds = [],
  onProjectMediaAttached,
}: UseVideoAutosaveInput) {
  const dispatch = useAppDispatch();
  const latestEditor = useRef(editor);
  const persistedDocumentRevision = useRef<number | null>(null);
  const persistedHistoryMutationCount = useRef<number | null>(null);
  const localWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<number | null>(null);
  const autosaveDeadlineConsumed = useRef(false);
  const syncInFlight = useRef<Promise<VideoSyncResult> | null>(null);
  const syncNowRef = useRef<() => Promise<VideoSyncResult>>(async () => ({
    status: "failure",
    message: "Video document is not loaded.",
  }));
  const attachedProjectMediaIdsRef = useRef(new Set(attachedProjectMediaIds));

  const flushLocalDraft = useCallback(async () => {
    await localWriteQueue.current.catch(() => undefined);
    const current = latestEditor.current;
    if (!current.document || current.projectId !== projectId) return;
    if (
      persistedDocumentRevision.current === current.document.history.revision &&
      persistedHistoryMutationCount.current === current.historyMutationCount
    ) return;

    const persisted = await persistVideoTimelineMutation({
      document: current.document,
      scope: cacheScope,
      draftOptions: {
        serverRevisionNumber: current.serverRevisionNumber ?? undefined,
        lastSyncedAt: current.lastSyncedAt,
        syncError: current.syncError,
      },
      operation: {
        entityId: `revision:${current.document.history.revision}:flush:${current.historyMutationCount}`,
        metadata: {
          localRevision: current.document.history.revision,
          historyMutationCount: current.historyMutationCount,
        },
      },
    });
    if (!persisted.ok) {
      const message = persisted.error ?? "Local timeline draft could not be saved.";
      const pending = await listPendingSync(cacheScope, projectId);
      dispatch(editorLocalSaveFailed({
        error: message,
        pendingSyncCount: pending.ok ? pending.value.length : undefined,
      }));
      throw new Error(message);
    }
    persistedDocumentRevision.current = current.document.history.revision;
    persistedHistoryMutationCount.current = current.historyMutationCount;
    const pending = await listPendingSync(cacheScope, projectId);
    dispatch(editorLocalMutationPersisted({
      documentRevision: current.document.history.revision,
      pendingSyncCount: pending.ok ? pending.value.length : current.pendingSyncCount,
    }));
  }, [cacheScope, dispatch, projectId]);

  const syncPending = useCallback(async (
    document: VideoProjectDocument,
    baseRevisionNumber: number,
    capturedHistoryMutationCount: number,
  ): Promise<VideoSyncResult> => {
    const pending = await listPendingSync(cacheScope, projectId);
    if (!pending.ok) return { status: "failure", message: "Pending timeline changes could not be read." };
    const includedPending = pending.value;
    const timelinePending = includedPending.filter((entry) => entry.kind === "timelineDraft");
    const attachmentPending = includedPending.filter((entry) => entry.kind === "projectMediaAttach");
    const operations = timelinePending
      .map(operationEntryFromPending)
      .filter((entry): entry is VideoTimelineSyncOperationEntry => entry !== null)
      .reverse();
    const correlationId = createEditorCorrelationId("autosave");

    dispatch(editorBackendSyncStarted());
    try {
      const confirmedAttachmentRecords = attachmentPending.filter((entry) =>
        mediaIdFromPending(entry).some((mediaId) => attachedProjectMediaIdsRef.current.has(mediaId))
      );
      if (confirmedAttachmentRecords.length > 0) {
        await Promise.all(confirmedAttachmentRecords.map((entry) => deletePendingSync(entry.id)));
      }
      const pendingAttachmentRecords = attachmentPending.filter((entry) => !confirmedAttachmentRecords.includes(entry));
      const mediaIds = Array.from(new Set(pendingAttachmentRecords.flatMap(mediaIdFromPending)));
      if (mediaIds.length > 0) {
        const attached = await attachProjectMediaFromBff(projectId, mediaIds, { correlationId });
        mediaIds.forEach((mediaId) => attachedProjectMediaIdsRef.current.add(mediaId));
        await Promise.all(pendingAttachmentRecords.map((entry) => deletePendingSync(entry.id)));
        onProjectMediaAttached?.(attached);
      }

      const result = await saveVideoTimelineToBff(
        projectId,
        createSaveVideoTimelineRequest({
          document,
          operations,
          baseRevisionNumber,
          source: operations.at(-1)?.source ?? "manual",
          label: operations.at(-1)?.label ?? "Timeline autosave",
        }),
        "Video timeline sync failed.",
        {
          correlationId,
          pendingCount: timelinePending.length,
          timelineId: latestEditor.current.serverTimelineId,
        },
      );

      if (!result.ok) {
        const latestResult = await getVideoTimelineFromBff(projectId, { correlationId });
        const latestServer = latestResult.status === "found" ? latestResult.timeline : null;
        if (latestServer) {
          dispatch(editorSyncBaseUpdated({
            revisionNumber: latestServer.revisionNumber,
            timelineId: latestServer.timelineId,
            syncedAt: latestServer.updatedAt,
          }));
        }
        dispatch(editorServerChangedDetected({
          reason: "local-unsynced-server-changed",
          serverProjectUpdatedAt: latestServer?.updatedAt ?? new Date().toISOString(),
        }));
        await saveVideoTimelineDraft(document, cacheScope, {
          serverRevisionNumber: latestServer?.revisionNumber ?? baseRevisionNumber,
          lastSyncedAt: latestEditor.current.lastSyncedAt,
          hasUnsyncedChanges: true,
          syncError: result.message,
        });
        return { status: "conflict", message: result.message };
      }

      const saved = result.timeline;
      const syncedAt = saved.updatedAt ?? new Date().toISOString();
      await Promise.all(timelinePending.map((entry) => deletePendingSync(entry.id)));
      const current = latestEditor.current;
      const stable = current.document?.history.revision === document.history.revision &&
        current.historyMutationCount === capturedHistoryMutationCount;
      const remaining = await listPendingSync(cacheScope, projectId);
      const remainingCount = remaining.ok ? remaining.value.length : 0;
      const fullySynced = stable && remaining.ok && remainingCount === 0;
      await saveVideoTimelineDraft(stable ? document : current.document ?? document, cacheScope, {
        serverRevisionNumber: saved.revisionNumber,
        lastSyncedAt: syncedAt,
        hasUnsyncedChanges: !fullySynced,
        syncError: null,
      });
      await saveProjectSnapshot({
        scope: cacheScope,
        projectId,
        snapshot: toJsonValue(document),
        documentSchemaVersion: document.schemaVersion,
        revision: saved.revisionNumber,
        projectUpdatedAt: syncedAt,
      });
      dispatch(editorBackendSyncSucceeded({
        revisionNumber: saved.revisionNumber,
        savedDocumentRevision: document.history.revision,
        syncedAt,
        timelineId: saved.timelineId,
        pendingSyncCount: remainingCount,
        fullySynced,
      }));
      await flushVideoEditorPerformanceMetrics();
      if (!fullySynced) {
        return {
          status: "failure",
          message: stable
            ? "The timeline synchronized, but local pending records could not be cleared. Try again before leaving."
            : "The timeline changed while synchronization was in progress. Sync again before leaving.",
        };
      }
      return {
        status: "success",
        timelineId: saved.timelineId,
        revisionNumber: saved.revisionNumber,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video timeline sync failed.";
      logVideoEditorEvent("editor.sync.failure", {
        projectId,
        correlationId,
        pendingCount: timelinePending.length,
        baseRevisionNumber,
        timelineId: latestEditor.current.serverTimelineId,
        reason: message,
      }, "error");
      const pendingAfterFailure = await listPendingSync(cacheScope, projectId);
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: baseRevisionNumber,
        lastSyncedAt: latestEditor.current.lastSyncedAt,
        hasUnsyncedChanges: true,
        syncError: message,
      });
      dispatch(editorBackendSyncFailed({
        error: message,
        pendingSyncCount: pendingAfterFailure.ok ? pendingAfterFailure.value.length : undefined,
      }));
      return { status: "failure", message };
    }
  }, [
    cacheScope,
    dispatch,
    onProjectMediaAttached,
    projectId,
  ]);

  useEffect(() => {
    latestEditor.current = editor;
  }, [editor]);

  useEffect(() => {
    attachedProjectMediaIdsRef.current = new Set(attachedProjectMediaIds);
  }, [attachedProjectMediaIds]);

  const syncNow = useCallback(async (): Promise<VideoSyncResult> => {
    if (syncInFlight.current) return syncInFlight.current;

    const operation = (async (): Promise<VideoSyncResult> => {
      const beforeFlush = latestEditor.current;
      if (!beforeFlush.document || beforeFlush.projectId !== projectId) {
        return { status: "failure", message: "Video document is not loaded." };
      }
      if (beforeFlush.syncStatus === "server-changed") {
        return { status: "conflict", message: "Resolve the server changes before synchronizing." };
      }
      if (
        !hasUnsyncedEditorChanges(beforeFlush) &&
        beforeFlush.serverTimelineId &&
        beforeFlush.serverRevisionNumber !== null
      ) {
        return {
          status: "success",
          timelineId: beforeFlush.serverTimelineId,
          revisionNumber: beforeFlush.serverRevisionNumber,
        };
      }

      try {
        await flushLocalDraft();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local timeline draft could not be saved.";
        dispatch(editorLocalSaveFailed({ error: message }));
        return { status: "failure", message };
      }

      const current = latestEditor.current;
      const document = current.document;
      if (!document) return { status: "failure", message: "Video document is not loaded." };
      return syncPending(document, current.serverRevisionNumber ?? 0, current.historyMutationCount);
    })();

    syncInFlight.current = operation;
    try {
      return await operation;
    } finally {
      if (syncInFlight.current === operation) syncInFlight.current = null;
    }
  }, [
    dispatch,
    flushLocalDraft,
    projectId,
    syncPending,
  ]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    const unsynced = editor.projectId === projectId && hasUnsyncedEditorChanges(editor);
    if (!unsynced) {
      autosaveDeadlineConsumed.current = false;
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
      return;
    }
    if (editor.syncStatus === "server-changed" || autosaveDeadlineConsumed.current || autosaveTimer.current !== null) return;

    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      autosaveDeadlineConsumed.current = true;
      void syncNowRef.current();
    }, videoTimelineAutosaveIntervalMs);

    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    };
  }, [
    editor.projectId === projectId && hasUnsyncedEditorChanges(editor),
    editor.syncStatus === "server-changed",
    projectId,
  ]);

  useEffect(() => {
    if (!editor.document || editor.projectId !== projectId || editor.syncStatus !== "dirty") return;

    const document = editor.document;
    const frame = editor.lastHistoryFrame;
    const action = editor.lastHistoryAction;

    async function saveLocalMutation() {
      const saved = await persistVideoTimelineMutation({
        document,
        scope: cacheScope,
        draftOptions: {
          serverRevisionNumber: editor.serverRevisionNumber ?? undefined,
          lastSyncedAt: editor.lastSyncedAt,
          syncError: null,
        },
        operation: {
          entityId: frame && action
            ? `${document.history.revision}:${action}:${frame.id}`
            : `${document.history.revision}:mutation`,
          operationBatchId: frame?.batch.id,
          metadata: {
            localRevision: document.history.revision,
            action: action ?? "edit",
            operation: toJsonValue(frame && action
              ? operationEntryFromFrame(frame, action)
              : genericOperationEntry(document)),
          },
        },
        projectMediaIds: frame ? projectMediaIdsFromFrame(frame) : [],
      });
      if (!saved.ok) throw new Error("Local timeline mutation could not be saved.");
      persistedDocumentRevision.current = document.history.revision;
      persistedHistoryMutationCount.current = editor.historyMutationCount;
      const pending = await listPendingSync(cacheScope, projectId);
      dispatch(editorLocalMutationPersisted({
        documentRevision: document.history.revision,
        pendingSyncCount: pending.ok ? pending.value.length : editor.pendingSyncCount,
      }));
    }

    const queuedWrite = localWriteQueue.current.catch(() => undefined).then(saveLocalMutation);
    localWriteQueue.current = queuedWrite;
    void queuedWrite.catch((error: unknown) => {
      void listPendingSync(cacheScope, projectId).then((pending) => {
        dispatch(editorLocalSaveFailed({
          error: error instanceof Error ? error.message : "Local timeline draft could not be saved.",
          pendingSyncCount: pending.ok ? pending.value.length : undefined,
        }));
      });
    });
  }, [
    cacheScope,
    dispatch,
    editor.document,
    editor.historyMutationCount,
    editor.lastHistoryAction,
    editor.lastHistoryFrame,
    editor.lastSyncedAt,
    editor.pendingSyncCount,
    editor.projectId,
    editor.serverRevisionNumber,
    editor.syncStatus,
    projectId,
  ]);

  const keepLocalEdits = useCallback(async () => {
    if (!editor.document) return;
    const latestResult = await getVideoTimelineFromBff(projectId, {
      correlationId: createEditorCorrelationId("conflict-keep-local"),
    });
    const latestServer = latestResult.status === "found" ? latestResult.timeline : null;
    if (latestServer) {
      dispatch(editorSyncBaseUpdated({
        revisionNumber: latestServer.revisionNumber,
        timelineId: latestServer.timelineId,
        syncedAt: latestServer.updatedAt,
      }));
    }
    dispatch(editorConflictResolved({ resolution: "keep-local" }));
    await flushLocalDraft();
    if (latestServer) {
      await saveVideoTimelineDraft(editor.document, cacheScope, {
        serverRevisionNumber: latestServer.revisionNumber,
        lastSyncedAt: latestServer.updatedAt,
        hasUnsyncedChanges: true,
        syncError: null,
      });
    }
  }, [cacheScope, dispatch, editor.document, flushLocalDraft, projectId]);

  const reloadServerCopy = useCallback(async () => {
    const currentDocument = editor.document;
    const hasLocalChanges = Boolean(
      currentDocument &&
      (
        editor.pendingSyncCount > 0 ||
        editor.syncStatus === "dirty" ||
        editor.syncStatus === "saved-local" ||
        editor.syncStatus === "sync-failed" ||
        editor.syncStatus === "server-changed" ||
        currentDocument.history.revision !== editor.lastSavedRevision
      ),
    );

    try {
      if (currentDocument && hasLocalChanges) {
        await saveVideoTimelineDraft(currentDocument, cacheScope, {
          serverRevisionNumber: editor.serverRevisionNumber ?? undefined,
          lastSyncedAt: editor.lastSyncedAt,
          hasUnsyncedChanges: true,
          syncError: editor.syncError,
        });
      }

      const serverResult = await getVideoTimelineFromBff(projectId);
      if (serverResult.status === "unavailable") throw new Error(serverResult.message);
      dispatch(editorConflictResolved({ resolution: "reload-server" }));

      if (serverResult.status === "not-found") {
        dispatch(editorDocumentLoaded({
          document: createEmptyVideoProjectDocument({ id: projectId, name: projectName }),
          source: "empty",
          syncStatus: "clean",
          pendingSyncCount: 0,
          conflict: null,
          serverTimelineId: null,
          serverRevisionNumber: null,
          lastSyncedAt: null,
        }));
        await clearLocalTimelineDraftAfterServerReload(cacheScope, projectId).catch(() => undefined);
        return;
      }

      const server = serverResult.timeline;

      dispatch(editorDocumentLoaded({
        document: server.document,
        source: "server",
        syncStatus: "clean",
        pendingSyncCount: 0,
        conflict: null,
        serverTimelineId: server.timelineId,
        serverRevisionNumber: server.revisionNumber,
        lastSyncedAt: server.updatedAt,
      }));
      await clearLocalTimelineDraftAfterServerReload(cacheScope, projectId).catch(() => undefined);
    } catch (error) {
      dispatch(editorBackendSyncFailed({
        error: error instanceof Error ? error.message : "Server copy could not be reloaded.",
      }));
    }
  }, [
    cacheScope,
    dispatch,
    editor.document,
    editor.lastSavedRevision,
    editor.lastSyncedAt,
    editor.pendingSyncCount,
    editor.serverRevisionNumber,
    editor.syncError,
    editor.syncStatus,
    projectId,
    projectName,
  ]);

  const retryNow = useCallback(() => {
    void syncNow();
  }, [syncNow]);

  const flushForExport = useCallback(async (): Promise<VideoExportFlushResult> => {
    if (!editor.document) {
      return { status: "failure", message: "Video document is not loaded." };
    }

    if (editor.syncStatus === "server-changed") {
      return { status: "conflict", message: "Resolve the server changes before exporting." };
    }

    if (!hasUnsyncedEditorChanges(editor) && editor.serverRevisionNumber !== null) {
      if (editor.serverTimelineId) {
        return {
          status: "success",
          timelineId: editor.serverTimelineId,
          revisionNumber: editor.serverRevisionNumber,
        };
      }

      try {
        const latestResult = await getVideoTimelineFromBff(projectId, {
          correlationId: createEditorCorrelationId("export-sync-check"),
        });
        if (latestResult.status === "found") {
          const latest = latestResult.timeline;
          return {
            status: "success",
            timelineId: latest.timelineId,
            revisionNumber: latest.revisionNumber,
          };
        }
      } catch {
        return {
          status: "failure",
          message: "Could not confirm the server timeline before export.",
        };
      }
    }

    return syncNow();
  }, [
    editor,
    projectId,
    syncNow,
  ]);

  return { flushForExport, flushLocalDraft, keepLocalEdits, reloadServerCopy, retryNow, syncNow };
}

async function clearLocalTimelineDraftAfterServerReload(
  cacheScope: EditorCacheScope,
  projectId: string,
): Promise<void> {
  await deleteVideoTimelineDraft(cacheScope, projectId);
  const pending = await listPendingSync(cacheScope, projectId);
  if (pending.ok) {
    await Promise.all(pending.value.map((entry) => deletePendingSync(entry.id)));
  }
}

function operationEntryFromFrame(
  frame: VideoEditorHistoryFrame,
  action: "edit" | "undo" | "redo",
): VideoTimelineSyncOperationEntry {
  return {
    id: `${action}:${frame.id}`,
    type: action,
    label: action === "edit" ? frame.label : action === "undo" ? `Undo ${frame.label}` : `Redo ${frame.label}`,
    source: frame.source,
    createdAt: new Date().toISOString(),
    revision: frame.historyEntry.revision,
    operationIds: frame.operationIds,
  };
}

function genericOperationEntry(document: VideoProjectDocument): VideoTimelineSyncOperationEntry {
  return {
    id: `edit:revision:${document.history.revision}`,
    type: "edit",
    label: "Timeline edit",
    source: "manual",
    createdAt: document.updatedAt,
    revision: document.history.revision,
  };
}

function operationEntryFromPending(record: CachedPendingSyncRecord): VideoTimelineSyncOperationEntry | null {
  const metadata = record.metadata && typeof record.metadata === "object"
    ? record.metadata as Record<string, unknown>
    : {};
  const operation = metadata.operation && typeof metadata.operation === "object"
    ? operationMetadata(metadata.operation as Record<string, unknown>)
    : null;

  if (operation) return operation;

  return {
    id: record.operationBatchId ?? record.entityId ?? record.id,
    type: "timelineDraft",
    label: "Timeline autosave",
    source: "manual",
    createdAt: record.queuedAt,
    revision: typeof metadata.localRevision === "number" ? metadata.localRevision : undefined,
  };
}

function operationMetadata(value: Record<string, unknown>): VideoTimelineSyncOperationEntry {
  return {
    id: String(value.id ?? crypto.randomUUID()),
    type: String(value.type ?? "timelineDraft"),
    label: String(value.label ?? "Timeline autosave"),
    source: String(value.source ?? "manual"),
    createdAt: String(value.createdAt ?? new Date().toISOString()),
    revision: typeof value.revision === "number" ? value.revision : undefined,
    operationIds: Array.isArray(value.operationIds)
      ? value.operationIds.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function projectMediaIdsFromFrame(frame: VideoEditorHistoryFrame): string[] {
  return frame.batch.operations.flatMap((operation) => {
    if (operation.type !== "addMediaToTimeline" && operation.type !== "addAudioItem") return [];
    return typeof operation.item.mediaId === "string" ? [operation.item.mediaId] : [];
  });
}

function mediaIdFromPending(record: CachedPendingSyncRecord): string[] {
  if (record.entityId) return [record.entityId];
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) return [];
  const mediaId = (record.metadata as Record<string, unknown>).mediaId;
  return typeof mediaId === "string" ? [mediaId] : [];
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
