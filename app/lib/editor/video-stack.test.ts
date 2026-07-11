import { describe, expect, it } from "vitest";

import { createEmptyVideoProjectDocument, type ImageOverlayTimelineItem, type TextTimelineItem } from "./video-document";
import { planVideoStack } from "./video-stack";

describe("video stack planner", () => {
  it("orders base video tracks first and overlay phase by layer and stable positions", () => {
    const document = createEmptyVideoProjectDocument({ id: "stack", name: "Stack" });
    const image = (id: string, layerOrder: number): ImageOverlayTimelineItem => ({
      id, type: "image", mediaId: id, timelineStart: 0, duration: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 }, opacity: 1, layerOrder,
    });
    const text = (id: string, layerOrder: number): TextTimelineItem => ({
      id, type: "text", timelineStart: 0, duration: 1, text: id,
      style: { fontFamily: "Inter", fontSize: 32, color: "#fff" },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, layerOrder,
    });
    document.tracks = [
      { id: "v-top", kind: "video", label: "V top", locked: false, hidden: false, muted: false, items: [image("base-top", 9)] },
      { id: "v-bottom", kind: "video", label: "V bottom", locked: false, hidden: false, muted: false, items: [image("base-bottom", 0)] },
      { id: "text", kind: "text", label: "Text", locked: false, hidden: false, muted: false, items: [text("text-high", 5), text("text-low", 1)] },
      { id: "overlay", kind: "overlay", label: "Overlay", locked: false, hidden: false, muted: false, items: [image("overlay-mid", 3)] },
    ];

    expect(planVideoStack(document).map((entry) => entry.itemId)).toEqual([
      "base-bottom", "base-top", "text-low", "overlay-mid", "text-high",
    ]);
  });
});
