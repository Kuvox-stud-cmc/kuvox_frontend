import { actionErrorMessage } from "~/lib/action-error.server";
import ProjectsDashboard from "../dashboard/projects-view";
import { ProjectKind, canManageStudioAccess, canWriteStudioContent, type MediaDto, type ProjectDto, type ProjectMediaDto, type Workspace } from "~/lib/api";
import {
  ApiError,
  createProject,
  listMedia,
  listProjectMedia,
  listMyStudios,
  listProjects,
  renameProject,
  renameMedia,
  setProjectStar,
  softDelete,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/projects";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team projects Kuvox" }];
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
      projects: [] as ProjectDto[],
      sharedProjects: [] as ProjectDto[],
      media: [] as MediaDto[],
      error: "Your session expired. Please sign in again.",
      canWrite: false,
      canManageAccess: false,
    };
  }

  try {
    const [page, media, studios] = await Promise.all([
      listProjects(accessToken, studioWs(params.studioId), reqLog),
      listMedia(accessToken, studioWs(params.studioId), reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const role = studios.find((studio) => studio.id === params.studioId)?.role;
    return {
      projects: await hydrateProjectPreviewMedia(accessToken, page.items, reqLog),
      sharedProjects: [] as ProjectDto[],
      media: media.items,
      error: null as string | null,
      canWrite: role != null ? canWriteStudioContent(role) : false,
      canManageAccess: role != null ? canManageStudioAccess(role) : false,
    };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Couldn't load team projects.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load team projects");
    return {
      projects: [] as ProjectDto[],
      sharedProjects: [] as ProjectDto[],
      media: [] as MediaDto[],
      error: message,
      canWrite: false,
      canManageAccess: false,
    };
  }
}

async function hydrateProjectPreviewMedia(
  accessToken: string,
  projects: ProjectDto[],
  log: ReturnType<typeof withUser>,
): Promise<ProjectDto[]> {
  if (projects.length === 0) return projects;

  const rows = await Promise.allSettled(
    projects.map((project) => listProjectMedia(accessToken, project.id, log)),
  );

  return projects.map((project, index) => {
    const result = rows[index];
    if (result?.status !== "fulfilled") {
      if (result?.status === "rejected") {
        log.warn({ err: result.reason, projectId: project.id }, "failed to load team project preview media");
      }
      return project;
    }

    const projectMediaItems = result.value.items.filter(hasPreviewObject).slice(0, 1);
    return projectMediaItems.length > 0
      ? ({ ...project, projectMediaItems } as ProjectDto & { projectMediaItems: ProjectMediaDto[] })
      : project;
  });
}

function hasPreviewObject(media: ProjectMediaDto) {
  return Boolean(media.thumbnailStorageKey || media.canonicalStorageKey || media.storageKey);
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
  const ws = studioWs(params.studioId);

  try {
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "create") {
      const name = String(formData.get("name") ?? "").trim();
      const kind = Number(formData.get("kind") ?? ProjectKind.Video);
      const description = String(formData.get("description") ?? "").trim();
      if (!name) {
        return { error: "Give your project a name." };
      }
      await createProject(accessToken, ws, { kind, name, description }, reqLog);
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "projects", id, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-star") {
      const id = String(formData.get("id") ?? "");
      const isStarred = String(formData.get("value") ?? "") === "true";
      if (id) {
        await setProjectStar(accessToken, id, isStarred, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "rename") {
      const id = String(formData.get("id") ?? "").trim();
      const name = String(formData.get("name") ?? "").trim();
      const resourceType = String(formData.get("resourceType") ?? "");
      if (id && name) {
        if (resourceType === "projects" || resourceType === "project") {
          await renameProject(accessToken, id, name, reqLog);
        } else {
          await renameMedia(accessToken, id, name, reqLog);
        }
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent, studioId: params.studioId }, "team project action failed");
    return { error: message };
  }
}

export default function TeamProjects({ loaderData, params }: Route.ComponentProps) {
  return (
    <ProjectsDashboard
      projects={loaderData.projects}
      sharedProjects={loaderData.sharedProjects}
      media={loaderData.media}
      error={loaderData.error}
      basePath={`/teams/${params.studioId}/projects`}
      studioId={params.studioId}
      canWrite={loaderData.canWrite}
      canManageAccess={loaderData.canManageAccess}
      workspaceKind="studio"
      title="Studio Projects"
      subtitle="Projects owned by this Studio workspace."
    />
  );
}
