import ProjectsDashboard from "./projects-view";
import {
  PERSONAL,
  ProjectKind,
  type MediaDto,
  type ProjectDto,
} from "~/lib/api";
import {
  ApiError,
  createProject,
  listMedia,
  listProjects,
  listSharedProjects,
  setProjectStar,
  softDelete,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/projects";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Projects · Kuvox" }];
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

  return {
    projects: projects.status === "fulfilled" ? projects.value.items : ([] as ProjectDto[]),
    sharedProjects:
      sharedProjects.status === "fulfilled" ? sharedProjects.value.items : ([] as ProjectDto[]),
    media: media.status === "fulfilled" ? media.value.items : ([] as MediaDto[]),
    error: anyFailed ? "Some projects dashboard data couldn't be loaded." : null,
  };
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

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
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
