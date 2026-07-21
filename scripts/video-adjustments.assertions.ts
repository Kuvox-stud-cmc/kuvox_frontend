import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import fixtures from "./fixtures/video-adjustments-v1.json";
import {
  resolveVideoVisualStyle,
  VIDEO_ADJUSTMENT_REGISTRY_VERSION,
} from "../app/lib/editor/video-adjustments";

assert.equal(fixtures.registryVersion, VIDEO_ADJUSTMENT_REGISTRY_VERSION);
for (const fixture of fixtures.cases) {
  assert.deepEqual(
    resolveVideoVisualStyle(fixture.item as never),
    fixture.expected,
    `Adjustment fixture ${fixture.id} diverged from the versioned registry.`,
  );
}

const pythonFixture = new URL("../../kuvox_ai_service/tests/fixtures/video-adjustments-v1.json", import.meta.url);
if (existsSync(pythonFixture)) {
  assert.deepEqual(
    JSON.parse(readFileSync(pythonFixture, "utf8")),
    fixtures,
    "TypeScript and Python adjustment fixtures must remain byte-for-byte equivalent JSON values.",
  );
}
