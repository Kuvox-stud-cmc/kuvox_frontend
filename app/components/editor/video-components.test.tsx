// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaKind } from "~/lib/api";
import { createMockVideoProjectDocument } from "~/lib/editor/video-document";
import { createVideoOperationBatch } from "~/lib/editor/video-operations";
import {
  commandInputChanged,
  currentTimeChanged,
  selectEditorState,
  timelineItemsSelected,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import { editorProject } from "./mock-editor-data";
import { TimelinePanel } from "./panels/timeline-panel";
import { mediaFixture, renderWithEditorStore } from "./test-utils";
import { VideoInspectorPanel } from "./video-inspector-panel";

const planningMock = vi.hoisted(() => vi.fn());
const retrievalMock = vi.hoisted(() => vi.fn());
const historyMock = vi.hoisted(() => vi.fn(async () => ({ ok: false, reason: "unavailable" })));

vi.mock("~/lib/editor/video-ai-service-planner", () => ({
  planVideoAiCommandWithService: planningMock,
}));

vi.mock("~/lib/editor/video-retrieval", () => ({
  searchVideoEditorRetrieval: retrievalMock,
}));

vi.mock("~/lib/editor/editor-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/editor/editor-cache")>();
  return {
    ...actual,
    saveCommandHistoryEntry: historyMock,
  };
});

beforeEach(() => {
  planningMock.mockReset();
  retrievalMock.mockReset();
  historyMock.mockClear();
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {}
      disconnect() {}
    },
  });
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
});

afterEach(() => {
  cleanup();
});

describe("MediaLibraryPanel", () => {
  it("shows empty, error, retry, add-to-timeline, and read-only placement states", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onAddMedia = vi.fn();
    renderWithEditorStore(
      <MediaLibraryPanel
        media={[]}
        mediaLoadError="network"
        onRetryMediaLoad={onRetry}
        onAddMedia={onAddMedia}
      />,
    );

    expect(screen.getByText("Media refresh failed")).toBeInTheDocument();
    expect(screen.getByText("No cached project media is available in this browser.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry media/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    cleanup();

    const ready = mediaFixture({ id: "clip-ready", filename: "Beach ready.mp4" });
    const { store } = renderWithEditorStore(
      <MediaLibraryPanel media={[ready]} canPlaceMedia={false} onAddMedia={onAddMedia} />,
    );

    await user.click(screen.getByRole("button", { name: /beach ready/i }));
    expect(onAddMedia).not.toHaveBeenCalled();
    expect(selectEditorState(store.getState()).ui.toastMessage).toBe("View only: you cannot place media on this timeline");
    cleanup();

    renderWithEditorStore(<MediaLibraryPanel media={[ready]} onAddMedia={onAddMedia} />);
    await user.click(screen.getByRole("button", { name: /beach ready/i }));
    expect(onAddMedia).toHaveBeenCalledWith(expect.objectContaining({ id: "clip-ready" }));
  });
});

describe("VideoInspectorPanel", () => {
  it("dispatches valid clip, text, audio, and project setting operations while rejecting invalid numbers", async () => {
    const user = userEvent.setup();
    const { store } = renderWithEditorStore(<VideoInspectorPanel />, { selectedItemIds: ["tl-beach"] });

    await replaceNumber(user, screen.getByLabelText("Speed"), "1.5");
    expect(findItem(store, "tl-beach")).toMatchObject({ type: "video", speed: 1.5 });

    await replaceNumber(user, screen.getByLabelText("Source in"), "99");
    expect(screen.getByText("Must be before source out.")).toBeInTheDocument();
    expect(findItem(store, "tl-beach")).toMatchObject({ type: "video", sourceIn: 0 });

    act(() => {
      store.dispatch(timelineItemsSelected({ itemIds: ["tl-caption"], activeItemId: "tl-caption" }));
    });
    await replaceText(user, screen.getByLabelText("Content"), "Updated caption");
    expect(findItem(store, "tl-caption")).toMatchObject({ type: "text", text: "Updated caption" });

    act(() => {
      store.dispatch(timelineItemsSelected({ itemIds: ["tl-audio-main"], activeItemId: "tl-audio-main" }));
    });
    await replaceNumber(user, screen.getByLabelText("Volume"), "0.25");
    expect(findItem(store, "tl-audio-main")).toMatchObject({ type: "audio", volume: 0.25 });

    act(() => {
      store.dispatch(timelineItemsSelected({ itemIds: [], activeItemId: undefined }));
    });
    await replaceNumber(user, screen.getByLabelText("Width"), "1280");
    expect(selectEditorState(store.getState()).document?.settings.width).toBe(1280);
  });
});

describe("AiAssistantPanel", () => {
  it("renders suggestions, reports unsupported commands, applies mocked plans, and blocks read-only semantic placement", async () => {
    const user = userEvent.setup();
    const document = createMockVideoProjectDocument("video-ai", "Video AI");
    const successBatch = createVideoOperationBatch({
      id: "ai-batch-test",
      source: "ai",
      label: "AI: move",
      operations: [{
        id: "ai-move-test",
        type: "moveItem",
        source: "ai",
        label: "AI move",
        affectedEntityIds: ["tl-beach"],
        timestamp: "2026-01-01T00:00:00.000Z",
        itemId: "tl-beach",
        timelineStart: 8,
      }],
    });
    planningMock
      .mockResolvedValueOnce({ ok: false, prompt: "make it epic", error: "Unsupported command", warnings: [] })
      .mockResolvedValueOnce({
        ok: true,
        commandId: "command-ok",
        prompt: "move clip",
        label: "Move clip",
        summary: "Moved clip",
        warnings: [],
        batch: successBatch,
      });
    retrievalMock.mockResolvedValue({
      projectId: "video-ai",
      query: "b-roll",
      results: [{
        shotId: "shot-1",
        mediaId: "clip-beach",
        startSeconds: 1,
        endSeconds: 4,
        score: 0.9,
        modalityScores: { transcript: 0.9 },
        evidence: [{ modality: "transcript", text: "surf", score: 0.9 }],
      }],
      warnings: [],
      totalCandidatesConsidered: 1,
    });

    const { store } = renderWithEditorStore(
      <AiAssistantPanel
        messages={[]}
        projectId="video-ai"
        cacheScope={{ userId: "user-1", ownerKind: "user", ownerId: "user-1" }}
        media={[mediaFixture({ id: "clip-beach", filename: "Beach.mp4" })]}
      />,
      { document, selectedItemIds: ["tl-beach"] },
    );
    act(() => {
      store.dispatch(commandInputChanged(""));
      store.dispatch(currentTimeChanged(6));
    });

    await waitFor(() => expect(selectEditorState(store.getState()).aiSuggestions.length).toBeGreaterThan(0));
    expect(screen.getByText(/split selected clip/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("AI edit command"), "make it epic");
    await user.click(screen.getByRole("button", { name: /send command/i }));
    expect(await screen.findAllByText("Unsupported command")).toHaveLength(2);

    await user.type(screen.getByLabelText("AI edit command"), "move clip");
    await user.click(screen.getByRole("button", { name: /send command/i }));
    await waitFor(() => expect(findItem(store, "tl-beach")).toMatchObject({ timelineStart: 8 }));
    expect(screen.getAllByText("Moved clip")).toHaveLength(2);

    cleanup();
    const readOnly = renderWithEditorStore(
      <AiAssistantPanel
        messages={[]}
        projectId="video-ai"
        cacheScope={{ userId: "user-1", ownerKind: "user", ownerId: "user-1" }}
        media={[mediaFixture({ id: "clip-beach", filename: "Beach.mp4" })]}
        canPlanCommands={false}
      />,
      { document },
    );
    expect(screen.getByLabelText("AI edit command")).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Search moments..."), "b-roll");
    await user.click(screen.getAllByRole("button", { name: /search moments/i }).at(-1)!);
    await waitFor(() => expect(retrievalMock).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /add shot to timeline/i }));
    expect(selectEditorState(readOnly.store.getState()).ui.toastMessage).toBe("View only: you cannot edit this timeline");
  });
});

describe("Timeline and top-bar controls", () => {
  it("selects, splits, deletes, undoes/redoes, zooms, and toggles edit tools", async () => {
    const user = userEvent.setup();
    const { store } = renderWithEditorStore(
      <MemoryRouter>
        <EditorTopBar project={editorProject} />
        <TimelinePanel />
      </MemoryRouter>,
      { selectedItemIds: ["tl-beach"] },
    );
    act(() => {
      store.dispatch(currentTimeChanged(6));
    });

    await user.click(screen.getByRole("button", { name: /split at playhead/i }));
    expect(selectEditorState(store.getState()).document?.tracks[0].items.some((item) => item.id === "tl-beach-a")).toBe(true);
    expect(selectEditorState(store.getState()).document?.tracks[0].items.some((item) => item.id === "tl-beach-b")).toBe(true);

    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(selectEditorState(store.getState()).lastHistoryAction).toBe("undo");
    await user.click(screen.getByRole("button", { name: /redo/i }));
    expect(selectEditorState(store.getState()).lastHistoryAction).toBe("redo");

    await user.click(screen.getByRole("button", { name: /delete selected/i }));
    expect(findItem(store, "tl-beach")).toBeUndefined();

    const zoom = screen.getByLabelText("Timeline zoom");
    fireEvent.change(zoom, { target: { value: "60" } });
    expect(selectEditorState(store.getState()).ui.timelineZoom).toBe(60);

    await user.click(screen.getByRole("button", { name: /enable snapping|disable snapping/i }));
    await user.click(screen.getByRole("button", { name: /link clips|unlink clips/i }));
    expect(typeof selectEditorState(store.getState()).ui.snappingEnabled).toBe("boolean");
    expect(typeof selectEditorState(store.getState()).ui.clipsLinked).toBe("boolean");
  });
});

async function replaceNumber(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) {
  await user.clear(input);
  await user.type(input, value);
  await user.tab();
}

async function replaceText(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) {
  await user.clear(input);
  await user.type(input, value);
  await user.tab();
}

function findItem(store: ReturnType<typeof renderWithEditorStore>["store"], itemId: string) {
  return selectEditorState(store.getState()).document?.tracks
    .flatMap((track) => track.items)
    .find((item) => item.id === itemId);
}
