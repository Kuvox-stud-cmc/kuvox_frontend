import { describe, expect, it } from "vitest";

import { createDefaultImageCompositionDocument } from "../document/default-document";
import { sanitizeImageExportFilename, withPngExtension } from "./filename";
import { imageCompositionCanExport, resolveImageExportDimensions } from "./types";

describe("image export helpers", () => {
  it("resolves export dimensions from canvas size and scale mode", () => {
    const composition = {
      ...createDefaultImageCompositionDocument(),
      canvas: { width: 1280, height: 720, unit: "px" as const, presetName: "Wide" },
    };

    expect(resolveImageExportDimensions(composition, { sizeMode: "1x", customWidth: null })).toEqual({
      width: 1280,
      height: 720,
    });
    expect(resolveImageExportDimensions(composition, { sizeMode: "3x", customWidth: null })).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(resolveImageExportDimensions(composition, { sizeMode: "custom", customWidth: 640 })).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("sanitizes filenames and appends png only when needed", () => {
    expect(sanitizeImageExportFilename(' Summer: "Launch" / Final*.png ')).toBe(
      "Summer- -Launch- - Final-.png",
    );
    expect(sanitizeImageExportFilename("...   ", "fallback")).toBe("fallback");
    expect(withPngExtension("poster")).toBe("poster.png");
    expect(withPngExtension("poster.PNG")).toBe("poster.PNG");
  });

  it("guards invalid export canvases", () => {
    expect(imageCompositionCanExport(createDefaultImageCompositionDocument())).toBe(true);
    expect(
      imageCompositionCanExport({
        ...createDefaultImageCompositionDocument(),
        canvas: { width: 0, height: 720, unit: "px", presetName: "Invalid" },
      }),
    ).toBe(false);
  });
});
