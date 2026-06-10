import { TrashView } from "~/components/dashboard/workspace/trash-view";
import { toTrashEntries, type ResourceKind, type TrashEntry, type Workspace } from "~/lib/api";
import {
  ApiError,
  listMediaTrash,
  listProjectTrash,
  permanentDelete,
  restore,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/trash";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team trash · Kuvox" }];
}

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { entries: [] as TrashEntry[], error: "Your session expired. Please sign in again." };
  }

  const ws = studioWs(params.studioId);
  const [projectsResult, mediaResult] = await Promise.allSettled([
    listProjectTrash(accessToken, ws),
    listMediaTrash(accessToken, ws),
  ]);

  const entries = toTrashEntries(
    projectsResult.status === "fulfilled" ? projectsResult.value.items : [],
    mediaResult.status === "fulfilled" ? mediaResult.value.items : [],
  );
  const error =
    projectsResult.status === "rejected" || mediaResult.status === "rejected"
      ? "Some trashed items couldn't be loaded."
      : null;

  return { entries, error };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const resource = String(formData.get("resource") ?? "") as ResourceKind;
  const id = String(formData.get("id") ?? "");

  if (resource !== "projects" && resource !== "media") {
    return { error: "Unknown resource." };
  }

  try {
    if (intent === "restore" && id) {
      await restore(accessToken, resource, id);
      return { ok: true };
    }
    if (intent === "permanent" && id) {
      await permanentDelete(accessToken, resource, id);
      return { ok: true };
    }
    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    return { error: message };
  }
}

export default function TeamTrash({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <TrashView
      entries={loaderData.entries}
      loadError={loaderData.error}
      actionData={actionData}
      subtitle="Deleted team items are kept for 7 days, then permanently removed."
    />
  );
}
