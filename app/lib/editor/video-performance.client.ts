import { countTimelineItems } from "./editor-timeline";
import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";
import type { VideoProjectDocument } from "./video-document";

export const videoEditorPerformanceMetricNames = [
  "editor-open",
  "first-usable-editor",
  "timeline-drag-latency",
  "playback-seek-latency",
] as const;

export type VideoEditorPerformanceMetricName = (typeof videoEditorPerformanceMetricNames)[number];

export interface VideoEditorPerformanceMetric {
  name: VideoEditorPerformanceMetricName;
  durationMs: number;
  measuredAt?: string;
  trackCount?: number;
  itemCount?: number;
  renderedItemCount?: number;
  timelineDurationSeconds?: number;
}

export interface VideoEditorPerformanceContext {
  document?: VideoProjectDocument | null;
  renderedItemCount?: number;
}

const maxMetricBatchSize = 50;
const maxDurationMs = 10 * 60 * 1000;
const allowedMetricNames = new Set<string>(videoEditorPerformanceMetricNames);

let pendingMetrics: Array<{ projectId: string; metric: VideoEditorPerformanceMetric }> = [];

export function createVideoEditorPerformanceMetric(
  name: VideoEditorPerformanceMetricName,
  durationMs: number,
  context: VideoEditorPerformanceContext = {},
): VideoEditorPerformanceMetric | null {
  const document = context.document;
  return sanitizeVideoEditorPerformanceMetric({
    name,
    durationMs,
    measuredAt: new Date().toISOString(),
    trackCount: document?.tracks.length,
    itemCount: document ? countTimelineItems(document) : undefined,
    renderedItemCount: context.renderedItemCount,
    timelineDurationSeconds: document ? actualTimelineDuration(document) : undefined,
  });
}

export function sanitizeVideoEditorPerformanceMetric(
  metric: VideoEditorPerformanceMetric,
): VideoEditorPerformanceMetric | null {
  if (!allowedMetricNames.has(metric.name)) return null;
  if (!Number.isFinite(metric.durationMs) || metric.durationMs < 0 || metric.durationMs > maxDurationMs) {
    return null;
  }

  const sanitized: VideoEditorPerformanceMetric = {
    name: metric.name,
    durationMs: roundMetricNumber(metric.durationMs),
    measuredAt: validIsoTimestamp(metric.measuredAt) ?? new Date().toISOString(),
  };
  if (validCount(metric.trackCount)) sanitized.trackCount = metric.trackCount;
  if (validCount(metric.itemCount)) sanitized.itemCount = metric.itemCount;
  if (validCount(metric.renderedItemCount)) sanitized.renderedItemCount = metric.renderedItemCount;
  if (validTimelineDuration(metric.timelineDurationSeconds)) {
    sanitized.timelineDurationSeconds = roundMetricNumber(metric.timelineDurationSeconds);
  }
  return sanitized;
}

export function sanitizeVideoEditorPerformanceBatch(
  metrics: VideoEditorPerformanceMetric[],
): VideoEditorPerformanceMetric[] {
  if (!Array.isArray(metrics) || metrics.length > maxMetricBatchSize) {
    return [];
  }
  return metrics.flatMap((metric) => {
    const sanitized = sanitizeVideoEditorPerformanceMetric(metric);
    return sanitized ? [sanitized] : [];
  });
}

export function queueVideoEditorPerformanceMetric(
  projectId: string,
  metric: VideoEditorPerformanceMetric | null,
): void {
  if (!projectId || !metric) return;
  pendingMetrics.push({ projectId, metric });
  if (pendingMetrics.length > maxMetricBatchSize) pendingMetrics = pendingMetrics.slice(-maxMetricBatchSize);
}

export async function flushVideoEditorPerformanceMetrics(): Promise<void> {
  const batch = pendingMetrics;
  pendingMetrics = [];
  const byProject = new Map<string, VideoEditorPerformanceMetric[]>();
  for (const entry of batch) {
    byProject.set(entry.projectId, [...(byProject.get(entry.projectId) ?? []), entry.metric]);
  }
  await Promise.all(
    Array.from(byProject, ([projectId, metrics]) =>
      recordVideoEditorPerformanceMetrics(projectId, metrics),
    ),
  );
}

export async function recordVideoEditorPerformanceMetrics(
  projectId: string,
  metrics: VideoEditorPerformanceMetric[],
): Promise<void> {
  const sanitized = sanitizeVideoEditorPerformanceBatch(metrics);
  if (!projectId || sanitized.length === 0) return;

  try {
    const correlationId = createEditorCorrelationId("performance");
    logVideoEditorEvent("editor.performance.metrics", {
      projectId,
      correlationId,
      metricCount: sanitized.length,
      metricNames: sanitized.map((metric) => metric.name),
    }, "debug");
    await fetch(`/bff/timelines/projects/${encodeURIComponent(projectId)}/performance`, {
      method: "POST",
      headers: withEditorCorrelationHeaders({ "Content-Type": "application/json" }, correlationId),
      body: JSON.stringify({ metrics: sanitized }),
    });
  } catch {
    // Telemetry must never block editing.
  }
}

function validCount(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

function validTimelineDuration(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 24 * 60 * 60;
}

function validIsoTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? value : null;
}

function roundMetricNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function actualTimelineDuration(document: VideoProjectDocument): number {
  return document.tracks.reduce((duration, track) => {
    const trackDuration = track.items.reduce(
      (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
      0,
    );
    return Math.max(duration, trackDuration);
  }, 0);
}
