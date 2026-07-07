import type { ImageCompositionDocument, ImageHistoryEntry } from "./types";

export function getUnsyncedImageOperations(
  document: ImageCompositionDocument,
): ImageHistoryEntry[] {
  if (!document.lastSyncedAt) return document.operationHistory;
  const syncedAt = Date.parse(document.lastSyncedAt);
  if (!Number.isFinite(syncedAt)) return document.operationHistory;
  return document.operationHistory.filter((entry) => Date.parse(entry.createdAt) > syncedAt);
}
