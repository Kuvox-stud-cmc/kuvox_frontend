import { describe, expect, it } from "vitest";

import { normalizeProjectEditorBootstrap } from "./editor-bootstrap";

describe("editor bootstrap normalization", () => {
  it("normalizes video timeline payloads and preserves project media pagination", () => {
    const normalized = normalizeProjectEditorBootstrap({
      project: { id: "project-1", kind: 0 },
      projectMedia: { items: [], page: 2, pageSize: 25, totalCount: 0, totalPages: 0 },
      videoTimeline: {
        projectId: "project-1",
        timelineId: "timeline-1",
        revisionId: "revision-1",
        revisionNumber: 4,
        documentSchemaVersion: 1,
        documentJson: videoDocument(),
        source: "manual",
        label: null,
        updatedAt: "2026-07-19T00:00:00Z",
        updatedByUserId: "user-1",
      },
      imageComposition: null,
    });

    expect(normalized.projectMedia.page).toBe(2);
    expect(normalized.videoTimeline.status).toBe("found");
    if (normalized.videoTimeline.status === "found") {
      expect(normalized.videoTimeline.timeline.revisionNumber).toBe(4);
    }
  });

  it("represents missing timelines and revision-zero image compositions", () => {
    const normalized = normalizeProjectEditorBootstrap({
      project: { id: "project-2", kind: 1 },
      projectMedia: { items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 },
      videoTimeline: null,
      imageComposition: {
        projectId: "project-2",
        documentJson: null,
        revisionNumber: 0,
        updatedAt: null,
        updatedByUserId: null,
      },
    });

    expect(normalized.videoTimeline).toEqual({ status: "not-found" });
    expect(normalized.imageComposition).toEqual({
      document: null,
      revisionNumber: 0,
      updatedAt: null,
      updatedByUserId: null,
    });
  });
});

function videoDocument() {
  return {
    schemaVersion: 1,
    projectId: "project-1",
    name: "Video",
    createdAt: "2026-07-19T00:00:00Z",
    updatedAt: "2026-07-19T00:00:00Z",
    settings: {
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      frameRate: 30,
      previewQuality: "balanced",
      defaultTransitionDuration: 0.4,
      exportPreset: "h264-1080p",
      backgroundColor: "#000000",
    },
    media: {},
    tracks: [],
    transitions: [],
    effects: [],
    history: { revision: 0, canUndo: false, canRedo: false },
  };
}
