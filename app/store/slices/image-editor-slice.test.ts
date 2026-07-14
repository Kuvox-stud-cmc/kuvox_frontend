import { describe, expect, it } from "vitest";

import { createDefaultImageCompositionDocument } from "~/lib/editor/image/document/default-document";
import { createCenteredTextLayer, createImageOperation } from "~/lib/editor/image/document/operations";
import {
  imageBackendSyncFailed,
  imageBackendSyncSucceeded,
  imageDocumentOperationApplied,
  imageEditorReducer,
  imageLayerSelected,
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

  it("supports layer selection and list operations", () => {
    let state = imageEditorReducer(
      undefined,
      imageProjectOpened({ projectId: "project-1", projectName: "Project" }),
    );
    const first = createCenteredTextLayer(state.document.canvas, "First");
    const second = { ...createCenteredTextLayer(state.document.canvas, "Second"), id: "second-layer" };

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({ type: "add-layer", layer: first, label: "Add first" })),
    );
    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({ type: "add-layer", layer: second, label: "Add second" })),
    );
    state = imageEditorReducer(state, imageLayerSelected(first.id));
    expect(state.document.selectedLayerId).toBe(first.id);

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "update-layer-style",
        layerId: first.id,
        patch: { name: "Hero title", visible: false, locked: true },
        label: "Update layer flags",
      })),
    );
    expect(state.document.layers[0]).toMatchObject({ name: "Hero title", visible: false, locked: true });

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "reorder-layer",
        layerId: second.id,
        direction: "down",
        label: "Move layer down",
      })),
    );
    expect(state.document.layers.map((layer) => layer.id)).toEqual([second.id, first.id]);

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "duplicate-layer",
        layerId: second.id,
        newLayerId: "second-copy",
        label: "Duplicate layer",
      })),
    );
    expect(state.document.layers.map((layer) => layer.id)).toContain("second-copy");
    expect(state.document.selectedLayerId).toBe("second-copy");

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "delete-layer",
        layerId: "second-copy",
        label: "Delete layer",
      })),
    );
    expect(state.document.layers.map((layer) => layer.id)).not.toContain("second-copy");
  });

  it("supports transform, text, fill color, and opacity edits", () => {
    let state = imageEditorReducer(
      undefined,
      imageProjectOpened({ projectId: "project-1", projectName: "Project" }),
    );
    const layer = createCenteredTextLayer(state.document.canvas, "Original");

    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({ type: "add-layer", layer, label: "Add text" })),
    );
    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "update-layer-transform",
        layerId: layer.id,
        transform: { x: 12, y: 34, width: 456, height: 123, rotation: 17 },
        label: "Transform layer",
      })),
    );
    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "update-text-content",
        layerId: layer.id,
        text: "Edited copy",
        label: "Edit text",
      })),
    );
    state = imageEditorReducer(
      state,
      imageDocumentOperationApplied(createImageOperation({
        type: "update-layer-style",
        layerId: layer.id,
        patch: { fill: "#ff00aa", opacity: 0.42 },
        label: "Style layer",
      })),
    );

    expect(state.document.layers[0]).toMatchObject({
      type: "text",
      text: "Edited copy",
      fill: "#ff00aa",
      transform: { x: 12, y: 34, width: 456, height: 123, rotation: 17, opacity: 0.42 },
    });
  });
});
