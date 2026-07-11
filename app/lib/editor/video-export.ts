import { type MediaDto, type ProjectMediaDto } from "~/lib/api";

import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";
import { mediaReadiness } from "./editor-media";
import { flushVideoEditorPerformanceMetrics } from "./video-performance.client";
import { roundTime } from "./editor-timeline";
import { evaluateVisualState } from "./video-evaluation";
import { videoStackOrderMap } from "./video-stack";
import {
  validateVideoProjectDocument,
  type VideoCrop,
  type VideoAnimatableValue,
  type VideoProjectDocument,
  type VideoMediaReference,
  type VideoTextStyle,
  type VideoTimelineItem,
  type VideoTrack,
  type VideoTransform,
} from "./video-document";

export type VideoExportPreset = "h264-720p" | "h264-1080p" | "h264-4k" | "prores-master";
export type VideoExportFormat = "mp4" | "mov";
export type VideoExportResolution = "1280x720" | "1920x1080" | "3840x2160" | "current";
export type VideoExportQuality = "draft" | "standard" | "high";
export type VideoRenderJobStatus =
  | "idle"
  | "validating"
  | "syncing"
  | "queued"
  | "rendering"
  | "completed"
  | "failed"
  | "backend-unavailable";

export interface VideoExportSettings {
  preset: VideoExportPreset;
  format: VideoExportFormat;
  resolution: VideoExportResolution;
  width: number;
  height: number;
  frameRate: number;
  quality: VideoExportQuality;
  destinationLabel: string;
}

export interface VideoExportValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  itemId?: string;
  trackId?: string;
  mediaId?: string;
}

export interface VideoExportValidationResult {
  ok: boolean;
  errors: VideoExportValidationIssue[];
  warnings: VideoExportValidationIssue[];
  manifest?: VideoRenderManifest;
}

export interface VideoRenderJob {
  id: string;
  timelineId: string;
  revisionNumber: number | null;
  status: Exclude<VideoRenderJobStatus, "idle" | "validating" | "syncing" | "backend-unavailable">;
  outputAvailable: boolean;
  outputUrl: string | null;
  outputContentType: string | null;
  outputSizeBytes: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  message: string | null;
}

export interface RequestVideoRenderJobInput {
  timelineId: string;
  revisionNumber: number;
  settings: VideoExportSettings;
}

export interface VideoRenderCanonicalSource {
  variant: "canonical";
  url: string;
  storageKey: string;
}

export interface VideoRenderMediaSource {
  mediaId: string;
  kind: VideoMediaReference["kind"];
  name: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  canonical: VideoRenderCanonicalSource;
}

export interface VideoRenderTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface VideoRenderCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface VideoRenderKeyframe {
  time: number;
  value: number;
  easing?: [number, number, number, number];
}

export interface VideoRenderAnimationTrack {
  keyframes: VideoRenderKeyframe[];
}

export interface VideoRenderAnimation {
  transform?: Partial<Record<"x" | "y" | "scaleX" | "scaleY" | "rotation", VideoRenderAnimationTrack>>;
  crop?: Partial<Record<"top" | "right" | "bottom" | "left", VideoRenderAnimationTrack>>;
  opacity?: VideoRenderAnimationTrack;
}

export interface VideoRenderVisualItem {
  itemId: string;
  trackId: string;
  type: "video" | "image" | "overlay";
  mediaId: string;
  shotId?: string;
  timelineStart: number;
  duration: number;
  sourceIn?: number;
  sourceOut?: number;
  speed?: number;
  layerOrder: number;
  stackOrder: number;
  transform: VideoRenderTransform;
  crop: VideoRenderCrop;
  opacity: number;
  animation?: VideoRenderAnimation;
}

export interface VideoRenderAudioItem {
  itemId: string;
  trackId: string;
  mediaId: string;
  timelineStart: number;
  duration: number;
  sourceIn: number;
  sourceOut: number;
  speed: number;
  volume: number;
  muted: boolean;
  fades: {
    fadeInDuration: number;
    fadeOutDuration: number;
  };
  layerOrder: number;
}

export interface VideoRenderTextOverlay {
  itemId: string;
  trackId: string;
  text: string;
  timelineStart: number;
  duration: number;
  style: VideoTextStyle;
  transform: VideoRenderTransform;
  opacity: number;
  layerOrder: number;
  stackOrder: number;
  animation?: Omit<VideoRenderAnimation, "crop">;
}

export interface VideoRenderManifest {
  schemaVersion: 2;
  projectId: string;
  settings: VideoExportSettings;
  durationSeconds: number;
  mediaSources: VideoRenderMediaSource[];
  visualItems: VideoRenderVisualItem[];
  audioItems: VideoRenderAudioItem[];
  textOverlays: VideoRenderTextOverlay[];
}

export type VideoRenderManifestBuildResult =
  | {
      ok: true;
      manifest: VideoRenderManifest;
      errors: [];
      warnings: VideoExportValidationIssue[];
    }
  | {
      ok: false;
      manifest?: undefined;
      errors: VideoExportValidationIssue[];
      warnings: VideoExportValidationIssue[];
    };

export class VideoRenderRequestError extends Error {
  readonly status: number | null;
  readonly response: Response | null;

  constructor(message: string, options: { status?: number | null; response?: Response | null } = {}) {
    super(message);
    this.name = "VideoRenderRequestError";
    this.status = options.status ?? null;
    this.response = options.response ?? null;
  }
}

const exportPresets = ["h264-720p", "h264-1080p", "h264-4k", "prores-master"] as const;
const exportFormats = ["mp4", "mov"] as const;
const exportResolutions = ["1280x720", "1920x1080", "3840x2160", "current"] as const;
const exportQualities = ["draft", "standard", "high"] as const;
const exportFrameRates = [24, 25, 30, 60] as const;

export function createDefaultVideoExportSettings(
  document: VideoProjectDocument | null | undefined,
  projectName: string,
): VideoExportSettings {
  const preset = isOneOf(document?.settings.exportPreset, exportPresets)
    ? document.settings.exportPreset
    : "h264-1080p";
  const dimensions = dimensionsForPreset(preset, document);
  const frameRate = exportFrameRates.includes(document?.settings.frameRate as never)
    ? document?.settings.frameRate ?? 30
    : 30;

  return {
    preset,
    format: preset === "prores-master" ? "mov" : "mp4",
    resolution: resolutionForDimensions(dimensions.width, dimensions.height, document),
    width: dimensions.width,
    height: dimensions.height,
    frameRate,
    quality: preset === "h264-720p" ? "draft" : "standard",
    destinationLabel: `${sanitizeLabel(projectName || document?.name || "Untitled video")} ${preset}`,
  };
}

export function resolveVideoExportDimensions(
  document: VideoProjectDocument | null | undefined,
  resolution: VideoExportResolution,
): { width: number; height: number } {
  if (resolution === "1280x720") return { width: 1280, height: 720 };
  if (resolution === "1920x1080") return { width: 1920, height: 1080 };
  if (resolution === "3840x2160") return { width: 3840, height: 2160 };
  return {
    width: positiveIntegerOrFallback(document?.settings.width, 1920),
    height: positiveIntegerOrFallback(document?.settings.height, 1080),
  };
}

export function validateVideoExport(
  document: VideoProjectDocument | null | undefined,
  media: MediaDto[],
  settings: VideoExportSettings,
  projectMedia?: ProjectMediaDto[],
): VideoExportValidationResult {
  const errors: VideoExportValidationIssue[] = [];
  const warnings: VideoExportValidationIssue[] = [];
  const validation = validateVideoProjectDocument(document);

  if (!validation.ok) {
    collectMissingDocumentMediaIssues(document, errors);
    errors.push({
      severity: "error",
      code: "invalid-document",
      message: validation.errors.length > 0
        ? `Video document is not exportable: ${validation.errors.join(" ")}`
        : "Video document is missing.",
    });
    return { ok: false, errors, warnings };
  }

  validateSettings(settings, errors);

  const mediaById = new Map(media.map((item) => [item.id, item]));
  const projectMediaById = new Map((projectMedia ?? []).map((item) => [item.mediaId, item]));
  const enforceProjectMediaAssociation = projectMedia !== undefined;

  for (const track of validation.document.tracks) {
    if (track.hidden) continue;
    if (track.kind === "audio" && track.muted) continue;

    for (const item of track.items) {
      if (item.duration <= 0) continue;
      if (!isMediaBackedItem(item)) continue;
      if (item.type === "audio" && item.muted) continue;

      validateReferencedMedia(
        item,
        track,
        validation.document.media[item.mediaId],
        mediaById.get(item.mediaId),
        projectMediaById.get(item.mediaId),
        enforceProjectMediaAssociation,
        errors,
      );
    }
  }

  const manifestResult = buildVideoRenderManifestFromValidDocument(
    validation.document,
    media,
    settings,
    projectMedia,
  );
  errors.push(...manifestResult.errors);
  warnings.push(...manifestResult.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    ...(errors.length === 0 && manifestResult.ok ? { manifest: manifestResult.manifest } : {}),
  };
}

export function buildVideoRenderManifest(input: {
  document: VideoProjectDocument | null | undefined;
  media: MediaDto[];
  settings: VideoExportSettings;
  projectMedia?: ProjectMediaDto[];
}): VideoRenderManifestBuildResult {
  const errors: VideoExportValidationIssue[] = [];
  const validation = validateVideoProjectDocument(input.document);

  if (!validation.ok) {
    collectMissingDocumentMediaIssues(input.document, errors);
    errors.push({
      severity: "error",
      code: "invalid-document",
      message: validation.errors.length > 0
        ? `Video document is not exportable: ${validation.errors.join(" ")}`
        : "Video document is missing.",
    });
    return { ok: false, errors, warnings: [] };
  }

  validateSettings(input.settings, errors);
  const result = buildVideoRenderManifestFromValidDocument(
    validation.document,
    input.media,
    input.settings,
    input.projectMedia,
  );
  errors.push(...result.errors);

  if (errors.length > 0 || !result.ok) {
    return { ok: false, errors, warnings: result.warnings };
  }

  return {
    ok: true,
    manifest: result.manifest,
    errors: [],
    warnings: result.warnings,
  };
}

function buildVideoRenderManifestFromValidDocument(
  document: VideoProjectDocument,
  media: MediaDto[],
  settings: VideoExportSettings,
  projectMedia?: ProjectMediaDto[],
): VideoRenderManifestBuildResult {
  const errors: VideoExportValidationIssue[] = [];
  const warnings: VideoExportValidationIssue[] = [];
  const loadedMediaById = new Map(media.map((item) => [item.id, item]));
  const projectMediaById = new Map((projectMedia ?? []).map((item) => [item.mediaId, item]));
  const mediaSourcesById = new Map<string, VideoRenderMediaSource>();
  const visualItems: VideoRenderVisualItem[] = [];
  const audioItems: VideoRenderAudioItem[] = [];
  const textOverlays: VideoRenderTextOverlay[] = [];
  let hasVisibleVisualMediaBackedItem = false;
  const stackOrderByItemId = videoStackOrderMap(document);

  for (const transition of document.transitions) {
    errors.push({
      severity: "error",
      code: "unsupported-transition",
      message: `Transition ${transition.id} is not supported by the V-013 renderer manifest.`,
    });
  }

  for (const effect of document.effects) {
    if (!effect.enabled) continue;
    errors.push({
      severity: "error",
      code: "unsupported-effect",
      message: `Effect ${effect.id} is not supported by the V-013 renderer manifest.`,
    });
  }

  document.tracks.forEach((track, trackIndex) => {
    if (track.items.length > 0 && track.hidden) {
      warnings.push({
        severity: "warning",
        code: "hidden-track-excluded",
        trackId: track.id,
        message: `${track.label} is hidden and will be excluded from export.`,
      });
    }

    if (track.hidden) return;

    if (track.kind === "audio" && track.items.length > 0 && track.muted) {
      warnings.push({
        severity: "warning",
        code: "muted-audio-track-excluded",
        trackId: track.id,
        message: `${track.label} is muted and will be excluded from export.`,
      });
      return;
    }

    for (const item of track.items) {
      if (item.duration <= 0) continue;

      const advancedError = unsupportedAdvancedState(item);
      if (advancedError) {
        errors.push({
          severity: "error",
          code: "unsupported-advanced-edit",
          itemId: item.id,
          trackId: track.id,
          message: advancedError,
        });
        continue;
      }

      if (item.type === "text") {
        textOverlays.push({
          itemId: item.id,
          trackId: track.id,
          text: item.text,
          timelineStart: roundTime(item.timelineStart),
          duration: roundTime(item.duration),
          style: { ...item.style },
          transform: renderTransform(item.transform),
          opacity: 1,
          layerOrder: item.layerOrder,
          stackOrder: stackOrderByItemId.get(item.id) ?? 0,
          ...animationForItem(item),
        });
        validateAnimatedTextFrames(item, settings.frameRate, track.id, errors);
        continue;
      }

      if (!isMediaBackedItem(item)) continue;

      const documentMedia = document.media[item.mediaId];
      const loadedMedia = loadedMediaById.get(item.mediaId);
      const source = canonicalRenderSourceForMedia(
        item.mediaId,
        loadedMedia,
        projectMediaById.get(item.mediaId),
      );

      if (isVisualMediaBackedItem(item)) {
        hasVisibleVisualMediaBackedItem = true;
      }

      if (!documentMedia || !source) {
        errors.push({
          severity: "error",
          code: "missing-canonical-source",
          itemId: item.id,
          trackId: track.id,
          mediaId: item.mediaId,
          message: `${documentMedia?.name ?? item.mediaId} is missing a canonical render source.`,
        });
        continue;
      }

      if (isVisualMediaBackedItem(item) && (!documentMedia.width || !documentMedia.height)) {
        errors.push({
          severity: "error",
          code: "missing-source-dimensions",
          itemId: item.id,
          trackId: track.id,
          mediaId: item.mediaId,
          message: `${documentMedia.name} is missing source dimensions required for export.`,
        });
        continue;
      }

      mediaSourcesById.set(item.mediaId, renderMediaSource(documentMedia, source));

      if (item.type === "audio") {
        if (item.muted) {
          warnings.push({
            severity: "warning",
            code: "muted-audio-item-excluded",
            itemId: item.id,
            trackId: track.id,
            mediaId: item.mediaId,
            message: `${documentMedia.name} is muted and will be excluded from export audio.`,
          });
          continue;
        }

        audioItems.push({
          itemId: item.id,
          trackId: track.id,
          mediaId: item.mediaId,
          timelineStart: roundTime(item.timelineStart),
          duration: roundTime(item.duration),
          sourceIn: roundTime(item.sourceIn),
          sourceOut: roundTime(item.sourceOut),
          speed: 1,
          volume: roundTime(item.volume),
          muted: false,
          fades: {
            fadeInDuration: roundTime(item.fades.fadeInDuration),
            fadeOutDuration: roundTime(item.fades.fadeOutDuration),
          },
          layerOrder: trackIndex,
        });
        continue;
      }

      visualItems.push({
        itemId: item.id,
        trackId: track.id,
        type: item.type,
        mediaId: item.mediaId,
        ...(item.type === "video" && item.shotId ? { shotId: item.shotId } : {}),
        timelineStart: roundTime(item.timelineStart),
        duration: roundTime(item.duration),
        ...(item.type === "video"
          ? {
              sourceIn: roundTime(item.sourceIn),
              sourceOut: roundTime(item.sourceOut),
              speed: roundTime(item.speed),
            }
          : {}),
        crop: renderCrop(item.crop),
        layerOrder: "layerOrder" in item ? item.layerOrder : trackIndex,
        stackOrder: stackOrderByItemId.get(item.id) ?? 0,
        transform: renderTransform(item.transform),
        opacity: roundTime(item.opacity),
        ...animationForItem(item),
      });

      validateAnimatedFrames(item, documentMedia, settings.frameRate, track.id, errors);
    }
  });

  if (!hasVisibleVisualMediaBackedItem) {
    errors.push({
      severity: "error",
      code: "no-visible-visual-media",
      message: "Add at least one visible video, image, or overlay item before exporting.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const sortedVisualItems = [...visualItems].sort(compareStackItems);
  const sortedAudioItems = [...audioItems].sort(compareRenderItems);
  const sortedTextOverlays = [...textOverlays].sort(compareStackItems);
  const durationSeconds = roundTime(Math.max(
    0,
    ...sortedVisualItems.map(itemEnd),
    ...sortedAudioItems.map(itemEnd),
    ...sortedTextOverlays.map(itemEnd),
  ));

  return {
    ok: true,
    errors: [],
    warnings,
    manifest: {
      schemaVersion: 2,
      projectId: document.projectId,
      settings: { ...settings },
      durationSeconds,
      mediaSources: [...mediaSourcesById.values()].sort((a, b) => a.mediaId.localeCompare(b.mediaId)),
      visualItems: sortedVisualItems,
      audioItems: sortedAudioItems,
      textOverlays: sortedTextOverlays,
    },
  };
}

export async function requestVideoRenderJob(input: RequestVideoRenderJobInput): Promise<VideoRenderJob> {
  let response: Response;
  const correlationId = createEditorCorrelationId("render");
  logVideoEditorEvent("editor.render.request.start", {
    timelineId: input.timelineId,
    revisionNumber: input.revisionNumber,
    correlationId,
  });
  try {
    response = await fetch(`/bff/timelines/${encodeURIComponent(input.timelineId)}/render`, {
      method: "POST",
      headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
      body: JSON.stringify({
        timelineId: input.timelineId,
        revisionNumber: input.revisionNumber,
        settings: input.settings,
      }),
    });
    await flushVideoEditorPerformanceMetrics();
  } catch (error) {
    logVideoEditorEvent("editor.render.request.backend-unavailable", {
      timelineId: input.timelineId,
      revisionNumber: input.revisionNumber,
      correlationId,
      reason: error instanceof Error ? error.message : "Render backend could not be reached.",
    }, "error");
    throw new VideoRenderRequestError(
      error instanceof Error ? error.message : "Render backend could not be reached.",
      { status: null },
    );
  }

  if (!response.ok) {
    const eventName = [404, 501, 502, 504].includes(response.status)
      ? "editor.render.request.backend-unavailable"
      : "editor.render.request.failure";
    logVideoEditorEvent(eventName, {
      timelineId: input.timelineId,
      revisionNumber: input.revisionNumber,
      correlationId,
      status: response.status,
    }, "error");
    throw new VideoRenderRequestError(await readRenderJobError(response), {
      status: response.status,
      response,
    });
  }

  const job = normalizeVideoRenderJob(await response.json());
  logVideoEditorEvent("editor.render.request.success", {
    timelineId: input.timelineId,
    revisionNumber: input.revisionNumber,
    renderJobId: job.id,
    renderJobStatus: job.status,
    correlationId,
  });
  return job;
}

export async function getVideoRenderJob(jobId: string): Promise<VideoRenderJob> {
  const response = await fetch(`/bff/timelines/render-jobs/${encodeURIComponent(jobId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new VideoRenderRequestError(await readRenderJobError(response), {
      status: response.status,
      response,
    });
  }
  return normalizeVideoRenderJob(await response.json());
}

export function normalizeVideoRenderJob(payload: unknown): VideoRenderJob {
  const body = isRecord(payload) ? payload : {};
  const nestedJob = isRecord(body.job) ? body.job : {};
  const source = Object.keys(nestedJob).length > 0 ? nestedJob : body;
  const rawStatus = String(source.status ?? source.state ?? "queued").toLowerCase();
  const status = normalizeRenderStatus(rawStatus);
  const id = String(source.id ?? source.jobId ?? "");
  const outputAvailable = source.outputAvailable === true;

  return {
    id,
    timelineId: String(source.timelineId ?? body.timelineId ?? ""),
    revisionNumber: numberOrNull(source.revisionNumber ?? body.revisionNumber),
    status,
    outputAvailable,
    outputUrl: status === "completed" && outputAvailable && id
      ? `/bff/timelines/render-jobs/${encodeURIComponent(id)}/output`
      : null,
    outputContentType: stringOrNull(source.outputContentType),
    outputSizeBytes: numberOrNull(source.outputSizeBytes),
    errorCode: stringOrNull(source.errorCode),
    errorMessage: stringOrNull(source.errorMessage),
    startedAt: stringOrNull(source.startedAt),
    finishedAt: stringOrNull(source.finishedAt),
    createdAt: stringOrNull(source.createdAt),
    updatedAt: stringOrNull(source.updatedAt ?? source.occurredAt),
    message: typeof source.message === "string"
      ? source.message
      : typeof source.errorMessage === "string"
        ? source.errorMessage
        : null,
  };
}

export function isRenderBackendUnavailable(errorOrResponse: unknown): boolean {
  if (errorOrResponse instanceof VideoRenderRequestError) {
    return errorOrResponse.status === null || [404, 501, 502, 504].includes(errorOrResponse.status);
  }

  if (typeof Response !== "undefined" && errorOrResponse instanceof Response) {
    return [404, 501, 502, 504].includes(errorOrResponse.status);
  }

  if (errorOrResponse instanceof TypeError) return true;
  if (errorOrResponse instanceof Error && /network|failed to fetch|timeout|timed out/i.test(errorOrResponse.message)) {
    return true;
  }

  if (isRecord(errorOrResponse) && typeof errorOrResponse.status === "number") {
    return [404, 501, 502, 504].includes(errorOrResponse.status);
  }

  return false;
}

function validateSettings(settings: VideoExportSettings, errors: VideoExportValidationIssue[]): void {
  if (!isOneOf(settings.preset, exportPresets)) {
    errors.push({ severity: "error", code: "invalid-preset", message: "Choose a supported export preset." });
  }

  if (!isOneOf(settings.format, exportFormats)) {
    errors.push({ severity: "error", code: "invalid-format", message: "Choose MP4 or MOV." });
  }

  if (!isOneOf(settings.resolution, exportResolutions)) {
    errors.push({ severity: "error", code: "invalid-resolution", message: "Choose a supported export resolution." });
  }

  if (!Number.isInteger(settings.width) || settings.width <= 0 || !Number.isInteger(settings.height) || settings.height <= 0) {
    errors.push({ severity: "error", code: "invalid-dimensions", message: "Export dimensions must be positive whole pixels." });
  }

  if (!exportFrameRates.includes(settings.frameRate as never)) {
    errors.push({ severity: "error", code: "invalid-frame-rate", message: "Choose 24, 25, 30, or 60 fps." });
  }

  if (!isOneOf(settings.quality, exportQualities)) {
    errors.push({ severity: "error", code: "invalid-quality", message: "Choose draft, standard, or high quality." });
  }
}

function validateReferencedMedia(
  item: Extract<VideoTimelineItem, { mediaId: string }>,
  track: VideoTrack,
  documentMedia: VideoMediaReference | undefined,
  loadedMedia: MediaDto | undefined,
  projectMedia: ProjectMediaDto | undefined,
  enforceProjectMediaAssociation: boolean,
  errors: VideoExportValidationIssue[],
): void {
  if (!documentMedia) {
    errors.push({
      severity: "error",
      code: "missing-document-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `Timeline item ${item.id} references media ${item.mediaId}, but it is missing from the video document.`,
    });
    return;
  }

  if (enforceProjectMediaAssociation && !projectMedia) {
    errors.push({
      severity: "error",
      code: "unassociated-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is not associated with this project.`,
    });
    return;
  }

  if (projectMedia?.availability === "deleted") {
    errors.push({
      severity: "error",
      code: "deleted-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} was deleted and cannot be exported.`,
    });
    return;
  }

  if (projectMedia?.availability === "inaccessible") {
    errors.push({
      severity: "error",
      code: "inaccessible-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is no longer accessible and cannot be exported.`,
    });
    return;
  }

  if (projectMedia?.availability === "missing") {
    errors.push({
      severity: "error",
      code: "missing-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is missing from project media and cannot be exported.`,
    });
    return;
  }

  if (projectMedia?.availability === "processing") {
    errors.push({
      severity: "error",
      code: "media-processing",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is still processing and cannot be exported yet.`,
    });
    return;
  }

  if (projectMedia?.availability === "failed") {
    errors.push({
      severity: "error",
      code: "media-failed",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} failed processing and cannot be exported.`,
    });
    return;
  }

  if (!loadedMedia) {
    errors.push({
      severity: "error",
      code: "missing-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is not present in the loaded project media.`,
    });
    return;
  }

  const readiness = mediaReadiness(loadedMedia);
  if (readiness === "processing") {
    errors.push({
      severity: "error",
      code: "media-processing",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is still processing and cannot be exported yet.`,
    });
  }

  if (readiness === "failed") {
    errors.push({
      severity: "error",
      code: "media-failed",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} failed processing and cannot be exported.`,
    });
  }

}

function isMediaBackedItem(item: VideoTimelineItem): item is Extract<VideoTimelineItem, { mediaId: string }> {
  return "mediaId" in item;
}

function isVisualMediaBackedItem(
  item: VideoTimelineItem,
): item is Extract<VideoTimelineItem, { type: "video" | "image" | "overlay" }> {
  return item.type === "video" || item.type === "image" || item.type === "overlay";
}

function canonicalRenderSourceForMedia(
  mediaId: string,
  loadedMedia: MediaDto | undefined,
  projectMedia: ProjectMediaDto | undefined,
): VideoRenderCanonicalSource | null {
  const storageKey = nonEmptyString(loadedMedia?.canonicalStorageKey) ?? nonEmptyString(projectMedia?.canonicalStorageKey);
  if (!storageKey) return null;

  return {
    variant: "canonical",
    storageKey,
    url: mediaObjectUrl(mediaId, "canonical", storageKey),
  };
}

function renderMediaSource(
  media: VideoMediaReference,
  canonical: VideoRenderCanonicalSource,
): VideoRenderMediaSource {
  return omitUndefined({
    mediaId: media.id,
    kind: media.kind,
    name: media.name,
    durationSeconds: media.duration === undefined ? undefined : roundTime(media.duration),
    width: media.width,
    height: media.height,
    mimeType: media.mimeType,
    canonical,
  });
}

function renderTransform(transform: VideoTransform): VideoRenderTransform {
  return {
    x: roundTime(transform.x),
    y: roundTime(transform.y),
    scaleX: roundTime(transform.scaleX),
    scaleY: roundTime(transform.scaleY),
    rotation: roundTime(transform.rotation),
  };
}

function renderCrop(crop: VideoCrop): VideoRenderCrop {
  return {
    top: roundTime(crop.top),
    right: roundTime(crop.right),
    bottom: roundTime(crop.bottom),
    left: roundTime(crop.left),
  };
}

function animationForItem(item: Exclude<VideoTimelineItem, { type: "audio" }>): { animation?: VideoRenderAnimation } {
  const transform = normalizeAnimationProperties(item.advanced?.transform, ["x", "y", "scaleX", "scaleY", "rotation"]);
  const crop = item.type === "text"
    ? undefined
    : normalizeAnimationProperties(item.advanced?.crop, ["top", "right", "bottom", "left"]);
  const opacity = normalizeAnimationTrack(item.advanced?.opacity);
  const animation = omitUndefined({ transform, crop, opacity });
  return Object.keys(animation).length > 0 ? { animation } : {};
}

function normalizeAnimationProperties<K extends string>(
  properties: Partial<Record<K, VideoAnimatableValue<number>>> | undefined,
  keys: readonly K[],
): Partial<Record<K, VideoRenderAnimationTrack>> | undefined {
  if (!properties) return undefined;
  const entries = keys.flatMap((key) => {
    const track = normalizeAnimationTrack(properties[key]);
    return track ? [[key, track] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) as Partial<Record<K, VideoRenderAnimationTrack>> : undefined;
}

function normalizeAnimationTrack(value: VideoAnimatableValue<number> | undefined): VideoRenderAnimationTrack | undefined {
  if (!value?.keyframes?.length) return undefined;
  return {
    keyframes: [...value.keyframes]
      .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id))
      .map((keyframe) => omitUndefined({
        time: roundTime(keyframe.time),
        value: roundTime(keyframe.value),
        easing: keyframe.easing ? [...keyframe.easing] as [number, number, number, number] : undefined,
      })),
  };
}

function unsupportedAdvancedState(item: VideoTimelineItem): string | null {
  const advanced = item.advanced;
  if (!advanced || Object.keys(advanced).length === 0) return null;
  if (advanced.trackingTargets?.length) return `Tracking metadata on ${item.id} is not supported by export.`;
  if (advanced.autoReframe) return `Auto-reframe metadata on ${item.id} is not supported by export.`;
  if (advanced.color) return `Color processing on ${item.id} is not supported by export.`;
  if (advanced.freezeFrames?.length) return `Freeze frames on ${item.id} are not supported by export.`;
  if (advanced.timeRemap) return `Time remapping on ${item.id} is not supported by export.`;
  if (advanced.transform?.anchorX || advanced.transform?.anchorY) return `Anchor animation on ${item.id} is not supported by export.`;
  if (item.type === "text" && advanced.crop) return `Crop animation on text item ${item.id} is not supported by export.`;

  const supportedTracks = [
    ...Object.values(advanced.transform ?? {}),
    ...(item.type === "text" ? [] : Object.values(advanced.crop ?? {})),
    advanced.opacity,
  ].filter((value): value is VideoAnimatableValue<number> => Boolean(value));
  if (supportedTracks.length === 0 || supportedTracks.some((track) => !track.keyframes?.length)) {
    return `Advanced state on ${item.id} must contain supported transform, crop, or opacity keyframes.`;
  }
  return null;
}

function validateAnimatedFrames(
  item: Exclude<VideoTimelineItem, { type: "audio" | "text" }>,
  media: VideoMediaReference,
  frameRate: number,
  trackId: string,
  errors: VideoExportValidationIssue[],
): void {
  if (!item.advanced || !media.width || !media.height) return;
  const frameCount = Math.max(1, Math.ceil(item.duration * frameRate));
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
    const timelineTime = item.timelineStart + Math.min(item.duration, frameIndex / frameRate);
    const state = evaluateVisualState(item, timelineTime);
    if (!state?.crop) continue;
    const { scaleX, scaleY } = state.transform;
    const { top, right, bottom, left } = state.crop;
    const invalidScale = scaleX <= 0 || scaleY <= 0;
    const invalidOpacity = state.opacity < 0 || state.opacity > 1;
    const invalidCrop = [top, right, bottom, left].some((value) => value < 0 || value > 1)
      || (1 - left - right) * media.width < 1
      || (1 - top - bottom) * media.height < 1;
    if (!invalidScale && !invalidOpacity && !invalidCrop) continue;
    errors.push({
      severity: "error",
      code: "invalid-animated-state",
      itemId: item.id,
      trackId,
      mediaId: item.mediaId,
      message: `Animated state on ${item.id} is invalid at output frame ${frameIndex}.`,
    });
    return;
  }
}

function validateAnimatedTextFrames(
  item: Extract<VideoTimelineItem, { type: "text" }>,
  frameRate: number,
  trackId: string,
  errors: VideoExportValidationIssue[],
): void {
  if (!item.advanced) return;
  const frameCount = Math.max(1, Math.ceil(item.duration * frameRate));
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
    const state = evaluateVisualState(item, item.timelineStart + Math.min(item.duration, frameIndex / frameRate));
    if (state && state.transform.scaleX > 0 && state.transform.scaleY > 0 && state.opacity >= 0 && state.opacity <= 1) continue;
    errors.push({
      severity: "error",
      code: "invalid-animated-state",
      itemId: item.id,
      trackId,
      message: `Animated state on ${item.id} is invalid at output frame ${frameIndex}.`,
    });
    return;
  }
}

function compareRenderItems(
  a: { timelineStart: number; layerOrder: number; itemId: string },
  b: { timelineStart: number; layerOrder: number; itemId: string },
): number {
  return a.timelineStart - b.timelineStart || a.layerOrder - b.layerOrder || a.itemId.localeCompare(b.itemId);
}

function compareStackItems(
  a: { stackOrder: number; itemId: string },
  b: { stackOrder: number; itemId: string },
): number {
  return a.stackOrder - b.stackOrder || a.itemId.localeCompare(b.itemId);
}

function itemEnd(item: { timelineStart: number; duration: number }): number {
  return roundTime(item.timelineStart + item.duration);
}

function mediaObjectUrl(mediaId: string, variant: "canonical", cacheKey: string): string {
  return `/bff/media/${encodeURIComponent(mediaId)}/object/${variant}?v=${encodeURIComponent(cacheKey)}`;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function collectMissingDocumentMediaIssues(
  document: unknown,
  errors: VideoExportValidationIssue[],
): void {
  if (!isRecord(document) || !isRecord(document.media) || !Array.isArray(document.tracks)) return;
  const mediaIds = new Set(Object.keys(document.media));

  for (const track of document.tracks) {
    if (!isRecord(track) || !Array.isArray(track.items)) continue;
    const trackId = typeof track.id === "string" ? track.id : undefined;
    for (const item of track.items) {
      if (!isRecord(item) || typeof item.mediaId !== "string" || mediaIds.has(item.mediaId)) continue;
      errors.push({
        severity: "error",
        code: "missing-document-media",
        itemId: typeof item.id === "string" ? item.id : undefined,
        trackId,
        mediaId: item.mediaId,
        message: `Timeline item ${typeof item.id === "string" ? item.id : "unknown"} references media ${item.mediaId}, but it is missing from the video document.`,
      });
    }
  }
}

function dimensionsForPreset(
  preset: VideoExportPreset,
  document: VideoProjectDocument | null | undefined,
): { width: number; height: number } {
  if (preset === "h264-720p") return { width: 1280, height: 720 };
  if (preset === "h264-4k") return { width: 3840, height: 2160 };
  if (preset === "prores-master") return resolveVideoExportDimensions(document, "current");
  return { width: 1920, height: 1080 };
}

function resolutionForDimensions(
  width: number,
  height: number,
  document: VideoProjectDocument | null | undefined,
): VideoExportResolution {
  if (width === 1280 && height === 720) return "1280x720";
  if (width === 1920 && height === 1080) return "1920x1080";
  if (width === 3840 && height === 2160) return "3840x2160";
  if (width === document?.settings.width && height === document.settings.height) return "current";
  return "current";
}

function normalizeRenderStatus(
  status: string,
): Exclude<VideoRenderJobStatus, "idle" | "validating" | "syncing" | "backend-unavailable"> {
  if (["rendering", "running", "processing", "in-progress", "in_progress"].includes(status)) return "rendering";
  if (["completed", "complete", "succeeded", "success", "done"].includes(status)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return "failed";
  return "queued";
}

async function readRenderJobError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return String(body?.detail || body?.error || body?.message || `Render request failed with ${response.status}.`);
  } catch {
    return `Render request failed with ${response.status}.`;
  }
}

function positiveIntegerOrFallback(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sanitizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ") || "Untitled video";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}
