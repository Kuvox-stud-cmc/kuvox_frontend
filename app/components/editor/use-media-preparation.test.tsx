// @vitest-environment jsdom
import { Provider } from "react-redux";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyVideoProjectDocument } from "~/lib/editor/video-document";
import { makeStore } from "~/store";
import {
  documentLoaded,
  mediaPreparationRequested,
  pendingTimelineInsertionAdded,
  selectEditorState,
} from "~/store/slices/editor-slice";

import { mediaFixture } from "./test-utils";
import { insertionPreparationRequest, useMediaPreparation } from "./use-media-preparation";

const prepareMediaResourceMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/editor/media-preparation.client", () => ({
  prepareMediaResource: prepareMediaResourceMock,
  clearPreparedMediaCache: vi.fn(),
}));

function PreparationHarness({ projectId }: { projectId: string }) {
  useMediaPreparation(projectId);
  return null;
}

describe("useMediaPreparation", () => {
  beforeEach(() => {
    prepareMediaResourceMock.mockReset();
    prepareMediaResourceMock.mockResolvedValue({ duration: 7, width: 1280, height: 720 });
  });

  it("keeps pending placement out of history and commits one item after readiness", async () => {
    const projectId = "preparation-project";
    const store = makeStore();
    store.dispatch(documentLoaded(createEmptyVideoProjectDocument({ id: projectId, name: "Preparation" })));
    const media = mediaFixture({ id: "pending-video", durationSeconds: null, width: null, height: null });
    const request = insertionPreparationRequest(media, 4);
    expect(request).not.toBeNull();
    store.dispatch(pendingTimelineInsertionAdded({
      id: "pending-1",
      projectId,
      media,
      trackId: "v1",
      timelineStart: 4,
      provisionalDuration: 3,
      resourceKey: request!.key,
      status: "queued",
      createdAt: 0,
    }));
    store.dispatch(mediaPreparationRequested(request!));

    expect(selectEditorState(store.getState()).document?.tracks[0].items).toHaveLength(0);
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(0);

    render(
      <Provider store={store}>
        <PreparationHarness projectId={projectId} />
      </Provider>,
    );

    await waitFor(() => {
      expect(selectEditorState(store.getState()).pendingTimelineInsertions).toHaveLength(0);
      expect(selectEditorState(store.getState()).document?.tracks[0].items).toHaveLength(1);
    });
    expect(selectEditorState(store.getState()).document?.media[media.id]).toMatchObject({
      duration: 7,
      width: 1280,
      height: 720,
    });
    expect(selectEditorState(store.getState()).undoStack).toHaveLength(1);
  });

  it("automatically retries one preparation failure", async () => {
    prepareMediaResourceMock.mockRejectedValueOnce(new Error("decoder warming up"));
    const projectId = "retry-project";
    const store = makeStore();
    store.dispatch(documentLoaded(createEmptyVideoProjectDocument({ id: projectId, name: "Retry" })));
    const media = mediaFixture({ id: "retry-video" });
    const request = insertionPreparationRequest(media, 0)!;
    store.dispatch(pendingTimelineInsertionAdded({
      id: "retry-pending",
      projectId,
      media,
      trackId: "v1",
      timelineStart: 0,
      provisionalDuration: 12,
      resourceKey: request.key,
      status: "queued",
      createdAt: 0,
    }));
    store.dispatch(mediaPreparationRequested(request));

    render(
      <Provider store={store}>
        <PreparationHarness projectId={projectId} />
      </Provider>,
    );

    await waitFor(() => expect(selectEditorState(store.getState()).mediaPreparationByKey[request.key]?.status).toBe("ready"));
    expect(prepareMediaResourceMock).toHaveBeenCalledTimes(2);
    expect(selectEditorState(store.getState()).mediaPreparationByKey[request.key]?.attempts).toBe(2);
  });
});
