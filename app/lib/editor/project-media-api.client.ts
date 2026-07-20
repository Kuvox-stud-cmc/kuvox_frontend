import type { MediaDto, ProjectMediaDto } from "~/lib/api";

import { readVideoTimelineError } from "./video-timeline-api.client";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";

export async function getProjectMediaFromBff(
  projectId: string,
  options: { correlationId?: string } = {},
): Promise<ProjectMediaDto[]> {
  const correlationId = options.correlationId ?? createEditorCorrelationId("project-media");
  const response = await fetch(projectMediaPath(projectId, "?page=1&pageSize=100"), {
    method: "GET",
    headers: withEditorCorrelationHeaders({ Accept: "application/json" }, correlationId),
  });
  if (!response.ok) {
    logVideoEditorEvent("editor.load.failure", {
      projectId,
      correlationId,
      status: response.status,
      route: "project-media",
    }, "error");
    throw new Error(await readVideoTimelineError(response, "Project media could not be loaded."));
  }

  const body = await response.json();
  const items = Array.isArray(body?.items) ? body.items.map(normalizeProjectMedia) : [];
  const totalPages = Number(body?.totalPages ?? 1);
  for (let page = 2; page <= totalPages; page += 1) {
    const nextResponse = await fetch(projectMediaPath(projectId, `?page=${page}&pageSize=100`), {
      method: "GET",
      headers: withEditorCorrelationHeaders({ Accept: "application/json" }, correlationId),
    });
    if (!nextResponse.ok) {
      throw new Error(await readVideoTimelineError(nextResponse, "Project media could not be loaded."));
    }
    const nextBody = await nextResponse.json();
    if (Array.isArray(nextBody?.items)) items.push(...nextBody.items.map(normalizeProjectMedia));
  }
  logVideoEditorEvent("editor.load.success", {
    projectId,
    correlationId,
    route: "project-media",
    mediaCount: items.length,
  }, "debug");
  return items;
}

export async function attachProjectMediaFromBff(
  projectId: string,
  mediaIds: string[],
  options: { correlationId?: string } = {},
): Promise<ProjectMediaDto[]> {
  const correlationId = options.correlationId ?? createEditorCorrelationId("project-media-attach");
  const response = await fetch(projectMediaPath(projectId), {
    method: "POST",
    headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
    body: JSON.stringify({ mediaIds }),
  });
  if (!response.ok) {
    logVideoEditorEvent("editor.sync.failure", {
      projectId,
      correlationId,
      route: "project-media-attach",
      status: response.status,
      mediaIds,
    }, "error");
    throw new Error(await readVideoTimelineError(response, "Media could not be attached to this project."));
  }

  const body = await response.json();
  const items = Array.isArray(body) ? body.map(normalizeProjectMedia) : [];
  logVideoEditorEvent("editor.sync.success", {
    projectId,
    correlationId,
    route: "project-media-attach",
    mediaIds,
    mediaCount: items.length,
  }, "debug");
  return items;
}

export function projectMediaToMediaDto(item: ProjectMediaDto): MediaDto | null {
  if (item.availability !== "available" && item.availability !== "processing" && item.availability !== "failed") {
    return null;
  }

  if (item.kind === null || !item.filename || !item.ownerId || item.ownerKind === null || !item.storageKey || !item.status) {
    return null;
  }

  return {
    id: item.mediaId,
    ownerId: item.ownerId,
    ownerKind: item.ownerKind,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: item.kind,
    filename: item.filename,
    storageKey: item.storageKey,
    sizeBytes: item.sizeBytes ?? 0,
    status: item.status,
    canonicalStorageKey: item.canonicalStorageKey,
    proxyStorageKey: item.proxyStorageKey,
    thumbnailStorageKey: item.thumbnailStorageKey,
    errorMessage: item.errorMessage,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
    codec: item.codec,
    frameRate: item.frameRate,
    createdAt: item.createdAt ?? new Date(0).toISOString(),
    isFavorite: false,
    pipeline: pipelineForStatus(item.status),
  } satisfies MediaDto;
}

function projectMediaPath(projectId: string, suffix = ""): string {
  return `/bff/projects/${encodeURIComponent(projectId)}/media${suffix}`;
}

function normalizeProjectMedia(value: unknown): ProjectMediaDto {
  const item = isRecord(value) ? value : {};
  return {
    mediaId: String(item.mediaId ?? item.id ?? ""),
    kind: normalizeNullableNumber(item.kind),
    availability: normalizeAvailability(item.availability),
    filename: nullableString(item.filename),
    ownerId: nullableString(item.ownerId),
    ownerKind: normalizeNullableNumber(item.ownerKind),
    status: nullableString(item.status),
    storageKey: nullableString(item.storageKey),
    sizeBytes: normalizeNullableNumber(item.sizeBytes),
    canonicalStorageKey: nullableString(item.canonicalStorageKey),
    proxyStorageKey: nullableString(item.proxyStorageKey),
    thumbnailStorageKey: nullableString(item.thumbnailStorageKey),
    errorMessage: nullableString(item.errorMessage),
    durationSeconds: normalizeNullableNumber(item.durationSeconds),
    width: normalizeNullableNumber(item.width),
    height: normalizeNullableNumber(item.height),
    codec: nullableString(item.codec),
    frameRate: normalizeNullableNumber(item.frameRate),
    shotCount: normalizeNullableNumber(item.shotCount),
    createdAt: nullableString(item.createdAt),
    searchRevision: normalizeNullableNumber(item.searchRevision),
  };
}

function normalizeAvailability(value: unknown): ProjectMediaDto["availability"] {
  const availability = String(value ?? "missing").toLowerCase();
  if (availability === "available" || availability === "processing" || availability === "failed" || availability === "deleted" || availability === "inaccessible") {
    return availability;
  }
  return "missing";
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pipelineForStatus(status: string): MediaDto["pipeline"] {
  const normalized = status.toLowerCase();
  if (normalized === "ready") {
    return { stage: "ready", label: "Ready", detail: "Ready for editing.", step: 4, stepCount: 4, terminal: true };
  }
  if (normalized === "failed") {
    return { stage: "failed", label: "Failed", detail: "Media processing failed.", step: 4, stepCount: 4, terminal: true };
  }
  return { stage: "processing", label: "Processing", detail: "Media is still processing.", step: 2, stepCount: 4, terminal: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
