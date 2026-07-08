import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { warnSkippedWorkspaceAssertion, workspaceFileExists } from "./workspace-paths";

const read = (path: string) => readFileSync(path, "utf8");

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string>; devDependencies: Record<string, string> };

for (const dependency of [
  "@testing-library/react",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
  "jsdom",
  "@playwright/test",
]) {
  assert.ok(packageJson.devDependencies[dependency], `${dependency} must be installed for V-019.`);
}

for (const script of [
  "test:video-components",
  "test:e2e",
  "verify:video-testing-strategy",
  "verify:video-mvp-cutline",
]) {
  assert.ok(packageJson.scripts[script], `${script} script must exist.`);
}

assert.ok(existsSync("app/components/editor/video-components.test.tsx"), "component coverage must exist.");
assert.ok(existsSync("e2e/video-editor.spec.ts"), "Playwright route-flow coverage must exist.");

if (!workspaceFileExists("kuvox_api", "Tests/TimelineServiceTests.cs")) {
  warnSkippedWorkspaceAssertion("API timeline service test presence", "kuvox_api");
}

if (!workspaceFileExists("kuvox_ai_service", "tests/unit/test_video_editor_routes.py")) {
  warnSkippedWorkspaceAssertion("AI route schema/correlation test presence", "kuvox_ai_service");
}

const componentTests = read("app/components/editor/video-components.test.tsx");
for (const marker of [
  "MediaLibraryPanel",
  "VideoInspectorPanel",
  "AiAssistantPanel",
  "TimelinePanel",
  "EditorTopBar",
]) {
  assert.match(componentTests, new RegExp(marker), `${marker} component coverage is required.`);
}

const e2e = read("e2e/video-editor.spec.ts");
for (const marker of [
  "/editor/video/e2e-video-project",
  "/bff/projects/",
  "/bff/ai/planning/video-editor",
  "/bff/ai/retrieval/video-editor",
  "/bff/timelines/",
  "IndexedDB",
]) {
  assert.ok(e2e.includes(marker), `${marker} must be represented in E2E coverage.`);
}

const reducerTests = read("scripts/video-operations.assertions.ts");
assert.match(reducerTests, /undo|history|checkpoint|split|trim|move/i, "operation assertion coverage must include history/time edit behavior.");

console.log("V-019 testing strategy assertions passed.");
