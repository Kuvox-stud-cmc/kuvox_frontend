import type { SaveImageCompositionRequest } from "~/lib/api";

import {
  normalizeImageCompositionPayload,
  readImageCompositionError,
  type ServerImageComposition,
} from "./image-composition-payload";

export async function getImageCompositionFromBff(
  projectId: string,
): Promise<ServerImageComposition> {
  const response = await fetch(imageCompositionUrl(projectId));
  if (!response.ok) {
    throw new Error(await readImageCompositionError(response, "Server version could not be loaded."));
  }
  return normalizeImageCompositionPayload(await response.json());
}

export async function saveImageCompositionToBff(
  projectId: string,
  request: SaveImageCompositionRequest,
  fallback = "Image composition sync failed.",
) {
  const response = await fetch(imageCompositionUrl(projectId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (response.status === 409) {
    return {
      ok: false as const,
      conflict: true as const,
      message: await readImageCompositionError(response, "The server has a newer version."),
    };
  }

  if (!response.ok) {
    throw new Error(await readImageCompositionError(response, fallback));
  }

  return {
    ok: true as const,
    conflict: false as const,
    composition: normalizeImageCompositionPayload(await response.json()),
  };
}

function imageCompositionUrl(projectId: string) {
  return `/bff/projects/${encodeURIComponent(projectId)}/image-composition`;
}
