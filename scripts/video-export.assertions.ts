import assert from "node:assert/strict";

import { MediaKind, OwnerKind, type MediaDto } from "../app/lib/api";
import {
  createDefaultVideoExportSettings,
  isRenderBackendUnavailable,
  normalizeVideoRenderJob,
  requestVideoRenderJob,
  validateVideoExport,
  VideoRenderRequestError,
  type VideoExportSettings,
} from "../app/lib/editor/video-export";
import {
  createEmptyVideoProjectDocument,
  createMockVideoProjectDocument,
  type ImageOverlayTimelineItem,
  type VideoMediaReference,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";

async function main(): Promise<void> {
  assertEmptyTimelineIsBlocked();
  assertTextOnlyTimelineIsBlocked();
  assertMissingDocumentMediaIsBlocked();
  assertMissingLoadedProjectMediaIsBlocked();
  assertProcessingAndFailedMediaAreBlocked();
  assertSupportedTimelinePasses();
  assertEffectsAndTransitionsAreBlocked();
  assertRenderJobNormalization();
  await assertRenderRequestBodyStaysStable();
  assertBackendUnavailableClassification();
  assertObjectStorageKeysDoNotBecomeOutputUrls();
}

function assertEmptyTimelineIsBlocked(): void {
  const document = createEmptyVideoProjectDocument({ id: "project-export-empty", name: "Empty" });
  const result = validateVideoExport(document, [], settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "no-visible-visual-media"));
  assert.equal(result.manifest, undefined);
}

function assertTextOnlyTimelineIsBlocked(): void {
  const document = createEmptyVideoProjectDocument({ id: "project-export-text", name: "Text" });
  document.tracks = [
    {
      id: "t1",
      kind: "text",
      label: "T1",
      locked: false,
      hidden: false,
      muted: false,
      items: [
        {
          id: "text-1",
          type: "text",
          timelineStart: 0,
          duration: 5,
          text: "Title",
          style: { fontFamily: "Inter", fontSize: 48, color: "#fff" },
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          layerOrder: 1,
        },
      ],
    },
  ];

  const result = validateVideoExport(document, [], settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "no-visible-visual-media"));
}

function assertMissingDocumentMediaIsBlocked(): void {
  const document = createMockVideoProjectDocument("project-export-missing-document", "Missing document media");
  delete document.media["clip-beach"];

  const result = validateVideoExport(document, readyMediaForDocument(createMockVideoProjectDocument("project-export-missing-document")), settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-document-media" && issue.mediaId === "clip-beach"));
}

function assertMissingLoadedProjectMediaIsBlocked(): void {
  const document = createMockVideoProjectDocument("project-export-missing-loaded", "Missing loaded media");
  const loaded = readyMediaForDocument(document).filter((item) => item.id !== "clip-beach");

  const result = validateVideoExport(document, loaded, settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-project-media" && issue.mediaId === "clip-beach"));
}

function assertProcessingAndFailedMediaAreBlocked(): void {
  const processingDocument = singleVideoDocument("project-export-processing", "processing-media");
  const processing = validateVideoExport(
    processingDocument,
    [mediaDto("processing-media", MediaKind.Video, { status: "processing", pipelineStage: "optimizing", terminal: false })],
    settings(processingDocument),
  );
  assert.equal(processing.ok, false);
  assert.ok(processing.errors.some((issue) => issue.code === "media-processing"));

  const failedDocument = singleVideoDocument("project-export-failed", "failed-media");
  const failed = validateVideoExport(
    failedDocument,
    [mediaDto("failed-media", MediaKind.Video, { status: "failed", pipelineStage: "failed", terminal: true })],
    settings(failedDocument),
  );
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.some((issue) => issue.code === "media-failed"));
}

function assertSupportedTimelinePasses(): void {
  const document = createMockVideoProjectDocument("project-export-pass", "Supported");
  document.effects = [];
  document.transitions = [];
  document.media["still-poster"] = mediaReference("still-poster", "image", "Poster.png", 5);
  document.tracks.push({
    id: "o1",
    kind: "overlay",
    label: "O1",
    locked: false,
    hidden: false,
    muted: false,
    items: [imageItem("image-1", "still-poster")],
  });

  const result = validateVideoExport(document, readyMediaForDocument(document), settings(document));
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.manifest?.schemaVersion, 1);
  assert.equal(result.manifest?.projectId, document.projectId);
  assert.ok(result.manifest?.visualItems.some((item) => item.itemId === "image-1"));
}

function assertEffectsAndTransitionsAreBlocked(): void {
  const document = createMockVideoProjectDocument("project-export-blockers", "Blockers");
  const result = validateVideoExport(document, readyMediaForDocument(document), settings(document));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-effect"));
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-transition"));
  assert.equal(result.manifest, undefined);
}

function assertRenderJobNormalization(): void {
  assert.equal(normalizeVideoRenderJob({ id: "job-queued", status: "queued" }).status, "queued");
  assert.equal(normalizeVideoRenderJob({ id: "job-running", status: "running" }).status, "rendering");
  assert.equal(normalizeVideoRenderJob({ id: "job-complete", status: "succeeded" }).status, "completed");
  assert.equal(normalizeVideoRenderJob({ id: "job-failed", status: "error" }).status, "failed");

  const backendQueued = normalizeVideoRenderJob({
    id: "job-backend-queued",
    timelineId: "timeline-backend",
    revisionNumber: 3,
    status: "queued",
    outputUrl: null,
  });
  assert.equal(backendQueued.timelineId, "timeline-backend");
  assert.equal(backendQueued.revisionNumber, 3);
  assert.equal(backendQueued.outputUrl, null);
}

async function assertRenderRequestBodyStaysStable(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let capturedBody: unknown = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    return new Response(JSON.stringify({ id: "job-1", status: "queued" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const exportSettings = settings(createEmptyVideoProjectDocument({ id: "project-request", name: "Request" }));
    const job = await requestVideoRenderJob({
      timelineId: "timeline-request",
      revisionNumber: 7,
      settings: exportSettings,
    });

    assert.equal(job.id, "job-1");
    assert.deepEqual(capturedBody, {
      timelineId: "timeline-request",
      revisionNumber: 7,
      settings: exportSettings,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertBackendUnavailableClassification(): void {
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Not implemented", { status: 501 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Not found", { status: 404 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Proxy failed", { status: 502 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Failed to fetch", { status: null })), true);
  assert.equal(isRenderBackendUnavailable(new TypeError("Failed to fetch")), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Unauthorized", { status: 401 })), false);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Forbidden", { status: 403 })), false);
}

function assertObjectStorageKeysDoNotBecomeOutputUrls(): void {
  const storageOnly = normalizeVideoRenderJob({
    id: "job-storage",
    status: "completed",
    outputStorageKey: "renders/project/video.mp4",
  });
  assert.equal(storageOnly.status, "completed");
  assert.equal(storageOnly.outputUrl, null);

  const completed = normalizeVideoRenderJob({
    id: "job-api",
    status: "completed",
    outputAvailable: true,
  });
  assert.equal(completed.outputUrl, "/bff/timelines/render-jobs/job-api/output");

  const objectStoreUrl = normalizeVideoRenderJob({
    id: "job-object-store",
    status: "completed",
    outputAvailable: false,
    outputUrl: "https://objects.example.test/renders/project/video.mp4",
  });
  assert.equal(objectStoreUrl.outputUrl, null);
}

function settings(document: VideoProjectDocument): VideoExportSettings {
  return createDefaultVideoExportSettings(document, document.name);
}

function singleVideoDocument(projectId: string, mediaId: string): VideoProjectDocument {
  const document = createEmptyVideoProjectDocument({ id: projectId, name: projectId });
  document.media[mediaId] = mediaReference(mediaId, "video", `${mediaId}.mp4`, 8);
  document.tracks[0].items = [
    {
      id: `tl-${mediaId}`,
      type: "video",
      mediaId,
      timelineStart: 0,
      duration: 8,
      sourceIn: 0,
      sourceOut: 8,
      speed: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      opacity: 1,
    },
  ];
  return document;
}

function readyMediaForDocument(document: VideoProjectDocument): MediaDto[] {
  return Object.values(document.media).map((item) => {
    const kind = item.kind === "audio"
      ? MediaKind.Audio
      : item.kind === "image"
        ? MediaKind.Image
        : MediaKind.Video;
    return mediaDto(item.id, kind);
  });
}

function mediaReference(
  id: string,
  kind: VideoMediaReference["kind"],
  name: string,
  duration: number,
): VideoMediaReference {
  return {
    id,
    kind,
    name,
    duration,
    width: kind === "audio" ? undefined : 1920,
    height: kind === "audio" ? undefined : 1080,
    objectUrls: { raw: `/bff/media/${id}/object/raw?v=${id}-raw` },
    sourceUrl: `/bff/media/${id}/object/raw?v=${id}-raw`,
  };
}

function imageItem(id: string, mediaId: string): ImageOverlayTimelineItem {
  return {
    id,
    type: "image",
    mediaId,
    timelineStart: 1,
    duration: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 1,
    layerOrder: 2,
  };
}

function mediaDto(
  id: string,
  kind: number,
  options: {
    status?: string;
    pipelineStage?: string;
    terminal?: boolean;
    storageKey?: string | null;
    canonicalStorageKey?: string | null;
  } = {},
): MediaDto {
  const status = options.status ?? "ready";
  const stage = options.pipelineStage ?? "ready";
  const terminal = options.terminal ?? true;

  return {
    id,
    ownerId: "owner-1",
    ownerKind: OwnerKind.User,
    ownerEmail: "owner@example.com",
    ownerDisplayName: "Owner",
    kind,
    filename: `${id}.${kind === MediaKind.Audio ? "wav" : kind === MediaKind.Image ? "png" : "mp4"}`,
    storageKey: options.storageKey === null ? "" : options.storageKey ?? `media/${id}/raw`,
    sizeBytes: 1024,
    status,
    canonicalStorageKey: options.canonicalStorageKey === null ? null : options.canonicalStorageKey ?? `media/${id}/canonical`,
    proxyStorageKey: null,
    thumbnailStorageKey: null,
    errorMessage: status === "failed" ? "Processing failed." : null,
    durationSeconds: kind === MediaKind.Image ? null : 8,
    width: kind === MediaKind.Audio ? null : 1920,
    height: kind === MediaKind.Audio ? null : 1080,
    codec: null,
    frameRate: kind === MediaKind.Video ? 30 : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    pipeline: {
      stage,
      label: stage,
      detail: stage,
      step: terminal ? 4 : 2,
      stepCount: 4,
      terminal,
    },
  };
}

await main();
