// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorPanelErrorBoundary } from "./editor-panel-error-boundary";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EditorPanelErrorBoundary transient recovery", () => {
  it("shows a loading animation and automatically restores a transient preview crash", async () => {
    let shouldThrow = true;
    function TransientPreview() {
      if (shouldThrow) throw new Error("preview initialization race");
      return <div>Preview ready</div>;
    }
    setTimeout(() => {
      shouldThrow = false;
    }, 100);

    render(
      <EditorPanelErrorBoundary label="Preview" autoRetryAttempts={2} autoRetryDelayMs={200}>
        <TransientPreview />
      </EditorPanelErrorBoundary>,
    );

    expect(screen.getByText("Loading preview")).toBeInTheDocument();
    expect(screen.queryByText(/backend is not reachable/i)).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.getByText("Preview ready")).toBeInTheDocument();
  });

  it("uses a neutral preview message after automatic retries are exhausted", async () => {
    function BrokenPreview(): ReactElement {
      throw new Error("canvas failed");
    }

    render(
      <EditorPanelErrorBoundary
        label="Preview"
        autoRetryAttempts={1}
        autoRetryDelayMs={200}
        fallbackMessage="The preview hit a rendering problem. Your edits are still safe."
      >
        <BrokenPreview />
      </EditorPanelErrorBoundary>,
    );

    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.getByText("The preview hit a rendering problem. Your edits are still safe.")).toBeInTheDocument();
    expect(screen.queryByText(/backend is not reachable/i)).not.toBeInTheDocument();
  });
});
