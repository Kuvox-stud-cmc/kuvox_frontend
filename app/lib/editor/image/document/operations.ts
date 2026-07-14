import { MediaKind, type MediaDto } from "~/lib/api";

import type {
  ImageCompositionDocument,
  ImageCompositionLayer,
  ImageCompositionOperation,
  ImageAdjustmentSettings,
  ImageDocumentSnapshot,
  ImageCanvas,
  ImageDocumentBackground,
  ImageLayer,
  ImageLayerStylePatch,
  ImageLayerTransform,
  ImageOperationSource,
  TextLayer,
} from "./types";

const DEFAULT_TEXT_WIDTH = 520;
const DEFAULT_TEXT_HEIGHT = 120;
const DUPLICATE_OFFSET = 28;

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustmentSettings = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
};

export type ImageCompositionOperationInput =
  ImageCompositionOperation extends infer Operation
    ? Operation extends ImageCompositionOperation
      ? Omit<Operation, "id" | "createdAt" | "source"> & {
          source?: ImageOperationSource;
        }
      : never
    : never;

export function createImageLayerFromMedia(
  media: MediaDto,
  canvas: ImageCompositionDocument["canvas"],
): ImageLayer {
  const sourceWidth = positiveNumber(media.width);
  const sourceHeight = positiveNumber(media.height);
  const fallbackWidth = Math.round(canvas.width * 0.5);
  const fallbackHeight = Math.round(canvas.height * 0.5);
  const naturalWidth = sourceWidth ?? fallbackWidth;
  const naturalHeight = sourceHeight ?? fallbackHeight;
  const fit = Math.min(
    (canvas.width * 0.8) / naturalWidth,
    (canvas.height * 0.8) / naturalHeight,
    1,
  );
  const width = Math.max(80, Math.round(naturalWidth * fit));
  const height = Math.max(80, Math.round(naturalHeight * fit));
  const source = imageSourceForMedia(media);

  return {
    id: createImageDocumentId("layer"),
    type: "image",
    name: media.filename || "Image layer",
    visible: true,
    locked: false,
    transform: centeredTransform(canvas, width, height),
    source: {
      ...source,
      sourceWidth,
      sourceHeight,
      alt: media.filename || "Image layer",
      filename: media.filename || "Image layer",
      url: source.cacheKey
        ? mediaObjectUrl(media.id, source.variant, source.cacheKey)
        : null,
      id: media.id,
    },
  };
}

export function createCenteredTextLayer(
  canvas: ImageCompositionDocument["canvas"],
  text = "Double-click to edit",
): TextLayer {
  return {
    id: createImageDocumentId("layer"),
    type: "text",
    name: "Text layer",
    visible: true,
    locked: false,
    transform: centeredTransform(canvas, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT),
    text,
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: 64,
    fontWeight: 700,
    fill: "#111827",
    align: "center",
  };
}

export function createImageOperation(
  operation: ImageCompositionOperationInput,
): ImageCompositionOperation {
  return {
    ...operation,
    id: createImageDocumentId("op"),
    source: operation.source ?? "manual",
    createdAt: new Date().toISOString(),
  } as ImageCompositionOperation;
}

export function applyImageOperation(
  document: ImageCompositionDocument,
  operation: ImageCompositionOperation,
): ImageCompositionDocument {
  const before = toImageDocumentSnapshot(document);
  const next: ImageCompositionDocument = {
    ...document,
    adjustments: normalizeAdjustments(document.adjustments),
    layers: document.layers.map((layer) => cloneLayer(layer)),
    operationHistory: [...document.operationHistory],
    updatedAt: document.updatedAt ?? null,
    lastSyncedAt: document.lastSyncedAt ?? null,
  };

  const changed = applyOperationWithoutHistory(next, operation);
  if (changed) {
    next.updatedAt = new Date().toISOString();
    next.operationHistory.push({
      id: operation.id,
      label: operation.label,
      source: operation.source,
      createdAt: operation.createdAt,
      operation,
      before,
      after: toImageDocumentSnapshot(next),
    });
  }

  return next;
}

export function restoreImageDocumentSnapshot(
  snapshot: ImageDocumentSnapshot,
  operationHistory: ImageCompositionDocument["operationHistory"],
): ImageCompositionDocument {
  return {
    ...snapshot,
    adjustments: normalizeAdjustments(snapshot.adjustments),
    layers: snapshot.layers.map((layer) => cloneLayer(layer)),
    operationHistory,
    updatedAt: new Date().toISOString(),
  };
}

export function toImageDocumentSnapshot(document: ImageCompositionDocument): ImageDocumentSnapshot {
  const { operationHistory: _, ...snapshot } = document;
  return {
    ...snapshot,
    adjustments: normalizeAdjustments(document.adjustments),
    layers: document.layers.map((layer) => cloneLayer(layer)),
  };
}

export function normalizeAdjustments(
  adjustments: Partial<ImageAdjustmentSettings> | null | undefined,
): ImageAdjustmentSettings {
  return {
    exposure: clamp(finiteNumber(adjustments?.exposure ?? DEFAULT_IMAGE_ADJUSTMENTS.exposure, 0), -100, 100),
    contrast: clamp(finiteNumber(adjustments?.contrast ?? DEFAULT_IMAGE_ADJUSTMENTS.contrast, 0), -100, 100),
    saturation: clamp(finiteNumber(adjustments?.saturation ?? DEFAULT_IMAGE_ADJUSTMENTS.saturation, 0), -100, 100),
  };
}

export function imageAdjustmentFilter(adjustments: ImageAdjustmentSettings): string {
  const normalized = normalizeAdjustments(adjustments);
  const brightness = 1 + normalized.exposure / 200;
  const contrast = 1 + normalized.contrast / 100;
  const saturation = 1 + normalized.saturation / 100;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)})`;
}

export function imageLayerOperationAvailability(
  document: ImageCompositionDocument,
  layerId: string | null,
) {
  const layer = layerId ? document.layers.find((item) => item.id === layerId) ?? null : null;
  const index = layer ? document.layers.findIndex((item) => item.id === layer.id) : -1;
  const editable = Boolean(layer && !layer.locked && layer.visible);

  return {
    layer,
    canTransform: editable,
    canEditContent: editable,
    canDelete: Boolean(layer && !layer.locked),
    canDuplicate: Boolean(layer && !layer.locked),
    canMoveUp: Boolean(layer && !layer.locked && index >= 0 && index < document.layers.length - 1),
    canMoveDown: Boolean(layer && !layer.locked && index > 0),
  };
}

function applyOperationWithoutHistory(
  document: ImageCompositionDocument,
  operation: ImageCompositionOperation,
): boolean {
  if (operation.type === "group-operation") {
    let changed = false;
    for (const childOperation of operation.childOperations) {
      changed = applyOperationWithoutHistory(document, childOperation) || changed;
    }
    return changed;
  }

  if (operation.type === "add-layer") {
    document.layers.push(cloneLayer(operation.layer));
    document.selectedLayerId = operation.layer.id;
    return true;
  }

  if (operation.type === "set-background") {
    if (sameBackground(document.background, operation.background)) return false;
    document.background = { ...operation.background };
    return true;
  }

  if (operation.type === "resize-canvas") {
    if (sameCanvas(document.canvas, operation.canvas)) return false;
    document.canvas = { ...operation.canvas };
    return true;
  }

  if (operation.type === "adjust-image") {
    const adjustments = normalizeAdjustments({
      ...document.adjustments,
      ...operation.adjustments,
    });
    if (sameAdjustments(document.adjustments, adjustments)) return false;
    document.adjustments = adjustments;
    return true;
  }

  const index = document.layers.findIndex((layer) => layer.id === operation.layerId);
  if (index < 0) return false;
  const layer = document.layers[index];

  if (operation.type === "update-layer-transform") {
    if (!isEditableForContent(layer)) return false;
    layer.transform = normalizeTransform({
      ...layer.transform,
      ...operation.transform,
    });
    return true;
  }

  if (operation.type === "update-layer-style") {
    applyStylePatch(layer, operation.patch);
    return true;
  }

  if (operation.type === "update-text-content") {
    if (layer.type !== "text" || !isEditableForContent(layer)) return false;
    layer.text = operation.text;
    return true;
  }

  if (operation.type === "reorder-layer") {
    if (layer.locked) return false;
    const targetIndex = operation.direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= document.layers.length) return false;
    const [moved] = document.layers.splice(index, 1);
    document.layers.splice(targetIndex, 0, moved);
    return true;
  }

  if (operation.type === "duplicate-layer") {
    if (layer.locked) return false;
    const duplicate = cloneLayer(layer);
    duplicate.id = operation.newLayerId;
    duplicate.name = uniqueLayerName(document.layers, `${layer.name} copy`);
    duplicate.transform = {
      ...duplicate.transform,
      x: duplicate.transform.x + DUPLICATE_OFFSET,
      y: duplicate.transform.y + DUPLICATE_OFFSET,
    };
    document.layers.splice(index + 1, 0, duplicate);
    document.selectedLayerId = duplicate.id;
    return true;
  }

  if (operation.type === "delete-layer") {
    if (layer.locked) return false;
    document.layers.splice(index, 1);
    if (document.selectedLayerId === layer.id) {
      document.selectedLayerId = null;
    }
    return true;
  }

  return false;
}

function applyStylePatch(layer: ImageCompositionLayer, patch: ImageLayerStylePatch) {
  if (patch.name !== undefined) {
    layer.name = patch.name.trim() || "Layer";
  }
  if (patch.visible !== undefined) {
    layer.visible = patch.visible;
  }
  if (patch.locked !== undefined) {
    layer.locked = patch.locked;
  }
  if (patch.opacity !== undefined && !layer.locked) {
    layer.transform.opacity = clamp(patch.opacity, 0, 1);
  }
  if (layer.type === "text" && isEditableForContent(layer)) {
    if (patch.fill !== undefined) layer.fill = patch.fill;
    if (patch.fontFamily !== undefined) layer.fontFamily = patch.fontFamily;
    if (patch.fontSize !== undefined) layer.fontSize = clamp(Math.round(patch.fontSize), 8, 300);
    if (patch.fontWeight !== undefined) layer.fontWeight = clamp(Math.round(patch.fontWeight), 100, 900);
    if (patch.align !== undefined) layer.align = patch.align;
  }
  if (layer.type === "shape" && isEditableForContent(layer)) {
    if (patch.fill !== undefined) layer.fill = patch.fill;
  }
}

function imageSourceForMedia(media: MediaDto) {
  const canonicalKey = media.canonicalStorageKey || media.storageKey || null;
  const thumbnailKey = media.thumbnailStorageKey || null;

  if (media.kind === MediaKind.Image && canonicalKey) {
    return { mediaId: media.id, variant: "canonical" as const, cacheKey: canonicalKey };
  }

  if (thumbnailKey) {
    return { mediaId: media.id, variant: "thumbnail" as const, cacheKey: thumbnailKey };
  }

  if (media.storageKey) {
    return { mediaId: media.id, variant: "raw" as const, cacheKey: media.storageKey };
  }

  return { mediaId: media.id, variant: "canonical" as const, cacheKey: null };
}

function centeredTransform(
  canvas: ImageCompositionDocument["canvas"],
  width: number,
  height: number,
): ImageLayerTransform {
  return normalizeTransform({
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  });
}

function normalizeTransform(transform: ImageLayerTransform): ImageLayerTransform {
  return {
    x: finiteNumber(transform.x, 0),
    y: finiteNumber(transform.y, 0),
    width: Math.max(1, finiteNumber(transform.width, 1)),
    height: Math.max(1, finiteNumber(transform.height, 1)),
    rotation: finiteNumber(transform.rotation, 0),
    scaleX: finiteNumber(transform.scaleX, 1),
    scaleY: finiteNumber(transform.scaleY, 1),
    opacity: clamp(finiteNumber(transform.opacity, 1), 0, 1),
  };
}

function isEditableForContent(layer: ImageCompositionLayer) {
  return !layer.locked && layer.visible;
}

function cloneLayer<T extends ImageCompositionLayer>(layer: T): T {
  return {
    ...layer,
    transform: { ...layer.transform },
    ...(layer.type === "image" ? { source: { ...layer.source } } : null),
  } as T;
}

function uniqueLayerName(layers: ImageCompositionLayer[], requested: string) {
  const names = new Set(layers.map((layer) => layer.name));
  if (!names.has(requested)) return requested;

  for (let index = 2; index < 1000; index += 1) {
    const name = `${requested} ${index}`;
    if (!names.has(name)) return name;
  }

  return `${requested} ${Date.now()}`;
}

function mediaObjectUrl(mediaId: string, variant: string, cacheKey?: string | null) {
  const query = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : "";
  return `/bff/media/${encodeURIComponent(mediaId)}/object/${variant}${query}`;
}

function sameBackground(
  current: ImageDocumentBackground,
  next: ImageDocumentBackground,
) {
  if (current.type !== next.type) return false;
  if (current.type === "transparent") return true;
  return next.type === "color" && current.color.toLowerCase() === next.color.toLowerCase();
}

function sameCanvas(current: ImageCanvas, next: ImageCanvas) {
  return (
    current.width === next.width &&
    current.height === next.height &&
    current.unit === next.unit &&
    current.presetName === next.presetName
  );
}

function sameAdjustments(current: ImageAdjustmentSettings, next: ImageAdjustmentSettings) {
  return (
    current.exposure === next.exposure &&
    current.contrast === next.contrast &&
    current.saturation === next.saturation
  );
}

function positiveNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createImageDocumentId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
