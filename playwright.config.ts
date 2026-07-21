import { defineConfig, devices } from "@playwright/test";

const fixtureServerCommand = process.platform === "win32"
  ? "set KUVOX_E2E_FIXTURES=1&& set KUVOX_MEDIA_RETRIEVAL_ENABLED=true&& npm run dev -- --host 127.0.0.1 --port 5173"
  : "KUVOX_E2E_FIXTURES=1 KUVOX_MEDIA_RETRIEVAL_ENABLED=true npm run dev -- --host 127.0.0.1 --port 5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: fixtureServerCommand,
    url: "http://127.0.0.1:5173/editor/video/e2e-video-project",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
