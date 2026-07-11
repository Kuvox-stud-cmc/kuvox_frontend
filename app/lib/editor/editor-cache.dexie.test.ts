import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import {
  createEditorCacheForTests,
  type EditorCacheScope,
} from "./editor-cache";
import { createMockVideoProjectDocument } from "./video-document";

describe("Dexie editor cache", () => {
  it("commits the full document, timeline operation, and deduplicated media attachments atomically", async () => {
    const cache = await isolatedCache();
    const document = editedDocument(1, "First exact draft");

    const saved = await cache.persistVideoTimelineMutation({
      document,
      scope: personalScope,
      operation: {
        entityId: "revision:1",
        operationBatchId: "batch-1",
        queuedAt: "2026-07-11T00:00:01.000Z",
        now: 1,
        metadata: { localRevision: 1 },
      },
      projectMediaIds: ["media-1", "media-1"],
    });

    expect(saved.ok).toBe(true);
    const draft = await cache.getVideoTimelineDraft(personalScope, document.projectId);
    expect(draft).toEqual({ ok: true, value: document });
    const pending = await cache.listPendingSync(personalScope, document.projectId);
    expect(pending.ok && pending.value.map((record) => record.kind).sort()).toEqual([
      "projectMediaAttach",
      "timelineDraft",
    ]);
  });

  it("rolls back the document when a pending record cannot be cloned", async () => {
    const cache = await isolatedCache();
    const document = editedDocument(1, "Must roll back");

    const failed = await cache.persistVideoTimelineMutation({
      document,
      scope: personalScope,
      operation: {
        entityId: "revision:1",
        metadata: { invalid: (() => undefined) as never },
      },
    });

    expect(failed.ok).toBe(false);
    expect(await cache.getVideoTimelineDraft(personalScope, document.projectId)).toEqual({ ok: false, reason: "miss" });
    expect(await cache.listPendingSync(personalScope, document.projectId)).toEqual({ ok: true, value: [] });
  });

  it("preserves the latest exact document and chronological pending operations across consecutive edits", async () => {
    const cache = await isolatedCache();
    const first = editedDocument(1, "First");
    const second = editedDocument(2, "Second");

    await cache.persistVideoTimelineMutation({
      document: first,
      scope: personalScope,
      operation: { entityId: "revision:1", queuedAt: "2026-07-11T00:00:01.000Z", now: 1 },
    });
    await cache.persistVideoTimelineMutation({
      document: second,
      scope: personalScope,
      operation: { entityId: "revision:2", queuedAt: "2026-07-11T00:00:02.000Z", now: 2 },
    });

    expect(await cache.getVideoTimelineDraft(personalScope, second.projectId)).toEqual({ ok: true, value: second });
    const pending = await cache.listPendingSync(personalScope, second.projectId);
    expect(pending.ok && pending.value.slice().reverse().map((record) => record.entityId)).toEqual([
      "revision:1",
      "revision:2",
    ]);
  });

  it("does not expose drafts across user or owner scopes", async () => {
    const cache = await isolatedCache();
    const document = editedDocument(1, "Scoped");
    await cache.persistVideoTimelineMutation({
      document,
      scope: personalScope,
      operation: { entityId: "revision:1" },
    });

    expect((await cache.getVideoTimelineDraft(otherUserScope, document.projectId)).ok).toBe(false);
    expect((await cache.getVideoTimelineDraft(studioScope, document.projectId)).ok).toBe(false);
  });
});

const personalScope: EditorCacheScope = { userId: "user-1", ownerKind: "user", ownerId: "user-1" };
const otherUserScope: EditorCacheScope = { userId: "user-2", ownerKind: "user", ownerId: "user-2" };
const studioScope: EditorCacheScope = { userId: "user-1", ownerKind: "studio", ownerId: "studio-1" };

async function isolatedCache() {
  const result = await createEditorCacheForTests(`kuvox-editor-cache-test-${crypto.randomUUID()}`);
  if (!result.ok) throw new Error(result.error ?? result.reason);
  return result.value;
}

function editedDocument(revision: number, name: string) {
  const document = createMockVideoProjectDocument("project-1", name);
  return {
    ...document,
    name,
    updatedAt: `2026-07-11T00:00:0${revision}.000Z`,
    history: { ...document.history, revision },
  };
}
