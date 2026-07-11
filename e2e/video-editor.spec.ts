import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await installBffMocks(page);
});

test("video editor route loads, edits timeline, recovers IndexedDB autosave, applies AI, and handles export backend outage", async ({ page }) => {
  await page.goto("/editor/video/e2e-video-project");

  await expect(page.getByText("E2E Video Project")).toBeVisible();
  await expect(page.getByRole("button", { name: /beach ready/i })).toBeVisible();

  const mediaCard = page.getByRole("button", { name: /beach ready/i });
  const timelineTracks = page.getByLabel("Timeline tracks");
  const timelineBox = await timelineTracks.boundingBox();
  expect(timelineBox).not.toBeNull();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await mediaCard.dispatchEvent("dragstart", { dataTransfer });
  await timelineTracks.dispatchEvent("dragover", {
    dataTransfer,
    clientX: (timelineBox?.x ?? 0) + 320,
    clientY: (timelineBox?.y ?? 0) + 56,
  });
  await timelineTracks.dispatchEvent("drop", {
    dataTransfer,
    clientX: (timelineBox?.x ?? 0) + 320,
    clientY: (timelineBox?.y ?? 0) + 56,
  });
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();

  await page.getByRole("button", { name: /split at playhead/i }).click();
  await page.getByRole("button", { name: /undo/i }).first().click();
  await page.getByRole("button", { name: /redo/i }).first().click();

  await page.getByRole("button", { name: /delete selected/i }).click();
  await page.reload();
  await expect(page.getByText(/Saved locally|Synced/)).toBeVisible();
  await expect(page.getByLabel(/video timeline item/i)).toBeVisible();

  await page.getByRole("button", { name: /AI Agent editing mode/i }).click();
  await expect(page.getByRole("complementary", { name: "AI Assistant" })).toBeVisible();
  await page.getByLabel("AI edit command").fill("add text at 8s");
  await page.getByRole("button", { name: /send command/i }).click();
  await expect(page.getByText("Added AI text at 8s.").first()).toBeVisible();

  await page.getByRole("button", { name: /expand ai workspace/i }).click();
  await page.getByPlaceholder("Search moments...").fill("b-roll");
  await page.getByRole("button", { name: /search moments/i }).last().click();
  await expect(page.getByRole("button", { name: /add shot to timeline/i })).toBeVisible();

  await page.getByRole("button", { name: /export video/i }).click();
  await page.getByRole("button", { name: /create render job/i }).click();
  await expect(page.getByText("Render job creation is not available from the backend yet.")).toBeVisible();

  await page.evaluate(async () => {
    const databases = "databases" in indexedDB ? await indexedDB.databases() : [];
    return databases.map((db) => db.name).filter(Boolean);
  }).then((names) => {
    expect(String(names)).toContain("kuvox");
  });
});

test("render jobs complete over the shared websocket without status polling", async ({ page }) => {
  await installMockSignalR(page);
  await page.unroute("**/bff/timelines/*/render");
  await page.route("**/bff/timelines/*/render", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "render-e2e",
        timelineId: "timeline-e2e",
        revisionNumber: 2,
        status: "queued",
        outputAvailable: false,
        message: "Render queued.",
      }),
    });
  });
  let statusRequests = 0;
  await page.route("**/bff/timelines/render-jobs/render-e2e", async (route) => {
    statusRequests += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto("/editor/video/e2e-video-project");
  await page.getByRole("button", { name: /export video/i }).click();
  await page.getByRole("button", { name: /create render job/i }).click();
  await expect(page.getByText("Queued")).toBeVisible();

  await emitSignalR(page, "renderJobUpdated", {
    jobId: "render-e2e",
    timelineId: "timeline-e2e",
    status: "rendering",
    outputAvailable: false,
    message: "Rendering video.",
  });
  await expect(page.getByText("Rendering")).toBeVisible();
  await emitSignalR(page, "renderJobUpdated", {
    jobId: "render-e2e",
    timelineId: "timeline-e2e",
    status: "completed",
    outputAvailable: true,
    outputContentType: "video/mp4",
    outputSizeBytes: 456,
    message: "Export completed.",
  });

  await expect(page.getByRole("link", { name: /open exported video/i })).toHaveAttribute(
    "href",
    "/bff/timelines/render-jobs/render-e2e/output",
  );
  await page.waitForTimeout(2200);
  expect(statusRequests).toBe(0);
});

test("manual editor adapts across phone, tablet, and desktop layouts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor/video/e2e-video-project");

  const responsiveControls = page.locator("[data-responsive-manual-controls]");
  await expect(responsiveControls).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  const playhead = page.getByLabel("Playhead", { exact: true });
  await expect(playhead).toBeHidden();

  await page.getByRole("button", { name: /AI Agent editing mode/i }).click();
  await expect(page.getByRole("complementary", { name: "AI Assistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto Enhance" })).toBeVisible();
  await expect(page.getByLabel("AI edit command")).toBeVisible();
  await page.getByRole("button", { name: /Manual editing mode/i }).click();

  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(playhead).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  const mediaTrigger = page.getByRole("button", { name: "Open media library" });
  const mediaPanel = page.locator('aside[aria-label="Media library"]');
  await mediaTrigger.click();
  await expect(mediaPanel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(mediaPanel).toBeHidden();
  await expect(mediaTrigger).toBeFocused();

  const inspectorTrigger = page.getByRole("button", { name: "Open inspector" });
  const inspectorPanel = page.locator('aside[aria-label="Inspector"]');
  await inspectorTrigger.click();
  await expect(inspectorPanel).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(inspectorTrigger).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(responsiveControls).toBeVisible();
  await expect(playhead).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(responsiveControls).toBeHidden();
  await expect(mediaPanel).toBeVisible();
  await expect(inspectorPanel).toBeHidden();
  await page.getByRole("button", { name: "Show inspector" }).click();
  await expect(inspectorPanel).toBeVisible();
  await expect(page.locator("[data-video-editor-root]")).toHaveCSS("overflow", "hidden");
});

async function installBffMocks(page: Page) {
  await page.route("**/bff/projects/e2e-video-project/video-timeline", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "e2e-video-project",
          timelineId: "timeline-e2e",
          revisionId: "revision-e2e-2",
          documentJson: body.documentJson,
          revisionNumber: Number(body.baseRevisionNumber ?? 0) + 1,
          documentSchemaVersion: 1,
          source: "e2e",
          label: "E2E save",
          updatedAt: "2026-01-01T00:01:00.000Z",
          updatedByUserId: "user-e2e",
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "No timeline" }) });
  });

  await page.route("**/bff/projects/e2e-video-project/media**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([projectMedia("media-ready")]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [projectMedia("media-ready")] }) });
  });

  await page.route("**/bff/ai/planning/video-editor", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        planId: "plan-e2e",
        commandId: "command-e2e",
        explanation: "Added AI text at 8s.",
        confidence: 0.9,
        warnings: [],
        actions: [{ type: "addText", text: "AI note", timelineStart: 8 }],
      }),
    });
  });

  await page.route("**/bff/ai/retrieval/video-editor", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projectId: "e2e-video-project",
        query: "b-roll",
        warnings: [],
        totalCandidatesConsidered: 1,
        results: [{
          shotId: "shot-e2e",
          mediaId: "media-ready",
          startSeconds: 1,
          endSeconds: 4,
          score: 0.9,
          modalityScores: { transcript: 0.9 },
          evidence: [{ modality: "transcript", text: "usable b-roll", score: 0.9 }],
        }],
      }),
    });
  });

  await page.route("**/bff/timelines/*/render", async (route) => {
    await route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ detail: "Backend unavailable" }) });
  });

  await page.route("**/bff/timelines/projects/e2e-video-project/performance", async (route) => {
    await route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
  });

  await page.route("**/bff/media/**", async (route) => {
    await route.fulfill({ status: 204 });
  });
}

async function installMockSignalR(page: Page) {
  await page.addInitScript(() => {
    const sockets: Array<{
      onmessage: ((event: { data: string }) => void) | null;
    }> = [];

    class MockWebSocket {
      static OPEN = 1;
      readyState = MockWebSocket.OPEN;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_url: string) {
        sockets.push(this);
        window.setTimeout(() => this.onopen?.(), 0);
      }

      send(_value: string) {
        this.onmessage?.({ data: "{}\x1e" });
      }

      close() {
        this.readyState = 3;
        this.onclose?.();
      }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: MockWebSocket });
    (window as typeof window & { __emitSignalR?: (target: string, payload: unknown) => void }).__emitSignalR =
      (target, payload) => {
        const data = `${JSON.stringify({ type: 1, target, arguments: [payload] })}\x1e`;
        sockets.forEach((socket) => socket.onmessage?.({ data }));
      };
  });
}

async function emitSignalR(page: Page, target: string, payload: unknown) {
  await page.evaluate(({ target, payload }) => {
    (window as typeof window & { __emitSignalR?: (target: string, payload: unknown) => void })
      .__emitSignalR?.(target, payload);
  }, { target, payload });
}

function projectMedia(mediaId: string) {
  return {
    mediaId,
    kind: 0,
    availability: "available",
    filename: "Beach ready.mp4",
    ownerId: "user-e2e",
    ownerKind: 0,
    status: "Ready",
    storageKey: "raw",
    sizeBytes: 100,
    canonicalStorageKey: "canonical",
    proxyStorageKey: "proxy",
    thumbnailStorageKey: "thumb",
    errorMessage: null,
    durationSeconds: 20,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    shotCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
