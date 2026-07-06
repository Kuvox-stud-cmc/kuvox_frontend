import { describe, expect, it } from "vitest";

import {
  createImageAiGroupOperation,
  planMockImageAiCommand,
} from "./ai-command-planner";
import { createDefaultImageCompositionDocument } from "./document/default-document";
import { applyImageOperation, createCenteredTextLayer } from "./document/operations";
import type { ShapeLayer } from "./document/types";

describe("image AI command planner", () => {
  it("plans deterministic supported commands", () => {
    const base = createDefaultImageCompositionDocument();
    const shape: ShapeLayer = {
      id: "shape-1",
      type: "shape",
      name: "Shape",
      visible: true,
      locked: false,
      transform: { x: 40, y: 40, width: 120, height: 80, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      shape: "rectangle",
      fill: "#dddddd",
      stroke: null,
      strokeWidth: 0,
    };
    const document = { ...base, layers: [shape] };

    expect(planMockImageAiCommand(document, "make colors pop")).toEqual(
      planMockImageAiCommand(document, "make colors pop"),
    );
  });

  it("does not mutate the document for unsupported prompts", () => {
    const document = {
      ...createDefaultImageCompositionDocument(),
      layers: [createCenteredTextLayer(createDefaultImageCompositionDocument().canvas, "Title")],
    };
    const before = JSON.stringify(document);

    const plan = planMockImageAiCommand(document, "turn this into a spreadsheet");

    expect(plan.ok).toBe(false);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("applies a successful plan as one grouped history entry", () => {
    const document = createDefaultImageCompositionDocument();
    const plan = planMockImageAiCommand(document, "add title \"Summer Sale\"");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const operation = createImageAiGroupOperation(plan);
    const next = applyImageOperation(document, operation);

    expect(next.layers).toHaveLength(1);
    expect(next.operationHistory).toHaveLength(1);
    expect(next.operationHistory[0].operation).toMatchObject({
      type: "group-operation",
      prompt: "add title \"Summer Sale\"",
    });
  });

  it("warns and skips locked or hidden layers during cleanup planning", () => {
    const canvas = createDefaultImageCompositionDocument().canvas;
    const locked = { ...createCenteredTextLayer(canvas, "Locked"), id: "locked", locked: true };
    const hidden = { ...createCenteredTextLayer(canvas, "Hidden"), id: "hidden", visible: false };
    const plan = planMockImageAiCommand(
      { ...createDefaultImageCompositionDocument(), layers: [locked, hidden] },
      "clean up empty space",
    );

    expect(plan.ok).toBe(false);
    expect(plan.warnings.join(" ")).toContain("locked or hidden");
  });
});
