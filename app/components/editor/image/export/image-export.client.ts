import Konva from "konva";

import type { ImageCompositionDocument, ImageCompositionLayer } from "../document/types";
import { sanitizeImageExportFilename, withPngExtension } from "./filename";
import {
  imageCompositionCanExport,
  resolveImageExportDimensions,
  type ImageExportResult,
  type ImageExportSettings,
} from "./types";

export async function exportImageCompositionDocument(
  composition: ImageCompositionDocument,
  settings: ImageExportSettings,
): Promise<ImageExportResult> {
  if (typeof window === "undefined") {
    throw new Error("Image export is only available in the browser.");
  }

  if (!imageCompositionCanExport(composition)) {
    throw new Error("This image does not have a valid canvas size.");
  }

  const canvasWidth = Math.round(composition.canvas.width);
  const canvasHeight = Math.round(composition.canvas.height);
  const dimensions = resolveImageExportDimensions(composition, settings);
  const pixelRatio = dimensions.width / canvasWidth;
  const warnings: string[] = [];
  const container = window.document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = `${canvasWidth}px`;
  container.style.height = `${canvasHeight}px`;
  container.style.pointerEvents = "none";
  window.document.body.appendChild(container);

  const stage = new Konva.Stage({
    container,
    width: canvasWidth,
    height: canvasHeight,
  });

  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);

    if (!settings.transparentBackground) {
      layer.add(
        new Konva.Rect({
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight,
          fill: composition.background.type === "color" ? composition.background.color : "#ffffff",
          listening: false,
        }),
      );
    }

    for (const compositionLayer of composition.layers) {
      if (!compositionLayer.visible) continue;
      const node = await createLayerContentNode(compositionLayer, warnings);
      const transform = compositionLayer.transform;
      const group = new Konva.Group({
        x: transform.x,
        y: transform.y,
        width: transform.width,
        height: transform.height,
        rotation: transform.rotation,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        opacity: transform.opacity,
        listening: false,
      });
      group.add(node);
      layer.add(group);
    }

    stage.draw();
    const canvas = stage.toCanvas({ pixelRatio });
    const blob = await canvasToBlob(canvas);
    const filename = withPngExtension(sanitizeImageExportFilename(settings.filename));
    downloadBlob(blob, filename);

    return {
      format: "png",
      filename,
      width: dimensions.width,
      height: dimensions.height,
      byteSize: blob.size,
      warnings,
    };
  } finally {
    stage.destroy();
    container.remove();
  }
}

async function createLayerContentNode(
  layer: ImageCompositionLayer,
  warnings: string[],
): Promise<Konva.Shape | Konva.Group> {
  if (layer.type === "text") {
    return new Konva.Text({
      text: layer.text,
      width: layer.transform.width,
      height: layer.transform.height,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontStyle: layer.fontWeight >= 700 ? "bold" : "normal",
      fill: layer.fill,
      align: layer.align,
      verticalAlign: "middle",
      listening: false,
    });
  }

  if (layer.type === "shape") {
    if (layer.shape === "ellipse") {
      return new Konva.Ellipse({
        x: layer.transform.width / 2,
        y: layer.transform.height / 2,
        radiusX: layer.transform.width / 2,
        radiusY: layer.transform.height / 2,
        fill: layer.fill,
        stroke: layer.stroke ?? undefined,
        strokeWidth: layer.strokeWidth,
        listening: false,
      });
    }

    return new Konva.Rect({
      width: layer.transform.width,
      height: layer.transform.height,
      fill: layer.fill,
      stroke: layer.stroke ?? undefined,
      strokeWidth: layer.strokeWidth,
      cornerRadius: layer.cornerRadius ?? 0,
      listening: false,
    });
  }

  const url = resolveImageLayerUrl(layer);
  if (!url) {
    warnings.push(`Image layer "${layer.name}" has no source and was exported as a placeholder.`);
    return createImagePlaceholderNode(layer);
  }

  try {
    const image = await loadImage(url);
    return new Konva.Image({
      image,
      width: layer.transform.width,
      height: layer.transform.height,
      listening: false,
    });
  } catch {
    warnings.push(`Image layer "${layer.name}" could not be loaded and was exported as a placeholder.`);
    return createImagePlaceholderNode(layer);
  }
}

function createImagePlaceholderNode(layer: Extract<ImageCompositionLayer, { type: "image" }>) {
  const group = new Konva.Group({ listening: false });
  group.add(
    new Konva.Rect({
      width: layer.transform.width,
      height: layer.transform.height,
      fill: "#dbeafe",
      stroke: "#86b7ff",
      strokeWidth: 2,
      listening: false,
    }),
  );
  group.add(
    new Konva.Text({
      text: layer.source.alt || layer.name,
      width: layer.transform.width,
      height: layer.transform.height,
      align: "center",
      verticalAlign: "middle",
      fill: "#1f2937",
      fontSize: 28,
      fontStyle: "bold",
      listening: false,
    }),
  );
  return group;
}

function resolveImageLayerUrl(layer: Extract<ImageCompositionLayer, { type: "image" }>) {
  if (layer.source.url) return layer.source.url;
  if (!layer.source.mediaId || !layer.source.variant) return null;

  const query = layer.source.cacheKey ? `?v=${encodeURIComponent(layer.source.cacheKey)}` : "";
  return `/bff/media/${encodeURIComponent(layer.source.mediaId)}/object/${layer.source.variant}${query}`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    if (isCrossOriginUrl(url)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = url;
  });
}

function isCrossOriginUrl(url: string) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed."));
      }
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
