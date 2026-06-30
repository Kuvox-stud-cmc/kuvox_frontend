import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { MediaKind, type MediaDto, type Workspace } from "~/lib/api";
import { ApiError, createMedia, listMedia, softDelete } from "~/lib/api.server";
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
      const page = await listMedia(accessToken, studioWs(studioId), reqLog);
      return {
        media: page.items.filter((item) => item.kind === kind),
        error: null as string | null,
      };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't load Studio media.";
      reqLog.error({ err: error, studioId, kind }, "failed to load Studio media kind");
      return { media: [] as MediaDto[], error: message };
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
  const ws = studioWs(studioId);

  try {
    if (intent === "create") {
      const filename = String(formData.get("filename") ?? "").trim();
      const kind = Number(formData.get("kind") ?? MediaKind.Video);
      if (!filename) {
        return { error: "Enter a filename to import." };
      }
      await createMedia(
        accessToken,
        ws,
        {
          kind,
          filename,
          storageKey: `studio/${studioId}/${crypto.randomUUID()}/${filename}`,
          sizeBytes: 1,
        },
        reqLog,
      );
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent, studioId }, "Studio media action failed");
    return { error: message };
  }
}
