// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, Link, RouterProvider } from "react-router";

import { EditorExitGuard } from "./editor-exit-guard";
import type { VideoSyncResult } from "./use-video-autosave";

afterEach(() => cleanup());

describe("EditorExitGuard", () => {
  it("allows clean navigation without opening a dialog", async () => {
    const user = userEvent.setup();
    renderGuard({ hasUnsyncedChanges: false });

    await user.click(screen.getByRole("link", { name: "Exit editor" }));

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks route navigation and cancel keeps the editor unchanged", async () => {
    const user = userEvent.setup();
    renderGuard();

    await user.click(screen.getByRole("link", { name: "Exit editor" }));
    expect(screen.getByRole("dialog", { name: "Leave the editor?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Editor route")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("syncs once and proceeds only after successful synchronization", async () => {
    const user = userEvent.setup();
    const syncNow = vi.fn<() => Promise<VideoSyncResult>>().mockResolvedValue({
      status: "success",
      timelineId: "timeline-1",
      revisionNumber: 4,
    });
    renderGuard({ syncNow });

    await user.click(screen.getByRole("link", { name: "Exit editor" }));
    await user.click(screen.getByRole("button", { name: "Sync and leave" }));

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it.each(["failure", "conflict"] as const)("keeps the editor open on sync %s", async (status) => {
    const user = userEvent.setup();
    const syncNow = vi.fn<() => Promise<VideoSyncResult>>().mockResolvedValue({
      status,
      message: "Timeline could not be synchronized.",
    });
    renderGuard({ syncNow });

    await user.click(screen.getByRole("link", { name: "Exit editor" }));
    await user.click(screen.getByRole("button", { name: "Sync and leave" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Timeline could not be synchronized.");
    expect(screen.getByText("Editor route")).toBeInTheDocument();
  });

  it("flushes locally and leaves without synchronizing", async () => {
    const user = userEvent.setup();
    const flushLocalDraft = vi.fn().mockResolvedValue(undefined);
    const syncNow = vi.fn<() => Promise<VideoSyncResult>>();
    renderGuard({ flushLocalDraft, syncNow });

    await user.click(screen.getByRole("link", { name: "Exit editor" }));
    await user.click(screen.getByRole("button", { name: "Leave without syncing" }));

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
    expect(flushLocalDraft).toHaveBeenCalledTimes(1);
    expect(syncNow).not.toHaveBeenCalled();
  });

  it("blocks browser back navigation", async () => {
    const { router } = renderGuard({ initialEntries: ["/dashboard", "/editor"], initialIndex: 1 });

    await router.navigate(-1);

    expect(await screen.findByRole("dialog", { name: "Leave the editor?" })).toBeInTheDocument();
    expect(screen.getByText("Editor route")).toBeInTheDocument();
  });

  it("registers native unload protection only while unsynced", () => {
    const clean = renderGuard({ hasUnsyncedChanges: false });
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    clean.unmount();

    const unsynced = renderGuard();
    const protectedEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(protectedEvent);
    expect(protectedEvent.defaultPrevented).toBe(true);
    unsynced.unmount();

    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
});

function renderGuard(overrides: {
  hasUnsyncedChanges?: boolean;
  flushLocalDraft?: () => Promise<void>;
  syncNow?: () => Promise<VideoSyncResult>;
  initialEntries?: string[];
  initialIndex?: number;
} = {}) {
  const router = createMemoryRouter([
    {
      path: "/editor",
      element: (
        <>
          <EditorExitGuard
            hasUnsyncedChanges={overrides.hasUnsyncedChanges ?? true}
            flushLocalDraft={overrides.flushLocalDraft ?? vi.fn().mockResolvedValue(undefined)}
            syncNow={overrides.syncNow ?? vi.fn().mockResolvedValue({
              status: "success",
              timelineId: "timeline-1",
              revisionNumber: 1,
            })}
          />
          <p>Editor route</p>
          <Link to="/dashboard">Exit editor</Link>
        </>
      ),
    },
    { path: "/dashboard", element: <p>Dashboard route</p> },
  ], {
    initialEntries: overrides.initialEntries ?? ["/editor"],
    initialIndex: overrides.initialIndex,
  });
  const result = render(<RouterProvider router={router} />);
  return { ...result, router };
}
