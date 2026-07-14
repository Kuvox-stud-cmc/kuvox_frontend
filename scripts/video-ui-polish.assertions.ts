import assert from "node:assert/strict";

import {
  sourceBundle,
  videoUiPolishMarkers,
  videoUiSources,
} from "./video-ui-polish.fixtures";

function main(): void {
  assertFiveRegionDarkLayout();
  assertStablePanelDimensions();
  assertEmptyAndFailureStates();
  assertResponsiveManualLayout();
  assertResponsiveElementsPanel();
  assertIconButtonsAndReducedMotion();
}

function assertFiveRegionDarkLayout(): void {
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

function assertStablePanelDimensions(): void {
  for (const marker of videoUiPolishMarkers.layoutTokens) {
    assert.ok(videoUiSources.appCss.includes(marker), `missing layout token: ${marker}`);
  }

  assert.match(videoUiSources.mediaLibrary, /min-w-video-library-min max-w-video-library-max/);
  assert.match(videoUiSources.mediaLibrary, /min:\s*240/);
  assert.match(videoUiSources.mediaLibrary, /max:\s*360/);
  assert.match(videoUiSources.slice, /libraryWidth = Math\.min\(360, Math\.max\(240/);
  assert.match(videoUiSources.inspector, /width: inspectorWidth/);
  assert.match(videoUiSources.inspector, /minWidth: 240/);
  assert.match(videoUiSources.inspector, /maxWidth: 480/);
  assert.match(videoUiSources.assistant, /min-\[760px\]:w-80 min-\[760px\]:min-w-80 min-\[760px\]:max-w-80/);
  assert.match(videoUiSources.toolRail, /w-video-tool-rail-width/);
  assert.match(videoUiSources.timeline, /min-h-video-timeline-min max-h-video-timeline-max/);
  assert.match(videoUiSources.timeline, /Math\.max\(960, timeToPixel/);
  assert.match(videoUiSources.preview, /fitStageToArea/);
  assert.match(videoUiSources.preview, /className="flex h-full w-full items-center justify-center overflow-hidden"/);
  assert.match(videoUiSources.preview, /width: stageSize\.width/);
  assert.match(videoUiSources.preview, /grid h-12 shrink-0/);
  assert.match(videoUiSources.preview, /2xl:h-14/);
}

function assertEmptyAndFailureStates(): void {
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

function assertResponsiveManualLayout(): void {
  assert.match(videoUiSources.workspace, /data-responsive-manual-controls/);
  assert.match(videoUiSources.workspace, /max-\[1179px\]:flex/);
  assert.match(videoUiSources.workspace, /max-\[759px\]:hidden/);
  assert.match(videoUiSources.workspace, /Open media library/);
  assert.match(videoUiSources.workspace, /Open inspector/);
  assert.match(videoUiSources.workspace, /role="tablist"/);
  assert.match(videoUiSources.mediaLibrary, /className\?: string/);
  assert.match(videoUiSources.inspector, /visibilityClassName\?: string/);
  assert.match(videoUiSources.assistant, /absolute inset-0/);
  assert.match(videoUiSources.assistant, /min-\[760px\]:relative/);
  assert.match(videoUiSources.toolRail, /orientation\?: "vertical" \| "horizontal"/);
  assert.match(videoUiSources.topBar, /hidden whitespace-nowrap xl:inline/);
  assert.match(videoUiSources.topBar, /aria-label="Project aspect ratio"/);
}

function assertResponsiveElementsPanel(): void {
  const elementsPanel = videoUiSources.mediaLibrary.slice(
    videoUiSources.mediaLibrary.indexOf("export function ElementsLibraryPanelContent"),
  );

  assert.ok(elementsPanel.includes("flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden"));
  assert.ok(elementsPanel.includes("flex min-h-0 flex-1 flex-col overflow-hidden"));
  assert.ok(elementsPanel.includes("overflow-x-hidden overflow-y-auto overscroll-contain"));
  assert.ok(elementsPanel.includes("max-h-[48%] shrink-0 flex-col"));
  assert.ok(elementsPanel.includes("grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))]"));
  assert.ok(elementsPanel.includes("col-span-full py-10"));
  assert.ok(elementsPanel.includes("min-w-[112px] max-w-full flex-1"));
  assert.ok(elementsPanel.includes("aspect-square w-full min-w-0 overflow-hidden"));
}

function assertIconButtonsAndReducedMotion(): void {
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
    assistant: videoUiSources.assistant,
  })) {
    if (!source.includes("transition")) continue;
    assert.ok(source.includes("motion-reduce:transition-none"), `${name} transitions need reduced-motion handling`);
  }
}

main();
