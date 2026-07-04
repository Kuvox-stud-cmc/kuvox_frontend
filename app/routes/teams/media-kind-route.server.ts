import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { canWriteStudioContent, type MediaDto, type Workspace } from "~/lib/api";
import { albumsApi, ApiError, listMedia, listMyStudios, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export function createTeamMediaKindLoader(kind: number) {
  return async function loader({ request, params }: LoaderFunctionArgs) {
    const log = createRequestLogger(request);
    const user = await requireUser(request, log);
    const reqLog = withUser(log, user);
    const session = await getSession(request);
    const accessToken = session.get("accessToken");
    const studioId = String(params.studioId ?? "");

    if (!accessToken) {
      return { media: [] as MediaDto[], error: "Your session expired. Please sign in again." };
    }

    try {
      const [page, studios] = await Promise.all([
        listMedia(accessToken, studioWs(studioId), reqLog),
        listMyStudios(accessToken, reqLog),
      ]);
      const role = studios.find((studio) => studio.id === studioId)?.role;
      return {
        media: page.items.filter((item) => item.kind === kind),
        error: null as string | null,
        canWrite: role != null ? canWriteStudioContent(role) : false,
      };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't load Studio media.";
      reqLog.error({ err: error, studioId, kind }, "failed to load Studio media kind");
      return { media: [] as MediaDto[], error: message, canWrite: false };
    }
  };
}

export async function teamMediaKindAction({ request, params }: ActionFunctionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = String(params.studioId ?? "");

  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "assign-audio-category") {
      const mediaId = String(formData.get("mediaId") ?? "");
      const category = String(formData.get("category") ?? "");
      if (!mediaId) {
        return { error: "Missing uploaded audio file." };
      }
      if (!category) {
        return { error: "Choose an audio type." };
      }

      await albumsApi.assignAudioCategory(accessToken, category, [mediaId], studioWs(studioId), reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent, studioId }, "Studio media action failed");
    return { error: message };
  }
}
