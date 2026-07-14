import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const testVideoObject = readFile(new URL("../public/test-media.mp4", import.meta.url));
const editorTourStorageKey = "kuvox.editor.onboardingTour.completed.v1:user-e2e:e2e-video-project";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, "true");
  }, editorTourStorageKey);
  await installBffMocks(page);
});

test("overlay elements drag directly in preview and persist after the next click", async ({ page }) => {
  await page.goto("/editor/video/e2e-video-project");
  await page.getByRole("button", { name: "Elements" }).click();
  await page.getByTitle("Drag or click to add Watercolor Blue to timeline").click();
  await expect(page.getByLabel(/timeline item, Watercolor Blue/i)).toBeVisible();

  const positionX = page.getByLabel("Position X");
  const positionY = page.getByLabel("Position Y");
  await expect(positionX).toHaveValue("0");
  await expect(positionY).toHaveValue("0");

  const stage = page.locator('[data-tour="preview-panel"] .konvajs-content').filter({ visible: true }).first();
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2;
  const startY = (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 70, { steps: 8 });
  await page.mouse.up();

  await expect(positionX).not.toHaveValue("0");
  await expect(positionY).not.toHaveValue("0");
  const movedX = await positionX.inputValue();
  const movedY = await positionY.inputValue();

  await page.mouse.click(startX + 120, startY + 70);
  await expect(positionX).toHaveValue(movedX);
  await expect(positionY).toHaveValue(movedY);
});

test("timeline shows a session-only preparing block before committing media", async ({ page }, testInfo) => {
  await page.unroute("**/bff/media/**");
  await page.route("**/bff/media/**", async (route) => {
    if (/\/object\/(proxy|canonical|raw)(\?|$)/.test(new URL(route.request().url()).pathname)) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 200, contentType: "video/mp4", body: await testVideoObject });
      return;
    }
    await route.fulfill({ status: 204 });
  });

  await page.goto("/editor/video/e2e-video-project");
  await page.getByRole("button", { name: /beach ready/i }).click();
  await expect(page.getByLabel(/beach ready\.mp4, preparing/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("timeline-preparing.png") });
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("timeline-ready.png") });
});

test("local timeline recovery syncs once and exports the exact saved revision", async ({ page }) => {
  const timelinePuts: Array<Record<string, unknown>> = [];
  const renderPosts: Array<Record<string, unknown>> = [];
  const backgroundMutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" || request.method() === "HEAD") return;
    const url = new URL(request.url());
    if (request.method() === "PUT" && url.pathname.endsWith("/video-timeline")) {
      timelinePuts.push(request.postDataJSON());
      return;
    }
    if (request.method() === "POST" && /\/bff\/timelines\/[^/]+\/render$/.test(url.pathname)) {
      renderPosts.push(request.postDataJSON());
      return;
    }
    if (
      (request.method() === "POST" && url.pathname === "/bff/projects/e2e-video-project/media") ||
      (request.method() === "POST" && url.pathname.endsWith("/performance"))
    ) {
      backgroundMutations.push(`${request.method()} ${url.pathname}`);
    }
  });
  let timelineGets = 0;
  await page.unroute("**/bff/projects/e2e-video-project/video-timeline");
  await page.route("**/bff/projects/e2e-video-project/video-timeline", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "e2e-video-project",
          timelineId: "timeline-e2e",
          revisionId: "revision-e2e-8",
          documentJson: body.documentJson,
          revisionNumber: 8,
          documentSchemaVersion: 1,
          source: "manual",
          label: "Explicit save",
          updatedAt: "2026-07-11T08:00:00.000Z",
          updatedByUserId: "user-e2e",
        }),
      });
      return;
    }

    timelineGets += 1;
    if (timelineGets <= 2) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "e2e-video-project",
          timelineId: "timeline-e2e",
          revisionId: "revision-e2e-7",
          documentJson: emptyTimelineDocument(),
          revisionNumber: 7,
          documentSchemaVersion: 1,
          source: "manual",
          label: "Existing revision",
          updatedAt: "2026-07-11T07:00:00.000Z",
          updatedByUserId: "user-e2e",
        }),
      });
      return;
    }

    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Timeline unavailable" }) });
  });

  await page.goto("/editor/video/e2e-video-project");
  await page.getByRole("button", { name: /beach ready/i }).click();
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();
  await expect(page.getByText(/Saved locally/)).toBeVisible();
  const beforeRefresh = await readCanonicalTimelineDraft(page, "e2e-video-project");
  const pendingBeforeRefresh = await readPendingTimelineRecords(page, "e2e-video-project");

  expect(timelinePuts).toHaveLength(0);
  expect(renderPosts).toHaveLength(0);
  expect(backgroundMutations).toEqual([]);
  expect(pendingBeforeRefresh.map((record) => record.kind)).toEqual(expect.arrayContaining(["timelineDraft", "projectMediaAttach"]));

  await page.reload();
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();
  const afterRefresh = await readCanonicalTimelineDraft(page, "e2e-video-project");
  expect(afterRefresh).toEqual(beforeRefresh);

  await page.getByRole("button", { name: /^sync$/i }).click();
  await expect.poll(() => timelinePuts.length).toBe(1);
  await expect(page.getByText(/Synced/)).toBeVisible();

  await page.getByRole("button", { name: /export video/i }).click();
  await page.getByRole("button", { name: /create render job/i }).click();
  await expect(page.getByText("Render job creation is not available from the backend yet.")).toBeVisible();
  expect(timelinePuts).toHaveLength(1);
  expect(renderPosts).toHaveLength(1);
  expect(timelineGets).toBeGreaterThan(2);
  expect(renderPosts[0]).toMatchObject({ timelineId: "timeline-e2e", revisionNumber: 8 });
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

  await page.getByLabel(/video timeline item/i).first().click();
  await page.getByRole("button", { name: /delete selected/i }).click();
  await page.reload();
  await expect(page.getByText(/Saved locally|Synced/)).toBeVisible();
  await expect(page.getByText("Empty timeline")).toBeVisible();

  await page.getByRole("button", { name: /AI Agent editing mode/i }).click();
  await expect(page.getByRole("complementary", { name: "AI Assistant" })).toBeVisible();
  await page.getByLabel("AI edit command").fill("add text at 8s");
  await page.getByRole("button", { name: /send command/i }).click();
  await expect(page.getByText("Added AI text at 8s.").first()).toBeVisible();

  await page.getByRole("button", { name: /expand ai workspace/i }).click();
  await page.getByPlaceholder("Search moments...").fill("b-roll");
  await page.getByRole("button", { name: /search moments/i }).last().click();
  const addShot = page.getByRole("button", { name: /add shot to timeline/i });
  await expect(addShot).toBeVisible();
  await addShot.click();
  await expect(page.getByLabel(/video timeline item, Beach ready/i)).toBeVisible();

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
  await page.getByRole("button", { name: /beach ready/i }).click();
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();
  await page.getByRole("button", { name: /export video/i }).click();
  await page.getByRole("button", { name: /create render job/i }).click();
  await expect(page.getByText("Queued", { exact: true })).toBeVisible();

  await emitSignalR(page, "renderJobUpdated", {
    jobId: "render-e2e",
    timelineId: "timeline-e2e",
    status: "rendering",
    outputAvailable: false,
    message: "Rendering video.",
  });
  await expect(page.getByText("Rendering", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Adjust" }).click();
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
    if (/\/object\/(proxy|canonical|raw)(\?|$)/.test(new URL(route.request().url()).pathname)) {
      await route.fulfill({ status: 200, contentType: "video/mp4", body: await testVideoObject });
      return;
    }
    await route.fulfill({ status: 204 });
  });
}

async function readCanonicalTimelineDraft(page: Page, projectId: string) {
  return page.evaluate(async ({ databaseName, projectId }) => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("videoTimelineDrafts", "readonly");
      const records = transaction.objectStore("videoTimelineDrafts").getAll();
      records.onerror = () => reject(records.error);
      records.onsuccess = () => {
        const record = records.result.find((candidate) => candidate.projectId === projectId);
        resolve(record?.document ?? null);
      };
    };
  }), { databaseName: "kuvox-editor-cache", projectId });
}

async function readPendingTimelineRecords(page: Page, projectId: string) {
  return page.evaluate(async ({ databaseName, projectId }) => new Promise<Array<{ kind: string; entityId?: string }>>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("pendingSync", "readonly");
      const records = transaction.objectStore("pendingSync").getAll();
      records.onerror = () => reject(records.error);
      records.onsuccess = () => resolve(records.result.filter((candidate) => candidate.projectId === projectId));
    };
  }), { databaseName: "kuvox-editor-cache", projectId });
}

function emptyTimelineDocument() {
  return {
    schemaVersion: 1,
    projectId: "e2e-video-project",
    name: "E2E Video Project",
    createdAt: "2026-07-11T07:00:00.000Z",
    updatedAt: "2026-07-11T07:00:00.000Z",
    settings: {
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      frameRate: 30,
      previewQuality: "balanced",
      defaultTransitionDuration: 0.4,
      exportPreset: "h264-1080p",
    },
    media: {},
    tracks: [
      { id: "v1", kind: "video", label: "V1", locked: false, hidden: false, muted: false, items: [] },
      { id: "a1", kind: "audio", label: "A1", locked: false, hidden: false, muted: false, items: [] },
      { id: "t1", kind: "text", label: "T1", locked: false, hidden: false, muted: false, items: [] },
    ],
    transitions: [],
    effects: [],
    history: { revision: 0, canUndo: false, canRedo: false },
  };
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
