import type Dexie from "dexie";

import type { ImageCompositionDocument, ImageHistoryEntry } from "../document/types";

export interface ImageCompositionDraftRecord {
  projectId: string;
  documentId: string;
  document: ImageCompositionDocument;
  baseRevisionNumber: number;
  updatedAt: string;
  lastSyncedAt: string | null;
  hasUnsyncedChanges: boolean;
  syncError: string | null;
}

export interface ImageCompositionOperationRecord {
  id: string;
  projectId: string;
  operation: ImageHistoryEntry["operation"];
  label: string;
  source: string;
  createdAt: string;
  syncedAt: string | null;
}

export interface ImageCompositionPendingSyncRecord {
  projectId: string;
  documentId: string;
  baseRevisionNumber: number;
  updatedAt: string;
  operationIds: string[];
  attemptCount: number;
  lastError: string | null;
}

interface ImageEditorCacheDatabase extends Dexie {
  imageCompositionDrafts: Dexie.Table<ImageCompositionDraftRecord, string>;
  imageCompositionOperations: Dexie.Table<ImageCompositionOperationRecord, string>;
  imageCompositionPendingSync: Dexie.Table<ImageCompositionPendingSyncRecord, string>;
}

let databasePromise: Promise<ImageEditorCacheDatabase> | null = null;

export async function loadNewestImageCompositionDraft(projectId: string) {
  const db = await getDatabase();
  const draft = await db.imageCompositionDrafts.get(projectId);
  return draft ?? null;
}

export async function saveImageCompositionDraft(input: {
  projectId: string;
  document: ImageCompositionDocument;
  baseRevisionNumber: number;
  operations: ImageHistoryEntry[];
}) {
  const db = await getDatabase();
  const updatedAt = input.document.updatedAt ?? new Date().toISOString();
  const documentId = input.document.documentId ?? `image-document-${input.projectId}`;
  const operationIds = input.operations.map((entry) => entry.id);

  await db.transaction(
    "rw",
    db.imageCompositionDrafts,
    db.imageCompositionOperations,
    db.imageCompositionPendingSync,
    async () => {
      await db.imageCompositionDrafts.put({
        projectId: input.projectId,
        documentId,
        document: {
          ...input.document,
          projectId: input.projectId,
          documentId,
          baseRevisionNumber: input.baseRevisionNumber,
        },
        baseRevisionNumber: input.baseRevisionNumber,
        updatedAt,
        lastSyncedAt: input.document.lastSyncedAt ?? null,
        hasUnsyncedChanges: true,
        syncError: null,
      });

      if (input.operations.length > 0) {
        await db.imageCompositionOperations.bulkPut(
          input.operations.map((entry) => ({
            id: entry.id,
            projectId: input.projectId,
            operation: entry.operation,
            label: entry.label,
            source: entry.source,
            createdAt: entry.createdAt,
            syncedAt: null,
          })),
        );
      }

      await db.imageCompositionPendingSync.put({
        projectId: input.projectId,
        documentId,
        baseRevisionNumber: input.baseRevisionNumber,
        updatedAt,
        operationIds,
        attemptCount: 0,
        lastError: null,
      });
    },
  );
}

export async function markImageCompositionSyncSucceeded(input: {
  projectId: string;
  revisionNumber: number;
  syncedAt: string;
}) {
  const db = await getDatabase();
  await db.transaction(
    "rw",
    db.imageCompositionDrafts,
    db.imageCompositionOperations,
    db.imageCompositionPendingSync,
    async () => {
      const draft = await db.imageCompositionDrafts.get(input.projectId);
      if (draft) {
        await db.imageCompositionDrafts.put({
          ...draft,
          document: {
            ...draft.document,
            baseRevisionNumber: input.revisionNumber,
            lastSyncedAt: input.syncedAt,
          },
          baseRevisionNumber: input.revisionNumber,
          lastSyncedAt: input.syncedAt,
          hasUnsyncedChanges: false,
          syncError: null,
        });
      }

      const operations = await db.imageCompositionOperations
        .where("projectId")
        .equals(input.projectId)
        .and((operation) => operation.syncedAt === null)
        .toArray();
      if (operations.length > 0) {
        await db.imageCompositionOperations.bulkPut(
          operations.map((operation) => ({ ...operation, syncedAt: input.syncedAt })),
        );
      }
      await db.imageCompositionPendingSync.delete(input.projectId);
    },
  );
}

export async function markImageCompositionSyncFailed(input: {
  projectId: string;
  error: string;
}) {
  const db = await getDatabase();
  await db.transaction("rw", db.imageCompositionDrafts, db.imageCompositionPendingSync, async () => {
    const draft = await db.imageCompositionDrafts.get(input.projectId);
    if (draft) {
      await db.imageCompositionDrafts.put({
        ...draft,
        hasUnsyncedChanges: true,
        syncError: input.error,
      });
    }

    const pending = await db.imageCompositionPendingSync.get(input.projectId);
    if (pending) {
      await db.imageCompositionPendingSync.put({
        ...pending,
        attemptCount: pending.attemptCount + 1,
        lastError: input.error,
      });
    }
  });
}

export async function clearImageCompositionDraft(projectId: string) {
  const db = await getDatabase();
  await db.transaction(
    "rw",
    db.imageCompositionDrafts,
    db.imageCompositionOperations,
    db.imageCompositionPendingSync,
    async () => {
      await db.imageCompositionDrafts.delete(projectId);
      await db.imageCompositionPendingSync.delete(projectId);
      const operations = await db.imageCompositionOperations
        .where("projectId")
        .equals(projectId)
        .primaryKeys();
      if (operations.length > 0) {
        await db.imageCompositionOperations.bulkDelete(operations as string[]);
      }
    },
  );
}

export async function replaceImageCompositionDraft(input: {
  projectId: string;
  document: ImageCompositionDocument;
  baseRevisionNumber: number;
  syncedAt: string | null;
}) {
  const db = await getDatabase();
  const documentId = input.document.documentId ?? `image-document-${input.projectId}`;
  const updatedAt = input.document.updatedAt ?? input.syncedAt ?? new Date().toISOString();

  await db.transaction(
    "rw",
    db.imageCompositionDrafts,
    db.imageCompositionOperations,
    db.imageCompositionPendingSync,
    async () => {
      await db.imageCompositionDrafts.put({
        projectId: input.projectId,
        documentId,
        document: {
          ...input.document,
          projectId: input.projectId,
          documentId,
          baseRevisionNumber: input.baseRevisionNumber,
          lastSyncedAt: input.syncedAt,
        },
        baseRevisionNumber: input.baseRevisionNumber,
        updatedAt,
        lastSyncedAt: input.syncedAt,
        hasUnsyncedChanges: false,
        syncError: null,
      });

      await db.imageCompositionPendingSync.delete(input.projectId);
      const operations = await db.imageCompositionOperations
        .where("projectId")
        .equals(input.projectId)
        .primaryKeys();
      if (operations.length > 0) {
        await db.imageCompositionOperations.bulkDelete(operations as string[]);
      }
    },
  );
}

async function getDatabase(): Promise<ImageEditorCacheDatabase> {
  if (typeof window === "undefined") {
    throw new Error("Image editor cache is only available in the browser.");
  }

  databasePromise ??= import("dexie").then(({ default: DexieCtor }) => {
    const db = new DexieCtor("kuvoxImageEditorCache") as ImageEditorCacheDatabase;
    db.version(1).stores({
      imageCompositionDrafts: "projectId, updatedAt, hasUnsyncedChanges",
      imageCompositionOperations: "id, projectId, createdAt, syncedAt",
      imageCompositionPendingSync: "projectId, updatedAt",
    });
    return db;
  });

  return databasePromise;
}
