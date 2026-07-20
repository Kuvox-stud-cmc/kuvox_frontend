import { useState } from "react";
import { Provider } from "react-redux";
import { redirect } from "react-router";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { ImageEditorWorkspace } from "~/components/editor/image-editor-workspace";
import { MediaKind, OwnerKind, PERSONAL, ProjectKind, type ProjectDto, type Workspace } from "~/lib/api";
import { ApiError, getImageComposition, getProject, getProjectEditorBootstrap, listAllMedia } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { normalizeImageCompositionPayload } from "~/lib/editor/image/image-composition-payload";
import { normalizeProjectEditorBootstrap } from "~/lib/editor/editor-bootstrap";
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

  let project: ProjectDto;
  let composition;
  try {
    const bootstrap = normalizeProjectEditorBootstrap(
      await getProjectEditorBootstrap(accessToken, projectId, 1, 100),
    );
    project = bootstrap.project;
    composition = bootstrap.imageComposition ?? normalizeImageCompositionPayload(null);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    project = await getProject(accessToken, projectId);
    composition = normalizeImageCompositionPayload(await getImageComposition(accessToken, projectId));
  }
  if (project.kind === ProjectKind.Video) {
    throw redirect(`/editor/video/${project.id}`);
  }

  const workspace = workspaceFromProject(project);
  try {
    const media = await listAllMedia(accessToken, workspace);
    return {
      projectId,
      project,
      user,
      imageComposition: composition,
      imageMedia: media.filter((item) => item.kind === MediaKind.Image),
      mediaError: null,
    };
  } catch (error) {
    return {
      projectId,
      project,
      user,
      imageComposition: composition,
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
