import { MediaView } from "~/components/dashboard/workspace/media-view";
import { MediaKind, PERSONAL, type MediaDto } from "~/lib/api";
import { ApiError, createMedia, listMedia, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/media";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Media · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { media: [] as MediaDto[], error: "Your session expired. Please sign in again." };
  }

  try {
    const page = await listMedia(accessToken, PERSONAL);
    return { media: page.items, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your media.";
    return { media: [] as MediaDto[], error: message };
  }
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

  try {
    if (intent === "create") {
      const filename = String(formData.get("filename") ?? "").trim();
      const kind = Number(formData.get("kind") ?? MediaKind.Video);
      if (!filename) {
        return { error: "Enter a filename to import." };
      }
      // Metadata/record only in Phase 2 — real byte upload to object storage is later.
      await createMedia(accessToken, PERSONAL, {
        kind,
        filename,
        storageKey: `raw/${filename}`,
        sizeBytes: 0,
      });
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    return { error: message };
  }
}

export default function Media({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <MediaView
      media={loaderData.media}
      loadError={loaderData.error}
      actionData={actionData}
      subtitle="Your personal media library."
    />
  );
}
