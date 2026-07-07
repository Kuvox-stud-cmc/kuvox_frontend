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
  assertSmallScreenFallback();
  assertIconButtonsAndReducedMotion();
}

function assertFiveRegionDarkLayout(): void {
  const workspace = videoUiSources.workspace;
  for (const marker of videoUiPolishMarkers.fiveRegionLayout) {
    assert.ok(workspace.includes(marker), `missing video editor layout marker: ${marker}`);
  }

  assert.match(workspace, /className="flex h-screen w-full flex-col overflow-hidden bg-background text-on-background"/);
  assert.match(videoUiSources.topBar, /h-toolbar-height/);
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
  assert.match(videoUiSources.inspector, /w-video-inspector-width min-w-video-inspector-width/);
  assert.match(videoUiSources.assistant, /w-video-ai-width min-w-\[320px\] max-w-\[392px\]/);
  assert.match(videoUiSources.toolRail, /w-video-tool-rail-width/);
  assert.match(videoUiSources.timeline, /min-h-video-timeline-min max-h-video-timeline-max/);
  assert.match(videoUiSources.timeline, /Math\.max\(960, timeToPixel/);
  assert.match(videoUiSources.preview, /relative aspect-video w-full max-h-full/);
  assert.match(videoUiSources.preview, /grid h-14 shrink-0/);
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

function assertSmallScreenFallback(): void {
  assert.match(videoUiSources.workspace, /lg:hidden/);
  assert.match(videoUiSources.workspace, /Use a wider screen for full editing/);
  assert.match(videoUiSources.mediaLibrary, /hidden h-full .* lg:flex/);
  assert.match(videoUiSources.inspector, /hidden h-full .* lg:flex/);
  assert.match(videoUiSources.assistant, /hidden h-full .* lg:flex/);
  assert.match(videoUiSources.toolRail, /hidden h-full .* lg:flex/);
  assert.match(videoUiSources.topBar, /hidden whitespace-nowrap xl:inline/);
  assert.match(videoUiSources.topBar, /hidden 2xl:block/);
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
