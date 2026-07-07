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
    layers: [],
    selectedLayerId: null,
    baseRevisionNumber: 0,
    lastSyncedAt: null,
    operationHistory: [],
  };
}
