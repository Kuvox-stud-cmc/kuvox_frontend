// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaKind } from "~/lib/api";
import { createMockVideoProjectDocument, type VideoProjectDocument, type VideoTransform } from "~/lib/editor/video-document";
import { createVideoOperationBatch } from "~/lib/editor/video-operations";
import {
  activeToolChanged,
  activeInspectorSectionChanged,
  commandInputChanged,
  currentTimeChanged,
  playbackToggled,
  selectEditorState,
  timelineItemsSelected,
  videoOperationApplied,
  videoRedoRequested,
  videoUndoRequested,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import { PreviewPanel } from "./panels/preview-panel";
import { TimelinePanel } from "./panels/timeline-panel";
import { mediaFixture, projectFixture, renderWithEditorStore } from "./test-utils";
import { useVideoKeyboardShortcuts } from "./use-video-keyboard-shortcuts";
import { VideoInspectorPanel } from "./video-inspector-panel";

const planningMock = vi.hoisted(() => vi.fn());
const retrievalMock = vi.hoisted(() => vi.fn());
const historyMock = vi.hoisted(() => vi.fn(async () => ({ ok: false, reason: "unavailable" })));
const mediaLayerBatchDrawMock = vi.hoisted(() => vi.fn());

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

vi.mock("react-konva", async () => {
  const React = await import("react");
  type MockKonvaProps = {
    children?: React.ReactNode;
    name?: string;
    listening?: boolean;
    onPointerDown?: (event: unknown) => void;
    onPointerMove?: (event: unknown) => void;
    onPointerUp?: (event: unknown) => void;
    onPointerCancel?: (event: unknown) => void;
  };
  const konvaEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const stageElement = event.currentTarget.closest<HTMLElement>("[data-konva-stage]") ?? event.currentTarget;
    return {
      evt: {
        pointerId: event.pointerId ?? 1,
        pointerType: event.pointerType || "mouse",
        button: typeof event.button === "number" ? event.button : 0,
        buttons: event.buttons,
        isPrimary: event.isPrimary !== false,
        shiftKey: event.shiftKey,
      },
      cancelBubble: false,
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: event.clientX, y: event.clientY }),
          container: () => stageElement,
        }),
      },
    };
  };
  const Node = ({ children, name, listening, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: MockKonvaProps) => (
    <div
      data-konva-name={name}
      data-konva-listening={listening === undefined ? undefined : String(listening)}
      onPointerDown={onPointerDown ? (event) => onPointerDown(konvaEvent(event)) : undefined}
      onPointerMove={onPointerMove ? (event) => onPointerMove(konvaEvent(event)) : undefined}
      onPointerUp={onPointerUp ? (event) => onPointerUp(konvaEvent(event)) : undefined}
      onPointerCancel={onPointerCancel ? (event) => onPointerCancel(konvaEvent(event)) : undefined}
    >
      {children}
    </div>
  );
  const Stage = (props: MockKonvaProps) => <div data-konva-stage="true"><Node {...props} /></div>;
  const Layer = React.forwardRef(({ children, ...props }: MockKonvaProps, ref) => {
    React.useImperativeHandle(ref, () => ({ batchDraw: mediaLayerBatchDrawMock }));
    return <Node {...props}>{children}</Node>;
  });
  Layer.displayName = "MockKonvaLayer";

  return {
    Stage,
    Layer,
    Group: Node,
    Rect: Node,
    Circle: Node,
    Line: Node,
    Text: ({ text }: { text?: string }) => <span>{text}</span>,
    Image: Node,
  };
});

beforeEach(() => {
  planningMock.mockReset();
  retrievalMock.mockReset();
  historyMock.mockClear();
  mediaLayerBatchDrawMock.mockClear();
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {}
      disconnect() {}
    },
  });
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: MouseEvent,
  });
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 960,
    bottom: 540,
    width: 960,
    height: 540,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it("links visual scales, supports independent edits, normalizes rotation, and disables locked tracks", async () => {
    const user = userEvent.setup();
    const { store } = renderWithEditorStore(<VideoInspectorPanel />, { selectedItemIds: ["tl-beach"] });

    await replaceNumber(user, screen.getByLabelText("Scale X"), "2");
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { scaleX: 2, scaleY: 2 } });
    await waitFor(() => expect(screen.getByLabelText("Scale Y")).toHaveValue(2));

    await user.click(screen.getByRole("button", { name: "Link scales" }));
    expect(selectEditorState(store.getState()).ui.visualScalesLinked).toBe(false);
    await replaceNumber(user, screen.getByLabelText("Scale Y"), "3");
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { scaleX: 2, scaleY: 3 } });

    await replaceNumber(user, screen.getByLabelText("Rotation"), "450");
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { rotation: 90 } });

    cleanup();
    const locked = directManipulationDocument();
    locked.tracks = locked.tracks.map((track) => track.id === "v1" ? { ...track, locked: true } : track);
    renderWithEditorStore(<VideoInspectorPanel />, { document: locked, selectedItemIds: ["tl-beach"] });
    expect(screen.getByLabelText("Position X")).toBeDisabled();
    expect(screen.getByLabelText("Scale X")).toBeDisabled();
    expect(screen.getByLabelText("Rotation")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fit visual to frame" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset visual transform" })).toBeDisabled();
  });

  it("applies fit, fill, center, reset, and original-size presets as single undoable visual operations", async () => {
    const user = userEvent.setup();
    const document = transformPresetDocument();
    const { store } = renderWithEditorStore(<VideoInspectorPanel />, {
      document,
      selectedItemIds: ["tl-beach"],
    });
    const originalItem = findItem(store, "tl-beach");
    expect(originalItem?.type).toBe("video");

    const assertPreset = async (
      buttonName: string,
      expectedTransform: Partial<VideoTransform>,
    ) => {
      await user.click(screen.getByRole("button", { name: buttonName }));
      expect(findItem(store, "tl-beach")).toMatchObject({ transform: expectedTransform });
      expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);
      expect(selectEditorState(store.getState()).lastAppliedOperationIds).toHaveLength(1);
      expect(findItem(store, "tl-beach")).toMatchObject({
        crop: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 },
        opacity: 0.65,
        advanced: originalItem && "advanced" in originalItem ? originalItem.advanced : undefined,
      });
      act(() => store.dispatch(videoUndoRequested()));
      expect(findItem(store, "tl-beach")).toEqual(originalItem);
      act(() => store.dispatch(videoRedoRequested()));
      expect(findItem(store, "tl-beach")).toMatchObject({ transform: expectedTransform });
      act(() => store.dispatch(videoUndoRequested()));
    };

    await assertPreset("Fit visual to frame", { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    await assertPreset("Fill frame with visual", { x: 0, y: 0, scaleX: 4.740741, scaleY: 4.740741, rotation: 0 });
    await assertPreset("Center visual", { x: 0, y: 0, scaleX: 2, scaleY: 0.75, rotation: 0 });
    await assertPreset("Set visual to original size", { x: 0, y: 0, scaleX: 1.066667, scaleY: 1.066667, rotation: 0 });
    await assertPreset("Reset visual transform", { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
  });

  it("shares transform presets with images and disables only dimension-dependent commands when metadata is missing", async () => {
    const user = userEvent.setup();
    const imageDocument = imagePresetDocument();
    const { store } = renderWithEditorStore(<VideoInspectorPanel />, {
      document: imageDocument,
      selectedItemIds: ["image-preset"],
    });
    await user.click(screen.getByRole("button", { name: "Fill frame with visual" }));
    expect(findItem(store, "image-preset")).toMatchObject({
      type: "image",
      transform: { x: 0, y: 0, scaleX: 3.160494, scaleY: 3.160494, rotation: 0 },
      opacity: 0.8,
      layerOrder: 7,
    });

    cleanup();
    const missingDimensions = transformPresetDocument();
    missingDimensions.media["clip-beach"] = {
      ...missingDimensions.media["clip-beach"],
      width: undefined,
      height: undefined,
    };
    renderWithEditorStore(<VideoInspectorPanel />, {
      document: missingDimensions,
      selectedItemIds: ["tl-beach"],
    });
    expect(screen.getByRole("button", { name: "Fit visual to frame" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fill frame with visual" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Set visual to original size" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Center visual" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset visual transform" })).toBeEnabled();
  });

  it("edits structural crop percentages with source-pixel constraints and reset parity", async () => {
    const user = userEvent.setup();
    const document = directManipulationDocument();
    document.media["clip-beach"] = { ...document.media["clip-beach"], width: 100, height: 50 };
    const { store } = renderWithEditorStore(<VideoInspectorPanel />, {
      document,
      selectedItemIds: ["tl-beach"],
    });

    await replaceNumber(user, screen.getByLabelText("Left"), "99.9");
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { left: 0.99, right: 0 } });
    await user.click(screen.getByRole("button", { name: "Reset Crop" }));
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { top: 0, right: 0, bottom: 0, left: 0 } });

    cleanup();
    const imageDocument = imagePresetDocument();
    renderWithEditorStore(<VideoInspectorPanel />, { document: imageDocument, selectedItemIds: ["image-preset"] });
    expect(screen.getByLabelText("Top")).toBeEnabled();
    expect(screen.queryByLabelText("Corner Rad.")).toBeNull();

    cleanup();
    imageDocument.media["image-preset-media"] = { ...imageDocument.media["image-preset-media"], width: undefined };
    renderWithEditorStore(<VideoInspectorPanel />, { document: imageDocument, selectedItemIds: ["image-preset"] });
    expect(screen.getByLabelText("Top")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset Crop" })).toBeDisabled();
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
  it("quick-mutes and unmutes video tracks from the track header", async () => {
    const user = userEvent.setup();
    const { store } = renderWithEditorStore(<TimelinePanel />);
    const videoTrack = selectEditorState(store.getState()).document?.tracks.find((track) => track.kind === "video");
    if (!videoTrack) throw new Error("Expected a video track fixture.");

    const muteButton = screen.getByRole("button", { name: `Mute ${videoTrack.label}` });
    expect(muteButton).toHaveAttribute("aria-pressed", "false");
    await user.click(muteButton);
    expect(selectEditorState(store.getState()).document?.tracks.find((track) => track.id === videoTrack.id)?.muted).toBe(true);
    expect(muteButton).toHaveAttribute("aria-pressed", "true");

    await user.click(muteButton);
    expect(selectEditorState(store.getState()).document?.tracks.find((track) => track.id === videoTrack.id)?.muted).toBe(false);
  });

  it("selects, splits, deletes, undoes/redoes, zooms, and toggles edit tools", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const { store } = renderWithEditorStore(
      <MemoryRouter>
        <EditorTopBar project={projectFixture()} onSync={onSync} />
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

    await user.click(screen.getAllByRole("button", { name: /undo/i })[0]);
    expect(selectEditorState(store.getState()).lastHistoryAction).toBe("undo");
    await user.click(screen.getAllByRole("button", { name: /redo/i })[0]);
    expect(selectEditorState(store.getState()).lastHistoryAction).toBe("redo");

    await user.click(screen.getByRole("button", { name: /delete selected/i }));
    expect(findItem(store, "tl-beach")).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(selectEditorState(store.getState()).ui.timelineZoom).toBe(60);

    await user.click(screen.getByRole("button", { name: /enable snapping|disable snapping/i }));
    await user.click(screen.getByRole("button", { name: /link clips|unlink clips/i }));
    await user.click(screen.getByRole("button", { name: /^sync$/i }));
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(typeof selectEditorState(store.getState()).ui.snappingEnabled).toBe("boolean");
    expect(typeof selectEditorState(store.getState()).ui.clipsLinked).toBe("boolean");
  });

  it("scrubs by dragging the playhead without changing the current edit selection", () => {
    const { store } = renderWithEditorStore(<TimelinePanel />, { selectedItemIds: ["tl-beach"] });
    const playhead = screen.getByLabelText("Playhead");
    const trackArea = playhead.parentElement as HTMLElement;
    Object.defineProperty(trackArea, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 960, height: 220, right: 960, bottom: 220 }),
    });

    fireEvent.pointerDown(playhead, { button: 0, pointerId: 1, clientX: 120, clientY: 24 });
    const afterPointerDown = selectEditorState(store.getState()).playback.currentTime;
    expect(afterPointerDown).toBeGreaterThan(3);

    fireEvent.pointerMove(trackArea, { pointerId: 1, clientX: 240, clientY: 24 });
    const afterDrag = selectEditorState(store.getState()).playback.currentTime;
    expect(afterDrag).toBeGreaterThan(afterPointerDown);

    fireEvent.pointerUp(trackArea, { pointerId: 1, clientX: 240, clientY: 24 });
    const state = selectEditorState(store.getState());
    expect(state.selection.selectedItemIds).toEqual(["tl-beach"]);
    expect(findItem(store, "tl-beach")).toMatchObject({ timelineStart: 2 });
  });

  it("does not mark direct SVG overlay elements as missing in the timeline", () => {
    renderWithEditorStore(<TimelinePanel />, { document: overlayElementDocument() });
    expect(screen.getByRole("button", { name: /overlay timeline item, Arrow/i })).not.toHaveTextContent("Missing");
  });

  it("reorders tracks by dragging a track header onto another track", () => {
    const base = createMockVideoProjectDocument("track-reorder", "Track Reorder");
    const document: VideoProjectDocument = {
      ...base,
      tracks: [
        base.tracks[0],
        { ...base.tracks[0], id: "v2", label: "V2", items: [] },
        ...base.tracks.slice(1),
      ],
    };
    const { store } = renderWithEditorStore(<TimelinePanel />, { document });
    const v1Header = screen.getByText("V1").closest('[draggable="true"]') as HTMLElement;
    const v2Header = screen.getByText("V2").closest('[draggable="true"]') as HTMLElement;
    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? "",
    };

    fireEvent.dragStart(v2Header, { dataTransfer });
    fireEvent.dragOver(v1Header, { dataTransfer });
    fireEvent.drop(v1Header, { dataTransfer });

    expect(selectEditorState(store.getState()).document?.tracks.slice(0, 2).map((track) => track.id)).toEqual(["v2", "v1"]);
  });

  it("triggers manual sync with Ctrl+S or Cmd+S", () => {
    const onSync = vi.fn();
    renderWithEditorStore(<KeyboardShortcutHarness onSync={onSync} />);

    fireEvent.keyDown(screen.getByTestId("shortcut-root"), { key: "s", ctrlKey: true });
    fireEvent.keyDown(screen.getByTestId("shortcut-root"), { key: "s", metaKey: true });

    expect(onSync).toHaveBeenCalledTimes(2);
  });
});

describe("PreviewPanel direct visual manipulation", () => {
  it("selects a vertical visual and mirrors timeline selection with an outline", () => {
    installMediaElementMocks();
    const document = directManipulationDocument();
    document.media["clip-beach"] = { ...document.media["clip-beach"], width: 1080, height: 1920 };
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });
    const visual = container.querySelector('[data-konva-name="preview-visual-tl-beach"]') as HTMLElement;

    fireEvent.pointerDown(visual, { clientX: 480, clientY: 270, pointerId: 1, pointerType: "mouse", button: 0 });
    expect(selectEditorState(store.getState()).selection.activeItemId).toBe("tl-beach");
    expect(container.querySelector('[data-konva-name="preview-selection-tl-beach"]')).not.toBeNull();

    act(() => {
      store.dispatch(timelineItemsSelected({ itemIds: ["tl-beach"], activeItemId: "tl-beach" }));
    });
    expect(container.querySelector('[data-konva-name="preview-selection-tl-beach"]')).not.toBeNull();
  });

  it("selects on click without sticking when Konva misses the pointer release", () => {
    installMediaElementMocks();
    const setPointerCapture = vi.mocked(HTMLElement.prototype.setPointerCapture);
    setPointerCapture.mockClear();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document: directManipulationDocument() });
    const visual = container.querySelector('[data-konva-name="preview-visual-tl-beach"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;

    fireEvent.pointerDown(visual, { clientX: 100, clientY: 100, pointerId: 31, pointerType: "mouse", button: 0 });
    expect(selectEditorState(store.getState()).selection.activeItemId).toBe("tl-beach");
    expect(setPointerCapture).not.toHaveBeenCalled();

    fireEvent.mouseUp(window, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { clientX: 400, clientY: 400, pointerId: 31, pointerType: "mouse", buttons: 0 });
    fireEvent.pointerUp(stage, { clientX: 400, clientY: 400, pointerId: 31, pointerType: "mouse" });

    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(0);
  });

  it("previews freely and commits one project-space transform operation on pointer release", () => {
    installMediaElementMocks();
    const setPointerCapture = vi.mocked(HTMLElement.prototype.setPointerCapture);
    setPointerCapture.mockClear();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document: directManipulationDocument() });
    const visual = container.querySelector('[data-konva-name="preview-visual-tl-beach"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;

    fireEvent.pointerDown(visual, { clientX: 100, clientY: 100, pointerId: 2, pointerType: "mouse", button: 0 });
    expect(setPointerCapture).not.toHaveBeenCalled();
    fireEvent.pointerMove(stage, { clientX: 196, clientY: 370, pointerId: 2, pointerType: "mouse", buttons: 1 });
    expect(setPointerCapture).not.toHaveBeenCalled();
    fireEvent.pointerMove(stage, { clientX: 580, clientY: 640, pointerId: 2, pointerType: "mouse", buttons: 1 });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });

    fireEvent.pointerUp(stage, { clientX: 580, clientY: 640, pointerId: 2, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 960, y: 1080 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);
    expect(selectEditorState(store.getState()).lastAppliedOperationIds).toHaveLength(1);
  });

  it("commits overlay element drags on window pointer release and preserves them across rerenders", () => {
    installMediaElementMocks();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, {
      document: overlayElementDocument(),
      selectedItemIds: ["element-arrow"],
    });
    const visual = container.querySelector('[data-konva-name="preview-visual-element-arrow"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;

    fireEvent.pointerDown(visual, { clientX: 100, clientY: 100, pointerId: 42, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 196, clientY: 370, pointerId: 42, pointerType: "mouse", buttons: 1 });
    expect(findItem(store, "element-arrow")).toMatchObject({ transform: { x: 0, y: 0 } });

    fireEvent.pointerUp(stage, { clientX: 100, clientY: 100, pointerId: 42, pointerType: "mouse" });
    expect(findItem(store, "element-arrow")).toMatchObject({ transform: { x: 192, y: 540 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);

    act(() => store.dispatch(timelineItemsSelected({ itemIds: ["tl-beach"], activeItemId: "tl-beach" })));
    act(() => store.dispatch(timelineItemsSelected({ itemIds: ["element-arrow"], activeItemId: "element-arrow" })));
    act(() => store.dispatch(currentTimeChanged(1)));
    expect(findItem(store, "element-arrow")).toMatchObject({ transform: { x: 192, y: 540 } });

    act(() => store.dispatch(videoUndoRequested()));
    expect(findItem(store, "element-arrow")).toMatchObject({ transform: { x: 0, y: 0 } });
    act(() => store.dispatch(videoRedoRequested()));
    expect(findItem(store, "element-arrow")).toMatchObject({ transform: { x: 192, y: 540 } });
  });

  it("cancels without document mutation and blocks movement on locked tracks", () => {
    installMediaElementMocks();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document: directManipulationDocument() });
    const visual = container.querySelector('[data-konva-name="preview-visual-tl-beach"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;
    fireEvent.pointerDown(visual, { clientX: 100, clientY: 100, pointerId: 3, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 400, clientY: 400, pointerId: 3, pointerType: "mouse", buttons: 1 });
    fireEvent.pointerCancel(stage, { clientX: 400, clientY: 400, pointerId: 3, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(0);

    fireEvent.pointerDown(visual, { clientX: 100, clientY: 100, pointerId: 6, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 500, clientY: 400, pointerId: 6, pointerType: "mouse", buttons: 1 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(stage, { clientX: 500, clientY: 400, pointerId: 6, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(0);

    const locked = directManipulationDocument();
    locked.tracks = locked.tracks.map((track) => track.id === "v1" ? { ...track, locked: true } : track);
    const lockedRender = renderWithEditorStore(<PreviewPanel />, { document: locked });
    const lockedVisual = lockedRender.container.querySelector('[data-konva-name="preview-visual-tl-beach"]') as HTMLElement;
    const lockedStage = lockedRender.container.querySelector("[data-konva-stage] > div") as HTMLElement;
    fireEvent.pointerDown(lockedVisual, { clientX: 100, clientY: 100, pointerId: 4, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(lockedStage, { clientX: 400, clientY: 400, pointerId: 4, pointerType: "mouse", buttons: 1 });
    fireEvent.pointerUp(lockedStage, { clientX: 400, clientY: 400, pointerId: 4, pointerType: "mouse" });
    expect(selectEditorState(lockedRender.store.getState()).selection.activeItemId).toBe("tl-beach");
    expect(findItem(lockedRender.store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });
  });

  it("renders overlapping videos bottom-to-top without marking lower layers unavailable", async () => {
    const media = installMediaElementMocks();
    const document = overlappingVisualDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });
    const visuals = Array.from(container.querySelectorAll('[data-konva-name^="preview-visual-"]')) as HTMLElement[];
    expect(visuals.map((node) => node.dataset.konvaName)).toEqual([
      "preview-visual-tl-beach",
      "preview-visual-tl-city",
    ]);
    await waitFor(() => {
      expect(screen.queryByText(/Media unavailable: Beach Ready/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Media unavailable: City Walk/i)).not.toBeInTheDocument();
    });
    act(() => {
      store.dispatch(playbackToggled());
    });
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(2));
    for (const video of playCallsFor(media.play, "VIDEO") as HTMLVideoElement[]) {
      expect(video.muted).toBe(false);
      expect(video.volume).toBe(1);
    }
    fireEvent.pointerDown(visuals.at(-1)!, { clientX: 480, clientY: 270, pointerId: 5, pointerType: "mouse", button: 0 });
    expect(selectEditorState(store.getState()).selection.activeItemId).toBe("tl-city");
  });

  it("resizes from the opposite corner with one undoable operation and supports Shift-independent scaling", () => {
    installMediaElementMocks();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, {
      document: directManipulationDocument(),
      selectedItemIds: ["tl-beach"],
    });
    const handle = container.querySelector('[data-konva-name="preview-resize-se-tl-beach"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 953, clientY: 533, pointerId: 7, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 713, clientY: 398, pointerId: 7, pointerType: "mouse", buttons: 1 });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { scaleX: 1, scaleY: 1 } });
    fireEvent.pointerUp(stage, { clientX: 713, clientY: 398, pointerId: 7, pointerType: "mouse" });

    expect(findItem(store, "tl-beach")).toMatchObject({
      transform: { x: -240, y: -135, scaleX: 0.75, scaleY: 0.75 },
    });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);
    act(() => store.dispatch(videoUndoRequested()));
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 } });
    act(() => store.dispatch(videoRedoRequested()));
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: -240, y: -135, scaleX: 0.75, scaleY: 0.75 } });

    act(() => store.dispatch(videoUndoRequested()));
    const nextHandle = container.querySelector('[data-konva-name="preview-resize-se-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(nextHandle, { clientX: 953, clientY: 533, pointerId: 8, pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(stage, { clientX: 473, clientY: 398, pointerId: 8, pointerType: "mouse", shiftKey: true });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { scaleX: 0.5, scaleY: 0.75 } });
  });

  it("rotates freely, snaps with Shift, and excludes locked or multi-selected visuals", () => {
    installMediaElementMocks();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, {
      document: directManipulationDocument(),
      selectedItemIds: ["tl-beach"],
    });
    const rotationHandle = container.querySelector('[data-konva-name="preview-rotate-tl-beach"]') as HTMLElement;
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;
    fireEvent.pointerDown(rotationHandle, { clientX: 480, clientY: 7, pointerId: 9, pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(stage, { clientX: 778, clientY: 305, pointerId: 9, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { rotation: 90 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);

    act(() => store.dispatch(videoUndoRequested()));
    const snappedHandle = container.querySelector('[data-konva-name="preview-rotate-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(snappedHandle, { clientX: 480, clientY: 7, pointerId: 10, pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(stage, { clientX: 768, clientY: 228, pointerId: 10, pointerType: "mouse", shiftKey: true });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { rotation: 75 } });

    act(() => {
      store.dispatch(videoUndoRequested());
    });
    const cancelledHandle = container.querySelector('[data-konva-name="preview-rotate-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(cancelledHandle, { clientX: 480, clientY: 7, pointerId: 11, pointerType: "mouse", button: 0 });
    act(() => store.dispatch(timelineItemsSelected({ itemIds: ["tl-beach", "tl-city"], activeItemId: "tl-beach" })));
    fireEvent.pointerUp(stage, { clientX: 778, clientY: 305, pointerId: 11, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { rotation: 0 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(0);
    expect(container.querySelector('[data-konva-name="preview-rotate-tl-beach"]')).toBeNull();

    cleanup();
    const locked = directManipulationDocument();
    locked.tracks = locked.tracks.map((track) => track.id === "v1" ? { ...track, locked: true } : track);
    const lockedRender = renderWithEditorStore(<PreviewPanel />, { document: locked, selectedItemIds: ["tl-beach"] });
    expect(lockedRender.container.querySelector('[data-konva-name="preview-selection-tl-beach"]')).toBeNull();
  });

  it("activates crop mode from the inspector, previews locally, and commits one edge operation", () => {
    installMediaElementMocks();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, {
      document: directManipulationDocument(),
      selectedItemIds: ["tl-beach"],
    });
    act(() => store.dispatch(activeInspectorSectionChanged("crop")));
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;
    const handle = container.querySelector('[data-konva-name="preview-crop-right-tl-beach"]') as HTMLElement;
    expect(handle).not.toBeNull();
    expect(container.querySelector('[data-konva-name="preview-selection-tl-beach"]')).toBeNull();

    fireEvent.pointerDown(handle, { clientX: 951, clientY: 270, pointerId: 21, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 711, clientY: 270, pointerId: 21, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { right: 0 }, transform: { x: 0 } });
    fireEvent.pointerUp(stage, { clientX: 711, clientY: 270, pointerId: 21, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { right: 0.25 }, transform: { x: -240, scaleX: 1, scaleY: 1 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);
    expect(selectEditorState(store.getState()).lastAppliedOperationIds).toHaveLength(1);
  });

  it("pans the source behind a fixed frame and cancels crop gestures on Escape or section changes", () => {
    installMediaElementMocks();
    const document = directManipulationDocument();
    document.tracks = document.tracks.map((track) => track.id === "v1" ? {
      ...track,
      items: track.items.map((item) => item.id === "tl-beach" && item.type === "video"
        ? { ...item, crop: { top: 0, right: 0.2, bottom: 0, left: 0.2 } }
        : item),
    } : track);
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document, selectedItemIds: ["tl-beach"] });
    act(() => store.dispatch(activeInspectorSectionChanged("crop")));
    const stage = container.querySelector("[data-konva-stage] > div") as HTMLElement;
    const pan = container.querySelector('[data-konva-name="preview-crop-pan-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(pan, { clientX: 480, clientY: 270, pointerId: 22, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 576, clientY: 270, pointerId: 22, pointerType: "mouse" });
    fireEvent.pointerUp(stage, { clientX: 576, clientY: 270, pointerId: 22, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({
      crop: { left: 0.1, right: 0.3 },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
    });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);

    act(() => store.dispatch(videoUndoRequested()));
    const nextPan = container.querySelector('[data-konva-name="preview-crop-pan-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(nextPan, { clientX: 480, clientY: 270, pointerId: 23, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 576, clientY: 270, pointerId: 23, pointerType: "mouse" });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(stage, { clientX: 576, clientY: 270, pointerId: 23, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { left: 0.2, right: 0.2 } });
    expect(selectEditorState(store.getState()).ui.activeInspectorSection).toBe("crop");

    const finalPan = container.querySelector('[data-konva-name="preview-crop-pan-tl-beach"]') as HTMLElement;
    fireEvent.pointerDown(finalPan, { clientX: 480, clientY: 270, pointerId: 24, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(stage, { clientX: 576, clientY: 270, pointerId: 24, pointerType: "mouse" });
    act(() => store.dispatch(activeInspectorSectionChanged("transform")));
    fireEvent.pointerUp(stage, { clientX: 576, clientY: 270, pointerId: 24, pointerType: "mouse" });
    expect(findItem(store, "tl-beach")).toMatchObject({ crop: { left: 0.2, right: 0.2 } });

    act(() => store.dispatch(activeInspectorSectionChanged("crop")));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(selectEditorState(store.getState()).ui.activeInspectorSection).toBe("transform");
  });
});

describe("Visual position keyboard shortcuts", () => {
  it("moves by project pixels, ignores editable controls, and supports exact undo/redo", () => {
    const { store } = renderWithEditorStore(<KeyboardShortcutHarness onSync={() => undefined} />, {
      document: directManipulationDocument(),
      selectedItemIds: ["tl-beach"],
    });
    const root = screen.getByTestId("shortcut-root");
    fireEvent.keyDown(root, { key: "ArrowRight" });
    fireEvent.keyDown(root, { key: "ArrowDown", shiftKey: true });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 1, y: 10 } });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(2);

    const input = screen.getByLabelText("Shortcut test input");
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 1, y: 10 } });

    act(() => {
      store.dispatch(videoUndoRequested());
      store.dispatch(videoUndoRequested());
    });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 0, y: 0 } });
    act(() => {
      store.dispatch(videoRedoRequested());
      store.dispatch(videoRedoRequested());
    });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 1, y: 10 } });

    act(() => {
      store.dispatch(activeToolChanged("split"));
    });
    fireEvent.keyDown(root, { key: "ArrowUp" });
    expect(findItem(store, "tl-beach")).toMatchObject({ transform: { x: 1, y: 10 } });
  });
});

describe("PreviewPanel media sync", () => {
  it("crosses a same-track video overlap without loading another decoder", async () => {
    const media = installMediaElementMocks();
    const document = overlappingSameTrackVideoDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    await waitFor(() => expect(videoWithSource(container, "clip-beach")).not.toBeNull());
    await waitFor(() => expect(videoWithSource(container, "clip-city")).not.toBeNull());
    act(() => {
      store.dispatch(playbackToggled());
    });
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));
    media.load.mockClear();
    media.play.mockClear();

    act(() => {
      store.dispatch(currentTimeChanged(2.1));
    });

    await waitFor(() => expect(container.querySelectorAll('[data-konva-name^="preview-visual-"]')).toHaveLength(2));
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(2));
    expect(playCallsFor(media.play, "VIDEO").map((video) => (video as HTMLVideoElement).src)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("clip-beach"),
        expect.stringContaining("clip-city"),
      ]),
    );
    expect(media.load).not.toHaveBeenCalled();
    expect(screen.queryByText(/Media unavailable/i)).not.toBeInTheDocument();
  });

  it("does not let a stale video frame reset an external timestamp seek", async () => {
    const media = installMediaElementMocks({ deferSeeks: true });
    const raf = installManualRaf();
    const base = withObjectUrls(createMockVideoProjectDocument("timestamp-seek", "Timestamp Seek"));
    const document = {
      ...base,
      tracks: base.tracks.map((track) => track.kind === "audio" ? { ...track, hidden: true } : track),
    };
    const { store } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(2));
      store.dispatch(playbackToggled());
    });
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));
    media.currentTimeSet.mockClear();

    const timecode = screen.getByLabelText("Current timecode");
    fireEvent.focus(timecode);
    fireEvent.change(timecode, { target: { value: "00:00:05:00" } });
    fireEvent.keyDown(timecode, { key: "Enter" });
    fireEvent.blur(timecode);
    await waitFor(() => expect(media.currentTimeSet).toHaveBeenCalled());
    act(() => {
      raf.runNext(performance.now() + 16);
    });

    expect(selectEditorState(store.getState()).playback.currentTime).toBe(5);
  });

  it("keeps a timeline-ruler seek when an old video clock callback fires", async () => {
    const media = installMediaElementMocks({ deferSeeks: true });
    const raf = installManualRaf();
    const base = directManipulationDocument();
    const document = {
      ...base,
      tracks: base.tracks.map((track) => track.kind === "audio" ? { ...track, hidden: true } : track),
    };
    const { store } = renderWithEditorStore(
      <>
        <PreviewPanel />
        <TimelinePanel />
      </>,
      { document },
    );

    act(() => store.dispatch(playbackToggled()));
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));

    fireEvent.pointerDown(screen.getByLabelText("Timeline ruler"), {
      button: 0,
      clientX: 240,
      pointerId: 44,
      pointerType: "mouse",
    });
    const soughtTime = selectEditorState(store.getState()).playback.currentTime;
    expect(soughtTime).toBeGreaterThan(0);

    act(() => raf.runNext(performance.now() + 16));
    expect(selectEditorState(store.getState()).playback.currentTime).toBe(soughtTime);
  });

  it("redraws the paused video frame after a hidden track becomes visible again", async () => {
    const media = installMediaElementMocks();
    const document = withObjectUrls(createMockVideoProjectDocument("visibility-refresh", "Visibility Refresh"));
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });
    const video = container.querySelector("video")!;

    act(() => {
      store.dispatch(currentTimeChanged(3));
    });
    await waitFor(() => expect(video.getAttribute("src")).toContain("clip-beach"));

    act(() => {
      store.dispatch(videoOperationApplied(updateTrackVisibilityOperation(true, "hide")));
    });
    await waitFor(() => expect(video.getAttribute("src")).toBeNull());

    mediaLayerBatchDrawMock.mockClear();
    act(() => {
      store.dispatch(videoOperationApplied(updateTrackVisibilityOperation(false, "show")));
    });
    await waitFor(() => expect(video.getAttribute("src")).toContain("clip-beach"));
    fireEvent(video, new Event("loadeddata"));

    expect(mediaLayerBatchDrawMock).toHaveBeenCalled();
    expect(media.play).not.toHaveBeenCalled();
  });

  it("does not replay or reseek video when Redux time advances with the media clock", async () => {
    const media = installMediaElementMocks();
    window.requestAnimationFrame = vi.fn(() => 1);
    window.cancelAnimationFrame = vi.fn();
    const base = withObjectUrls(createMockVideoProjectDocument("video-sync", "Video Sync"));
    const document = {
      ...base,
      tracks: base.tracks.map((track) => track.kind === "audio" ? { ...track, hidden: true } : track),
    };
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(2));
      store.dispatch(playbackToggled());
    });
    const video = container.querySelector("video")!;
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));
    await waitFor(() => expect(videoWithSource(container, "clip-city")).not.toBeNull());

    media.times.set(video, 1);
    media.currentTimeSet.mockClear();
    media.play.mockClear();

    act(() => {
      store.dispatch(currentTimeChanged(3));
    });

    expect(media.play).not.toHaveBeenCalled();
    expect(media.currentTimeSet).not.toHaveBeenCalled();
  });

  it("does not replay or reseek audio when Redux time advances with the primary audio clock", async () => {
    const media = installMediaElementMocks();
    window.requestAnimationFrame = vi.fn(() => 1);
    window.cancelAnimationFrame = vi.fn();
    const base = withObjectUrls(createMockVideoProjectDocument("audio-sync", "Audio Sync"));
    const document = {
      ...base,
      tracks: base.tracks.map((track) => track.kind === "video" ? { ...track, hidden: true } : track),
    };
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(2));
      store.dispatch(playbackToggled());
    });
    await waitFor(() => expect(media.play).toHaveBeenCalledTimes(1));

    const audio = container.querySelector("audio")!;
    media.times.set(audio, 1);
    media.currentTimeSet.mockClear();
    media.play.mockClear();

    act(() => {
      store.dispatch(currentTimeChanged(3));
    });

    expect(media.play).not.toHaveBeenCalled();
    expect(media.currentTimeSet).not.toHaveBeenCalled();
  });

  it("hands off from a split video clip to fallback playback through a gap", async () => {
    const media = installMediaElementMocks();
    const raf = installManualRaf();
    const document = splitGapVideoDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(0));
      store.dispatch(playbackToggled());
    });
    const video = container.querySelector("video")!;
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));

    media.times.set(video, 2.05);
    act(() => {
      raf.runNext(performance.now() + 100);
    });

    const handoffPlayback = selectEditorState(store.getState()).playback;
    expect(handoffPlayback.playing).toBe(true);
    expect(handoffPlayback.currentTime).toBeGreaterThan(2);
    expect(handoffPlayback.currentTime).toBeLessThan(2.02);

    act(() => {
      raf.runNext(performance.now() + 1200);
    });
    expect(selectEditorState(store.getState()).playback.currentTime).toBeGreaterThan(2);

    act(() => {
      store.dispatch(currentTimeChanged(6));
    });
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(2));
  });

  it("continues into an adjacent video after an interrupted source-swap play request", async () => {
    const media = installMediaElementMocks();
    const raf = installManualRaf();
    media.play
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException("The play request was interrupted.", "AbortError"))
      .mockResolvedValue(undefined);
    const document = adjacentVideoDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(0));
      store.dispatch(playbackToggled());
    });
    const video = container.querySelector("video")!;
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));

    media.times.set(video, 2.05);
    act(() => {
      raf.runNext(performance.now() + 100);
    });

    await waitFor(() => expect(videoWithSource(container, "clip-city")).not.toBeNull());
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(2));
    fireEvent(videoWithSource(container, "clip-city")!, new Event("canplay"));
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(3));

    const playback = selectEditorState(store.getState()).playback;
    expect(playback.playing).toBe(true);
    expect(playback.currentTime).toBeGreaterThanOrEqual(2);
  });

  it("hands off to an adjacent video when the browser ends before another frame callback", async () => {
    const media = installMediaElementMocks();
    const document = adjacentVideoDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(0));
      store.dispatch(playbackToggled());
    });
    const video = container.querySelector("video")!;
    await waitFor(() => expect(video.getAttribute("src")).toContain("clip-beach"));
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(1));
    await waitFor(() => expect(videoWithSource(container, "clip-city")).not.toBeNull());

    fireEvent(video, new Event("ended"));

    await waitFor(() => expect(videoWithSource(container, "clip-city")).not.toBeNull());
    await waitFor(() => expect(playCallsFor(media.play, "VIDEO")).toHaveLength(2));
    const playback = selectEditorState(store.getState()).playback;
    expect(playback.playing).toBe(true);
    expect(playback.currentTime).toBeGreaterThanOrEqual(2);
  });

  it("hands off from a clipped primary audio item to fallback playback through a silent gap", async () => {
    const media = installMediaElementMocks();
    const raf = installManualRaf();
    const document = splitGapAudioDocument();
    const { store, container } = renderWithEditorStore(<PreviewPanel />, { document });

    act(() => {
      store.dispatch(currentTimeChanged(0));
      store.dispatch(playbackToggled());
    });
    const audio = container.querySelector("audio")!;
    await waitFor(() => expect(playCallsFor(media.play, "AUDIO")).toHaveLength(1));

    media.times.set(audio, 2.05);
    act(() => {
      raf.runNext(performance.now() + 100);
    });

    const handoffPlayback = selectEditorState(store.getState()).playback;
    expect(handoffPlayback.playing).toBe(true);
    expect(handoffPlayback.currentTime).toBeGreaterThan(2);
    expect(handoffPlayback.currentTime).toBeLessThan(2.02);

    act(() => {
      raf.runNext(performance.now() + 1200);
    });
    expect(selectEditorState(store.getState()).playback.currentTime).toBeGreaterThan(2);
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

function withObjectUrls(document: ReturnType<typeof createMockVideoProjectDocument>) {
  return {
    ...document,
    media: Object.fromEntries(
      Object.entries(document.media).map(([id, media]) => [
        id,
        {
          ...media,
          objectUrls: {
            proxy: `/bff/media/${id}/object/proxy?v=${id}`,
          },
        },
      ]),
    ),
  };
}

function directManipulationDocument(): VideoProjectDocument {
  const base = withObjectUrls(createMockVideoProjectDocument("direct-manipulation", "Direct Manipulation"));
  return {
    ...base,
    transitions: [],
    effects: [],
    tracks: base.tracks.map((track) => track.id === "v1" ? {
      ...track,
      items: track.items.map((item) => item.id === "tl-beach" ? { ...item, timelineStart: 0 } : item),
    } : track),
  };
}

function overlayElementDocument(): VideoProjectDocument {
  const base = directManipulationDocument();
  const svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,40 L70,40 L70,20 L95,50 L70,80 L70,60 L10,60 Z" fill="%23ff2d2d"/></svg>`;
  return {
    ...base,
    media: {
      ...base.media,
      "element-arrow-media": {
        id: "element-arrow-media",
        kind: "image",
        name: "Arrow",
        width: 100,
        height: 100,
        sourceUrl: svgUrl,
        objectUrls: { raw: svgUrl },
      },
    },
    tracks: [
      ...base.tracks,
      {
        id: "element-track",
        kind: "overlay",
        label: "Element",
        locked: false,
        hidden: false,
        muted: false,
        items: [{
          id: "element-arrow",
          type: "overlay",
          mediaId: "element-arrow-media",
          timelineStart: 0,
          duration: 5,
          transform: { x: 0, y: 0, scaleX: 0.16, scaleY: 0.16, rotation: 0 },
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          opacity: 1,
          layerOrder: 8,
        }],
      },
    ],
  };
}

function transformPresetDocument(): VideoProjectDocument {
  const document = directManipulationDocument();
  document.media["clip-beach"] = {
    ...document.media["clip-beach"],
    width: 1080,
    height: 1920,
  };
  document.tracks = document.tracks.map((track) => track.id === "v1" ? {
    ...track,
    items: track.items.map((item) => item.id === "tl-beach" && item.type === "video" ? {
      ...item,
      transform: { x: 240, y: -120, scaleX: 2, scaleY: 0.75, rotation: 0 },
      crop: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 },
      opacity: 0.65,
      advanced: {
        transform: {
          x: {
            value: 240,
            keyframes: [
              { id: "preset-x-start", time: 0, value: 240 },
              { id: "preset-x-end", time: 2, value: 320 },
            ],
          },
        },
      },
    } : item),
  } : track);
  return document;
}

function imagePresetDocument(): VideoProjectDocument {
  const document = directManipulationDocument();
  return {
    ...document,
    media: {
      ...document.media,
      "image-preset-media": {
        id: "image-preset-media",
        kind: "image",
        name: "vertical-poster.png",
        width: 1080,
        height: 1920,
        objectUrls: { proxy: "/bff/media/image-preset-media/object/proxy?v=preset" },
      },
    },
    tracks: [
      ...document.tracks,
      {
        id: "image-presets",
        kind: "overlay",
        label: "Images",
        locked: false,
        hidden: false,
        muted: false,
        items: [{
          id: "image-preset",
          type: "image",
          mediaId: "image-preset-media",
          timelineStart: 0,
          duration: 10,
          transform: { x: 120, y: 80, scaleX: 1.4, scaleY: 0.9, rotation: 0 },
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          opacity: 0.8,
          layerOrder: 7,
        }],
      },
    ],
  };
}

function overlappingVisualDocument(): VideoProjectDocument {
  const base = directManipulationDocument();
  const videoTrack = base.tracks.find((track) => track.id === "v1")!;
  const beach = videoTrack.items.find((item) => item.id === "tl-beach")!;
  const city = videoTrack.items.find((item) => item.id === "tl-city")!;
  return {
    ...base,
    tracks: [
      {
        ...videoTrack,
        id: "v2",
        label: "V2",
        items: [{ ...city, timelineStart: 0, duration: beach.duration }],
      },
      { ...videoTrack, items: [beach] },
      ...base.tracks.filter((track) => track.id !== "v1"),
    ],
  };
}

function updateTrackVisibilityOperation(hidden: boolean, suffix: string) {
  return {
    id: `visibility-${suffix}`,
    source: "manual" as const,
    timestamp: `2026-07-11T00:00:0${hidden ? 1 : 2}.000Z`,
    label: hidden ? "Hide video track" : "Show video track",
    affectedEntityIds: ["v1"],
    type: "updateTrack" as const,
    trackId: "v1",
    hidden,
  };
}

function splitGapVideoDocument(): VideoProjectDocument {
  const base = withObjectUrls(createMockVideoProjectDocument("video-gap", "Video Gap"));
  const videoTrack = base.tracks.find((track) => track.kind === "video");
  const clip = videoTrack?.items.find((item) => item.id === "tl-beach");
  if (!videoTrack || !clip || clip.type !== "video") {
    throw new Error("Mock video clip fixture is missing.");
  }

  return {
    ...base,
    transitions: [],
    effects: [],
    tracks: [
      {
        ...videoTrack,
        items: [
          {
            ...clip,
            id: "tl-beach-a",
            timelineStart: 0,
            duration: 2,
            sourceIn: 0,
            sourceOut: 2,
          },
          {
            ...clip,
            id: "tl-beach-b",
            timelineStart: 6,
            duration: 2,
            sourceIn: 2,
            sourceOut: 4,
          },
        ],
      },
    ],
  };
}

function adjacentVideoDocument(): VideoProjectDocument {
  const base = withObjectUrls(createMockVideoProjectDocument("video-adjacent", "Adjacent Videos"));
  const videoTrack = base.tracks.find((track) => track.kind === "video");
  const first = videoTrack?.items.find((item) => item.id === "tl-beach");
  const second = videoTrack?.items.find((item) => item.id === "tl-city");
  if (!videoTrack || !first || first.type !== "video" || !second || second.type !== "video") {
    throw new Error("Mock adjacent video fixtures are missing.");
  }

  return {
    ...base,
    transitions: [],
    effects: [],
    tracks: [
      {
        ...videoTrack,
        items: [
          { ...first, timelineStart: 0, duration: 2, sourceIn: 0, sourceOut: 2 },
          { ...second, timelineStart: 2, duration: 2, sourceIn: 0, sourceOut: 2 },
        ],
      },
      ...base.tracks.filter((track) => track.id !== videoTrack.id && track.kind !== "audio"),
    ],
  };
}

function overlappingSameTrackVideoDocument(): VideoProjectDocument {
  const document = adjacentVideoDocument();
  const videoTrack = document.tracks.find((track) => track.kind === "video");
  if (!videoTrack || videoTrack.items.length < 2) throw new Error("Expected adjacent video fixtures.");
  const [first, second] = videoTrack.items;
  return {
    ...document,
    tracks: document.tracks.map((track) => track.id === videoTrack.id ? {
      ...track,
      items: [
        { ...first, timelineStart: 0, duration: 4, sourceIn: 0, sourceOut: 4 },
        { ...second, timelineStart: 2, duration: 2, sourceIn: 0, sourceOut: 2 },
      ],
    } : track),
  };
}

function splitGapAudioDocument(): VideoProjectDocument {
  const base = withObjectUrls(createMockVideoProjectDocument("audio-gap", "Audio Gap"));
  const audioTrack = base.tracks.find((track) => track.kind === "audio");
  const audio = audioTrack?.items.find((item) => item.id === "tl-audio-main");
  if (!audioTrack || !audio || audio.type !== "audio") {
    throw new Error("Mock audio item fixture is missing.");
  }

  return {
    ...base,
    transitions: [],
    effects: [],
    tracks: [
      {
        ...audioTrack,
        items: [
          {
            ...audio,
            id: "tl-audio-main-a",
            timelineStart: 0,
            duration: 2,
            sourceIn: 0,
            sourceOut: 2,
          },
          {
            ...audio,
            id: "tl-audio-main-b",
            timelineStart: 6,
            duration: 2,
            sourceIn: 2,
            sourceOut: 4,
          },
        ],
      },
    ],
  };
}

function installMediaElementMocks({ deferSeeks = false }: { deferSeeks?: boolean } = {}) {
  const times = new WeakMap<HTMLMediaElement, number>();
  const currentTimeSet = vi.fn();
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      return times.get(this) ?? 0;
    },
    set(value: number) {
      currentTimeSet(value);
      if (!deferSeeks) times.set(this, value);
    },
  });

  return { times, currentTimeSet, play, load };
}

function playCallsFor(play: { mock: { contexts: unknown[] } }, tagName: string) {
  return play.mock.contexts.filter((element) => element instanceof HTMLElement && element.tagName === tagName);
}

function videoWithSource(container: HTMLElement, sourceFragment: string): HTMLVideoElement | null {
  return Array.from(container.querySelectorAll("video"))
    .find((video) => video.getAttribute("src")?.includes(sourceFragment)) ?? null;
}

function KeyboardShortcutHarness({ onSync }: { onSync: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useVideoKeyboardShortcuts(ref, { onSave: onSync });
  return (
    <div ref={ref} data-testid="shortcut-root" tabIndex={0}>
      <input aria-label="Shortcut test input" />
    </div>
  );
}

function installManualRaf() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  window.cancelAnimationFrame = vi.fn((id: number) => {
    callbacks.delete(id);
  });

  return {
    runNext(now: number) {
      const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!next) {
        throw new Error("Expected a queued animation frame callback.");
      }
      const [id, callback] = next;
      callbacks.delete(id);
      callback(now);
    },
  };
}
