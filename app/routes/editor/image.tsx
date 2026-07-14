import { useState } from "react";
import { Provider } from "react-redux";
import { redirect } from "react-router";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { ImageEditorWorkspace } from "~/components/editor/image-editor-workspace";
import { MediaKind, OwnerKind, PERSONAL, ProjectKind, type ProjectDto, type Workspace } from "~/lib/api";
import { getImageComposition, getProject, listAllMedia } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { normalizeImageCompositionPayload } from "~/lib/editor/image/image-composition-payload";
import { getSession } from "~/lib/session.server";
import { makeStore } from "~/store";

import type { Route } from "./+types/image";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Image Editor - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const projectId = params.projectId;
  if (!projectId) {
    throw redirect("/dashboard/projects");
  }

  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    throw redirect("/login");
  }

  const project = await getProject(accessToken, projectId);
  if (project.kind === ProjectKind.Video) {
    throw redirect(`/editor/video/${project.id}`);
  }

  const workspace = workspaceFromProject(project);
  const composition = await getImageComposition(accessToken, projectId);
  try {
    const media = await listAllMedia(accessToken, workspace);
    return {
      projectId,
      project,
      user,
      imageComposition: normalizeImageCompositionPayload(composition),
      imageMedia: media.filter((item) => item.kind === MediaKind.Image),
      mediaError: null,
    };
  } catch (error) {
    return {
      projectId,
      project,
      user,
      imageComposition: normalizeImageCompositionPayload(composition),
      imageMedia: [],
      mediaError:
        error instanceof Error ? error.message : "Media could not be loaded for this project.",
    };
  }
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <EditorSkeleton />;
}

export default function ImageEditorRoute({ loaderData }: Route.ComponentProps) {
  const [store] = useState(() => makeStore());

  return (
    <Provider store={store}>
      <ImageEditorWorkspace
        projectId={loaderData.projectId}
        projectName={loaderData.project.name}
        uploadStudioId={
          loaderData.project.ownerKind === OwnerKind.Studio ? loaderData.project.ownerId : null
        }
        backendComposition={loaderData.imageComposition}
        imageMedia={loaderData.imageMedia}
        mediaError={loaderData.mediaError}
        user={loaderData.user}
      />
    </Provider>
  );
}

function workspaceFromProject(project: ProjectDto): Workspace {
  if (project.ownerKind === OwnerKind.Studio) {
    return { kind: "studio", studioId: project.ownerId };
  }

  return PERSONAL;
}
