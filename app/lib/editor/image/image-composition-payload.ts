import { isImageCompositionDocument } from "./document/guards";
import type { ImageCompositionDocument } from "./document/types";

export interface ServerImageComposition {
  document: ImageCompositionDocument | null;
  revisionNumber: number;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export function normalizeImageCompositionPayload(value: unknown): ServerImageComposition {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    document: isImageCompositionDocument(body.documentJson) ? body.documentJson : null,
    revisionNumber: Number(body.revisionNumber) || 0,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
    updatedByUserId: typeof body.updatedByUserId === "string" ? body.updatedByUserId : null,
  };
}

export async function readImageCompositionError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body?.detail || body?.error || fallback;
  } catch {
    return fallback;
  }
}
