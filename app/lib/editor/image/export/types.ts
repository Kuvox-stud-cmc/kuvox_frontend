import type { ImageCompositionDocument } from "../document/types";

export type ImageExportFormat = "png";
export type ImageExportSizeMode = "1x" | "2x" | "3x" | "custom";

export interface ImageExportSettings {
  format: ImageExportFormat;
  filename: string;
  sizeMode: ImageExportSizeMode;
  customWidth: number | null;
  transparentBackground: boolean;
}

export interface ImageExportResult {
  format: ImageExportFormat;
  filename: string;
  width: number;
  height: number;
  byteSize: number;
  warnings: string[];
}

export function resolveImageExportDimensions(
  composition: ImageCompositionDocument,
  settings: Pick<ImageExportSettings, "sizeMode" | "customWidth">,
) {
  const canvasWidth = Math.max(1, Math.round(composition.canvas.width));
  const canvasHeight = Math.max(1, Math.round(composition.canvas.height));

  if (settings.sizeMode === "custom") {
    const width = Math.max(1, Math.round(settings.customWidth ?? canvasWidth));
    return {
      width,
      height: Math.max(1, Math.round(width * (canvasHeight / canvasWidth))),
    };
  }

  const multiplier = settings.sizeMode === "3x" ? 3 : settings.sizeMode === "2x" ? 2 : 1;
  return {
    width: canvasWidth * multiplier,
    height: canvasHeight * multiplier,
  };
}

export function imageCompositionCanExport(composition: ImageCompositionDocument) {
  return (
    Number.isFinite(composition.canvas.width) &&
    Number.isFinite(composition.canvas.height) &&
    composition.canvas.width > 0 &&
    composition.canvas.height > 0
  );
}
