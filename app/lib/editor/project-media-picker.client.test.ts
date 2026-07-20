// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPickerAlbumMedia, loadProjectMediaPickerData } from "./project-media-picker.client";

afterEach(() => vi.restoreAllMocks());

describe("project media picker client", () => {
  it("loads workspace and shared choices only when requested, follows media pages, and deduplicates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/bff/media/library") && url.includes("page=1")) {
        return json({ items: [media("workspace")], page: 1, pageSize: 100, totalCount: 2, totalPages: 2 });
      }
      if (url.includes("/bff/media/library") && url.includes("page=2")) {
        return json({ items: [media("workspace-2")], page: 2, pageSize: 100, totalCount: 2, totalPages: 2 });
      }
      if (url.includes("/bff/media/shared")) {
        return json({ items: [media("workspace"), media("shared")], page: 1, pageSize: 100, totalCount: 2, totalPages: 1 });
      }
      if (url.includes("/bff/albums/library")) return json([album("album-1")]);
      if (url.includes("/bff/albums/shared")) return json([album("album-1"), album("album-2")]);
      throw new Error(`Unexpected fetch ${url}`);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const result = await loadProjectMediaPickerData("studio-1");

    expect(result.media.map((item) => item.id)).toEqual(["workspace", "workspace-2", "shared"]);
    expect(result.albums.map((item) => item.id)).toEqual(["album-1", "album-2"]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("studioId=studio-1"),
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("loads an album's individual media for project attachment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({
      items: [media("album-media")],
      page: 1,
      pageSize: 1,
      totalCount: 1,
      totalPages: 1,
    }));

    await expect(loadPickerAlbumMedia("album-1")).resolves.toEqual([
      expect.objectContaining({ id: "album-media" }),
    ]);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function media(id: string) {
  return {
    id,
    ownerId: "owner",
    ownerKind: 0,
    kind: 0,
    filename: `${id}.mp4`,
    storageKey: `raw/${id}`,
    sizeBytes: 1,
    status: "Ready",
    canonicalStorageKey: `canonical/${id}`,
    proxyStorageKey: `proxy/${id}`,
    thumbnailStorageKey: `thumbnail/${id}`,
    errorMessage: null,
    durationSeconds: 1,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    createdAt: "2026-01-01T00:00:00Z",
    isFavorite: false,
    pipeline: { stage: "ready", label: "Ready", detail: "Ready", step: 4, stepCount: 4, terminal: true },
  };
}

function album(id: string) {
  return {
    id,
    ownerId: "owner",
    ownerKind: 0,
    name: id,
    description: "",
    kind: 3,
    materialSymbol: "photo_album",
    isDeleteAble: true,
    mediaCount: 1,
    isFavorite: false,
  };
}
