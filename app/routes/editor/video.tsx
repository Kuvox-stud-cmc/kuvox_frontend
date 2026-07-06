import { useState } from "react";
import { Provider } from "react-redux";
import { redirect } from "react-router";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { VideoEditorWorkspace } from "~/components/editor/video-editor-workspace";
import { OwnerKind, ProjectKind, type MediaDto, type Workspace } from "~/lib/api";
import { getProject, listAllMedia } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";
import { makeStore } from "~/store";

import type { Route } from "./+types/video";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Video Editor - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    throw redirect("/login");
  }

  const project = await getProject(accessToken, params.projectId);
  if (project.kind === ProjectKind.Image) {
    throw redirect(`/editor/image/${project.id}`);
  }

  let media: MediaDto[] = [];
  let mediaLoadError: string | null = null;
  try {
    media = await listAllMedia(accessToken, workspaceForProject(project));
  } catch (error) {
    mediaLoadError = error instanceof Error ? error.message : String(error);
  }

  return { projectId: params.projectId, project, user, media, mediaLoadError };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <EditorSkeleton />;
}

export default function VideoEditorRoute({ loaderData }: Route.ComponentProps) {
  const [store] = useState(() => makeStore());

  return (
    <Provider store={store}>
      <VideoEditorWorkspace
        project={loaderData.project}
        userId={loaderData.user.id}
        media={loaderData.media}
        mediaLoadError={loaderData.mediaLoadError}
      />
    </Provider>
  );
}

function workspaceForProject(project: { ownerKind: number; ownerId: string }): Workspace {
  return project.ownerKind === OwnerKind.Studio
    ? { kind: "studio", studioId: project.ownerId }
    : { kind: "personal" };
}
