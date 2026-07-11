import { readFileSync } from "node:fs";

export const videoUiSources = {
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
  slice: readFileSync("app/store/slices/editor-slice.ts", "utf8"),
};

export const videoUiPolishMarkers = {
  fiveRegionLayout: [
    "data-video-editor-root",
    "<EditorTopBar",
    "<MediaLibraryPanel",
    "<PreviewPanel",
    "<ToolRail",
    "<VideoInspectorPanel",
    "<AiAssistantPanel",
    "<TimelinePanel",
  ],
  emptyStates: [
    "No project media",
    "No filter matches",
    "Media refresh failed. Showing cached media.",
    "processing or failed",
    "Empty timeline",
    "No active visual",
    "Media unavailable",
    "Canvas size",
    "No matching moments found.",
    "Suggestions appear when the timeline or selection changes.",
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
    "--spacing-video-timeline-max",
  ],
};

export function sourceBundle(...keys: Array<keyof typeof videoUiSources>): string {
  return keys.map((key) => videoUiSources[key]).join("\n");
}
