import { actionErrorMessage } from "~/lib/action-error.server";
import ProjectsDashboard from "./projects-view";
import {
  PERSONAL,
  ProjectKind,
  type MediaDto,
  type ProjectDto,
  type ProjectMediaDto,
} from "~/lib/api";
import {
  createProject,
  listMedia,
  listProjectMedia,
  listProjects,
  listSharedProjects,
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
  return [{ title: "Projects Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
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
    };
  }

  const [projects, sharedProjects, media] = await Promise.allSettled([
    listProjects(accessToken, PERSONAL, reqLog),
    listSharedProjects(accessToken, reqLog),
    listMedia(accessToken, PERSONAL, reqLog),
  ]);

  const anyFailed = [projects, sharedProjects, media].some(
    (result) => result.status === "rejected",
  );

  if (anyFailed) {
    reqLog.warn("some projects dashboard data failed to load");
  }

  const projectItems = projects.status === "fulfilled" ? projects.value.items : ([] as ProjectDto[]);
  const sharedProjectItems = sharedProjects.status === "fulfilled" ? sharedProjects.value.items : ([] as ProjectDto[]);

  return {
    projects: await hydrateProjectPreviewMedia(accessToken, projectItems, reqLog),
    sharedProjects: await hydrateProjectPreviewMedia(accessToken, sharedProjectItems, reqLog),
    media: media.status === "fulfilled" ? media.value.items : ([] as MediaDto[]),
    error: anyFailed ? "Some projects dashboard data couldn't be loaded." : null,
  };
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
        log.warn({ err: result.reason, projectId: project.id }, "failed to load project preview media");
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

export async function action({ request }: Route.ActionArgs) {
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

    if (intent === "create") {
      const name = String(formData.get("name") ?? "").trim();
      const kind = Number(formData.get("kind") ?? ProjectKind.Video);
      const description = String(formData.get("description") ?? "").trim();
      if (!name) {
        return { error: "Give your project a name." };
      }
      await createProject(accessToken, PERSONAL, { kind, name, description }, reqLog);
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
    reqLog.error({ err: error, intent }, "project action failed");
    return { error: message };
  }
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  return (
    <ProjectsDashboard
      projects={loaderData.projects}
      sharedProjects={loaderData.sharedProjects}
      media={loaderData.media}
      error={loaderData.error}
    />
  );
}
