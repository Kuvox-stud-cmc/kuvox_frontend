import { MediaKind, type MediaDto } from "~/lib/api";

export type MediaPipeline = NonNullable<MediaDto["pipeline"]>;

export type MediaPipelineStage = "queued" | "optimizing" | "ingesting" | "ready" | "failed" | string;

export interface ResolvedMediaPipeline {
  stage: MediaPipelineStage;
  label: string;
  detail: string;
  step: number;
  stepCount: number;
  terminal: boolean;
}

export function resolveMediaPipeline(
  media: MediaDto,
  override?: MediaPipeline | null,
): ResolvedMediaPipeline {
  const pipeline = override ?? media.pipeline;
  if (pipeline?.stage) {
    return {
      stage: pipeline.stage,
      label: pipeline.label || fallbackLabel(media),
      detail: pipeline.detail || fallbackDetail(media),
      step: normalizeStep(pipeline.step, 1),
      stepCount: normalizeStep(pipeline.stepCount, 4),
      terminal: Boolean(pipeline.terminal),
    };
  }

  return fallbackPipeline(media);
}

export function isMediaInProgress(media: MediaDto): boolean {
  const pipeline = resolveMediaPipeline(media);
  return !pipeline.terminal && ["queued", "optimizing", "ingesting"].includes(pipeline.stage);
}

export function mediaPipelineTone(stage: string) {
  if (stage === "ready") return "success" as const;
  if (stage === "failed") return "danger" as const;
  if (stage === "ingesting") return "warning" as const;
  if (stage === "optimizing" || stage === "queued") return "primary" as const;
  return "neutral" as const;
}

function fallbackPipeline(media: MediaDto): ResolvedMediaPipeline {
  const status = media.status.trim().toLowerCase();

  if (status === "ready" || status === "complete" || status === "completed") {
    return {
      stage: "ready",
      label: "Ready to edit",
      detail: "Import and processing completed.",
      step: 4,
      stepCount: 4,
      terminal: true,
    };
  }

  if (status === "failed") {
    return {
      stage: "failed",
      label: "Import failed",
      detail: media.errorMessage || "Kuvox could not finish importing this file.",
      step: 4,
      stepCount: 4,
      terminal: true,
    };
  }

  if (status === "processing") {
    return {
      stage: media.kind === MediaKind.Video ? "ingesting" : "optimizing",
      label: media.kind === MediaKind.Video ? "Analyzing video" : "Optimizing media",
      detail:
        media.kind === MediaKind.Video
          ? "Kuvox is indexing shots and AI context."
          : "Kuvox is finalizing optimized media.",
      step: 3,
      stepCount: 4,
      terminal: false,
    };
  }

  if (status === "uploaded" || status === "uploading") {
    return {
      stage: "optimizing",
      label: "Optimizing media",
      detail: "Upload saved. Kuvox is generating optimized media and previews.",
      step: 2,
      stepCount: 4,
      terminal: false,
    };
  }

  return {
    stage: "queued",
    label: fallbackLabel(media),
    detail: fallbackDetail(media),
    step: 1,
    stepCount: 4,
    terminal: false,
  };
}

function fallbackLabel(media: MediaDto): string {
  return media.status || "Queued";
}

function fallbackDetail(media: MediaDto): string {
  return media.errorMessage || "Import status is being updated.";
}

function normalizeStep(value: number | string | undefined, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}
