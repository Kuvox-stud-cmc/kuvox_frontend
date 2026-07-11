import { describe, expect, it } from "vitest";

import { makeStore } from "~/store";
import { createMockVideoProjectDocument } from "~/lib/editor/video-document";
import {
  editorDocumentLoaded,
  editorReducer,
  hasUnsyncedEditorChanges,
  projectOpened,
  type EditorState,
  type EditorSyncStatus,
} from "./editor-slice";

describe("editor document initialization", () => {
  it("starts with neutral transient state and opens an empty project document", () => {
    const initial = editorReducer(undefined, { type: "test/init" });
    expect(initial.selection.selectedItemIds).toEqual([]);
    expect(initial.playback).toMatchObject({ playing: false, currentTime: 0 });
    expect(initial.ui.selectedMediaId).toBeNull();
    expect(initial.ui.commandInput).toBe("");

    const opened = editorReducer(initial, projectOpened({ projectId: "project-1", projectName: "Project 1" }));
    expect(opened.document?.media).toEqual({});
    expect(opened.document?.tracks.every((track) => track.items.length === 0)).toBe(true);
  });

  it("resets document transients while preserving editor preferences", () => {
    const state = structuredClone(editorState({}));
    state.ui.libraryWidth = 333;
    state.ui.timelineHeight = 311;
    state.ui.timelineZoom = 77;
    state.ui.editorMode = "ai";
    state.ui.activeToolId = "trim";
    state.playback.volume = 0.4;
    state.playback.muted = true;
    state.playback.loop = true;
    state.selection.selectedItemIds = ["old-item"];
    state.playback.currentTime = 42;
    state.ui.commandInput = "old command";

    const loaded = editorReducer(state, editorDocumentLoaded({
      document: createMockVideoProjectDocument("project-2", "Project 2"),
      source: "server",
      syncStatus: "clean",
    }));

    expect(loaded.selection.selectedItemIds).toEqual([]);
    expect(loaded.playback.currentTime).toBe(0);
    expect(loaded.ui.commandInput).toBe("");
    expect(loaded.ui.selectedMediaId).toBeNull();
    expect(loaded.ui).toMatchObject({ libraryWidth: 333, timelineHeight: 311, timelineZoom: 77, editorMode: "ai", activeToolId: "trim" });
    expect(loaded.playback).toMatchObject({ volume: 0.4, muted: true, loop: true });
  });
});

describe("hasUnsyncedEditorChanges", () => {
  it.each(["dirty", "saved-local", "sync-failed", "server-changed", "failed"] satisfies EditorSyncStatus[])(
    "treats %s as unsynced",
    (syncStatus) => {
      expect(hasUnsyncedEditorChanges(editorState({ syncStatus }))).toBe(true);
    },
  );

  it("treats pending records as unsynced regardless of sync status", () => {
    expect(hasUnsyncedEditorChanges(editorState({ syncStatus: "clean", pendingSyncCount: 1 }))).toBe(true);
  });

  it("guards an active sync while the document revision is pending", () => {
    const editor = editorState({ syncStatus: "syncing" });
    editor.document = {
      history: { revision: 2 },
    } as EditorState["document"];
    editor.lastSavedRevision = 1;

    expect(hasUnsyncedEditorChanges(editor)).toBe(true);
  });

  it("does not guard a synchronized or initial syncing editor", () => {
    expect(hasUnsyncedEditorChanges(editorState({ syncStatus: "synced" }))).toBe(false);
    expect(hasUnsyncedEditorChanges(editorState({ syncStatus: "syncing" }))).toBe(false);
  });
});

function editorState(overrides: Partial<EditorState>): EditorState {
  return {
    ...makeStore().getState().editor,
    ...overrides,
  };
}
