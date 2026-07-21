// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => {
  const events = new Map<string, Set<(payload: unknown) => void>>();
  const lifecycle = new Set<(state: { state: "connected" | "disconnected"; reconnected: boolean }) => void>();
  return {
    events,
    lifecycle,
    connection: {
      subscribe: vi.fn((target: string, handler: (payload: unknown) => void) => {
        const handlers = events.get(target) ?? new Set();
        handlers.add(handler);
        events.set(target, handlers);
        return () => handlers.delete(handler);
      }),
      subscribeLifecycle: vi.fn((handler: (state: { state: "connected" | "disconnected"; reconnected: boolean }) => void) => {
        lifecycle.add(handler);
        return () => lifecycle.delete(handler);
      }),
    },
  };
});

const renderApi = vi.hoisted(() => ({
  request: vi.fn(),
  get: vi.fn(),
}));

vi.mock("~/lib/realtime-connection.client", () => ({
  getRealtimeConnection: () => realtime.connection,
}));

vi.mock("~/lib/editor/video-export", () => ({
  createDefaultVideoExportSettings: () => ({
    preset: "h264-1080p",
    format: "mp4",
    resolution: "1080p",
    width: 1920,
    height: 1080,
    frameRate: 30,
    quality: "standard",
    destinationLabel: "Test",
  }),
  validateVideoExport: () => ({ ok: true, errors: [], warnings: [] }),
  resolveVideoExportDimensions: () => ({ width: 1920, height: 1080 }),
  isRenderBackendUnavailable: () => false,
  requestVideoRenderJob: renderApi.request,
  getVideoRenderJob: renderApi.get,
  normalizeVideoRenderJob: (payload: Record<string, unknown>) => job({
    id: String(payload.jobId ?? payload.id ?? ""),
    timelineId: String(payload.timelineId ?? "timeline-1"),
    status: String(payload.status ?? "queued") as "queued" | "rendering" | "completed" | "failed",
    outputAvailable: payload.outputAvailable === true,
    message: typeof payload.message === "string" ? payload.message : null,
  }),
}));

import { VideoExportModal } from "./video-export-modal";

beforeEach(() => {
  realtime.events.clear();
  realtime.lifecycle.clear();
  realtime.connection.subscribe.mockClear();
  realtime.connection.subscribeLifecycle.mockClear();
  renderApi.request.mockReset();
  renderApi.get.mockReset();
  renderApi.request.mockResolvedValue(job());
  renderApi.get.mockResolvedValue(job({ status: "rendering", message: "Rendering video." }));
});

afterEach(() => cleanup());

describe("VideoExportModal realtime jobs", () => {
  it("does not create a render job when synchronization fails", async () => {
    const user = userEvent.setup();
    const flushForExport = vi.fn().mockResolvedValue({
      status: "failure",
      message: "Timeline sync failed.",
    });
    renderModal(vi.fn(), flushForExport);

    await user.click(screen.getByRole("button", { name: /create render job/i }));

    expect(await screen.findByText("Timeline sync failed.")).toBeInTheDocument();
    expect(renderApi.request).not.toHaveBeenCalled();
  });

  it("renders exactly the synchronized revision and ignores duplicate starts", async () => {
    let resolveSync!: (value: { status: "success"; timelineId: string; revisionNumber: number }) => void;
    const flushForExport = vi.fn(() => new Promise<{ status: "success"; timelineId: string; revisionNumber: number }>((resolve) => {
      resolveSync = resolve;
    }));
    renderModal(vi.fn(), flushForExport);

    const start = screen.getByRole("button", { name: /create render job/i });
    fireEvent.click(start);
    fireEvent.click(start);
    resolveSync({ status: "success", timelineId: "timeline-7", revisionNumber: 7 });

    await waitFor(() => expect(renderApi.request).toHaveBeenCalledTimes(1));
    expect(flushForExport).toHaveBeenCalledTimes(1);
    expect(renderApi.request).toHaveBeenCalledWith(expect.objectContaining({
      timelineId: "timeline-7",
      revisionNumber: 7,
    }));
  });

  it("follows matching realtime transitions and creates only the authenticated output link", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole("button", { name: /create render job/i }));
    expect(await screen.findByText("Queued")).toBeInTheDocument();

    emitJob({ jobId: "job-2", status: "failed", message: "Other job" });
    expect(screen.getByText("Queued")).toBeInTheDocument();
    emitJob({ jobId: "job-1", status: "rendering", message: "Rendering video." });
    expect(await screen.findByText("Rendering")).toBeInTheDocument();
    emitJob({
      jobId: "job-1",
      status: "completed",
      outputAvailable: true,
      message: "Export completed.",
    });

    const link = await screen.findByRole("link", { name: /open exported video/i });
    expect(link).toHaveAttribute("href", "/bff/timelines/render-jobs/job-1/output");
    expect(realtime.events.get("renderJobUpdated")?.size ?? 0).toBe(0);

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reconciles once after reconnect and each visible-page return without polling", async () => {
    const user = userEvent.setup();
    renderModal(vi.fn());
    await user.click(screen.getByRole("button", { name: /create render job/i }));
    await screen.findByText("Queued");

    realtime.lifecycle.forEach((handler) => handler({ state: "connected", reconnected: false }));
    expect(renderApi.get).not.toHaveBeenCalled();
    realtime.lifecycle.forEach((handler) => handler({ state: "connected", reconnected: true }));
    await waitFor(() => expect(renderApi.get).toHaveBeenCalledTimes(1));

    Object.defineProperty(window.document, "visibilityState", { configurable: true, value: "visible" });
    window.document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(renderApi.get).toHaveBeenCalledTimes(2));
  });
});

function renderModal(
  onClose: () => void,
  flushForExport = async () => ({ status: "success" as const, timelineId: "timeline-1", revisionNumber: 2 }),
) {
  render(
    <VideoExportModal
      open
      document={{} as never}
      media={[]}
      projectMedia={[]}
      projectName="Test project"
      onClose={onClose}
      flushForExport={flushForExport}
    />,
  );
}

function emitJob(payload: Record<string, unknown>) {
  realtime.events.get("renderJobUpdated")?.forEach((handler) => handler(payload));
}

function job(overrides: Partial<Record<string, unknown>> = {}) {
  const id = String(overrides.id ?? "job-1");
  const status = String(overrides.status ?? "queued") as "queued" | "rendering" | "completed" | "failed";
  const outputAvailable = overrides.outputAvailable === true;
  return {
    id,
    timelineId: String(overrides.timelineId ?? "timeline-1"),
    revisionNumber: 2,
    status,
    outputAvailable,
    outputUrl: status === "completed" && outputAvailable
      ? `/bff/timelines/render-jobs/${id}/output`
      : null,
    outputContentType: outputAvailable ? "video/mp4" : null,
    outputSizeBytes: outputAvailable ? 123 : null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: null,
    updatedAt: null,
    message: typeof overrides.message === "string" ? overrides.message : null,
  };
}
