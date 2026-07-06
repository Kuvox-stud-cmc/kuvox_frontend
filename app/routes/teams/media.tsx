import { actionErrorMessage } from "~/lib/action-error.server";
import { MediaView } from "~/components/dashboard/workspace/media-view";
import { canManageStudioAccess, canWriteStudioContent, type MediaDto, type Workspace } from "~/lib/api";
import { ApiError, listMedia, listMyStudios, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
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
  return [{ title: "Team media Kuvox" }];
}

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      media: [] as MediaDto[],
      error: "Your session expired. Please sign in again.",
      studioId: String(params.studioId ?? ""),
      canWrite: false,
      canManageAccess: false,
    };
  }

  try {
    const studioId = String(params.studioId ?? "");
    const [page, studios] = await Promise.all([
      listMedia(accessToken, studioWs(studioId), reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const role = studios.find((studio) => studio.id === studioId)?.role;
    return {
      media: page.items,
      error: null as string | null,
      studioId,
      canWrite: role != null ? canWriteStudioContent(role) : false,
      canManageAccess: role != null ? canManageStudioAccess(role) : false,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load team media.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load team media");
    return { media: [] as MediaDto[], error: message, studioId: String(params.studioId ?? ""), canWrite: false, canManageAccess: false };
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

  try {
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
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
      studioId={loaderData.studioId}
      canWrite={loaderData.canWrite}
      canManageAccess={loaderData.canManageAccess}
      workspaceKind="studio"
    />
  );
}
