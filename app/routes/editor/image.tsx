import { redirect } from "react-router";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { ImageEditorWorkspace } from "~/components/editor/image-editor-workspace";
import { ProjectKind } from "~/lib/api";
import { getProject } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/image";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Image Editor - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    throw redirect("/login");
  }

  const project = await getProject(accessToken, params.projectId);
  if (project.kind === ProjectKind.Video) {
    throw redirect(`/editor/video/${project.id}`);
  }

  return { projectId: params.projectId, project };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <EditorSkeleton />;
}

export default function ImageEditorRoute({ loaderData }: Route.ComponentProps) {
  return (
    <ImageEditorWorkspace
      projectId={loaderData.projectId}
      project={loaderData.project}
    />
  );
}
