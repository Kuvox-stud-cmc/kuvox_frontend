import type { ProjectEditorBootstrapDto } from "~/lib/api";

import { normalizeImageCompositionPayload, type ServerImageComposition } from "./image/image-composition-payload";
import { normalizeVideoTimelinePayload, type VideoTimelineLoadResult } from "./video-timeline-api.client";

export interface NormalizedProjectEditorBootstrap {
  project: ProjectEditorBootstrapDto["project"];
  projectMedia: ProjectEditorBootstrapDto["projectMedia"];
  videoTimeline: VideoTimelineLoadResult;
  imageComposition: ServerImageComposition | null;
}

export function normalizeProjectEditorBootstrap(value: unknown): NormalizedProjectEditorBootstrap {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  if (!body.project || typeof body.project !== "object") {
    throw new Error("Editor bootstrap project is missing.");
  }
  if (!body.projectMedia || typeof body.projectMedia !== "object") {
    throw new Error("Editor bootstrap project media is missing.");
  }

  return {
    project: body.project as ProjectEditorBootstrapDto["project"],
    projectMedia: body.projectMedia as ProjectEditorBootstrapDto["projectMedia"],
    videoTimeline: body.videoTimeline
      ? { status: "found", timeline: normalizeVideoTimelinePayload(body.videoTimeline) }
      : { status: "not-found" },
    imageComposition: body.imageComposition
      ? normalizeImageCompositionPayload(body.imageComposition)
      : null,
  };
}
