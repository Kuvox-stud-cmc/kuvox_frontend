// @vitest-environment jsdom
import { Provider } from "react-redux";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({
  deletePendingSync: vi.fn(),
  deleteVideoTimelineDraft: vi.fn(),
  enqueuePendingSync: vi.fn(),
  listPendingSync: vi.fn(),
  persistVideoTimelineMutation: vi.fn(),
  saveProjectSnapshot: vi.fn(),
  saveVideoTimelineDraft: vi.fn(),
}));

const timelineApi = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
}));

const projectMediaApi = vi.hoisted(() => ({
  attach: vi.fn(),
}));

vi.mock("~/lib/editor/editor-cache", () => ({
  deletePendingSync: cache.deletePendingSync,
  deleteVideoTimelineDraft: cache.deleteVideoTimelineDraft,
  enqueuePendingSync: cache.enqueuePendingSync,
  listPendingSync: cache.listPendingSync,
  persistVideoTimelineMutation: cache.persistVideoTimelineMutation,
  saveProjectSnapshot: cache.saveProjectSnapshot,
  saveVideoTimelineDraft: cache.saveVideoTimelineDraft,
}));

vi.mock("~/lib/editor/video-timeline-api.client", () => ({
  createSaveVideoTimelineRequest: (input: unknown) => input,
  getVideoTimelineFromBff: timelineApi.get,
  saveVideoTimelineToBff: timelineApi.save,
}));

vi.mock("~/lib/editor/editor-observability.client", () => ({
  createEditorCorrelationId: () => "correlation-test",
  logVideoEditorEvent: vi.fn(),
}));

vi.mock("~/lib/editor/project-media-api.client", () => ({
  attachProjectMediaFromBff: projectMediaApi.attach,
}));

vi.mock("~/lib/editor/video-performance.client", () => ({
  flushVideoEditorPerformanceMetrics: vi.fn().mockResolvedValue(undefined),
}));

import { createMockVideoProjectDocument } from "~/lib/editor/video-document";
import { makeStore } from "~/store";
import type { EditorState } from "~/store/slices/editor-slice";
import { useVideoAutosave } from "./use-video-autosave";

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  cache.listPendingSync.mockResolvedValue({ ok: true, value: [] });
  cache.saveVideoTimelineDraft.mockResolvedValue({ ok: true, value: {} });
  cache.persistVideoTimelineMutation.mockResolvedValue({ ok: true, value: { draft: {}, pending: [] } });
  cache.saveProjectSnapshot.mockResolvedValue({ ok: true, value: {} });
  cache.deletePendingSync.mockResolvedValue({ ok: true, value: undefined });
  projectMediaApi.attach.mockResolvedValue([]);
});

describe("useVideoAutosave export synchronization", () => {
  it("does not synchronize before the fixed 15-minute interval", async () => {
    vi.useFakeTimers();
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const editor = editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    });
    timelineApi.save.mockResolvedValue({
      ok: true,
      timeline: { timelineId: "timeline-1", revisionNumber: 4, updatedAt: "2026-07-11T00:00:00.000Z" },
    });
    renderAutosave(editor);

    await act(() => vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1));
    expect(timelineApi.save).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(timelineApi.save).toHaveBeenCalledTimes(1);
  });

  it("does not reset the deadline for later edits and does not retry in the background", async () => {
    vi.useFakeTimers();
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const initial = editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    });
    timelineApi.save.mockRejectedValue(new Error("offline"));
    const { rerender } = renderAutosave(initial);

    await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000));
    const laterDocument = {
      ...document,
      updatedAt: "2026-07-11T00:10:00.000Z",
      history: { ...document.history, revision: document.history.revision + 1 },
    };
    rerender(editorState({ ...initial, document: laterDocument, historyMutationCount: 1 }));
    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(timelineApi.save).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(30 * 60 * 1000));
    expect(timelineApi.save).toHaveBeenCalledTimes(1);
  });

  it("does not synchronize a clean editor when connectivity changes", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    renderAutosave(editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "clean",
      lastSavedRevision: document.history.revision,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    }));

    window.dispatchEvent(new Event("online"));
    await act(async () => undefined);
    expect(timelineApi.save).not.toHaveBeenCalled();
  });

  it("retries the current local snapshot after an IndexedDB failure", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    cache.persistVideoTimelineMutation.mockResolvedValueOnce({ ok: false, reason: "error", error: "disk full" });
    const { result } = renderAutosave(editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "saved-local",
      pendingSyncCount: 1,
      lastSavedRevision: document.history.revision - 1,
    }));

    await expect(result.current.flushLocalDraft()).rejects.toThrow("disk full");
    cache.persistVideoTimelineMutation.mockResolvedValueOnce({ ok: true, value: { draft: {}, pending: [] } });
    await expect(result.current.flushLocalDraft()).resolves.toBeUndefined();
  });

  it("synchronizes an unsynced document once and returns the saved revision", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const editor = editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    });
    timelineApi.save.mockResolvedValue({
      ok: true,
      timeline: {
        timelineId: "timeline-1",
        revisionNumber: 4,
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
    });
    const { result } = renderAutosave(editor);

    const synced = await result.current.flushForExport();

    expect(synced).toEqual({ status: "success", timelineId: "timeline-1", revisionNumber: 4 });
    expect(timelineApi.save).toHaveBeenCalledTimes(1);
    expect(cache.saveVideoTimelineDraft).toHaveBeenCalled();
  });

  it("returns the current server revision without another timeline save when already synced", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const editor = editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "synced",
      lastSavedRevision: document.history.revision,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 8,
    });
    const { result } = renderAutosave(editor);

    const synced = await result.current.flushForExport();

    expect(synced).toEqual({ status: "success", timelineId: "timeline-1", revisionNumber: 8 });
    expect(timelineApi.save).not.toHaveBeenCalled();
    expect(cache.saveVideoTimelineDraft).not.toHaveBeenCalled();
  });

  it("batches project media attachments before saving the captured timeline", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const order: string[] = [];
    const queued = {
      ok: true,
      value: [
        pending("projectMediaAttach", "media-1"),
        pending("projectMediaAttach", "media-1"),
        pending("timelineDraft", "revision-1"),
      ],
    };
    cache.listPendingSync
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(queued)
      .mockResolvedValue({ ok: true, value: [] });
    projectMediaApi.attach.mockImplementation(async () => {
      order.push("attach");
      return [];
    });
    timelineApi.save.mockImplementation(async () => {
      order.push("timeline");
      return { ok: true, timeline: { timelineId: "timeline-1", revisionNumber: 4, updatedAt: "2026-07-11T00:00:00.000Z" } };
    });
    const { result } = renderAutosave(editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    }));

    expect((await result.current.syncNow()).status).toBe("success");
    expect(projectMediaApi.attach).toHaveBeenCalledWith("project-1", ["media-1"], expect.anything());
    expect(order).toEqual(["attach", "timeline"]);
  });

  it("clears stale attachment records for media already confirmed on the project", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    const attachment = pending("projectMediaAttach", "media-1");
    const timeline = pending("timelineDraft", "revision-1");
    const queued = { ok: true, value: [attachment, timeline] };
    cache.listPendingSync
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(queued)
      .mockResolvedValue({ ok: true, value: [] });
    timelineApi.save.mockResolvedValue({
      ok: true,
      timeline: { timelineId: "timeline-1", revisionNumber: 4, updatedAt: "2026-07-11T00:00:00.000Z" },
    });
    const { result } = renderAutosave(editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    }), makeStore(), ["media-1"]);

    expect((await result.current.flushForExport()).status).toBe("success");
    expect(projectMediaApi.attach).not.toHaveBeenCalled();
    expect(cache.deletePendingSync).toHaveBeenCalledWith(attachment.id);
    expect(timelineApi.save).toHaveBeenCalledTimes(1);
  });

  it("retains backend progress and remains unsynced when the document changes during save", async () => {
    const document = createMockVideoProjectDocument("project-1", "Project 1");
    let resolveSave!: (value: unknown) => void;
    timelineApi.save.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const initialEditor = editorState({
      projectId: document.projectId,
      document,
      documentStatus: "ready",
      syncStatus: "dirty",
      lastSavedRevision: document.history.revision - 1,
      serverTimelineId: "timeline-1",
      serverRevisionNumber: 3,
    });
    const store = makeStore();
    const { result, rerender } = renderAutosave(initialEditor, store);
    const saving = result.current.flushForExport();
    await act(async () => undefined);
    const newerDocument = { ...document, updatedAt: "2026-07-11T00:00:01.000Z", history: { ...document.history, revision: document.history.revision + 1 } };
    rerender(editorState({ ...initialEditor, document: newerDocument, syncStatus: "dirty" }));
    resolveSave({ ok: true, timeline: { timelineId: "timeline-1", revisionNumber: 4, updatedAt: "2026-07-11T00:00:00.000Z" } });

    await expect(saving).resolves.toEqual(expect.objectContaining({ status: "failure" }));
    expect(store.getState().editor.serverRevisionNumber).toBe(4);
    expect(store.getState().editor.syncStatus).toBe("saved-local");
  });
});

function renderAutosave(editor: EditorState, store = makeStore(), attachedProjectMediaIds: string[] = []) {
  return renderHook((currentEditor: EditorState) => useVideoAutosave({
    projectId: "project-1",
    projectName: "Project 1",
    cacheScope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
    editor: currentEditor,
    attachedProjectMediaIds,
  }), {
    initialProps: editor,
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
}

function pending(kind: string, entityId: string) {
  return {
    id: `${kind}:${entityId}:${crypto.randomUUID()}`,
    scopeProjectKey: "scope:project-1",
    scopeKey: "scope",
    scope: { userId: "user-1", ownerKind: "user" as const, ownerId: "user-1" },
    projectId: "project-1",
    kind,
    queuedAt: "2026-07-11T00:00:00.000Z",
    entityId,
    retryCount: 0,
    cachedAt: 1,
  };
}

function editorState(overrides: Partial<EditorState>): EditorState {
  return {
    ...makeStore().getState().editor,
    ...overrides,
  };
}
