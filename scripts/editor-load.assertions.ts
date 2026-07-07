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
  const resolved = resolveCachedEditorDocument({
    project: project({ id: "project-1", name: "Server" }),
    draft: { ok: true, value: draft },
    pendingSync: { ok: true, value: [] },
  });

  assert.equal(resolved.source, "draft");
  assert.equal(resolved.document.name, "Draft");
  assert.equal(resolved.syncStatus, "clean");
}

function assertCorruptDraftFallsBack(): void {
  const resolved = resolveCachedEditorDocument({
    project: project({ id: "project-1", name: "Server" }),
    draft: { ok: false, reason: "corrupt", error: "bad document" },
    pendingSync: { ok: true, value: [] },
  });

  assert.equal(resolved.source, "empty");
  assert.equal(resolved.document.name, "Server");
  assert.equal(resolved.syncStatus, "clean");
  assert.deepEqual(resolved.warnings, [
    "Draft cache corrupt.",
    "Local video draft cache corrupt. Loaded the server copy instead.",
  ]);
}

function assertConflictDetection(): void {
  const draft = createMockVideoProjectDocument("project-1", "Draft");
  const resolved = resolveCachedEditorDocument({
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
  });

  assert.equal(resolved.syncStatus, "server-changed");
  assert.equal(resolved.conflict?.reason, "local-unsynced-server-changed");
}

function assertSavedLocalWithoutServerChange(): void {
  const draft = createMockVideoProjectDocument("project-1", "Draft");
  const resolved = resolveCachedEditorDocument({
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
  });

  assert.equal(resolved.syncStatus, "saved-local");
  assert.equal(resolved.conflict, null);
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
