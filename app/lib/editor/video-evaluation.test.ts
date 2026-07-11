import { describe, expect, it } from "vitest";

import { createMockVideoProjectDocument, validateVideoProjectDocument } from "./video-document";
import { evaluateAnimatableNumber, evaluateVideoSourceTime, evaluateVisualState } from "./video-evaluation";
import {
  applyVideoOperation,
  updateAdvancedItemOperation,
  upsertEffectOperation,
  upsertTransitionOperation,
} from "./video-operations";

describe("video schema v3 and advanced evaluation", () => {
  it.each([1, 2])("migrates schema-v%s documents and adds zero crop to images", (schemaVersion) => {
    const document = createMockVideoProjectDocument("migration", "Migration");
    document.media.image = { id: "image", kind: "image", name: "Image", width: 100, height: 50 };
    document.tracks.push({
      id: "overlay",
      kind: "overlay",
      label: "Overlay",
      locked: false,
      hidden: false,
      muted: false,
      items: [{
        id: "legacy-image",
        type: "overlay",
        mediaId: "image",
        timelineStart: 0,
        duration: 2,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        opacity: 1,
        layerOrder: 1,
      } as never],
    });
    const result = validateVideoProjectDocument({ ...document, schemaVersion });

    expect(result.ok).toBe(true);
    expect(result.ok && result.document.schemaVersion).toBe(3);
    expect(result.ok && result.document.tracks.at(-1)?.items[0]).toMatchObject({
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("rejects collapsed and sub-pixel crop windows", () => {
    const document = createMockVideoProjectDocument("crop-validation", "Crop validation");
    const clip = document.tracks[0].items[0];
    if (clip.type !== "video") throw new Error("Expected video fixture");
    document.media[clip.mediaId] = { ...document.media[clip.mediaId], width: 100, height: 50 };
    clip.crop = { top: 0, right: 0.5, bottom: 0, left: 0.5 };
    expect(validateVideoProjectDocument(document).ok).toBe(false);
    clip.crop = { top: 0, right: 0.4951, bottom: 0, left: 0.495 };
    expect(validateVideoProjectDocument(document).ok).toBe(false);
    clip.crop = { top: 0, right: 0.495, bottom: 0, left: 0.495 };
    expect(validateVideoProjectDocument(document).ok).toBe(true);
  });

  it("evaluates cubic-bezier numeric keyframes at item-relative time", () => {
    const value = evaluateAnimatableNumber({
      value: 0,
      keyframes: [
        { id: "start", time: 0, value: 0 },
        { id: "end", time: 2, value: 100, easing: [0.42, 0, 0.58, 1] },
      ],
    }, 1, 0);

    expect(value).toBeCloseTo(50, 5);
  });

  it("evaluates animated visual state, freeze frames, and reverse time maps", () => {
    const document = createMockVideoProjectDocument("advanced", "Advanced");
    const clip = document.tracks[0].items[0];
    if (clip.type !== "video") throw new Error("Expected video fixture");
    clip.advanced = {
      transform: {
        x: { value: 0, keyframes: [{ id: "x0", time: 0, value: 0 }, { id: "x1", time: 2, value: 200 }] },
      },
      freezeFrames: [{ id: "freeze", timelineStart: 1, duration: 0.5, sourceTime: 8 }],
      timeRemap: {
        points: [{ timelineTime: 0, sourceTime: 10 }, { timelineTime: clip.duration, sourceTime: 2 }],
        preservePitch: true,
        audioBehavior: "remap",
      },
    };

    expect(evaluateVisualState(clip, clip.timelineStart + 1)?.transform.x).toBeCloseTo(100);
    expect(evaluateVideoSourceTime(clip, clip.timelineStart + 1.25)).toBe(8);
    expect(evaluateVideoSourceTime(clip, clip.timelineStart + clip.duration / 2)).toBeCloseTo(6);
  });

  it("evaluates crop animation for image and overlay items", () => {
    const document = createMockVideoProjectDocument("image-crop", "Image crop");
    const item = {
      id: "image",
      type: "image" as const,
      mediaId: "image-media",
      timelineStart: 0,
      duration: 2,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      opacity: 1,
      layerOrder: 1,
      advanced: { crop: { left: { value: 0, keyframes: [{ id: "a", time: 0, value: 0 }, { id: "b", time: 2, value: 0.4 }] } } },
    };
    expect(evaluateVisualState(item, 1)?.crop?.left).toBeCloseTo(0.2);
  });

  it("applies advanced edits as normal undoable operations", () => {
    const document = createMockVideoProjectDocument("operation", "Operation");
    const result = applyVideoOperation(document, updateAdvancedItemOperation("tl-beach", {
      timeRemap: {
        points: [{ timelineTime: 0, sourceTime: 0 }, { timelineTime: 21, sourceTime: 21 }],
        preservePitch: true,
        audioBehavior: "remap",
      },
    }, "Add time map"));

    expect(result.ok).toBe(true);
    expect(result.document.tracks[0].items[0].advanced?.timeRemap?.points).toHaveLength(2);
    expect(result.undo?.type).toBe("inverseOperations");
  });

  it("stores effects and transitions in the document operation log surface", () => {
    const document = createMockVideoProjectDocument("features", "Features");
    const withEffect = applyVideoOperation(document, upsertEffectOperation({
      id: "effect-vignette-test",
      type: "vignette",
      targetItemIds: ["tl-beach"],
      enabled: true,
      parameters: { amount: 0.5 },
    }));
    expect(withEffect.ok).toBe(true);
    expect(withEffect.document.effects.some((effect) => effect.id === "effect-vignette-test")).toBe(true);

    const withTransition = applyVideoOperation(withEffect.document, upsertTransitionOperation({
      id: "transition-test",
      type: "cross-dissolve",
      targetItemIds: ["tl-beach", "tl-city"],
      duration: 0.4,
      easing: "ease-in-out",
    }));
    expect(withTransition.ok).toBe(true);
    expect(withTransition.document.transitions.some((transition) => transition.id === "transition-test")).toBe(true);
  });
});
