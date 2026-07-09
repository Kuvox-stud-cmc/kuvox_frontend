// scripts/video-ui-polish.assertions.ts
import assert from "node:assert/strict";

// scripts/video-ui-polish.fixtures.ts
import { readFileSync } from "node:fs";
var videoUiSources = {
  appCss: readFileSync("app/app.css", "utf8"),
  workspace: readFileSync("app/components/editor/video-editor-workspace.tsx", "utf8"),
  topBar: readFileSync("app/components/editor/editor-top-bar.tsx", "utf8"),
  editorUi: readFileSync("app/components/editor/editor-ui.tsx", "utf8"),
  mediaLibrary: readFileSync("app/components/editor/media-library-panel.tsx", "utf8"),
  preview: readFileSync("app/components/editor/panels/preview-panel.tsx", "utf8"),
  timeline: readFileSync("app/components/editor/panels/timeline-panel.tsx", "utf8"),
  toolRail: readFileSync("app/components/editor/tool-rail.tsx", "utf8"),
  inspector: readFileSync("app/components/editor/video-inspector-panel.tsx", "utf8"),
  assistant: readFileSync("app/components/editor/ai-assistant-panel.tsx", "utf8"),
  slice: readFileSync("app/store/slices/editor-slice.ts", "utf8")
};
var videoUiPolishMarkers = {
  fiveRegionLayout: [
    "data-video-editor-root",
    "<EditorTopBar",
    "<MediaLibraryPanel",
    "<PreviewPanel",
    "<ToolRail",
    "<VideoInspectorPanel",
    "<AiAssistantPanel",
    "<TimelinePanel"
  ],
  emptyStates: [
    "No project media",
    "No filter matches",
    "Media refresh failed. Showing cached media.",
    "processing or failed",
    "Empty timeline",
    "No active visual",
    "Media unavailable",
    "No selection",
    "No matching moments found.",
    "Suggestions appear when the timeline or selection changes."
  ],
  layoutTokens: [
    "--spacing-video-library-width",
    "--spacing-video-library-min",
    "--spacing-video-library-max",
    "--spacing-video-inspector-width",
    "--spacing-video-ai-width",
    "--spacing-video-tool-rail-width",
    "--spacing-video-timeline-min",
    "--spacing-video-timeline-default",
    "--spacing-video-timeline-max"
  ]
};
function sourceBundle(...keys) {
  return keys.map((key) => videoUiSources[key]).join("\n");
}

// scripts/video-ui-polish.assertions.ts
function main() {
  assertFiveRegionDarkLayout();
  assertStablePanelDimensions();
  assertEmptyAndFailureStates();
  assertResponsiveManualLayout();
  assertIconButtonsAndReducedMotion();
}
function assertFiveRegionDarkLayout() {
  const workspace = videoUiSources.workspace;
  for (const marker of videoUiPolishMarkers.fiveRegionLayout) {
    assert.ok(workspace.includes(marker), `missing video editor layout marker: ${marker}`);
  }
  assert.match(workspace, /className="video-editor-theme flex h-dvh w-full flex-col overflow-hidden bg-background/);
  assert.match(workspace, /safe-area-inset-bottom/);
  assert.match(videoUiSources.topBar, /min-\[760px\]:h-16/);
  assert.match(videoUiSources.mediaLibrary, /bg-surface/);
  assert.match(videoUiSources.preview, /bg-surface-container-lowest/);
  assert.match(videoUiSources.timeline, /bg-surface/);
}
function assertStablePanelDimensions() {
  for (const marker of videoUiPolishMarkers.layoutTokens) {
    assert.ok(videoUiSources.appCss.includes(marker), `missing layout token: ${marker}`);
  }
  assert.match(videoUiSources.mediaLibrary, /min-w-video-library-min max-w-video-library-max/);
  assert.match(videoUiSources.mediaLibrary, /min:\s*240/);
  assert.match(videoUiSources.mediaLibrary, /max:\s*360/);
  assert.match(videoUiSources.slice, /libraryWidth = Math\.min\(360, Math\.max\(240/);
  assert.match(videoUiSources.inspector, /w-video-inspector-width min-w-video-inspector-width/);
  assert.match(videoUiSources.assistant, /min-\[760px\]:w-80 min-\[760px\]:min-w-80 min-\[760px\]:max-w-80/);
  assert.match(videoUiSources.toolRail, /w-video-tool-rail-width/);
  assert.match(videoUiSources.timeline, /min-h-video-timeline-min max-h-video-timeline-max/);
  assert.match(videoUiSources.timeline, /Math\.max\(960, timeToPixel/);
  assert.match(videoUiSources.preview, /fitStageToArea/);
  assert.match(videoUiSources.preview, /className="flex h-full w-full items-center justify-center overflow-hidden"/);
  assert.match(videoUiSources.preview, /width: stageSize\.width/);
  assert.match(videoUiSources.preview, /grid h-14 shrink-0/);
}
function assertEmptyAndFailureStates() {
  const bundle = sourceBundle("mediaLibrary", "timeline", "preview", "inspector", "assistant");
  for (const marker of videoUiPolishMarkers.emptyStates) {
    assert.ok(bundle.includes(marker), `missing empty/failure state: ${marker}`);
  }
  assert.match(videoUiSources.mediaLibrary, /mediaLibraryEmptyState/);
  assert.match(videoUiSources.mediaLibrary, /sync_problem/);
  assert.match(videoUiSources.mediaLibrary, /readiness === "failed"/);
  assert.match(videoUiSources.timeline, /EmptyTimelineState/);
  assert.match(videoUiSources.preview, /MonitorMessage/);
}
function assertResponsiveManualLayout() {
  assert.match(videoUiSources.workspace, /data-responsive-manual-controls/);
  assert.match(videoUiSources.workspace, /max-\[1179px\]:flex/);
  assert.match(videoUiSources.workspace, /max-\[759px\]:hidden/);
  assert.match(videoUiSources.workspace, /Open media library/);
  assert.match(videoUiSources.workspace, /Open inspector/);
  assert.match(videoUiSources.workspace, /role="tablist"/);
  assert.match(videoUiSources.mediaLibrary, /className\?: string/);
  assert.match(videoUiSources.inspector, /className\?: string/);
  assert.match(videoUiSources.assistant, /absolute inset-0/);
  assert.match(videoUiSources.assistant, /min-\[760px\]:relative/);
  assert.match(videoUiSources.toolRail, /orientation\?: "vertical" \| "horizontal"/);
  assert.match(videoUiSources.topBar, /hidden whitespace-nowrap xl:inline/);
  assert.match(videoUiSources.topBar, /aria-label="Project aspect ratio"/);
}
function assertIconButtonsAndReducedMotion() {
  assert.match(videoUiSources.editorUi, /title=\{label\}/);
  assert.match(videoUiSources.editorUi, /aria-label=\{label\}/);
  assert.match(videoUiSources.toolRail, /title=\{tool\.label\}/);
  assert.match(videoUiSources.toolRail, /aria-label=\{tool\.label\}/);
  for (const [name, source] of Object.entries({
    topBar: videoUiSources.topBar,
    mediaLibrary: videoUiSources.mediaLibrary,
    preview: videoUiSources.preview,
    timeline: videoUiSources.timeline,
    toolRail: videoUiSources.toolRail,
    inspector: videoUiSources.inspector,
    assistant: videoUiSources.assistant
  })) {
    if (!source.includes("transition")) continue;
    assert.ok(source.includes("motion-reduce:transition-none"), `${name} transitions need reduced-motion handling`);
  }
}
main();
