import {
  createImageDocumentId,
  createImageOperation,
  type ImageCompositionOperationInput,
} from "./document/operations";
import type {
  ImageCanvas,
  ImageCompositionDocument,
  ImageCompositionLayer,
  ImageCompositionOperation,
  ImageLayerTransform,
  ShapeLayer,
  TextLayer,
} from "./document/types";

export type ImageAiCommandKind =
  | "remove-background"
  | "make-colors-pop"
  | "add-title"
  | "clean-up-empty-space"
  | "youtube-thumbnail"
  | "resize-social-post";

type ImageAiChildOperationInput = Exclude<
  ImageCompositionOperationInput,
  { type: "group-operation" }
>;

export type ImageAiPlan =
  | {
      ok: true;
      kind: ImageAiCommandKind;
      prompt: string;
      label: string;
      summary: string;
      warnings: string[];
      operations: ImageAiChildOperationInput[];
    }
  | {
      ok: false;
      prompt: string;
      error: string;
      warnings: string[];
    };

export type ImageAiSuccessfulPlan = Extract<ImageAiPlan, { ok: true }>;

const YOUTUBE_CANVAS: ImageCanvas = {
  width: 1280,
  height: 720,
  unit: "px",
  presetName: "YouTube thumbnail",
};

const SOCIAL_CANVAS: ImageCanvas = {
  width: 1080,
  height: 1080,
  unit: "px",
  presetName: "Social post",
};

export function planMockImageAiCommand(
  document: ImageCompositionDocument,
  input: string,
): ImageAiPlan {
  const prompt = input.trim();
  if (!prompt) {
    return {
      ok: false,
      prompt,
      error: "Enter an image edit prompt.",
      warnings: [],
    };
  }

  const kind = resolveCommandKind(prompt);
  if (!kind) {
    return {
      ok: false,
      prompt,
      error: "This mock assistant can only apply background, color, title, cleanup, thumbnail, or social resize edits.",
      warnings: [],
    };
  }

  const plan = createPlanForKind(document, prompt, kind);
  if (plan.operations.length === 0) {
    return {
      ok: false,
      prompt,
      error: plan.emptyReason,
      warnings: plan.warnings,
    };
  }

  return {
    ok: true,
    kind,
    prompt,
    label: plan.label,
    summary: plan.summary,
    warnings: plan.warnings,
    operations: plan.operations,
  };
}

export function createImageAiGroupOperation(
  plan: ImageAiSuccessfulPlan,
): ImageCompositionOperation {
  const childOperations = plan.operations.map((operation) =>
    createImageOperation({
      ...operation,
      source: "ai",
    } as ImageCompositionOperationInput),
  );

  return createImageOperation({
    type: "group-operation",
    childOperations,
    prompt: plan.prompt,
    summary: summaryWithWarnings(plan.summary, plan.warnings),
    warnings: plan.warnings,
    label: `AI: ${plan.label}`,
    source: "ai",
  });
}

function createPlanForKind(
  document: ImageCompositionDocument,
  prompt: string,
  kind: ImageAiCommandKind,
): {
  label: string;
  summary: string;
  emptyReason: string;
  warnings: string[];
  operations: ImageAiChildOperationInput[];
} {
  if (kind === "remove-background") {
    const operations: ImageAiChildOperationInput[] =
      document.background.type === "transparent"
        ? []
        : [
            {
              type: "set-background",
              background: { type: "transparent" },
              label: "AI: remove background",
            },
          ];

    return {
      label: "remove background",
      summary: "Set the canvas background to transparent.",
      emptyReason: "The canvas background is already transparent.",
      warnings: [],
      operations,
    };
  }

  if (kind === "make-colors-pop") {
    return createColorsPopPlan(document);
  }

  if (kind === "add-title") {
    return {
      label: "add title",
      summary: "Added a bold centered title layer.",
      emptyReason: "No title layer could be added.",
      warnings: [],
      operations: [
        {
          type: "add-layer",
          layer: createTitleLayer(document.canvas, titleTextForPrompt(prompt)),
          label: "AI: add title",
        },
      ],
    };
  }

  if (kind === "clean-up-empty-space") {
    return createCleanUpPlan(document);
  }

  if (kind === "youtube-thumbnail") {
    return createResizePlan(document, YOUTUBE_CANVAS, "youtube thumbnail");
  }

  return createResizePlan(document, SOCIAL_CANVAS, "social post");
}

function createColorsPopPlan(document: ImageCompositionDocument) {
  const operations: ImageAiChildOperationInput[] = [];
  const warnings = skippedLayerWarnings(
    document.layers.filter((layer) => layer.type === "text" || layer.type === "shape"),
  );

  if (document.background.type === "transparent" || backgroundIsLight(document.background.color)) {
    operations.push({
      type: "set-background",
      background: { type: "color", color: "#111827" },
      label: "AI: set contrast background",
    });
  }

  const accentColors = ["#f97316", "#22d3ee", "#facc15", "#fb7185"];
  let accentIndex = 0;
  for (const layer of document.layers) {
    if (!isEditableLayer(layer)) continue;
    if (layer.type === "text") {
      operations.push({
        type: "update-layer-style",
        layerId: layer.id,
        patch: {
          fill: "#ffffff",
          fontWeight: Math.max(layer.fontWeight, 800),
        },
        label: "AI: brighten text",
      });
    }
    if (layer.type === "shape") {
      operations.push({
        type: "update-layer-style",
        layerId: layer.id,
        patch: { fill: accentColors[accentIndex % accentColors.length] },
        label: "AI: brighten shape",
      });
      accentIndex += 1;
    }
  }

  return {
    label: "make colors pop",
    summary: "Boosted editable text and shape colors for stronger contrast.",
    emptyReason: "There are no editable colors to boost.",
    warnings,
    operations,
  };
}

function createCleanUpPlan(document: ImageCompositionDocument) {
  const selectedLayer = document.selectedLayerId
    ? document.layers.find((layer) => layer.id === document.selectedLayerId) ?? null
    : null;
  const warnings: string[] = [];
  const operations: ImageAiChildOperationInput[] = [];

  if (selectedLayer) {
    if (isEditableLayer(selectedLayer)) {
      operations.push({
        type: "update-layer-transform",
        layerId: selectedLayer.id,
        transform: centerTransform(document.canvas, selectedLayer.transform),
        label: "AI: center selected layer",
      });
      return {
        label: "clean up empty space",
        summary: `Centered ${selectedLayer.name}.`,
        emptyReason: "The selected layer is already centered.",
        warnings,
        operations,
      };
    }
    warnings.push(`Skipped ${selectedLayer.name} because it is locked or hidden.`);
  }

  const editableLayers = document.layers.filter(isEditableLayer);
  warnings.push(...skippedLayerWarnings(document.layers));
  operations.push(...translateLayerGroupToCenter(document.canvas, editableLayers));

  return {
    label: "clean up empty space",
    summary: "Centered the editable visible layer group on the canvas.",
    emptyReason: "There are no editable visible layers to center.",
    warnings: uniqueStrings(warnings),
    operations,
  };
}

function createResizePlan(
  document: ImageCompositionDocument,
  canvas: ImageCanvas,
  label: "youtube thumbnail" | "social post",
) {
  const isYouTube = label === "youtube thumbnail";
  const operations: ImageAiChildOperationInput[] = [];
  if (!sameCanvas(document.canvas, canvas)) {
    operations.push({
      type: "resize-canvas",
      canvas,
      label: isYouTube ? "AI: resize for YouTube" : "AI: resize for social post",
    });
  }
  const warnings = skippedLayerWarnings(document.layers);
  const editableLayers = document.layers.filter(isEditableLayer);
  const fitArea = isYouTube
    ? { x: 72, y: 174, width: 1136, height: 472 }
    : { x: 96, y: 96, width: 888, height: 888 };

  operations.push(...fitLayerGroupToArea(editableLayers, fitArea));

  if (isYouTube) {
    operations.push({
      type: "add-layer",
      layer: createAccentLayer(canvas),
      label: "AI: add thumbnail accent",
    });
    operations.push({
      type: "add-layer",
      layer: createTitleLayer(canvas, "BIG IDEA", {
        y: 36,
        height: 116,
        fill: "#ffffff",
        fontSize: 86,
      }),
      label: "AI: add thumbnail title",
    });
  }

  return {
    label: isYouTube ? "youtube thumbnail" : "resize for social post",
    summary: isYouTube
      ? "Resized to 1280 x 720, fit editable layers, and added thumbnail title accents."
      : "Resized to 1080 x 1080 and fit editable visible layers.",
    emptyReason: "The resize did not change the document.",
    warnings,
    operations,
  };
}

function resolveCommandKind(prompt: string): ImageAiCommandKind | null {
  const normalized = prompt.toLowerCase();
  if (/\byoutube\b|\bthumbnail\b|16:9/.test(normalized)) return "youtube-thumbnail";
  if (/\bsocial\b|\bpost\b|\binstagram\b|\bsquare\b|1080/.test(normalized)) {
    return "resize-social-post";
  }
  if (/\b(remove|erase|clear)\b.*\bbackground\b|\btransparent\b/.test(normalized)) {
    return "remove-background";
  }
  if (/\b(pop|vibrant|bright|brighter|color|colour|contrast)\b/.test(normalized)) {
    return "make-colors-pop";
  }
  if (/\b(title|headline|caption)\b/.test(normalized)) return "add-title";
  if (/\b(clean|center|centre|empty space|align|tidy)\b/.test(normalized)) {
    return "clean-up-empty-space";
  }
  return null;
}

function createTitleLayer(
  canvas: ImageCanvas,
  text: string,
  overrides: Partial<Pick<TextLayer, "fontSize" | "fill">> & {
    y?: number;
    height?: number;
  } = {},
): TextLayer {
  const width = Math.round(canvas.width * 0.82);
  const height = overrides.height ?? Math.max(92, Math.round(canvas.height * 0.16));
  return {
    id: createImageDocumentId("layer"),
    type: "text",
    name: "AI title",
    visible: true,
    locked: false,
    transform: {
      x: Math.round((canvas.width - width) / 2),
      y: overrides.y ?? Math.round(canvas.height * 0.1),
      width,
      height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    },
    text,
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: overrides.fontSize ?? Math.min(96, Math.round(canvas.width / 14)),
    fontWeight: 900,
    fill: overrides.fill ?? "#111827",
    align: "center",
  };
}

function createAccentLayer(canvas: ImageCanvas): ShapeLayer {
  return {
    id: createImageDocumentId("layer"),
    type: "shape",
    name: "AI accent bar",
    visible: true,
    locked: false,
    transform: {
      x: 72,
      y: 656,
      width: canvas.width - 144,
      height: 24,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    },
    shape: "rectangle",
    fill: "#f97316",
    stroke: null,
    strokeWidth: 0,
    cornerRadius: 12,
  };
}

function titleTextForPrompt(prompt: string) {
  const quoted = prompt.match(/["']([^"']{1,60})["']/);
  return quoted?.[1]?.trim() || "YOUR TITLE HERE";
}

function centerTransform(
  canvas: ImageCanvas,
  transform: ImageLayerTransform,
): Partial<ImageLayerTransform> {
  return {
    x: Math.round((canvas.width - transform.width) / 2),
    y: Math.round((canvas.height - transform.height) / 2),
  };
}

function translateLayerGroupToCenter(
  canvas: ImageCanvas,
  layers: ImageCompositionLayer[],
): ImageAiChildOperationInput[] {
  const bounds = layerBounds(layers);
  if (!bounds) return [];

  const dx = Math.round(canvas.width / 2 - (bounds.x + bounds.width / 2));
  const dy = Math.round(canvas.height / 2 - (bounds.y + bounds.height / 2));
  if (dx === 0 && dy === 0) return [];

  return layers.map((layer) => ({
    type: "update-layer-transform",
    layerId: layer.id,
    transform: {
      x: layer.transform.x + dx,
      y: layer.transform.y + dy,
    },
    label: "AI: center layer group",
  }));
}

function fitLayerGroupToArea(
  layers: ImageCompositionLayer[],
  area: { x: number; y: number; width: number; height: number },
): ImageAiChildOperationInput[] {
  const bounds = layerBounds(layers);
  if (!bounds) return [];

  const scale = Math.min(area.width / bounds.width, area.height / bounds.height, 1.25);
  const fittedWidth = bounds.width * scale;
  const fittedHeight = bounds.height * scale;
  const offsetX = area.x + (area.width - fittedWidth) / 2 - bounds.x * scale;
  const offsetY = area.y + (area.height - fittedHeight) / 2 - bounds.y * scale;

  return layers.map((layer) => ({
    type: "update-layer-transform",
    layerId: layer.id,
    transform: {
      x: Math.round(layer.transform.x * scale + offsetX),
      y: Math.round(layer.transform.y * scale + offsetY),
      width: Math.max(1, Math.round(layer.transform.width * scale)),
      height: Math.max(1, Math.round(layer.transform.height * scale)),
      scaleX: 1,
      scaleY: 1,
    },
    label: "AI: fit layer",
  }));
}

function layerBounds(layers: ImageCompositionLayer[]) {
  if (layers.length === 0) return null;
  const left = Math.min(...layers.map((layer) => layer.transform.x));
  const top = Math.min(...layers.map((layer) => layer.transform.y));
  const right = Math.max(
    ...layers.map((layer) => layer.transform.x + layer.transform.width),
  );
  const bottom = Math.max(
    ...layers.map((layer) => layer.transform.y + layer.transform.height),
  );
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function skippedLayerWarnings(layers: ImageCompositionLayer[]) {
  const skipped = layers.filter((layer) => layer.locked || !layer.visible);
  if (skipped.length === 0) return [];
  return [`Skipped ${skipped.length} locked or hidden layer${skipped.length === 1 ? "" : "s"}.`];
}

function isEditableLayer(layer: ImageCompositionLayer) {
  return layer.visible && !layer.locked;
}

function backgroundIsLight(color: string) {
  const match = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return true;
  const red = Number.parseInt(match[1], 16);
  const green = Number.parseInt(match[2], 16);
  const blue = Number.parseInt(match[3], 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150;
}

function summaryWithWarnings(summary: string, warnings: string[]) {
  if (warnings.length === 0) return summary;
  return `${summary} ${warnings.join(" ")}`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function sameCanvas(current: ImageCanvas, next: ImageCanvas) {
  return (
    current.width === next.width &&
    current.height === next.height &&
    current.unit === next.unit &&
    current.presetName === next.presetName
  );
}
