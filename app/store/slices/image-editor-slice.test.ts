import { describe, expect, it } from "vitest";

import { createDefaultImageCompositionDocument } from "~/components/editor/image/document/default-document";
import { createCenteredTextLayer, createImageOperation } from "~/components/editor/image/document/operations";
import {
  imageBackendSyncFailed,
  imageBackendSyncSucceeded,
  imageDocumentOperationApplied,
  imageEditorReducer,
  imageProjectOpened,
  imageRedoRequested,
  imageServerVersionLoaded,
  imageUndoRequested,
} from "./image-editor-slice";

describe("image editor reducer", () => {
  it("updates revision metadata after a successful save", () => {
    let state = imageEditorReducer(
      undefined,
      imageProjectOpened({
        projectId: "project-1",
        projectName: "Project",
        document: createDefaultImageCompositionDocument(),
        baseRevisionNumber: 2,
        lastSyncedAt: "2026-07-06T01:00:00.000Z",
      }),
    );

    state = imageEditorReducer(
      state,
      imageBackendSyncSucceeded({
        revisionNumber: 3,
        syncedAt: "2026-07-06T01:02:00.000Z",
        updatedAt: "2026-07-06T01:02:00.000Z",
      }),
    );

    expect(state.document.baseRevisionNumber).toBe(3);
    expect(state.document.lastSyncedAt).toBe("2026-07-06T01:02:00.000Z");
    expect(state.saveState).toBe("synced");
    expect(state.conflict).toBeNull();
  });

  it("enters server-changed state on 409 conflict metadata", () => {
    const state = imageEditorReducer(
      undefined,
      imageBackendSyncFailed({
        conflict: true,
        error: "The server has a newer version.",
        serverRevisionNumber: 7,
        serverUpdatedAt: "2026-07-06T02:00:00.000Z",
        updatedByUserId: "user-1",
      }),
    );

    expect(state.saveState).toBe("server-changed");
    expect(state.saveError).toBe("The server has a newer version.");
    expect(state.conflict).toEqual({
      message: "The server has a newer version.",
      serverRevisionNumber: 7,
      serverUpdatedAt: "2026-07-06T02:00:00.000Z",
      updatedByUserId: "user-1",
    });
  });

  it("reload server version clears the conflict state", () => {
    let state = imageEditorReducer(
      undefined,
      imageProjectOpened({ projectId: "project-1", projectName: "Project" }),
    );
    state = imageEditorReducer(
      state,
      imageBackendSyncFailed({
        conflict: true,
        error: "Conflict",
        serverRevisionNumber: 4,
      }),
    );

    const serverDocument = {
      ...createDefaultImageCompositionDocument(),
      canvas: { width: 1280, height: 720, unit: "px" as const, presetName: "Wide" },
    };
    state = imageEditorReducer(
      state,
      imageServerVersionLoaded({
        document: serverDocument,
        baseRevisionNumber: 4,
        lastSyncedAt: "2026-07-06T03:00:00.000Z",
      }),
    );

    expect(state.saveState).toBe("synced");
    expect(state.conflict).toBeNull();
    expect(state.document.canvas).toMatchObject({ width: 1280, height: 720 });
    expect(state.document.baseRevisionNumber).toBe(4);
  });

  it("keep local retry success clears the conflict state", () => {
    let state = imageEditorReducer(
      undefined,
      imageBackendSyncFailed({
        conflict: true,
        error: "Conflict",
        serverRevisionNumber: 4,
      }),
    );

    state = imageEditorReducer(
      state,
      imageBackendSyncSucceeded({
        revisionNumber: 5,
        syncedAt: "2026-07-06T04:00:00.000Z",
      }),
    );

    expect(state.saveState).toBe("synced");
    expect(state.conflict).toBeNull();
    expect(state.document.baseRevisionNumber).toBe(5);
  });

  it("undo and redo restore document snapshots", () => {
    let state = imageEditorReducer(
      undefined,
      imageProjectOpened({ projectId: "project-1", projectName: "Project" }),
    );
    const layer = createCenteredTextLayer(state.document.canvas, "Title");

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(
        createImageOperation({ type: "add-layer", layer, label: "Add title" }),
      ),
    );
    expect(state.document.layers).toHaveLength(1);
    expect(state.undoStack).toHaveLength(1);

    state = imageEditorReducer(state, imageUndoRequested());
    expect(state.document.layers).toHaveLength(0);
    expect(state.redoStack).toHaveLength(1);

    state = imageEditorReducer(state, imageRedoRequested());
    expect(state.document.layers).toHaveLength(1);
    expect(state.document.layers[0].id).toBe(layer.id);
  });
});
