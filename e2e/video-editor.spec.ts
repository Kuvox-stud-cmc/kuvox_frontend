import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await installBffMocks(page);
});

test("video editor route loads, edits timeline, recovers IndexedDB autosave, applies AI, and handles export backend outage", async ({ page }) => {
  await page.goto("/editor/video/e2e-video-project");

  await expect(page.getByText("E2E Video Project")).toBeVisible();
  await expect(page.getByRole("button", { name: /beach ready/i })).toBeVisible();

  await page.getByRole("button", { name: /beach ready/i }).click();
  await expect(page.getByLabel(/video timeline item, beach ready/i)).toBeVisible();

  await page.getByRole("button", { name: /split at playhead/i }).click();
  await page.getByRole("button", { name: /undo/i }).click();
  await page.getByRole("button", { name: /redo/i }).click();

  await page.getByRole("button", { name: /delete selected/i }).click();
  await page.reload();
  await expect(page.getByText(/Saved locally|Synced/)).toBeVisible();
  await expect(page.getByLabel(/video timeline item/i)).toBeVisible();

  await page.getByRole("button", { name: /AI Agent editing mode/i }).click();
  await page.getByLabel("AI edit command").fill("add text at 8s");
  await page.getByRole("button", { name: /send command/i }).click();
  await expect(page.getByText("Added AI text at 8s.").first()).toBeVisible();

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
