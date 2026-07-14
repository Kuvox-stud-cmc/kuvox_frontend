import type { ImageCompositionDocument } from "./types";

export function createDefaultImageCompositionDocument(): ImageCompositionDocument {
  return {
    version: 1,
    canvas: {
      width: 1080,
      height: 1080,
      unit: "px",
      presetName: "Square",
    },
    background: {
      type: "color",
      color: "#ffffff",
    },
    adjustments: {
      exposure: 0,
      contrast: 0,
      saturation: 0,
    },
    layers: [],
    selectedLayerId: null,
    baseRevisionNumber: 0,
    lastSyncedAt: null,
    operationHistory: [],
  };
}
