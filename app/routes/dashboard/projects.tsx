import { ProjectsView } from "~/components/dashboard/workspace/projects-view";
import { PERSONAL, ProjectKind, type ProjectDto } from "~/lib/api";
import { ApiError, createProject, listProjects, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/projects";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Projects · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { projects: [] as ProjectDto[], error: "Your session expired. Please sign in again." };
  }

  try {
    const page = await listProjects(accessToken, PERSONAL);
    return { projects: page.items, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your projects.";
    return { projects: [] as ProjectDto[], error: message };
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
      const name = String(formData.get("name") ?? "").trim();
      const kind = Number(formData.get("kind") ?? ProjectKind.Video);
      const description = String(formData.get("description") ?? "").trim();
      if (!name) {
        return { error: "Give your project a name." };
      }
      await createProject(accessToken, PERSONAL, { kind, name, description });
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "projects", id);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    return { error: message };
  }
}

export default function Projects({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <ProjectsView
      projects={loaderData.projects}
      loadError={loaderData.error}
      actionData={actionData}
      subtitle="Your personal editing projects."
    />
  );
}
