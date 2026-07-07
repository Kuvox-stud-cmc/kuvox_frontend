import {
  createEditorCorrelationId,
  logVideoEditorEvent,
  withEditorCorrelationHeaders,
} from "./editor-observability.client";

export type VideoRetrievalModality = "visual" | "transcript" | "audio" | "ocr";
export type VideoRetrievalStatus = "idle" | "searching" | "succeeded" | "failed";

export interface VideoRetrievalEvidenceSnippet {
  modality: "transcript" | "ocr";
  text: string;
  score: number;
}

export interface VideoEditorShotSearchResult {
  shotId: string;
  mediaId: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  modalityScores: Record<string, number>;
  previousShotId?: string;
  nextShotId?: string;
  evidence: VideoRetrievalEvidenceSnippet[];
}

export interface VideoEditorRetrievalResponse {
  projectId: string;
  query: string;
  results: VideoEditorShotSearchResult[];
  warnings: string[];
  totalCandidatesConsidered: number;
}

export interface SearchVideoEditorRetrievalInput {
  projectId: string;
  query: string;
  modalities?: VideoRetrievalModality[];
  topK?: number;
  expandGraph?: boolean;
}

export async function searchVideoEditorRetrieval(
  input: SearchVideoEditorRetrievalInput,
): Promise<VideoEditorRetrievalResponse> {
  const correlationId = createEditorCorrelationId("ai-retrieval");
  logVideoEditorEvent("editor.ai.retrieval.start", {
    projectId: input.projectId,
    correlationId,
    modalities: input.modalities ?? ["transcript", "ocr"],
    topK: input.topK ?? 8,
    expandGraph: input.expandGraph ?? true,
  });
  const response = await fetch("/bff/ai/retrieval/video-editor", {
    method: "POST",
    headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
    body: JSON.stringify({
      projectId: input.projectId,
      query: input.query,
      modalities: input.modalities ?? ["transcript", "ocr"],
      topK: input.topK ?? 8,
      expandGraph: input.expandGraph ?? true,
    }),
  });

  if (!response.ok) {
    logVideoEditorEvent("editor.ai.retrieval.failure", {
      projectId: input.projectId,
      correlationId,
      status: response.status,
      modalities: input.modalities ?? ["transcript", "ocr"],
      topK: input.topK ?? 8,
    }, "error");
    throw new Error(await readRetrievalError(response));
  }

  const result = normalizeVideoEditorRetrievalResponse(await response.json());
  logVideoEditorEvent("editor.ai.retrieval.success", {
    projectId: input.projectId,
    correlationId,
    resultCount: result.results.length,
    warningCount: result.warnings.length,
    totalCandidatesConsidered: result.totalCandidatesConsidered,
    modalities: input.modalities ?? ["transcript", "ocr"],
    topK: input.topK ?? 8,
  });
  return result;
}

export function normalizeVideoEditorRetrievalResponse(value: unknown): VideoEditorRetrievalResponse {
  const body = isRecord(value) && isRecord(value.result) ? value.result : value;
  const result = isRecord(body) ? body : {};
  return {
    projectId: stringOrEmpty(result.projectId),
    query: stringOrEmpty(result.query),
    results: Array.isArray(result.results)
      ? result.results.flatMap((item) => normalizeShotResult(item) ?? [])
      : [],
    warnings: Array.isArray(result.warnings)
      ? result.warnings.flatMap((warning) => typeof warning === "string" ? [warning] : [])
      : [],
    totalCandidatesConsidered: finiteNumber(result.totalCandidatesConsidered) ?? 0,
  };
}

async function readRetrievalError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Semantic retrieval failed.";
}

function normalizeShotResult(value: unknown): VideoEditorShotSearchResult | null {
  if (!isRecord(value)) return null;
  const shotId = stringOrEmpty(value.shotId);
  const mediaId = stringOrEmpty(value.mediaId);
  const startSeconds = finiteNumber(value.startSeconds);
  const endSeconds = finiteNumber(value.endSeconds);
  const score = finiteNumber(value.score);
  if (!shotId || !mediaId || startSeconds === null || endSeconds === null || score === null || endSeconds <= startSeconds) {
    return null;
  }

  return {
    shotId,
    mediaId,
    startSeconds,
    endSeconds,
    score,
    modalityScores: normalizeScores(value.modalityScores),
    previousShotId: stringOrUndefined(value.previousShotId),
    nextShotId: stringOrUndefined(value.nextShotId),
    evidence: Array.isArray(value.evidence)
      ? value.evidence.flatMap((item) => normalizeEvidence(item) ?? [])
      : [],
  };
}

function normalizeEvidence(value: unknown): VideoRetrievalEvidenceSnippet | null {
  if (!isRecord(value)) return null;
  const modality = value.modality === "transcript" || value.modality === "ocr" ? value.modality : null;
  const text = stringOrEmpty(value.text);
  const score = finiteNumber(value.score);
  if (!modality || !text || score === null) return null;
  return { modality, text, score };
}

function normalizeScores(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, score]) => {
      const numeric = finiteNumber(score);
      return numeric === null ? [] : [[key, numeric]];
    }),
  );
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
