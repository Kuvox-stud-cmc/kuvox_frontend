import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyEditorRecoveryError,
  draftRecoveryState,
} from "../app/lib/editor/editor-recovery";
import { createMockVideoProjectDocument } from "../app/lib/editor/video-document";
import type { CachedPendingSyncRecord } from "../app/lib/editor/editor-cache";

function main(): void {
  assertFailureClassification();
  assertDraftRecoveryPrompt();
  assertCorruptDraftWarning();
  assertReloadServerCopyIsGuarded();
  assertRouteAndPanelBoundaries();
  assertMediaAndRenderRetryUi();
}

function assertFailureClassification(): void {
  assert.equal(classifyEditorRecoveryError({ status: 401 }, "route").kind, "stale-auth");
  assert.equal(classifyEditorRecoveryError({ status: 403 }, "route").kind, "stale-auth");
  assert.equal(classifyEditorRecoveryError({ status: 409 }, "sync").kind, "sync-failed");
  assert.equal(classifyEditorRecoveryError({ status: 503 }, "route").kind, "api-unavailable");
  assert.equal(classifyEditorRecoveryError(new TypeError("Failed to fetch"), "route").kind, "api-unavailable");
  assert.equal(classifyEditorRecoveryError(new Error("Draft cache corrupt."), "cache").kind, "cache-corrupt");
  assert.equal(classifyEditorRecoveryError(new Error("Timeline sync failed."), "sync").kind, "sync-failed");
  assert.equal(classifyEditorRecoveryError(new Error("Render job failed."), "render").kind, "render-failed");
}

function assertDraftRecoveryPrompt(): void {
  const document = createMockVideoProjectDocument("project-recovery", "Recovery");
  const state = draftRecoveryState({
    draft: { ok: true, value: document },
    draftRecord: {
      ok: true,
      value: {
        key: "draft",
        scopeKey: "scope",
        scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
        projectId: "project-recovery",
        documentSchemaVersion: document.schemaVersion,
        documentUpdatedAt: document.updatedAt,
        revision: document.history.revision,
        document,
        hasUnsyncedChanges: true,
        cachedAt: 1,
      },
    },
    pendingSync: { ok: true, value: [pendingSyncRecord()] },
  });

  assert.equal(state.state, "prompt");
  if (state.state === "prompt") {
    assert.equal(state.defaultAction, "continue-local-draft");
    assert.equal(state.secondaryAction, "reload-server-copy");
    assert.equal(state.pendingSyncCount, 1);
  }
}

function assertCorruptDraftWarning(): void {
  const corrupt = draftRecoveryState({
    draft: { ok: false, reason: "corrupt", error: "bad draft" },
    pendingSync: { ok: true, value: [] },
  });
  assert.deepEqual(corrupt, {
    state: "warning",
    kind: "cache-corrupt",
    cacheReason: "corrupt",
    message: "Local video draft cache corrupt. Loaded the server copy instead.",
  });

  const schemaMismatch = draftRecoveryState({
    draft: { ok: false, reason: "schema-mismatch" },
    pendingSync: { ok: true, value: [] },
  });
  assert.equal(schemaMismatch.state, "warning");
  if (schemaMismatch.state === "warning") {
    assert.equal(schemaMismatch.cacheReason, "schema-mismatch");
  }
}

function assertReloadServerCopyIsGuarded(): void {
  const source = read("app/components/editor/use-video-autosave.ts");
  const saveIndex = source.indexOf("await saveVideoTimelineDraft(currentDocument, cacheScope");
  const fetchIndex = source.indexOf("const serverResult = await getVideoTimelineFromBff(projectId)");
  const loadIndex = source.indexOf("dispatch(editorDocumentLoaded({\n        document: server.document");
  const clearIndex = source.indexOf("await clearLocalTimelineDraftAfterServerReload(cacheScope, projectId)", loadIndex);
  const deleteIndex = source.indexOf("await deleteVideoTimelineDraft(cacheScope, projectId)");
  const pendingDeleteIndex = source.indexOf("deletePendingSync(entry.id)", deleteIndex);

  assert.ok(saveIndex > -1, "reloadServerCopy must force-save current local draft");
  assert.ok(fetchIndex > saveIndex, "server reload must happen after local draft preservation");
  assert.ok(loadIndex > fetchIndex, "replacement document must be loaded before cleanup");
  assert.ok(clearIndex > loadIndex, "local draft cleanup must follow successful document load");
  assert.ok(pendingDeleteIndex > deleteIndex, "pending sync records are cleared only inside post-load cleanup");
}

function assertRouteAndPanelBoundaries(): void {
  const route = read("app/routes/editor/video.tsx");
  const workspace = read("app/components/editor/video-editor-workspace.tsx");
  const panelBoundary = read("app/components/editor/editor-panel-error-boundary.tsx");

  assert.match(route, /export function ErrorBoundary/);
  assert.match(route, /data-editor-video-route-error-boundary/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Media library"/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Preview"/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Assistant"/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Inspector"/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Timeline"/);
  assert.match(workspace, /EditorPanelErrorBoundary label="Modal layer"/);
  assert.match(panelBoundary, /data-editor-panel-error-boundary/);
}

function assertMediaAndRenderRetryUi(): void {
  const mediaLibrary = read("app/components/editor/media-library-panel.tsx");
  const workspace = read("app/components/editor/video-editor-workspace.tsx");
  const exportModal = read("app/components/editor/video-export-modal.tsx");

  assert.match(mediaLibrary, /Retry media/);
  assert.match(mediaLibrary, /mediaRetrying/);
  assert.match(workspace, /onRetryMediaLoad/);
  assert.match(exportModal, /Retry render job/);
  assert.match(exportModal, /renderRequest/);
}

function pendingSyncRecord(): CachedPendingSyncRecord {
  return {
    id: "pending-1",
    scopeProjectKey: "scope:project",
    scopeKey: "scope",
    scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
    projectId: "project-recovery",
    kind: "timelineDraft",
    queuedAt: "2026-02-01T10:05:00.000Z",
    retryCount: 0,
    cachedAt: 1,
  };
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

main();
