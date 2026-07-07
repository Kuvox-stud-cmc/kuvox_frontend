import type { ImageCompositionDocument } from "./types";

export function isImageCompositionDocument(value: unknown): value is ImageCompositionDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ImageCompositionDocument>;
  return document.version === 1 && Boolean(document.canvas) && Array.isArray(document.layers);
}
