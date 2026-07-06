import { useEffect, useRef, useState, type RefObject } from "react";

import type { SaveImageCompositionRequest } from "~/lib/api";
import { getUnsyncedImageOperations } from "~/lib/editor/image/document/sync";
import type {
  ImageCompositionDocument,
  ImageHistoryEntry,
} from "~/lib/editor/image/document/types";
import {
  getImageCompositionFromBff,
  saveImageCompositionToBff,
} from "~/lib/editor/image/image-composition-api.client";
import { useAppDispatch } from "~/store/hooks";
import {
  imageBackendSyncFailed,
  imageBackendSyncSucceeded,
  imageSaveStateChanged,
  imageServerVersionLoaded,
  type ImageEditorState,
} from "~/store/slices/image-editor-slice";

type ConflictAction = "reload" | "keep-local" | null;

interface UseImageAutosaveInput {
  projectId: string;
  imageEditor: ImageEditorState;
  initializedProject: RefObject<string | null>;
}

export function useImageAutosave({
  projectId,
  imageEditor,
  initializedProject,
}: UseImageAutosaveInput) {
  const dispatch = useAppDispatch();
  const latestDocumentUpdatedAt = useRef<string | null>(null);
  const [conflictAction, setConflictAction] = useState<ConflictAction>(null);

  useEffect(() => {
    latestDocumentUpdatedAt.current = imageEditor.document.updatedAt ?? null;
  }, [imageEditor.document.updatedAt]);

  useEffect(() => {
    if (imageEditor.projectId !== projectId || initializedProject.current !== projectId) return;
    const documentUpdatedAt = imageEditor.document.updatedAt;
    if (!documentUpdatedAt) return;

    const unsyncedOperations = getUnsyncedImageOperations(imageEditor.document);
    const baseRevisionNumber = imageEditor.document.baseRevisionNumber ?? 0;
    const documentChangedSinceSync = imageEditor.document.lastSyncedAt
      ? Date.parse(documentUpdatedAt) > Date.parse(imageEditor.document.lastSyncedAt)
      : imageEditor.document.operationHistory.length > 0;
    if (!documentChangedSinceSync && unsyncedOperations.length === 0) return;

    import("~/lib/editor/image/persistence/image-editor-cache.client").then((cache) => {
      cache.saveImageCompositionDraft({
        projectId,
        document: imageEditor.document,
        baseRevisionNumber,
        operations: unsyncedOperations,
      }).catch((error: unknown) => {
        dispatch(
          imageSaveStateChanged({
            state: "sync-failed",
            error: error instanceof Error ? error.message : "Local draft could not be saved.",
          }),
        );
      });
    });

    if (imageEditor.saveState === "server-changed" || conflictAction) return;

    const timeoutId = window.setTimeout(async () => {
      dispatch(imageSaveStateChanged({ state: "syncing" }));
      try {
        const result = await saveImageCompositionToBff(
          projectId,
          createSaveImageCompositionRequest(
            imageEditor.document,
            unsyncedOperations,
            baseRevisionNumber,
          ),
        );

        if (!result.ok) {
          const serverComposition = await getImageCompositionFromBff(projectId).catch(() => null);
          const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
          await cache.markImageCompositionSyncFailed({ projectId, error: result.message });
          dispatch(
            imageBackendSyncFailed({
              conflict: true,
              error: result.message,
              serverRevisionNumber: serverComposition?.revisionNumber ?? null,
              serverUpdatedAt: serverComposition?.updatedAt ?? null,
              updatedByUserId: serverComposition?.updatedByUserId ?? null,
            }),
          );
          return;
        }

        if (latestDocumentUpdatedAt.current !== documentUpdatedAt) return;

        const saved = result.composition;
        const syncedAt = saved.updatedAt ?? new Date().toISOString();
        const revisionNumber = saved.revisionNumber || baseRevisionNumber + 1;
        const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncSucceeded({ projectId, revisionNumber, syncedAt });
        dispatch(imageBackendSyncSucceeded({ revisionNumber, syncedAt, updatedAt: saved.updatedAt }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image composition sync failed.";
        const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncFailed({ projectId, error: message });
        dispatch(imageBackendSyncFailed({ error: message }));
      }
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [
    conflictAction,
    dispatch,
    imageEditor.document,
    imageEditor.projectId,
    imageEditor.saveState,
    initializedProject,
    projectId,
  ]);

  const handleReloadServerVersion = async () => {
    if (conflictAction) return;
    setConflictAction("reload");
    dispatch(imageSaveStateChanged({ state: "syncing" }));
    try {
      const serverComposition = await getImageCompositionFromBff(projectId);
      dispatch(
        imageServerVersionLoaded({
          document: serverComposition.document,
          baseRevisionNumber: serverComposition.revisionNumber,
          lastSyncedAt: serverComposition.updatedAt,
        }),
      );
      const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
      await cache.clearImageCompositionDraft(projectId);
    } catch (error) {
      dispatch(
        imageBackendSyncFailed({
          conflict: true,
          error: error instanceof Error ? error.message : "Server version could not be loaded.",
          serverRevisionNumber: imageEditor.conflict?.serverRevisionNumber ?? null,
          serverUpdatedAt: imageEditor.conflict?.serverUpdatedAt ?? null,
          updatedByUserId: imageEditor.conflict?.updatedByUserId ?? null,
        }),
      );
    } finally {
      setConflictAction(null);
    }
  };

  const handleKeepLocalEdits = async () => {
    if (conflictAction) return;
    const localDocument = imageEditor.document;
    const unsyncedOperations = getUnsyncedImageOperations(localDocument);
    setConflictAction("keep-local");
    dispatch(imageSaveStateChanged({ state: "syncing" }));

    try {
      const latestServer = await getImageCompositionFromBff(projectId);
      const baseRevisionNumber = latestServer.revisionNumber;
      const result = await saveImageCompositionToBff(
        projectId,
        createSaveImageCompositionRequest(
          {
            ...localDocument,
            projectId,
            baseRevisionNumber,
          },
          unsyncedOperations,
          baseRevisionNumber,
        ),
        "Local edits could not be saved.",
      );

      if (!result.ok) {
        const serverComposition = await getImageCompositionFromBff(projectId).catch(() => null);
        const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
        await cache.markImageCompositionSyncFailed({ projectId, error: result.message });
        dispatch(
          imageBackendSyncFailed({
            conflict: true,
            error: result.message,
            serverRevisionNumber: serverComposition?.revisionNumber ?? latestServer.revisionNumber,
            serverUpdatedAt: serverComposition?.updatedAt ?? latestServer.updatedAt,
            updatedByUserId: serverComposition?.updatedByUserId ?? latestServer.updatedByUserId,
          }),
        );
        return;
      }

      const saved = result.composition;
      const syncedAt = saved.updatedAt ?? new Date().toISOString();
      const cache = await import("~/lib/editor/image/persistence/image-editor-cache.client");
      await cache.replaceImageCompositionDraft({
        projectId,
        document: {
          ...localDocument,
          projectId,
          baseRevisionNumber: saved.revisionNumber,
          lastSyncedAt: syncedAt,
        },
        baseRevisionNumber: saved.revisionNumber,
        syncedAt,
      });
      dispatch(
        imageBackendSyncSucceeded({
          revisionNumber: saved.revisionNumber,
          syncedAt,
          updatedAt: saved.updatedAt,
        }),
      );
    } catch (error) {
      dispatch(
        imageBackendSyncFailed({
          conflict: true,
          error: error instanceof Error ? error.message : "Local edits could not be saved.",
          serverRevisionNumber: imageEditor.conflict?.serverRevisionNumber ?? null,
          serverUpdatedAt: imageEditor.conflict?.serverUpdatedAt ?? null,
          updatedByUserId: imageEditor.conflict?.updatedByUserId ?? null,
        }),
      );
    } finally {
      setConflictAction(null);
    }
  };

  return { conflictAction, handleReloadServerVersion, handleKeepLocalEdits };
}

function createSaveImageCompositionRequest(
  document: ImageCompositionDocument,
  operations: ImageHistoryEntry[],
  baseRevisionNumber: number,
): SaveImageCompositionRequest {
  return {
    documentJson: document,
    operationsJson: operations.map((entry) => ({
      id: entry.id,
      type: entry.operation.type,
      label: entry.label,
      source: entry.source,
      createdAt: entry.createdAt,
    })),
    baseRevisionNumber,
  };
}
