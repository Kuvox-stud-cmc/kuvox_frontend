import { MediaView } from "~/components/dashboard/workspace/media-view";
import { MediaKind, type MediaDto, type Workspace } from "~/lib/api";
import { ApiError, createMedia, listMedia, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

namespace Route {
  export type LoaderArgs = LoaderFunctionArgs;
  export type ActionArgs = ActionFunctionArgs;
  export type ComponentProps = {
    loaderData: Awaited<ReturnType<typeof loader>>;
    actionData?: { ok?: boolean; intent?: string; error?: string };
  };
}

export function meta() {
  return [{ title: "Team media · Kuvox" }];
}

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { media: [] as MediaDto[], error: "Your session expired. Please sign in again." };
  }

  try {
    const page = await listMedia(accessToken, studioWs(String(params.studioId ?? "")), reqLog);
    return { media: page.items, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load team media.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load team media");
    return { media: [] as MediaDto[], error: message };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const ws = studioWs(String(params.studioId ?? ""));

  try {
    if (intent === "create") {
      const filename = String(formData.get("filename") ?? "").trim();
      const kind = Number(formData.get("kind") ?? MediaKind.Video);
      if (!filename) {
        return { error: "Enter a filename to import." };
      }
      await createMedia(accessToken, ws, {
        kind,
        filename,
        storageKey: `raw/${filename}`,
        sizeBytes: 0,
      }, reqLog);
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
    reqLog.error({ err: error, intent, studioId: params.studioId }, "team media action failed");
    return { error: message };
  }
}

export default function TeamMedia({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <MediaView
      media={loaderData.media}
      loadError={loaderData.error}
      actionData={actionData}
      subtitle="This team's shared media library."
    />
  );
}
