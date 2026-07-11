import assert from "node:assert/strict";

import {
  editorToolDefinitions,
  isEnabledEditorToolId,
  isEditorToolId,
  isTimelineEditorToolId,
  type EditorToolId,
} from "../app/lib/editor/editor-tools";
import {
  activeToolChanged,
  editorReducer,
  selectActiveToolId,
  selectEditorMode,
  selectToolRailState,
} from "../app/store/slices/editor-slice";

function main(): void {
  assertRegistryShape();
  assertDefaultRailState();
  assertEnabledToolActivation();
  assertAiRouting();
  assertDisabledAndUnknownToolsDoNotMutate();
}

function assertRegistryShape(): void {
  assert.deepEqual(
    editorToolDefinitions.map((tool) => tool.id),
    ["select", "trim", "split", "text", "transform", "speed", "color", "audio", "ai"],
  );
  assert.deepEqual(
    editorToolDefinitions.filter((tool) => tool.availability === "enabled").map((tool) => tool.id),
    ["select", "trim", "split", "text", "transform", "speed", "color", "audio", "ai"],
  );
  assert.deepEqual(
    editorToolDefinitions.filter((tool) => tool.availability !== "enabled").map((tool) => tool.id),
    [],
  );
  assert.equal(isEditorToolId("transform"), true);
  assert.equal(isEditorToolId("transition"), false);
  assert.equal(isEnabledEditorToolId("text"), true);
  assert.equal(isEnabledEditorToolId("trim"), true);
  assert.equal(isTimelineEditorToolId("ai" as EditorToolId), false);
}

function assertDefaultRailState(): void {
  const state = editorReducer(undefined, { type: "init" });
  assert.equal(selectActiveToolId({ editor: state }), "select");
  assert.equal(selectEditorMode({ editor: state }), "manual");

  const rail = selectToolRailState({ editor: state });
  assert.equal(rail.activeToolId, "select");
  assert.equal(rail.editorMode, "manual");
  assert.equal(rail.tools.find((tool) => tool.id === "select")?.active, true);
  assert.equal(rail.tools.find((tool) => tool.id === "text")?.disabled, false);
  assert.equal(rail.tools.find((tool) => tool.id === "ai")?.disabled, false);
}

function assertEnabledToolActivation(): void {
  const initial = editorReducer(undefined, { type: "init" });
  const trimmed = editorReducer(initial, activeToolChanged("trim"));
  assert.equal(trimmed.ui.activeToolId, "trim");
  assert.equal(trimmed.ui.editorMode, "manual");

  const split = editorReducer(trimmed, activeToolChanged("split"));
  assert.equal(split.ui.activeToolId, "split");
  assert.equal(selectToolRailState({ editor: split }).tools.find((tool) => tool.id === "split")?.active, true);
}

function assertAiRouting(): void {
  const selected = editorReducer(undefined, activeToolChanged("trim"));
  const ai = editorReducer(selected, activeToolChanged("ai"));
  assert.equal(ai.ui.editorMode, "ai");
  assert.equal(ai.ui.activeToolId, "trim");

  const rail = selectToolRailState({ editor: ai });
  assert.equal(rail.tools.find((tool) => tool.id === "ai")?.active, true);
  assert.equal(rail.tools.find((tool) => tool.id === "trim")?.active, false);
}

function assertDisabledAndUnknownToolsDoNotMutate(): void {
  const selected = editorReducer(undefined, activeToolChanged("split"));
  const disabled = editorReducer(selected, activeToolChanged("text"));
  assert.equal(disabled.ui.activeToolId, "split");
  assert.equal(disabled.ui.editorMode, "manual");
  assert.equal(disabled.ui.toastMessage, selected.ui.toastMessage);

  const unknown = editorReducer(selected, {
    type: activeToolChanged.type,
    payload: "transition",
  });
  assert.equal(unknown.ui.activeToolId, "split");
  assert.equal(unknown.ui.editorMode, "manual");
  assert.equal(unknown.ui.toastMessage, selected.ui.toastMessage);
}

main();
