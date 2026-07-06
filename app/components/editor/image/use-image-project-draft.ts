import { useEffect, useRef } from "react";

import type { ServerImageComposition } from "~/lib/editor/image/image-composition-payload";
import { useAppDispatch } from "~/store/hooks";
import {
  imageDraftLoaded,
  imageProjectOpened,
} from "~/store/slices/image-editor-slice";

interface UseImageProjectDraftInput {
  projectId: string;
  projectName?: string | null;
  backendComposition?: ServerImageComposition | null;
}

export function useImageProjectDraft({
  projectId,
  projectName,
  backendComposition = null,
}: UseImageProjectDraftInput) {
  const dispatch = useAppDispatch();
  const initializedProject = useRef<string | null>(null);

  useEffect(() => {
    dispatch(
      imageProjectOpened({
        projectId,
        projectName,
        document: backendComposition?.document ?? null,
        baseRevisionNumber: backendComposition?.revisionNumber ?? 0,
        lastSyncedAt: backendComposition?.updatedAt ?? null,
      }),
    );
    initializedProject.current = projectId;
  }, [backendComposition, dispatch, projectId, projectName]);

  useEffect(() => {
    let cancelled = false;
    import("~/lib/editor/image/persistence/image-editor-cache.client").then(async (cache) => {
      const draft = await cache.loadNewestImageCompositionDraft(projectId);
      if (cancelled || !draft?.hasUnsyncedChanges) return;

      const serverUpdatedAt = backendComposition?.updatedAt
        ? Date.parse(backendComposition.updatedAt)
        : 0;
      const draftUpdatedAt = Date.parse(draft.updatedAt);
      if (!Number.isFinite(draftUpdatedAt) || draftUpdatedAt < serverUpdatedAt) return;

      dispatch(
        imageDraftLoaded({
          document: draft.document,
          baseRevisionNumber: draft.baseRevisionNumber,
          lastSyncedAt: draft.lastSyncedAt,
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [backendComposition?.updatedAt, dispatch, projectId]);

  return initializedProject;
}
