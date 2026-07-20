// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectAddMediaModal } from "./project-add-media-modal";

const loadChoices = vi.hoisted(() => vi.fn());
const loadAlbumMedia = vi.hoisted(() => vi.fn());
const attachMedia = vi.hoisted(() => vi.fn());

vi.mock("~/lib/editor/project-media-picker.client", () => ({
  loadProjectMediaPickerData: loadChoices,
  loadPickerAlbumMedia: loadAlbumMedia,
}));
vi.mock("~/lib/editor/project-media-api.client", () => ({
  attachProjectMediaFromBff: attachMedia,
}));
vi.mock("~/components/dashboard/workspace/media-thumbnail", () => ({
  MediaThumbnail: ({ media }: { media: { filename: string } }) => <span>{media.filename}</span>,
}));

beforeEach(() => {
  loadChoices.mockReset().mockResolvedValue({ media: [media("media-1")], albums: [album("album-1")] });
  loadAlbumMedia.mockReset().mockResolvedValue([media("album-media")]);
  attachMedia.mockReset().mockImplementation(async (_projectId: string, ids: string[]) => ids.map(projectMedia));
});

afterEach(() => cleanup());

describe("ProjectAddMediaModal", () => {
  it("loads choices only after opening and atomically attaches selected media", async () => {
    const onAttached = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<ProjectAddMediaModal open={false} projectId="project-1" attachedMediaIds={new Set()} onClose={onClose} onAttached={onAttached} />);
    expect(loadChoices).not.toHaveBeenCalled();

    rerender(<ProjectAddMediaModal open projectId="project-1" attachedMediaIds={new Set()} onClose={onClose} onAttached={onAttached} />);
    await screen.findByRole("button", { name: /media-1.mp4/i });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /media-1.mp4/i }));
    await user.click(screen.getByRole("button", { name: "Add selected" }));

    await waitFor(() => expect(attachMedia).toHaveBeenCalledWith("project-1", ["media-1"]));
    expect(onAttached).toHaveBeenCalledWith([expect.objectContaining({ mediaId: "media-1" })]);
  });

  it("browses an album and resolves select-all to individual media IDs", async () => {
    render(<ProjectAddMediaModal open projectId="project-1" attachedMediaIds={new Set()} onClose={() => {}} onAttached={() => {}} />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /media-1.mp4/i });
    await user.click(screen.getByRole("button", { name: "Albums" }));
    await user.click(screen.getByRole("button", { name: /album-1/i }));
    await screen.findByRole("button", { name: /album-media.mp4/i });
    await user.click(screen.getByRole("button", { name: "Select all available" }));
    await user.click(screen.getByRole("button", { name: "Add selected" }));

    await waitFor(() => expect(attachMedia).toHaveBeenCalledWith("project-1", ["album-media"]));
  });
});

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
  return { id, ownerId: "owner", ownerKind: 0, name: id, description: "", kind: 3, materialSymbol: "photo_album", isDeleteAble: true, mediaCount: 1, isFavorite: false };
}

function projectMedia(mediaId: string) {
  return { mediaId, kind: 0, availability: "available", filename: `${mediaId}.mp4`, ownerId: "owner", ownerKind: 0, status: "Ready", storageKey: `raw/${mediaId}`, sizeBytes: 1, canonicalStorageKey: `canonical/${mediaId}`, proxyStorageKey: `proxy/${mediaId}`, thumbnailStorageKey: `thumbnail/${mediaId}`, errorMessage: null, durationSeconds: 1, width: 1920, height: 1080, codec: "h264", frameRate: 30, createdAt: "2026-01-01T00:00:00Z", searchRevision: 0 };
}
