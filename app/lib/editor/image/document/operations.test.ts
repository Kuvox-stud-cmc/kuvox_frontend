import { describe, expect, it } from "vitest";

import { createDefaultImageCompositionDocument } from "./default-document";
import {
  applyImageOperation,
  createCenteredTextLayer,
  createImageLayerFromMedia,
  createImageOperation,
  imageLayerOperationAvailability,
} from "./operations";
import type { ImageCompositionDocument, ShapeLayer } from "./types";
import { MediaKind, type MediaDto } from "~/lib/api";

describe("image document operations", () => {
  it("adds, updates, and deletes layers with history entries", () => {
    let document = createDefaultImageCompositionDocument();
    const layer = createCenteredTextLayer(document.canvas, "Launch");

    document = applyImageOperation(
      document,
      createImageOperation({ type: "add-layer", layer, label: "Add text" }),
    );
    expect(document.layers).toHaveLength(1);
    expect(document.selectedLayerId).toBe(layer.id);
    expect(document.operationHistory).toHaveLength(1);

    document = applyImageOperation(
      document,
      createImageOperation({
        type: "update-text-content",
        layerId: layer.id,
        text: "Launch now",
        label: "Edit text",
      }),
    );
    expect(document.layers[0]).toMatchObject({ type: "text", text: "Launch now" });
    expect(document.operationHistory).toHaveLength(2);

    document = applyImageOperation(
      document,
      createImageOperation({ type: "delete-layer", layerId: layer.id, label: "Delete" }),
    );
    expect(document.layers).toHaveLength(0);
    expect(document.selectedLayerId).toBeNull();
    expect(document.operationHistory).toHaveLength(3);
  });

  it("records grouped AI operations as one history entry", () => {
    const base = createDefaultImageCompositionDocument();
    const firstLayer = createCenteredTextLayer(base.canvas, "One");
    const secondLayer = createCenteredTextLayer(base.canvas, "Two");

    const document = applyImageOperation(
      base,
      createImageOperation({
        type: "group-operation",
        prompt: "add both",
        summary: "Added two layers",
        label: "AI: add both",
        source: "ai",
        childOperations: [
          createImageOperation({ type: "add-layer", layer: firstLayer, label: "Add one" }),
          createImageOperation({ type: "add-layer", layer: secondLayer, label: "Add two" }),
        ],
      }),
    );

    expect(document.layers.map((layer) => layer.name)).toEqual(["Text layer", "Text layer"]);
    expect(document.operationHistory).toHaveLength(1);
    expect(document.operationHistory[0]).toMatchObject({
      label: "AI: add both",
      source: "ai",
      operation: { type: "group-operation" },
    });
  });

  it("applies resize and background operations only when values change", () => {
    let document = createDefaultImageCompositionDocument();

    document = applyImageOperation(
      document,
      createImageOperation({
        type: "set-background",
        background: { type: "transparent" },
        label: "Transparent",
      }),
    );
    expect(document.background).toEqual({ type: "transparent" });

    document = applyImageOperation(
      document,
      createImageOperation({
        type: "resize-canvas",
        canvas: { width: 1280, height: 720, unit: "px", presetName: "Wide" },
        label: "Resize",
      }),
    );
    expect(document.canvas).toMatchObject({ width: 1280, height: 720 });
    expect(document.operationHistory).toHaveLength(2);

    const unchanged = applyImageOperation(
      document,
      createImageOperation({
        type: "resize-canvas",
        canvas: { width: 1280, height: 720, unit: "px", presetName: "Wide" },
        label: "Resize again",
      }),
    );
    expect(unchanged.operationHistory).toHaveLength(2);
  });

  it("blocks content, transform, duplicate, and delete operations on locked or hidden layers", () => {
    const base = createDefaultImageCompositionDocument();
    const lockedLayer = { ...createCenteredTextLayer(base.canvas, "Locked"), locked: true };
    const hiddenLayer = { ...createCenteredTextLayer(base.canvas, "Hidden"), visible: false };
    const document: ImageCompositionDocument = {
      ...base,
      layers: [lockedLayer, hiddenLayer],
      selectedLayerId: lockedLayer.id,
    };

    const lockedAvailability = imageLayerOperationAvailability(document, lockedLayer.id);
    expect(lockedAvailability.canTransform).toBe(false);
    expect(lockedAvailability.canDelete).toBe(false);
    expect(lockedAvailability.canDuplicate).toBe(false);

    const hiddenAvailability = imageLayerOperationAvailability(document, hiddenLayer.id);
    expect(hiddenAvailability.canTransform).toBe(false);
    expect(hiddenAvailability.canEditContent).toBe(false);

    const afterLockedTransform = applyImageOperation(
      document,
      createImageOperation({
        type: "update-layer-transform",
        layerId: lockedLayer.id,
        transform: { x: 200 },
        label: "Move locked",
      }),
    );
    expect(afterLockedTransform.operationHistory).toHaveLength(0);
    expect(afterLockedTransform.layers[0].transform.x).toBe(lockedLayer.transform.x);

    const afterHiddenText = applyImageOperation(
      document,
      createImageOperation({
        type: "update-text-content",
        layerId: hiddenLayer.id,
        text: "Changed",
        label: "Edit hidden",
      }),
    );
    expect(afterHiddenText.operationHistory).toHaveLength(0);
    expect(afterHiddenText.layers[1]).toMatchObject({ type: "text", text: "Hidden" });
  });

  it("creates image layers from media using the BFF object route", () => {
    const document = createDefaultImageCompositionDocument();
    const media = {
      id: "media-1",
      kind: MediaKind.Image,
      filename: "cover.png",
      width: 2000,
      height: 1000,
      canonicalStorageKey: "canonical-key",
      storageKey: "raw-key",
      thumbnailStorageKey: "thumb-key",
    } as MediaDto;

    const layer = createImageLayerFromMedia(media, document.canvas);
    expect(layer.source).toMatchObject({
      mediaId: "media-1",
      variant: "canonical",
      cacheKey: "canonical-key",
      filename: "cover.png",
    });
    expect(layer.source.url).toBe("/bff/media/media-1/object/canonical?v=canonical-key");
    expect(layer.transform.width).toBeLessThanOrEqual(Math.round(document.canvas.width * 0.8));
  });

  it("allows visible and lock state changes while preserving locked layer content", () => {
    const base = createDefaultImageCompositionDocument();
    const shape: ShapeLayer = {
      id: "shape-1",
      type: "shape",
      name: "Badge",
      visible: true,
      locked: true,
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      shape: "rectangle",
      fill: "#111111",
      stroke: null,
      strokeWidth: 0,
    };

    const document = applyImageOperation(
      { ...base, layers: [shape] },
      createImageOperation({
        type: "update-layer-style",
        layerId: shape.id,
        patch: { name: "Renamed", visible: false, fill: "#ffffff", opacity: 0.2 },
        label: "Style locked",
      }),
    );

    expect(document.layers[0]).toMatchObject({
      name: "Renamed",
      visible: false,
      fill: "#111111",
      transform: { opacity: 1 },
    });
  });
});
