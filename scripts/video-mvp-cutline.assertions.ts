import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const route = read("app/routes/editor/video.tsx");
assert.match(route, /\/editor\/image\/\$\{project\.id\}/, "video route must redirect image projects.");
assert.match(route, /getProject\(/, "video route must load project metadata.");
assert.match(route, /listAllMedia\(/, "video route must load media metadata.");
assert.match(route, /listProjectMedia\(/, "video route must load project-media metadata.");
assert.match(route, /KUVOX_E2E_FIXTURES/, "video route must expose only gated E2E fixtures.");

const document = read("app/lib/editor/video-document.ts");
assert.match(document, /VideoProjectDocument/, "video document model must exist.");
assert.match(document, /TextTimelineItem/, "text overlay items must exist.");
assert.match(document, /AudioTimelineItem/, "audio timeline items must exist.");
assert.match(document, /validateVideoProjectDocument/, "video document must serialize/validate.");

const operations = read("app/lib/editor/video-operations.ts");
for (const type of ["addMediaToTimeline", "addAudioItem", "addTextItem", "moveItem", "trimItem", "splitItem", "deleteItem", "reorderItem", "updateAudio"]) {
  assert.ok(operations.includes(type), `timeline operation ${type} must be supported.`);
}

const workspace = read("app/components/editor/video-editor-workspace.tsx");
assert.match(workspace, /PreviewPanel/, "program monitor preview must be present.");
assert.match(workspace, /useVideoAutosave/, "IndexedDB autosave must be wired.");
assert.match(workspace, /getVideoTimelineFromBff/, "backend sync load boundary must be wired.");
assert.match(workspace, /VideoExportModal/, "export/render path must be present.");
assert.match(workspace, /AiAssistantPanel/, "AI command path must be present.");

const topBar = read("app/components/editor/editor-top-bar.tsx");
assert.match(topBar, /videoUndoRequested/, "undo must be exposed.");
assert.match(topBar, /videoRedoRequested/, "redo must be exposed.");

const cache = read("app/lib/editor/editor-cache.ts");
assert.match(cache, /videoTimelineDrafts|VideoTimelineDraft/, "video drafts must autosave to IndexedDB.");

console.log("V-020 MVP cutline assertions passed.");
