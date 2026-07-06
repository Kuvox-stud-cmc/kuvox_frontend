import { OwnerKind, type ProjectDto } from "../api";
import {
  type CachedPendingSyncRecord,
  type CachedProjectSnapshotRecord,
  type EditorCacheResult,
  type EditorCacheScope,
  buildEditorCacheScope,
} from "./editor-cache";
import {
  createEmptyVideoProjectDocument,
  type VideoProjectDocument,
} from "./video-document";

export type EditorLoadDocumentSource = "draft" | "empty";
export type EditorLoadSyncStatus = "clean" | "saved-local" | "server-changed";
export type EditorLoadConflictReason = "local-unsynced-server-changed";

export interface EditorLoadConflict {
  reason: EditorLoadConflictReason;
  cachedProjectUpdatedAt?: string;
  serverProjectUpdatedAt: string;
}

export interface ResolvedEditorLoad {
  document: VideoProjectDocument;
  source: EditorLoadDocumentSource;
  syncStatus: EditorLoadSyncStatus;
  pendingSyncCount: number;
  conflict: EditorLoadConflict | null;
  warnings: string[];
}

export interface ResolveCachedEditorDocumentInput {
  project: ProjectDto;
  draft: EditorCacheResult<VideoProjectDocument>;
  cachedProject?: EditorCacheResult<ProjectDto>;
  cachedSnapshot?: EditorCacheResult<CachedProjectSnapshotRecord>;
  pendingSync?: EditorCacheResult<CachedPendingSyncRecord[]>;
}

export function buildEditorCacheScopeFromProject(
  userId: string,
  project: Pick<ProjectDto, "ownerId" | "ownerKind">,
): EditorCacheScope {
  return buildEditorCacheScope({
    userId,
    ownerKind: project.ownerKind === OwnerKind.Studio ? "studio" : "user",
    ownerId: project.ownerId,
  });
}

export function resolveCachedEditorDocument(input: ResolveCachedEditorDocumentInput): ResolvedEditorLoad {
  const warnings = collectWarnings(input);
  const pendingSyncCount = input.pendingSync?.ok ? input.pendingSync.value.length : 0;
  const draftDocument = input.draft.ok ? input.draft.value : null;
  const document =
    draftDocument ??
    createEmptyVideoProjectDocument({
      id: input.project.id,
      name: input.project.name,
      createdAt: input.project.createdAt,
      updatedAt: input.project.updatedAt,
    });
  const source: EditorLoadDocumentSource = draftDocument ? "draft" : "empty";
  const conflict = detectEditorLoadConflict({
    project: input.project,
    draft: draftDocument,
    cachedProject: input.cachedProject,
    cachedSnapshot: input.cachedSnapshot,
    pendingSyncCount,
  });
  const hasLocalUnsynced = conflict !== null || pendingSyncCount > 0 || isDraftNewerThanSnapshot(draftDocument, input.cachedSnapshot);

  return {
    document,
    source,
    syncStatus: conflict ? "server-changed" : hasLocalUnsynced ? "saved-local" : "clean",
    pendingSyncCount,
    conflict,
    warnings,
  };
}

export function detectEditorLoadConflict(input: {
  project: ProjectDto;
  draft: VideoProjectDocument | null;
  cachedProject?: EditorCacheResult<ProjectDto>;
  cachedSnapshot?: EditorCacheResult<CachedProjectSnapshotRecord>;
  pendingSyncCount: number;
}): EditorLoadConflict | null {
  const cachedProjectUpdatedAt = cachedProjectUpdatedAtFor(input.cachedProject, input.cachedSnapshot);
  const serverChanged = Boolean(cachedProjectUpdatedAt && cachedProjectUpdatedAt !== input.project.updatedAt);
  const localUnsynced =
    input.pendingSyncCount > 0 ||
    isDraftNewerThanSnapshot(input.draft, input.cachedSnapshot);

  if (!serverChanged || !localUnsynced) {
    return null;
  }

  return {
    reason: "local-unsynced-server-changed",
    cachedProjectUpdatedAt,
    serverProjectUpdatedAt: input.project.updatedAt,
  };
}

function cachedProjectUpdatedAtFor(
  cachedProject?: EditorCacheResult<ProjectDto>,
  cachedSnapshot?: EditorCacheResult<CachedProjectSnapshotRecord>,
): string | undefined {
  if (cachedProject?.ok) return cachedProject.value.updatedAt;
  if (cachedSnapshot?.ok) return cachedSnapshot.value.projectUpdatedAt;
  return undefined;
}

function isDraftNewerThanSnapshot(
  draft: VideoProjectDocument | null,
  cachedSnapshot?: EditorCacheResult<CachedProjectSnapshotRecord>,
): boolean {
  if (!draft || !cachedSnapshot?.ok || typeof cachedSnapshot.value.revision !== "number") {
    return false;
  }

  return draft.history.revision > cachedSnapshot.value.revision;
}

function collectWarnings(input: ResolveCachedEditorDocumentInput): string[] {
  const warnings: string[] = [];

  if (!input.draft.ok && input.draft.reason !== "miss" && input.draft.reason !== "unavailable") {
    warnings.push(`Draft cache ${input.draft.reason}.`);
  }

  if (input.cachedProject && !input.cachedProject.ok && input.cachedProject.reason !== "miss" && input.cachedProject.reason !== "unavailable") {
    warnings.push(`Project cache ${input.cachedProject.reason}.`);
  }

  if (input.cachedSnapshot && !input.cachedSnapshot.ok && input.cachedSnapshot.reason !== "miss" && input.cachedSnapshot.reason !== "unavailable") {
    warnings.push(`Project snapshot cache ${input.cachedSnapshot.reason}.`);
  }

  if (input.pendingSync && !input.pendingSync.ok && input.pendingSync.reason !== "miss" && input.pendingSync.reason !== "unavailable") {
    warnings.push(`Pending sync cache ${input.pendingSync.reason}.`);
  }

  return warnings;
}
