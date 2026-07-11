import assert from "node:assert/strict";

import { OwnerKind, ProjectKind, type ProjectDto } from "../app/lib/api";
import {
  buildEditorCacheScopeFromProject,
  resolveCachedEditorDocument,
} from "../app/lib/editor/editor-load";
import { createMockVideoProjectDocument } from "../app/lib/editor/video-document";

function main(): void {
  assertScopeMapping();
  assertValidDraftWins();
  assertCorruptDraftFallsBack();
  assertConflictDetection();
  assertSavedLocalWithoutServerChange();
  assertUnavailableServerUsesPreviouslyOpenedCache();
  assertUnavailableServerWithoutCacheFails();
  assertConfirmedNotFoundCreatesEmptyDocument();
}

function assertScopeMapping(): void {
  const personal = project({ ownerKind: OwnerKind.User, ownerId: "owner-user" });
  const studio = project({ ownerKind: OwnerKind.Studio, ownerId: "studio-1" });

  assert.deepEqual(buildEditorCacheScopeFromProject("user-1", personal), {
    userId: "user-1",
    ownerKind: "user",
    ownerId: "owner-user",
  });
  assert.deepEqual(buildEditorCacheScopeFromProject("user-1", studio), {
    userId: "user-1",
    ownerKind: "studio",
    ownerId: "studio-1",
  });
}

function assertValidDraftWins(): void {
  const draft = createMockVideoProjectDocument("project-1", "Draft");
  const server = createMockVideoProjectDocument("project-1", "Server");
  const resolved = ready(resolveCachedEditorDocument({
    project: project({ id: "project-1", name: "Server" }),
    draft: { ok: true, value: draft },
    pendingSync: { ok: true, value: [] },
    serverTimeline: found(server, 2),
  }));

  assert.equal(resolved.source, "server");
  assert.equal(resolved.document.name, "Server");
  assert.equal(resolved.syncStatus, "clean");
}

function assertCorruptDraftFallsBack(): void {
  const server = createMockVideoProjectDocument("project-1", "Server");
  const resolved = ready(resolveCachedEditorDocument({
    project: project({ id: "project-1", name: "Server" }),
    draft: { ok: false, reason: "corrupt", error: "bad document" },
    pendingSync: { ok: true, value: [] },
    serverTimeline: found(server, 2),
  }));

  assert.equal(resolved.source, "server");
  assert.equal(resolved.document.name, "Server");
  assert.equal(resolved.syncStatus, "clean");
  assert.deepEqual(resolved.warnings, [
    "Draft cache corrupt.",
    "Local video draft cache corrupt. Loaded the server copy instead.",
  ]);
}

function assertConflictDetection(): void {
  const draft = createMockVideoProjectDocument("project-1", "Draft");
  const resolved = ready(resolveCachedEditorDocument({
    project: project({
      id: "project-1",
      updatedAt: "2026-02-02T10:00:00.000Z",
    }),
    draft: { ok: true, value: draft },
    cachedProject: {
      ok: true,
      value: project({
        id: "project-1",
        updatedAt: "2026-02-01T10:00:00.000Z",
      }),
    },
    pendingSync: {
      ok: true,
      value: [
        {
          id: "pending-1",
          scopeProjectKey: "scope:project",
          scopeKey: "scope",
          scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
          projectId: "project-1",
          kind: "timelineDraft",
          queuedAt: "2026-02-01T10:05:00.000Z",
          retryCount: 0,
          cachedAt: 1,
        },
      ],
    },
    serverTimeline: found(createMockVideoProjectDocument("project-1", "Server"), 2),
  }));

  assert.equal(resolved.syncStatus, "server-changed");
  assert.equal(resolved.conflict?.reason, "local-unsynced-server-changed");
}

function assertSavedLocalWithoutServerChange(): void {
  const draft = createMockVideoProjectDocument("project-1", "Draft");
  const resolved = ready(resolveCachedEditorDocument({
    project: project({
      id: "project-1",
      updatedAt: "2026-02-01T10:00:00.000Z",
    }),
    draft: { ok: true, value: draft },
    cachedProject: {
      ok: true,
      value: project({
        id: "project-1",
        updatedAt: "2026-02-01T10:00:00.000Z",
      }),
    },
    pendingSync: {
      ok: true,
      value: [
        {
          id: "pending-1",
          scopeProjectKey: "scope:project",
          scopeKey: "scope",
          scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
          projectId: "project-1",
          kind: "timelineDraft",
          queuedAt: "2026-02-01T10:05:00.000Z",
          retryCount: 0,
          cachedAt: 1,
        },
      ],
    },
    serverTimeline: found(createMockVideoProjectDocument("project-1", "Server"), 1),
  }));

  assert.equal(resolved.syncStatus, "saved-local");
  assert.equal(resolved.conflict, null);
}

function assertUnavailableServerUsesPreviouslyOpenedCache(): void {
  const draft = createMockVideoProjectDocument("project-1", "Cached");
  const resolved = ready(resolveCachedEditorDocument({
    project: project(),
    draft: { ok: true, value: draft },
    cachedProject: { ok: true, value: project() },
    pendingSync: { ok: true, value: [] },
    serverTimeline: { status: "unavailable", message: "offline" },
  }));

  assert.equal(resolved.source, "cached");
  assert.equal(resolved.document.name, "Cached");
}

function assertUnavailableServerWithoutCacheFails(): void {
  const resolved = resolveCachedEditorDocument({
    project: project(),
    draft: { ok: false, reason: "miss" },
    pendingSync: { ok: true, value: [] },
    serverTimeline: { status: "unavailable", message: "offline" },
  });

  assert.deepEqual(resolved, { status: "failure", message: "offline", warnings: [] });
}

function assertConfirmedNotFoundCreatesEmptyDocument(): void {
  const resolved = ready(resolveCachedEditorDocument({
    project: project({ name: "Empty project" }),
    draft: { ok: false, reason: "miss" },
    pendingSync: { ok: true, value: [] },
    serverTimeline: { status: "not-found" },
  }));

  assert.equal(resolved.source, "empty");
  assert.equal(resolved.document.name, "Empty project");
  assert.equal(resolved.document.tracks.flatMap((track) => track.items).length, 0);
}

function ready(result: ReturnType<typeof resolveCachedEditorDocument>) {
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("Expected editor load to resolve.");
  return result.value;
}

function found(document: ReturnType<typeof createMockVideoProjectDocument>, revisionNumber: number) {
  return {
    status: "found" as const,
    timeline: {
      projectId: document.projectId,
      timelineId: "timeline-1",
      revisionId: `revision-${revisionNumber}`,
      document,
      revisionNumber,
      documentSchemaVersion: document.schemaVersion,
      source: "manual",
      label: null,
      updatedAt: "2026-02-02T10:00:00.000Z",
      updatedByUserId: "user-1",
    },
  };
}

function project(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: "project-1",
    ownerId: "user-1",
    ownerKind: OwnerKind.User,
    ownerEmail: "user@example.com",
    ownerDisplayName: "User",
    kind: ProjectKind.Video,
    name: "Server Project",
    description: null,
    durationSeconds: null,
    status: "Ready",
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    mediaCount: 0,
    isStarred: false,
    ...overrides,
  };
}

main();
