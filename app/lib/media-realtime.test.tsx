// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaDto } from "./api";
import { useLiveMedia } from "./media-realtime";

const revalidate = vi.hoisted(() => vi.fn());

vi.mock("react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router")>(),
  useRevalidator: () => ({ state: "idle", revalidate }),
}));

vi.mock("./realtime-connection.client", () => ({
  getRealtimeConnection: () => ({ subscribe: () => () => undefined }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  revalidate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLiveMedia editor mode", () => {
  it("replaces media in place without revalidating the editor route", async () => {
    function Harness() {
      const live = useLiveMedia([media("processing", "Processing")], { routeRevalidation: false });
      return (
        <div>
          <span>{live.media.map((item) => item.id).join(",")}</span>
          <button type="button" onClick={() => live.replaceMedia([media("ready", "Ready")])}>Refresh media</button>
        </div>
      );
    }

    render(<Harness />);
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(revalidate).not.toHaveBeenCalled();

    vi.useRealTimers();
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh media" }));
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(revalidate).not.toHaveBeenCalled();
  });
});

function media(id: string, status: string): MediaDto {
  return {
    id,
    ownerId: "owner",
    ownerKind: 0,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: 0,
    filename: `${id}.mp4`,
    storageKey: `raw/${id}`,
    sizeBytes: 1,
    status,
    canonicalStorageKey: status === "Ready" ? `canonical/${id}` : null,
    proxyStorageKey: status === "Ready" ? `proxy/${id}` : null,
    thumbnailStorageKey: null,
    errorMessage: null,
    durationSeconds: 1,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    createdAt: "2026-01-01T00:00:00Z",
    isFavorite: false,
    pipeline: status === "Ready"
      ? { stage: "ready", label: "Ready", detail: "Ready", step: 4, stepCount: 4, terminal: true }
      : { stage: "processing", label: "Processing", detail: "Processing", step: 2, stepCount: 4, terminal: false },
  };
}
