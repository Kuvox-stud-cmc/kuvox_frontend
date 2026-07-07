import assert from "node:assert/strict";

import {
  VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
  createMockVideoProjectDocument,
} from "../app/lib/editor/video-document";
import {
  buildEditorCacheKey,
  buildEditorCacheScope,
  coerceVideoTimelineDraft,
  createMediaObjectCacheRecord,
  createOperationLogRecord,
  createUndoCheckpointRecord,
  isEditorCacheRecordExpired,
  mediaStorageSignature,
  planEditorCacheCleanup,
  projectScopeKey,
  scopeKey,
  serializeVideoTimelineDraft,
  type CleanupCandidate,
} from "../app/lib/editor/editor-cache";
import {
  applyVideoOperationBatch,
  createVideoOperationBatch,
  type MoveItemOperation,
} from "../app/lib/editor/video-operations";
import type { MediaDto } from "../app/lib/api";

function main(): void {
  assertNamespaceBuilders();
  assertDraftSerialization();
  assertInvalidDraftClassification();
  assertTtlClassification();
  assertCleanupPlanning();
  assertOperationLogAndUndoCheckpointRecords();
  assertMediaObjectMetadataOnly();
  assertMediaStorageSignature();
}

function assertOperationLogAndUndoCheckpointRecords(): void {
  const scope = buildEditorCacheScope({ userId: "user-1" });
  const document = createMockVideoProjectDocument("cache-history", "Cache History");
  const batch = createVideoOperationBatch({
    id: "cache-batch",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Move beach",
    operations: [moveBeachOperation()],
  });
  const result = applyVideoOperationBatch(document, batch);
  assert.equal(result.ok, true, result.errors?.join("; "));

  const logRecord = createOperationLogRecord({
    scope,
    projectId: document.projectId,
    batch,
    result,
    now: 100,
  });
  assert.equal(logRecord.projectId, "cache-history");
  assert.equal(logRecord.batch.id, "cache-batch");
  assert.equal(logRecord.result?.historyEntry?.id, "cache-batch");
  assert.equal(logRecord.revision, result.document.history.revision);
  assert.deepEqual(logRecord.result?.appliedOperationIds, ["cache-move-beach"]);

  const checkpointRecord = createUndoCheckpointRecord({
    scope,
    projectId: document.projectId,
    operationId: batch.id,
    timestamp: batch.timestamp,
    checkpoint: document,
    undo: result.undo,
    historyEntry: result.historyEntry,
    now: 100,
  });
  assert.equal(checkpointRecord.ok, true);
  assert.equal(checkpointRecord.ok && checkpointRecord.value.operationId, "cache-batch");
  assert.equal(checkpointRecord.ok && checkpointRecord.value.checkpoint.projectId, "cache-history");
  assert.deepEqual(checkpointRecord.ok && checkpointRecord.value.undo, result.undo);
  assert.deepEqual(checkpointRecord.ok && checkpointRecord.value.historyEntry, result.historyEntry);
}

function assertNamespaceBuilders(): void {
  const userScope = buildEditorCacheScope({ userId: "user-1" });
  const studioScope = buildEditorCacheScope({
    userId: "user-1",
    ownerKind: "studio",
    ownerId: "studio-1",
  });

  assert.equal(scopeKey(userScope), "user-1:user:user-1");
  assert.equal(scopeKey(studioScope), "user-1:studio:studio-1");
  assert.equal(projectScopeKey(userScope, "project-1"), "user-1:user:user-1:project:project-1");
  assert.notEqual(
    buildEditorCacheKey(userScope, "project", "project-1"),
    buildEditorCacheKey(studioScope, "project", "project-1"),
  );
  assert.notEqual(
    buildEditorCacheKey(userScope, "project", "project-1"),
    buildEditorCacheKey(userScope, "project", "project-2"),
  );
}

function assertDraftSerialization(): void {
  const document = createMockVideoProjectDocument("cache-draft", "Cache Draft");
  const serialized = serializeVideoTimelineDraft(document);

  assert.equal(serialized.ok, true);
  assert.notEqual(serialized.ok && serialized.value, document);
  assert.deepEqual(serialized.ok && serialized.value, document);

  const coerced = coerceVideoTimelineDraft(serialized.ok ? serialized.value : null, "cache-draft");
  assert.equal(coerced.ok, true);
  assert.equal(coerced.ok && coerced.value.history.revision, document.history.revision);
}

function assertInvalidDraftClassification(): void {
  const document = createMockVideoProjectDocument("cache-draft", "Cache Draft");
  const wrongSchema = coerceVideoTimelineDraft({
    ...document,
    schemaVersion: VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION + 1,
  });
  assert.equal(wrongSchema.ok, false);
  assert.equal(!wrongSchema.ok && wrongSchema.reason, "schema-mismatch");

  const corrupt = coerceVideoTimelineDraft({
    ...document,
    tracks: [{ bad: true }],
  });
  assert.equal(corrupt.ok, false);
  assert.equal(!corrupt.ok && corrupt.reason, "corrupt");

  const wrongProject = coerceVideoTimelineDraft(document, "other-project");
  assert.equal(wrongProject.ok, false);
  assert.equal(!wrongProject.ok && wrongProject.reason, "corrupt");
}

function assertTtlClassification(): void {
  assert.equal(isEditorCacheRecordExpired({ expiresAt: 110 }, 100), false);
  assert.equal(isEditorCacheRecordExpired({ expiresAt: 100 }, 100), true);
  assert.equal(isEditorCacheRecordExpired({}, 100), false);
}

function assertCleanupPlanning(): void {
  const checkpoints = candidates("project-a", 25);
  const logs = candidates("project-a", 505);
  const commands = candidates("project-a", 105);
  const plan = planEditorCacheCleanup(
    {
      projects: [
        { id: "project-fresh", expiresAt: 101 },
        { id: "project-expired", expiresAt: 99 },
      ],
      mediaAssets: [{ id: "media-expired", expiresAt: 99 }],
      mediaObjectCache: [{ id: "object-expired", expiresAt: 99 }],
      operationLog: logs,
      undoCheckpoints: checkpoints,
      commandHistory: commands,
      pendingSync: [{ id: "pending-expired", expiresAt: 1 }],
    },
    { now: 100 },
  );

  assert.deepEqual(plan.projects, ["project-expired"]);
  assert.deepEqual(plan.mediaAssets, ["media-expired"]);
  assert.deepEqual(plan.mediaObjectCache, ["object-expired"]);
  assert.equal(plan.undoCheckpoints.length, 5);
  assert.equal(plan.operationLog.length, 5);
  assert.equal(plan.commandHistory.length, 5);
  assert.deepEqual(plan.pendingSync, []);
  assert.ok(plan.undoCheckpoints.every((id) => id.endsWith("-old")));
}

function assertMediaObjectMetadataOnly(): void {
  const scope = buildEditorCacheScope({ userId: "user-1" });
  const blob = new Blob(["binary"]);
  const record = createMediaObjectCacheRecord({
    scope,
    mediaId: "media-1",
    variant: "thumbnail",
    storageKey: "media/thumb.jpg",
    contentType: "image/jpeg",
    sizeBytes: 123,
    metadata: {
      width: 320,
      height: 180,
      objectUrl: "blob:http://local/1",
      blob,
      nested: {
        src: "/bff/media/media-1/object/thumbnail",
        color: "blue",
      },
    },
    now: 10,
  });

  assert.equal("blob" in record, false);
  assert.equal("objectUrl" in record, false);
  assert.equal(record.metadata?.width, 320);
  assert.equal(record.metadata?.height, 180);
  assert.equal(record.metadata && "objectUrl" in record.metadata, false);
  assert.deepEqual(record.metadata?.nested, { color: "blue" });
}

function assertMediaStorageSignature(): void {
  const media = {
    id: "media-1",
    storageKey: "raw.mp4",
    canonicalStorageKey: "canonical.mp4",
    proxyStorageKey: "proxy.mp4",
    thumbnailStorageKey: "thumb.jpg",
  } as MediaDto;

  assert.equal(mediaStorageSignature(media), "raw.mp4|canonical.mp4|proxy.mp4|thumb.jpg");
}

function moveBeachOperation(): MoveItemOperation {
  return {
    id: "cache-move-beach",
    source: "manual",
    timestamp: "2026-02-02T10:00:00.000Z",
    label: "Move beach",
    affectedEntityIds: ["tl-beach"],
    type: "moveItem",
    itemId: "tl-beach",
    timelineStart: 12,
  };
}

function candidates(projectId: string, count: number): CleanupCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index < count - 5 ? `${projectId}-${index}` : `${projectId}-${index}-old`,
    scopeProjectKey: projectId,
    revision: count - index,
  }));
}

main();
