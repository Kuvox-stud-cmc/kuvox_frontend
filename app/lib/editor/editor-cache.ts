import type Dexie from "dexie";
import type { Table } from "dexie";

import type { MediaDto, ProjectDto } from "../api";
import {
  VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
  type JsonValue,
  type VideoDocumentSchemaVersion,
  type VideoProjectDocument,
  validateVideoProjectDocument,
} from "./video-document";
import type {
  VideoHistoryEntry,
  VideoOperationApplyResult,
  VideoOperationBatch,
  VideoOperationUndoPayload,
} from "./video-operations";

export const EDITOR_CACHE_DATABASE_NAME = "kuvox-editor-cache";
export const EDITOR_CACHE_DATABASE_VERSION = 1;

const hourMs = 60 * 60 * 1000;

export const EDITOR_CACHE_TTL_MS = {
  projectMetadata: 24 * hourMs,
  mediaMetadata: 6 * hourMs,
  mediaObjectMetadata: 7 * 24 * hourMs,
} as const;

export type EditorCacheOwnerKind = "user" | "studio";

export interface EditorCacheScope {
  userId: string;
  ownerKind: EditorCacheOwnerKind;
  ownerId: string;
}

export type EditorCacheMissReason =
  | "unavailable"
  | "miss"
  | "expired"
  | "schema-mismatch"
  | "corrupt"
  | "error";

export type EditorCacheResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: EditorCacheMissReason; error?: string };

export interface EditorCacheFreshness {
  cachedAt: number;
  expiresAt?: number;
}

export interface CachedProjectRecord extends EditorCacheFreshness {
  key: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  projectUpdatedAt: string;
  project: ProjectDto;
}

export interface CachedProjectSnapshotRecord extends EditorCacheFreshness {
  key: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  documentSchemaVersion?: number;
  projectUpdatedAt?: string;
  revision?: number;
  snapshot?: JsonValue;
}

export interface CachedVideoTimelineDraftRecord extends EditorCacheFreshness {
  key: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  documentSchemaVersion: VideoDocumentSchemaVersion;
  documentUpdatedAt: string;
  revision: number;
  document: VideoProjectDocument;
  serverRevisionNumber?: number;
  lastSyncedAt?: string | null;
  hasUnsyncedChanges?: boolean;
  syncError?: string | null;
}

export interface CachedMediaAssetRecord extends EditorCacheFreshness {
  key: string;
  scopeKey: string;
  scope: EditorCacheScope;
  mediaId: string;
  storageSignature: string;
  media: MediaDto;
}

export type MediaObjectVariant = "thumbnail" | "canonical" | "proxy" | "raw";

export interface CachedMediaObjectRecord extends EditorCacheFreshness {
  key: string;
  scopeKey: string;
  scope: EditorCacheScope;
  mediaId: string;
  variant: MediaObjectVariant;
  storageKey: string;
  sizeBytes?: number;
  contentType?: string;
  metadata?: Record<string, JsonValue>;
}

export interface CachedOperationLogRecord extends EditorCacheFreshness {
  id: string;
  scopeProjectKey: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  timestamp: string;
  revision?: number;
  batch: VideoOperationBatch;
  result?: VideoOperationApplyResult;
}

export interface CachedUndoCheckpointRecord extends EditorCacheFreshness {
  id: string;
  scopeProjectKey: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  operationId: string;
  timestamp: string;
  revision: number;
  checkpoint: VideoProjectDocument;
  undo?: VideoOperationUndoPayload;
  historyEntry?: VideoHistoryEntry;
}

export interface CachedCommandHistoryRecord extends EditorCacheFreshness {
  id: string;
  scopeProjectKey: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  commandId?: string;
  source: "manual" | "ai";
  text: string;
  timestamp: string;
  operationBatchId?: string;
  status?: "queued" | "applied" | "failed" | "discarded";
}

export interface CachedPendingSyncRecord extends EditorCacheFreshness {
  id: string;
  scopeProjectKey: string;
  scopeKey: string;
  scope: EditorCacheScope;
  projectId: string;
  kind: "project" | "timelineDraft" | "operationLog" | "mediaMetadata" | string;
  queuedAt: string;
  entityId?: string;
  operationBatchId?: string;
  metadata?: JsonValue;
  retryCount: number;
  lastError?: string;
}

export interface SaveProjectSnapshotInput {
  scope: EditorCacheScope;
  projectId: string;
  snapshot?: JsonValue;
  projectUpdatedAt?: string;
  documentSchemaVersion?: number;
  revision?: number;
  ttlMs?: number;
  now?: number;
}

export interface SaveMediaObjectCacheEntryInput {
  scope: EditorCacheScope;
  mediaId: string;
  variant: MediaObjectVariant;
  storageKey: string;
  sizeBytes?: number;
  contentType?: string;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
  now?: number;
}

export interface SaveVideoTimelineDraftOptions {
  now?: number;
  serverRevisionNumber?: number;
  lastSyncedAt?: string | null;
  hasUnsyncedChanges?: boolean;
  syncError?: string | null;
}

export interface EditorCacheCleanupPolicy {
  now?: number;
  undoCheckpointLimit?: number;
  operationLogLimit?: number;
  commandHistoryLimit?: number;
}

export interface EditorCacheCleanupPlanInput {
  projects?: CleanupCandidate[];
  projectSnapshots?: CleanupCandidate[];
  mediaAssets?: CleanupCandidate[];
  mediaObjectCache?: CleanupCandidate[];
  operationLog?: CleanupCandidate[];
  undoCheckpoints?: CleanupCandidate[];
  commandHistory?: CleanupCandidate[];
  pendingSync?: CleanupCandidate[];
}

export interface CleanupCandidate {
  id: string;
  scopeProjectKey?: string;
  cachedAt?: number;
  expiresAt?: number;
  timestamp?: string;
  revision?: number;
}

export interface EditorCacheCleanupPlan {
  projects: string[];
  projectSnapshots: string[];
  mediaAssets: string[];
  mediaObjectCache: string[];
  operationLog: string[];
  undoCheckpoints: string[];
  commandHistory: string[];
  pendingSync: string[];
}

export interface EditorCache {
  saveProjectMetadata(project: ProjectDto, scope: EditorCacheScope, options?: { ttlMs?: number; now?: number }): Promise<EditorCacheResult<CachedProjectRecord>>;
  getProjectMetadata(scope: EditorCacheScope, projectId: string, options?: { expectedUpdatedAt?: string; now?: number }): Promise<EditorCacheResult<ProjectDto>>;
  saveProjectSnapshot(input: SaveProjectSnapshotInput): Promise<EditorCacheResult<CachedProjectSnapshotRecord>>;
  getProjectSnapshot(scope: EditorCacheScope, projectId: string, options?: { now?: number }): Promise<EditorCacheResult<CachedProjectSnapshotRecord>>;
  saveVideoTimelineDraft(document: VideoProjectDocument, scope: EditorCacheScope, options?: SaveVideoTimelineDraftOptions): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>>;
  getVideoTimelineDraft(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<VideoProjectDocument>>;
  getVideoTimelineDraftRecord(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>>;
  deleteVideoTimelineDraft(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<void>>;
  saveMediaAssets(media: MediaDto[], scope: EditorCacheScope, options?: { ttlMs?: number; now?: number }): Promise<EditorCacheResult<CachedMediaAssetRecord[]>>;
  listMediaAssets(scope: EditorCacheScope, options?: { now?: number }): Promise<EditorCacheResult<MediaDto[]>>;
  saveMediaObjectCacheEntry(input: SaveMediaObjectCacheEntryInput): Promise<EditorCacheResult<CachedMediaObjectRecord>>;
  getMediaObjectCacheEntry(scope: EditorCacheScope, mediaId: string, variant: MediaObjectVariant, options?: { now?: number }): Promise<EditorCacheResult<CachedMediaObjectRecord>>;
  appendOperationLog(input: { scope: EditorCacheScope; projectId: string; batch: VideoOperationBatch; result?: VideoOperationApplyResult; now?: number }): Promise<EditorCacheResult<CachedOperationLogRecord>>;
  listOperationLog(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedOperationLogRecord[]>>;
  saveUndoCheckpoint(input: { scope: EditorCacheScope; projectId: string; operationId: string; timestamp?: string; checkpoint: VideoProjectDocument; undo?: VideoOperationUndoPayload; historyEntry?: VideoHistoryEntry; now?: number }): Promise<EditorCacheResult<CachedUndoCheckpointRecord>>;
  listUndoCheckpoints(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedUndoCheckpointRecord[]>>;
  saveCommandHistoryEntry(input: { scope: EditorCacheScope; projectId: string; text: string; source: "manual" | "ai"; commandId?: string; operationBatchId?: string; status?: CachedCommandHistoryRecord["status"]; timestamp?: string; now?: number }): Promise<EditorCacheResult<CachedCommandHistoryRecord>>;
  listCommandHistory(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedCommandHistoryRecord[]>>;
  enqueuePendingSync(input: { scope: EditorCacheScope; projectId: string; kind: CachedPendingSyncRecord["kind"]; entityId?: string; operationBatchId?: string; metadata?: JsonValue; queuedAt?: string; now?: number }): Promise<EditorCacheResult<CachedPendingSyncRecord>>;
  listPendingSync(scope: EditorCacheScope, projectId?: string): Promise<EditorCacheResult<CachedPendingSyncRecord[]>>;
  deletePendingSync(id: string): Promise<EditorCacheResult<void>>;
  cleanupEditorCache(policy?: EditorCacheCleanupPolicy): Promise<EditorCacheResult<EditorCacheCleanupPlan>>;
}

type EditorDexie = Dexie & {
  table<T, Key = string>(tableName: string): Table<T, Key>;
};

let cacheSingleton: Promise<EditorCacheResult<EditorCache>> | null = null;

export function isEditorCacheAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function getEditorCache(): Promise<EditorCacheResult<EditorCache>> {
  if (!isEditorCacheAvailable()) {
    return { ok: false, reason: "unavailable" };
  }

  cacheSingleton ??= createEditorCache();
  return cacheSingleton;
}

export function buildEditorCacheScope(input: {
  userId: string;
  ownerKind?: EditorCacheOwnerKind;
  ownerId?: string;
}): EditorCacheScope {
  const userId = input.userId.trim();
  const ownerKind = input.ownerKind ?? "user";
  const ownerId = (input.ownerId ?? (ownerKind === "user" ? userId : "")).trim();

  if (!userId || !ownerId) {
    throw new Error("Editor cache scope requires userId and ownerId.");
  }

  return { userId, ownerKind, ownerId };
}

export function buildEditorCacheKey(scope: EditorCacheScope, ...parts: Array<number | string>): string {
  return [scopeKey(scope), ...parts.map((part) => encodeURIComponent(String(part)))].join(":");
}

export function scopeKey(scope: EditorCacheScope): string {
  return `${scope.userId}:${scope.ownerKind}:${scope.ownerId}`;
}

export function projectScopeKey(scope: EditorCacheScope, projectId: string): string {
  return buildEditorCacheKey(scope, "project", projectId);
}

export async function saveProjectMetadata(
  project: ProjectDto,
  scope: EditorCacheScope,
  options?: { ttlMs?: number; now?: number },
): Promise<EditorCacheResult<CachedProjectRecord>> {
  return withEditorCache((cache) => cache.saveProjectMetadata(project, scope, options));
}

export async function getProjectMetadata(
  scope: EditorCacheScope,
  projectId: string,
  options?: { expectedUpdatedAt?: string; now?: number },
): Promise<EditorCacheResult<ProjectDto>> {
  return withEditorCache((cache) => cache.getProjectMetadata(scope, projectId, options));
}

export async function saveProjectSnapshot(input: SaveProjectSnapshotInput): Promise<EditorCacheResult<CachedProjectSnapshotRecord>> {
  return withEditorCache((cache) => cache.saveProjectSnapshot(input));
}

export async function getProjectSnapshot(
  scope: EditorCacheScope,
  projectId: string,
  options?: { now?: number },
): Promise<EditorCacheResult<CachedProjectSnapshotRecord>> {
  return withEditorCache((cache) => cache.getProjectSnapshot(scope, projectId, options));
}

export async function saveVideoTimelineDraft(
  document: VideoProjectDocument,
  scope: EditorCacheScope,
  options?: SaveVideoTimelineDraftOptions,
): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>> {
  return withEditorCache((cache) => cache.saveVideoTimelineDraft(document, scope, options));
}

export async function getVideoTimelineDraft(
  scope: EditorCacheScope,
  projectId: string,
): Promise<EditorCacheResult<VideoProjectDocument>> {
  return withEditorCache((cache) => cache.getVideoTimelineDraft(scope, projectId));
}

export async function getVideoTimelineDraftRecord(
  scope: EditorCacheScope,
  projectId: string,
): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>> {
  return withEditorCache((cache) => cache.getVideoTimelineDraftRecord(scope, projectId));
}

export async function deleteVideoTimelineDraft(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<void>> {
  return withEditorCache((cache) => cache.deleteVideoTimelineDraft(scope, projectId));
}

export async function saveMediaAssets(
  media: MediaDto[],
  scope: EditorCacheScope,
  options?: { ttlMs?: number; now?: number },
): Promise<EditorCacheResult<CachedMediaAssetRecord[]>> {
  return withEditorCache((cache) => cache.saveMediaAssets(media, scope, options));
}

export async function listMediaAssets(
  scope: EditorCacheScope,
  options?: { now?: number },
): Promise<EditorCacheResult<MediaDto[]>> {
  return withEditorCache((cache) => cache.listMediaAssets(scope, options));
}

export async function saveMediaObjectCacheEntry(
  input: SaveMediaObjectCacheEntryInput,
): Promise<EditorCacheResult<CachedMediaObjectRecord>> {
  return withEditorCache((cache) => cache.saveMediaObjectCacheEntry(input));
}

export async function getMediaObjectCacheEntry(
  scope: EditorCacheScope,
  mediaId: string,
  variant: MediaObjectVariant,
  options?: { now?: number },
): Promise<EditorCacheResult<CachedMediaObjectRecord>> {
  return withEditorCache((cache) => cache.getMediaObjectCacheEntry(scope, mediaId, variant, options));
}

export async function appendOperationLog(input: {
  scope: EditorCacheScope;
  projectId: string;
  batch: VideoOperationBatch;
  result?: VideoOperationApplyResult;
  now?: number;
}): Promise<EditorCacheResult<CachedOperationLogRecord>> {
  return withEditorCache((cache) => cache.appendOperationLog(input));
}

export async function listOperationLog(
  scope: EditorCacheScope,
  projectId: string,
): Promise<EditorCacheResult<CachedOperationLogRecord[]>> {
  return withEditorCache((cache) => cache.listOperationLog(scope, projectId));
}

export async function saveUndoCheckpoint(input: {
  scope: EditorCacheScope;
  projectId: string;
  operationId: string;
  timestamp?: string;
  checkpoint: VideoProjectDocument;
  undo?: VideoOperationUndoPayload;
  historyEntry?: VideoHistoryEntry;
  now?: number;
}): Promise<EditorCacheResult<CachedUndoCheckpointRecord>> {
  return withEditorCache((cache) => cache.saveUndoCheckpoint(input));
}

export async function listUndoCheckpoints(
  scope: EditorCacheScope,
  projectId: string,
): Promise<EditorCacheResult<CachedUndoCheckpointRecord[]>> {
  return withEditorCache((cache) => cache.listUndoCheckpoints(scope, projectId));
}

export async function saveCommandHistoryEntry(input: {
  scope: EditorCacheScope;
  projectId: string;
  text: string;
  source: "manual" | "ai";
  commandId?: string;
  operationBatchId?: string;
  status?: CachedCommandHistoryRecord["status"];
  timestamp?: string;
  now?: number;
}): Promise<EditorCacheResult<CachedCommandHistoryRecord>> {
  return withEditorCache((cache) => cache.saveCommandHistoryEntry(input));
}

export async function listCommandHistory(
  scope: EditorCacheScope,
  projectId: string,
): Promise<EditorCacheResult<CachedCommandHistoryRecord[]>> {
  return withEditorCache((cache) => cache.listCommandHistory(scope, projectId));
}

export async function enqueuePendingSync(input: {
  scope: EditorCacheScope;
  projectId: string;
  kind: CachedPendingSyncRecord["kind"];
  entityId?: string;
  operationBatchId?: string;
  metadata?: JsonValue;
  queuedAt?: string;
  now?: number;
}): Promise<EditorCacheResult<CachedPendingSyncRecord>> {
  return withEditorCache((cache) => cache.enqueuePendingSync(input));
}

export async function listPendingSync(
  scope: EditorCacheScope,
  projectId?: string,
): Promise<EditorCacheResult<CachedPendingSyncRecord[]>> {
  return withEditorCache((cache) => cache.listPendingSync(scope, projectId));
}

export async function deletePendingSync(id: string): Promise<EditorCacheResult<void>> {
  return withEditorCache((cache) => cache.deletePendingSync(id));
}

export async function cleanupEditorCache(policy?: EditorCacheCleanupPolicy): Promise<EditorCacheResult<EditorCacheCleanupPlan>> {
  return withEditorCache((cache) => cache.cleanupEditorCache(policy));
}

export function isEditorCacheRecordExpired(record: { expiresAt?: number }, now = Date.now()): boolean {
  return typeof record.expiresAt === "number" && record.expiresAt <= now;
}

export function serializeVideoTimelineDraft(document: VideoProjectDocument): EditorCacheResult<VideoProjectDocument> {
  return coerceVideoTimelineDraft(JSON.parse(JSON.stringify(document)) as unknown, document.projectId);
}

export function coerceVideoTimelineDraft(value: unknown, projectId?: string): EditorCacheResult<VideoProjectDocument> {
  const validation = validateVideoProjectDocument(value);

  if (!validation.ok) {
    return {
      ok: false,
      reason: hasSchemaMismatch(value) ? "schema-mismatch" : "corrupt",
      error: validation.errors.join("; "),
    };
  }

  if (projectId !== undefined && validation.document.projectId !== projectId) {
    return {
      ok: false,
      reason: "corrupt",
      error: "Draft projectId does not match the requested project.",
    };
  }

  return { ok: true, value: validation.document };
}

export function mediaStorageSignature(media: MediaDto): string {
  return [
    media.storageKey,
    media.canonicalStorageKey ?? "",
    media.proxyStorageKey ?? "",
    media.thumbnailStorageKey ?? "",
  ].join("|");
}

export function createMediaObjectCacheRecord(input: SaveMediaObjectCacheEntryInput): CachedMediaObjectRecord {
  const cachedAt = input.now ?? Date.now();

  return omitUndefined({
    key: buildEditorCacheKey(input.scope, "mediaObjectCache", input.mediaId, input.variant),
    scopeKey: scopeKey(input.scope),
    scope: input.scope,
    mediaId: input.mediaId,
    variant: input.variant,
    storageKey: input.storageKey,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    metadata: sanitizeMediaObjectMetadata(input.metadata),
    cachedAt,
    expiresAt: cachedAt + (input.ttlMs ?? EDITOR_CACHE_TTL_MS.mediaObjectMetadata),
  });
}

export function createOperationLogRecord(input: {
  scope: EditorCacheScope;
  projectId: string;
  batch: VideoOperationBatch;
  result?: VideoOperationApplyResult;
  now?: number;
}): CachedOperationLogRecord {
  return omitUndefined({
    id: buildEditorCacheKey(input.scope, "operationLog", input.projectId, input.batch.id),
    scopeProjectKey: projectScopeKey(input.scope, input.projectId),
    scopeKey: scopeKey(input.scope),
    scope: input.scope,
    projectId: input.projectId,
    timestamp: input.batch.timestamp,
    revision: input.result?.document.history.revision,
    batch: input.batch,
    result: input.result,
    cachedAt: input.now ?? Date.now(),
  }) as CachedOperationLogRecord;
}

export function createUndoCheckpointRecord(input: {
  scope: EditorCacheScope;
  projectId: string;
  operationId: string;
  timestamp?: string;
  checkpoint: VideoProjectDocument;
  undo?: VideoOperationUndoPayload;
  historyEntry?: VideoHistoryEntry;
  now?: number;
}): EditorCacheResult<CachedUndoCheckpointRecord> {
  const checkpoint = serializeVideoTimelineDraft(input.checkpoint);
  if (!checkpoint.ok) return checkpoint;

  const timestamp = input.timestamp ?? checkpoint.value.updatedAt;
  return {
    ok: true,
    value: omitUndefined({
      id: buildEditorCacheKey(input.scope, "undoCheckpoint", input.projectId, input.operationId),
      scopeProjectKey: projectScopeKey(input.scope, input.projectId),
      scopeKey: scopeKey(input.scope),
      scope: input.scope,
      projectId: input.projectId,
      operationId: input.operationId,
      timestamp,
      revision: checkpoint.value.history.revision,
      checkpoint: checkpoint.value,
      undo: input.undo,
      historyEntry: input.historyEntry,
      cachedAt: input.now ?? Date.now(),
    }) as CachedUndoCheckpointRecord,
  };
}

export function planEditorCacheCleanup(
  input: EditorCacheCleanupPlanInput,
  policy: EditorCacheCleanupPolicy = {},
): EditorCacheCleanupPlan {
  const now = policy.now ?? Date.now();
  const undoCheckpointLimit = policy.undoCheckpointLimit ?? 20;
  const operationLogLimit = policy.operationLogLimit ?? 500;
  const commandHistoryLimit = policy.commandHistoryLimit ?? 100;

  return {
    projects: expiredIds(input.projects, now),
    projectSnapshots: expiredIds(input.projectSnapshots, now),
    mediaAssets: expiredIds(input.mediaAssets, now),
    mediaObjectCache: expiredIds(input.mediaObjectCache, now),
    operationLog: pruneOldestByProject(input.operationLog, operationLogLimit),
    undoCheckpoints: pruneOldestByProject(input.undoCheckpoints, undoCheckpointLimit),
    commandHistory: pruneOldestByProject(input.commandHistory, commandHistoryLimit),
    pendingSync: [],
  };
}

async function createEditorCache(): Promise<EditorCacheResult<EditorCache>> {
  try {
    const { default: DexieClass } = await import("dexie");
    const db = new DexieClass(EDITOR_CACHE_DATABASE_NAME) as EditorDexie;

    db.version(EDITOR_CACHE_DATABASE_VERSION).stores({
      projects: "key, scopeKey, projectId, cachedAt, expiresAt, projectUpdatedAt",
      projectSnapshots: "key, scopeKey, projectId, documentSchemaVersion, cachedAt, expiresAt",
      videoTimelineDrafts: "key, scopeKey, projectId, documentSchemaVersion, cachedAt, documentUpdatedAt, revision",
      mediaAssets: "key, scopeKey, mediaId, cachedAt, expiresAt, storageSignature",
      mediaObjectCache: "key, scopeKey, mediaId, variant, cachedAt, expiresAt, storageKey",
      operationLog: "id, scopeProjectKey, scopeKey, projectId, cachedAt, timestamp, revision",
      undoCheckpoints: "id, scopeProjectKey, scopeKey, projectId, cachedAt, timestamp, revision",
      commandHistory: "id, scopeProjectKey, scopeKey, projectId, cachedAt, timestamp, commandId",
      pendingSync: "id, scopeProjectKey, scopeKey, projectId, cachedAt, queuedAt, kind",
    });

    await db.open();
    return { ok: true, value: new DexieEditorCache(db) };
  } catch (error) {
    cacheSingleton = null;
    return { ok: false, reason: "error", error: errorMessage(error) };
  }
}

class DexieEditorCache implements EditorCache {
  constructor(private readonly db: EditorDexie) {}

  async saveProjectMetadata(
    project: ProjectDto,
    scope: EditorCacheScope,
    options: { ttlMs?: number; now?: number } = {},
  ): Promise<EditorCacheResult<CachedProjectRecord>> {
    return this.run(async () => {
      const cachedAt = options.now ?? Date.now();
      const record: CachedProjectRecord = {
        key: buildEditorCacheKey(scope, "project", project.id),
        scopeKey: scopeKey(scope),
        scope,
        projectId: project.id,
        projectUpdatedAt: project.updatedAt,
        project,
        cachedAt,
        expiresAt: cachedAt + (options.ttlMs ?? EDITOR_CACHE_TTL_MS.projectMetadata),
      };

      await this.projects.put(record);
      return record;
    });
  }

  async getProjectMetadata(
    scope: EditorCacheScope,
    projectId: string,
    options: { expectedUpdatedAt?: string; now?: number } = {},
  ): Promise<EditorCacheResult<ProjectDto>> {
    return this.read(async () => {
      const record = await this.projects.get(buildEditorCacheKey(scope, "project", projectId));
      if (!record) return { ok: false, reason: "miss" };
      if (isEditorCacheRecordExpired(record, options.now)) return { ok: false, reason: "expired" };
      if (options.expectedUpdatedAt && record.projectUpdatedAt !== options.expectedUpdatedAt) {
        return { ok: false, reason: "expired" };
      }
      return { ok: true, value: record.project };
    });
  }

  async saveProjectSnapshot(input: SaveProjectSnapshotInput): Promise<EditorCacheResult<CachedProjectSnapshotRecord>> {
    return this.run(async () => {
      const cachedAt = input.now ?? Date.now();
      const record = omitUndefined({
        key: buildEditorCacheKey(input.scope, "projectSnapshot", input.projectId),
        scopeKey: scopeKey(input.scope),
        scope: input.scope,
        projectId: input.projectId,
        documentSchemaVersion: input.documentSchemaVersion,
        projectUpdatedAt: input.projectUpdatedAt,
        revision: input.revision,
        snapshot: input.snapshot,
        cachedAt,
        expiresAt: input.ttlMs === undefined ? undefined : cachedAt + input.ttlMs,
      }) as CachedProjectSnapshotRecord;

      await this.projectSnapshots.put(record);
      return record;
    });
  }

  async getProjectSnapshot(
    scope: EditorCacheScope,
    projectId: string,
    options: { now?: number } = {},
  ): Promise<EditorCacheResult<CachedProjectSnapshotRecord>> {
    return this.read(async () => {
      const record = await this.projectSnapshots.get(buildEditorCacheKey(scope, "projectSnapshot", projectId));
      if (!record) return { ok: false, reason: "miss" };
      if (isEditorCacheRecordExpired(record, options.now)) return { ok: false, reason: "expired" };
      return { ok: true, value: record };
    });
  }

  async saveVideoTimelineDraft(
    document: VideoProjectDocument,
    scope: EditorCacheScope,
    options: SaveVideoTimelineDraftOptions = {},
  ): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>> {
    const serialized = serializeVideoTimelineDraft(document);
    if (!serialized.ok) return serialized;

    return this.run(async () => {
      const cachedAt = options.now ?? Date.now();
      const record: CachedVideoTimelineDraftRecord = {
        key: draftKey(scope, document.projectId),
        scopeKey: scopeKey(scope),
        scope,
        projectId: document.projectId,
        documentSchemaVersion: VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
        documentUpdatedAt: document.updatedAt,
        revision: document.history.revision,
        document: serialized.value,
        serverRevisionNumber: options.serverRevisionNumber,
        lastSyncedAt: options.lastSyncedAt,
        hasUnsyncedChanges: options.hasUnsyncedChanges,
        syncError: options.syncError,
        cachedAt,
      };

      await this.videoTimelineDrafts.put(record);
      return record;
    });
  }

  async getVideoTimelineDraft(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<VideoProjectDocument>> {
    return this.read(async () => {
      const record = await this.videoTimelineDrafts.get(draftKey(scope, projectId));
      if (!record) return { ok: false, reason: "miss" };
      if (record.documentSchemaVersion !== VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION) {
        return { ok: false, reason: "schema-mismatch" };
      }
      return coerceVideoTimelineDraft(record.document, projectId);
    });
  }

  async getVideoTimelineDraftRecord(
    scope: EditorCacheScope,
    projectId: string,
  ): Promise<EditorCacheResult<CachedVideoTimelineDraftRecord>> {
    return this.read(async () => {
      const record = await this.videoTimelineDrafts.get(draftKey(scope, projectId));
      if (!record) return { ok: false, reason: "miss" };
      if (record.documentSchemaVersion !== VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION) {
        return { ok: false, reason: "schema-mismatch" };
      }

      const draft = coerceVideoTimelineDraft(record.document, projectId);
      if (!draft.ok) return draft;
      return {
        ok: true,
        value: {
          ...record,
          document: draft.value,
        },
      };
    });
  }

  async deleteVideoTimelineDraft(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<void>> {
    return this.run(async () => {
      await this.videoTimelineDrafts.delete(draftKey(scope, projectId));
    });
  }

  async saveMediaAssets(
    media: MediaDto[],
    scope: EditorCacheScope,
    options: { ttlMs?: number; now?: number } = {},
  ): Promise<EditorCacheResult<CachedMediaAssetRecord[]>> {
    return this.run(async () => {
      const cachedAt = options.now ?? Date.now();
      const expiresAt = cachedAt + (options.ttlMs ?? EDITOR_CACHE_TTL_MS.mediaMetadata);
      const records = media.map((item): CachedMediaAssetRecord => ({
        key: buildEditorCacheKey(scope, "media", item.id),
        scopeKey: scopeKey(scope),
        scope,
        mediaId: item.id,
        storageSignature: mediaStorageSignature(item),
        media: item,
        cachedAt,
        expiresAt,
      }));

      await this.mediaAssets.bulkPut(records);
      return records;
    });
  }

  async listMediaAssets(scope: EditorCacheScope, options: { now?: number } = {}): Promise<EditorCacheResult<MediaDto[]>> {
    return this.read(async () => {
      const records = await this.mediaAssets.where("scopeKey").equals(scopeKey(scope)).toArray();
      return {
        ok: true,
        value: records.filter((record) => !isEditorCacheRecordExpired(record, options.now)).map((record) => record.media),
      };
    });
  }

  async saveMediaObjectCacheEntry(input: SaveMediaObjectCacheEntryInput): Promise<EditorCacheResult<CachedMediaObjectRecord>> {
    return this.run(async () => {
      const record = createMediaObjectCacheRecord(input);
      await this.mediaObjectCache.put(record);
      return record;
    });
  }

  async getMediaObjectCacheEntry(
    scope: EditorCacheScope,
    mediaId: string,
    variant: MediaObjectVariant,
    options: { now?: number } = {},
  ): Promise<EditorCacheResult<CachedMediaObjectRecord>> {
    return this.read(async () => {
      const record = await this.mediaObjectCache.get(buildEditorCacheKey(scope, "mediaObjectCache", mediaId, variant));
      if (!record) return { ok: false, reason: "miss" };
      if (isEditorCacheRecordExpired(record, options.now)) return { ok: false, reason: "expired" };
      return { ok: true, value: record };
    });
  }

  async appendOperationLog(input: {
    scope: EditorCacheScope;
    projectId: string;
    batch: VideoOperationBatch;
    result?: VideoOperationApplyResult;
    now?: number;
  }): Promise<EditorCacheResult<CachedOperationLogRecord>> {
    return this.run(async () => {
      const record = createOperationLogRecord(input);
      await this.operationLog.put(record);
      return record;
    });
  }

  async listOperationLog(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedOperationLogRecord[]>> {
    return this.read(async () => ({
      ok: true,
      value: sortNewestFirst(await this.operationLog.where("scopeProjectKey").equals(projectScopeKey(scope, projectId)).toArray()),
    }));
  }

  async saveUndoCheckpoint(input: {
    scope: EditorCacheScope;
    projectId: string;
    operationId: string;
    timestamp?: string;
    checkpoint: VideoProjectDocument;
    undo?: VideoOperationUndoPayload;
    historyEntry?: VideoHistoryEntry;
    now?: number;
  }): Promise<EditorCacheResult<CachedUndoCheckpointRecord>> {
    const record = createUndoCheckpointRecord(input);
    if (!record.ok) return record;

    return this.run(async () => {
      await this.undoCheckpoints.put(record.value);
      return record.value;
    });
  }

  async listUndoCheckpoints(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedUndoCheckpointRecord[]>> {
    return this.read(async () => ({
      ok: true,
      value: sortNewestFirst(await this.undoCheckpoints.where("scopeProjectKey").equals(projectScopeKey(scope, projectId)).toArray()),
    }));
  }

  async saveCommandHistoryEntry(input: {
    scope: EditorCacheScope;
    projectId: string;
    text: string;
    source: "manual" | "ai";
    commandId?: string;
    operationBatchId?: string;
    status?: CachedCommandHistoryRecord["status"];
    timestamp?: string;
    now?: number;
  }): Promise<EditorCacheResult<CachedCommandHistoryRecord>> {
    return this.run(async () => {
      const timestamp = input.timestamp ?? new Date(input.now ?? Date.now()).toISOString();
      const id = buildEditorCacheKey(
        input.scope,
        "commandHistory",
        input.projectId,
        input.commandId ?? `${timestamp}:${input.text}`,
      );
      const record = omitUndefined({
        id,
        scopeProjectKey: projectScopeKey(input.scope, input.projectId),
        scopeKey: scopeKey(input.scope),
        scope: input.scope,
        projectId: input.projectId,
        commandId: input.commandId,
        source: input.source,
        text: input.text,
        timestamp,
        operationBatchId: input.operationBatchId,
        status: input.status,
        cachedAt: input.now ?? Date.now(),
      }) as CachedCommandHistoryRecord;

      await this.commandHistory.put(record);
      return record;
    });
  }

  async listCommandHistory(scope: EditorCacheScope, projectId: string): Promise<EditorCacheResult<CachedCommandHistoryRecord[]>> {
    return this.read(async () => ({
      ok: true,
      value: sortNewestFirst(await this.commandHistory.where("scopeProjectKey").equals(projectScopeKey(scope, projectId)).toArray()),
    }));
  }

  async enqueuePendingSync(input: {
    scope: EditorCacheScope;
    projectId: string;
    kind: CachedPendingSyncRecord["kind"];
    entityId?: string;
    operationBatchId?: string;
    metadata?: JsonValue;
    queuedAt?: string;
    now?: number;
  }): Promise<EditorCacheResult<CachedPendingSyncRecord>> {
    return this.run(async () => {
      const queuedAt = input.queuedAt ?? new Date(input.now ?? Date.now()).toISOString();
      const id = buildEditorCacheKey(
        input.scope,
        "pendingSync",
        input.projectId,
        input.kind,
        input.entityId ?? input.operationBatchId ?? queuedAt,
      );
      const record = omitUndefined({
        id,
        scopeProjectKey: projectScopeKey(input.scope, input.projectId),
        scopeKey: scopeKey(input.scope),
        scope: input.scope,
        projectId: input.projectId,
        kind: input.kind,
        queuedAt,
        entityId: input.entityId,
        operationBatchId: input.operationBatchId,
        metadata: input.metadata,
        retryCount: 0,
        cachedAt: input.now ?? Date.now(),
      }) as CachedPendingSyncRecord;

      await this.pendingSync.put(record);
      return record;
    });
  }

  async listPendingSync(scope: EditorCacheScope, projectId?: string): Promise<EditorCacheResult<CachedPendingSyncRecord[]>> {
    return this.read(async () => {
      const records =
        projectId === undefined
          ? await this.pendingSync.where("scopeKey").equals(scopeKey(scope)).toArray()
          : await this.pendingSync.where("scopeProjectKey").equals(projectScopeKey(scope, projectId)).toArray();

      return { ok: true, value: sortNewestFirst(records) };
    });
  }

  async deletePendingSync(id: string): Promise<EditorCacheResult<void>> {
    return this.run(async () => {
      await this.pendingSync.delete(id);
    });
  }

  async cleanupEditorCache(policy: EditorCacheCleanupPolicy = {}): Promise<EditorCacheResult<EditorCacheCleanupPlan>> {
    return this.run(async () => {
      const plan = planEditorCacheCleanup(
        {
          projects: keyedCandidates(await this.projects.toArray()),
          projectSnapshots: keyedCandidates(await this.projectSnapshots.toArray()),
          mediaAssets: keyedCandidates(await this.mediaAssets.toArray()),
          mediaObjectCache: keyedCandidates(await this.mediaObjectCache.toArray()),
          operationLog: await this.operationLog.toArray(),
          undoCheckpoints: await this.undoCheckpoints.toArray(),
          commandHistory: await this.commandHistory.toArray(),
          pendingSync: await this.pendingSync.toArray(),
        },
        policy,
      );

      await Promise.all([
        this.projects.bulkDelete(plan.projects),
        this.projectSnapshots.bulkDelete(plan.projectSnapshots),
        this.mediaAssets.bulkDelete(plan.mediaAssets),
        this.mediaObjectCache.bulkDelete(plan.mediaObjectCache),
        this.operationLog.bulkDelete(plan.operationLog),
        this.undoCheckpoints.bulkDelete(plan.undoCheckpoints),
        this.commandHistory.bulkDelete(plan.commandHistory),
      ]);

      return plan;
    });
  }

  private get projects() {
    return this.db.table<CachedProjectRecord>("projects");
  }

  private get projectSnapshots() {
    return this.db.table<CachedProjectSnapshotRecord>("projectSnapshots");
  }

  private get videoTimelineDrafts() {
    return this.db.table<CachedVideoTimelineDraftRecord>("videoTimelineDrafts");
  }

  private get mediaAssets() {
    return this.db.table<CachedMediaAssetRecord>("mediaAssets");
  }

  private get mediaObjectCache() {
    return this.db.table<CachedMediaObjectRecord>("mediaObjectCache");
  }

  private get operationLog() {
    return this.db.table<CachedOperationLogRecord>("operationLog");
  }

  private get undoCheckpoints() {
    return this.db.table<CachedUndoCheckpointRecord>("undoCheckpoints");
  }

  private get commandHistory() {
    return this.db.table<CachedCommandHistoryRecord>("commandHistory");
  }

  private get pendingSync() {
    return this.db.table<CachedPendingSyncRecord>("pendingSync");
  }

  private async run<T>(operation: () => Promise<T>): Promise<EditorCacheResult<T>> {
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      return { ok: false, reason: "error", error: errorMessage(error) };
    }
  }

  private async read<T>(operation: () => Promise<EditorCacheResult<T>>): Promise<EditorCacheResult<T>> {
    try {
      return await operation();
    } catch (error) {
      return { ok: false, reason: "error", error: errorMessage(error) };
    }
  }
}

async function withEditorCache<T>(
  operation: (cache: EditorCache) => Promise<EditorCacheResult<T>>,
): Promise<EditorCacheResult<T>> {
  const cache = await getEditorCache();
  if (!cache.ok) return cache;
  return operation(cache.value);
}

function draftKey(scope: EditorCacheScope, projectId: string): string {
  return buildEditorCacheKey(
    scope,
    "videoTimelineDraft",
    projectId,
    VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
  );
}

function hasSchemaMismatch(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    (value as { schemaVersion?: unknown }).schemaVersion !== VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION
  );
}

function expiredIds(records: CleanupCandidate[] | undefined, now: number): string[] {
  return (records ?? [])
    .filter((record) => isEditorCacheRecordExpired(record, now))
    .map((record) => record.id);
}

function keyedCandidates<T extends { key: string; cachedAt?: number; expiresAt?: number }>(records: T[]): CleanupCandidate[] {
  return records.map((record) => ({
    id: record.key,
    cachedAt: record.cachedAt,
    expiresAt: record.expiresAt,
  }));
}

function pruneOldestByProject(records: CleanupCandidate[] | undefined, limit: number): string[] {
  if (limit < 0) return (records ?? []).map((record) => record.id);

  const groups = new Map<string, CleanupCandidate[]>();
  for (const record of records ?? []) {
    const key = record.scopeProjectKey ?? "__global";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return Array.from(groups.values()).flatMap((group) =>
    sortNewestFirst(group)
      .slice(limit)
      .map((record) => record.id),
  );
}

function sortNewestFirst<T extends CleanupCandidate>(records: T[]): T[] {
  return [...records].sort((a, b) => sortValue(b) - sortValue(a));
}

function sortValue(record: CleanupCandidate): number {
  if (typeof record.revision === "number") return record.revision;
  if (record.timestamp) {
    const value = Date.parse(record.timestamp);
    if (Number.isFinite(value)) return value;
  }
  return record.cachedAt ?? 0;
}

function sanitizeMediaObjectMetadata(metadata: Record<string, unknown> | undefined): Record<string, JsonValue> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key === "blob" || key === "objectUrl" || key === "url" || key === "src") continue;
    const jsonValue = toJsonValue(value);
    if (jsonValue !== undefined) sanitized[key] = jsonValue;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return Number.isNaN(value) ? undefined : value;
  }

  if (Array.isArray(value)) {
    const items = value.map(toJsonValue).filter((item): item is JsonValue => item !== undefined);
    return items;
  }

  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const record: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "blob" || key === "objectUrl" || key === "url" || key === "src") continue;
      const jsonChild = toJsonValue(child);
      if (jsonChild !== undefined) record[key] = jsonChild;
    }
    return record;
  }

  return undefined;
}

function omitUndefined<T extends Record<string, unknown>>(record: T): T {
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) {
      delete record[key];
    }
  }

  return record;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
