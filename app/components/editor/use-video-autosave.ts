import { useCallback, useEffect, useRef } from "react";

import {
  deletePendingSync,
  deleteVideoTimelineDraft,
  enqueuePendingSync,
  listPendingSync,
  saveProjectSnapshot,
  saveVideoTimelineDraft,
  type CachedPendingSyncRecord,
  type EditorCacheScope,
} from "~/lib/editor/editor-cache";
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
  editorServerChangedDetected,
  type EditorState,
  type VideoEditorHistoryFrame,
} from "~/store/slices/editor-slice";

interface UseVideoAutosaveInput {
  projectId: string;
  projectName: string;
  cacheScope: EditorCacheScope;
  editor: EditorState;
}

export type VideoExportFlushResult =
  | { ok: true; timelineId: string; revisionNumber: number }
  | { ok: false; reason: "conflict" | "sync-failed"; message: string };

const videoTimelineAutosaveIntervalMs = 15 * 60 * 1000;

export function useVideoAutosave({ projectId, projectName, cacheScope, editor }: UseVideoAutosaveInput) {
  const dispatch = useAppDispatch();
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const latestDocumentUpdatedAt = useRef<string | null>(null);
  const syncNowRef = useRef<() => Promise<void>>(async () => undefined);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const syncPending = useCallback(async (
    document: VideoProjectDocument,
    documentUpdatedAt: string,
    baseRevisionNumber: number,
    force = false,
  ) => {
    if (!force && editor.syncStatus === "server-changed") return;

    const pending = await listPendingSync(cacheScope, projectId);
    if (!pending.ok || pending.value.length === 0) {
      if (editor.syncStatus === "dirty") {
        await saveVideoTimelineDraft(document, cacheScope, {
          serverRevisionNumber: baseRevisionNumber,
          lastSyncedAt: editor.lastSyncedAt,
          hasUnsyncedChanges: true,
          syncError: null,
        });
      }
      return;
    }

    const includedPending = pending.value.filter((entry) => entry.kind === "timelineDraft");
    const operations = includedPending
      .map(operationEntryFromPending)
      .filter((entry): entry is VideoTimelineSyncOperationEntry => entry !== null)
      .reverse();
    const correlationId = createEditorCorrelationId("autosave");

    dispatch(editorBackendSyncStarted());
    try {
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
          pendingCount: includedPending.length,
          timelineId: editor.serverTimelineId,
        },
      );

      if (!result.ok) {
        const latestServer = await getVideoTimelineFromBff(projectId, { correlationId }).catch(() => null);
        dispatch(editorServerChangedDetected({
          reason: "local-unsynced-server-changed",
          serverProjectUpdatedAt: latestServer?.updatedAt ?? new Date().toISOString(),
        }));
        await saveVideoTimelineDraft(document, cacheScope, {
          serverRevisionNumber: latestServer?.revisionNumber ?? baseRevisionNumber,
          lastSyncedAt: editor.lastSyncedAt,
          hasUnsyncedChanges: true,
          syncError: result.message,
        });
        return;
      }

      clearRetryTimer();
      retryCount.current = 0;
      if (latestDocumentUpdatedAt.current !== documentUpdatedAt) return;

      const saved = result.timeline;
      const syncedAt = saved.updatedAt ?? new Date().toISOString();
      await Promise.all(includedPending.map((entry) => deletePendingSync(entry.id)));
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: saved.revisionNumber,
        lastSyncedAt: syncedAt,
        hasUnsyncedChanges: false,
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
      dispatch(editorBackendSyncSucceeded({ revisionNumber: saved.revisionNumber, syncedAt, timelineId: saved.timelineId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video timeline sync failed.";
      logVideoEditorEvent("editor.sync.failure", {
        projectId,
        correlationId,
        pendingCount: includedPending.length,
        baseRevisionNumber,
        timelineId: editor.serverTimelineId,
        reason: message,
      }, "error");
      const pendingAfterFailure = await listPendingSync(cacheScope, projectId);
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: baseRevisionNumber,
        lastSyncedAt: editor.lastSyncedAt,
        hasUnsyncedChanges: true,
        syncError: message,
      });
      dispatch(editorBackendSyncFailed({
        error: message,
        pendingSyncCount: pendingAfterFailure.ok ? pendingAfterFailure.value.length : undefined,
      }));
      clearRetryTimer();
      const delay = Math.min(30_000, 2000 * 2 ** retryCount.current);
      retryCount.current = Math.min(retryCount.current + 1, 4);
      retryTimer.current = window.setTimeout(() => {
        void syncPending(document, documentUpdatedAt, baseRevisionNumber, force);
      }, delay);
    }
  }, [
    cacheScope,
    clearRetryTimer,
    dispatch,
    editor.lastSyncedAt,
    editor.syncStatus,
    projectId,
  ]);

  useEffect(() => {
    latestDocumentUpdatedAt.current = editor.document?.updatedAt ?? null;
  }, [editor.document?.updatedAt]);

  const syncNow = useCallback(async () => {
    if (!editor.document || editor.projectId !== projectId) return;
    if (editor.syncStatus === "server-changed" || editor.syncStatus === "syncing") return;
    if (editor.syncStatus !== "dirty" && editor.syncStatus !== "saved-local" && editor.syncStatus !== "sync-failed") return;

    const document = editor.document;
    await syncPending(document, document.updatedAt, editor.serverRevisionNumber ?? 0, true);
  }, [
    editor.document,
    editor.projectId,
    editor.serverRevisionNumber,
    editor.syncStatus,
    projectId,
    syncPending,
  ]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    if (!editor.document || editor.projectId !== projectId) return;
    if (editor.syncStatus === "server-changed") return;
    if (editor.syncStatus !== "dirty" && editor.syncStatus !== "saved-local" && editor.syncStatus !== "sync-failed") return;

    const intervalId = window.setInterval(() => {
      void syncNowRef.current();
    }, videoTimelineAutosaveIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [
    editor.projectId,
    editor.syncStatus,
    projectId,
  ]);

  useEffect(() => {
    if (!editor.document || !editor.lastHistoryFrame || !editor.lastHistoryAction) return;

    const document = editor.document;
    const frame = editor.lastHistoryFrame;
    const action = editor.lastHistoryAction;

    async function saveLocalMutation() {
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: editor.serverRevisionNumber ?? undefined,
        lastSyncedAt: editor.lastSyncedAt,
        hasUnsyncedChanges: true,
        syncError: null,
      });

      await enqueuePendingSync({
        scope: cacheScope,
        projectId,
        kind: "timelineDraft",
        entityId: `${document.history.revision}:${action}:${frame.id}`,
        operationBatchId: frame.batch.id,
        metadata: {
          localRevision: document.history.revision,
          action,
          operation: toJsonValue(operationEntryFromFrame(frame, action)),
        },
      });
    }

    void saveLocalMutation().catch((error: unknown) => {
      dispatch(editorBackendSyncFailed({
        error: error instanceof Error ? error.message : "Local timeline draft could not be saved.",
      }));
    });
  }, [
    cacheScope,
    dispatch,
    editor.document,
    editor.historyMutationCount,
    editor.lastHistoryAction,
    editor.lastHistoryFrame,
    editor.lastSyncedAt,
    editor.serverRevisionNumber,
    projectId,
  ]);

  const keepLocalEdits = useCallback(async () => {
    if (!editor.document) return;
    dispatch(editorConflictResolved({ resolution: "keep-local" }));
    const correlationId = createEditorCorrelationId("conflict-keep-local");
    const latestServer = await getVideoTimelineFromBff(projectId, { correlationId });
    void syncPending(editor.document, editor.document.updatedAt, latestServer?.revisionNumber ?? 0, true);
  }, [dispatch, editor.document, projectId, syncPending]);

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

      const server = await getVideoTimelineFromBff(projectId);
      dispatch(editorConflictResolved({ resolution: "reload-server" }));

      if (!server) {
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
    clearRetryTimer();
    void syncNow();
  }, [clearRetryTimer, syncNow]);

  const flushForExport = useCallback(async (): Promise<VideoExportFlushResult> => {
    if (!editor.document) {
      return { ok: false, reason: "sync-failed", message: "Video document is not loaded." };
    }

    if (editor.syncStatus === "server-changed") {
      return { ok: false, reason: "conflict", message: "Resolve the server changes before exporting." };
    }

    if (
      (editor.syncStatus === "clean" || editor.syncStatus === "synced") &&
      editor.serverRevisionNumber !== null
    ) {
      if (editor.serverTimelineId) {
        return {
          ok: true,
          timelineId: editor.serverTimelineId,
          revisionNumber: editor.serverRevisionNumber,
        };
      }

      try {
        const latest = await getVideoTimelineFromBff(projectId, {
          correlationId: createEditorCorrelationId("export-sync-check"),
        });
        if (latest) {
          return {
            ok: true,
            timelineId: latest.timelineId,
            revisionNumber: latest.revisionNumber,
          };
        }
      } catch {
        return {
          ok: false,
          reason: "sync-failed",
          message: "Could not confirm the server timeline before export.",
        };
      }
    }

    const document = editor.document;
    const baseRevisionNumber = editor.serverRevisionNumber ?? 0;
    const pending = await listPendingSync(cacheScope, projectId);
    const includedPending = pending.ok
      ? pending.value.filter((entry) => entry.kind === "timelineDraft")
      : [];
    const operations = includedPending
      .map(operationEntryFromPending)
      .filter((entry): entry is VideoTimelineSyncOperationEntry => entry !== null)
      .reverse();
    const correlationId = createEditorCorrelationId("export-sync");

    dispatch(editorBackendSyncStarted());
    try {
      const result = await saveVideoTimelineToBff(
        projectId,
        createSaveVideoTimelineRequest({
          document,
          operations,
          baseRevisionNumber,
          source: operations.at(-1)?.source ?? "manual",
          label: operations.at(-1)?.label ?? "Timeline export sync",
        }),
        "Timeline export sync failed.",
        {
          correlationId,
          pendingCount: includedPending.length,
          timelineId: editor.serverTimelineId,
        },
      );

      if (!result.ok) {
        const latestServer = await getVideoTimelineFromBff(projectId, { correlationId }).catch(() => null);
        dispatch(editorServerChangedDetected({
          reason: "local-unsynced-server-changed",
          serverProjectUpdatedAt: latestServer?.updatedAt ?? new Date().toISOString(),
        }));
        await saveVideoTimelineDraft(document, cacheScope, {
          serverRevisionNumber: latestServer?.revisionNumber ?? baseRevisionNumber,
          lastSyncedAt: editor.lastSyncedAt,
          hasUnsyncedChanges: true,
          syncError: result.message,
        });
        return { ok: false, reason: "conflict", message: result.message };
      }

      const saved = result.timeline;
      const syncedAt = saved.updatedAt ?? new Date().toISOString();
      await Promise.all(includedPending.map((entry) => deletePendingSync(entry.id)));
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: saved.revisionNumber,
        lastSyncedAt: syncedAt,
        hasUnsyncedChanges: false,
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
        syncedAt,
        timelineId: saved.timelineId,
      }));

      return {
        ok: true,
        timelineId: saved.timelineId,
        revisionNumber: saved.revisionNumber,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Timeline export sync failed.";
      logVideoEditorEvent("editor.sync.failure", {
        projectId,
        correlationId,
        pendingCount: includedPending.length,
        baseRevisionNumber,
        timelineId: editor.serverTimelineId,
        reason: message,
      }, "error");
      const pendingAfterFailure = await listPendingSync(cacheScope, projectId);
      await saveVideoTimelineDraft(document, cacheScope, {
        serverRevisionNumber: baseRevisionNumber,
        lastSyncedAt: editor.lastSyncedAt,
        hasUnsyncedChanges: true,
        syncError: message,
      });
      dispatch(editorBackendSyncFailed({
        error: message,
        pendingSyncCount: pendingAfterFailure.ok ? pendingAfterFailure.value.length : undefined,
      }));
      return { ok: false, reason: "sync-failed", message };
    }
  }, [
    cacheScope,
    dispatch,
    editor.document,
    editor.lastSyncedAt,
    editor.serverRevisionNumber,
    editor.serverTimelineId,
    editor.syncStatus,
    projectId,
  ]);

  return { flushForExport, keepLocalEdits, reloadServerCopy, retryNow, syncNow };
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

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
