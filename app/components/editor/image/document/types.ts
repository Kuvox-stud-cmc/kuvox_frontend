export type ImageDocumentVersion = 1;

export interface ImageCanvas {
  width: number;
  height: number;
  unit: "px";
  presetName: string;
}

export type ImageDocumentBackground =
  | {
      type: "color";
      color: string;
    }
  | {
      type: "transparent";
    };

export interface ImageLayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

interface BaseImageLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  transform: ImageLayerTransform;
}

export interface ImageLayer extends BaseImageLayer {
  type: "image";
  source: {
    mediaId: string;
    variant: "canonical" | "thumbnail" | "raw";
    cacheKey: string | null;
    sourceWidth: number | null;
    sourceHeight: number | null;
    alt: string;
    filename: string;
    url: string | null;
    id?: string;
  };
}

export interface TextLayer extends BaseImageLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: "left" | "center" | "right";
}

export interface ShapeLayer extends BaseImageLayer {
  type: "shape";
  shape: "rectangle" | "ellipse";
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  cornerRadius?: number;
}

export type ImageCompositionLayer = ImageLayer | TextLayer | ShapeLayer;

export type ImageOperationSource = "manual" | "ai" | "system";

export type ImageLayerStylePatch =
  Partial<Pick<ImageCompositionLayer, "name" | "visible" | "locked">> & {
    opacity?: number;
    fill?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    align?: TextLayer["align"];
  };

export type ImageCompositionOperation =
  | {
      id: string;
      type: "add-layer";
      layer: ImageCompositionLayer;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "set-background";
      background: ImageDocumentBackground;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "resize-canvas";
      canvas: ImageCanvas;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "group-operation";
      childOperations: ImageCompositionOperation[];
      prompt: string;
      summary: string;
      warnings?: string[];
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "update-layer-transform";
      layerId: string;
      transform: Partial<ImageLayerTransform>;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "update-layer-style";
      layerId: string;
      patch: ImageLayerStylePatch;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "update-text-content";
      layerId: string;
      text: string;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "reorder-layer";
      layerId: string;
      direction: "up" | "down";
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "duplicate-layer";
      layerId: string;
      newLayerId: string;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    }
  | {
      id: string;
      type: "delete-layer";
      layerId: string;
      label: string;
      source: ImageOperationSource;
      createdAt: string;
    };

export type ImageDocumentSnapshot = Omit<ImageCompositionDocument, "operationHistory">;

export interface ImageHistoryEntry {
  id: string;
  label: string;
  source: ImageOperationSource;
  createdAt: string;
  operation: ImageCompositionOperation;
  before: ImageDocumentSnapshot;
  after: ImageDocumentSnapshot;
}

export interface ImageCompositionDocument {
  projectId?: string | null;
  documentId?: string | null;
  updatedAt?: string | null;
  baseRevisionNumber?: number;
  lastSyncedAt?: string | null;
  version: ImageDocumentVersion;
  canvas: ImageCanvas;
  background: ImageDocumentBackground;
  layers: ImageCompositionLayer[];
  selectedLayerId: string | null;
  operationHistory: ImageHistoryEntry[];
}
