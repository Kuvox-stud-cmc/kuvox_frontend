import { Link } from "react-router";

import { Chip, ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import { PERSONAL, ProjectKind, projectKindLabel, type ProjectDto } from "~/lib/api";
import {
  listMedia,
  listMediaTrash,
  listProjects,
  listProjectTrash,
  listSharedMedia,
  listSharedProjects,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Dashboard · Kuvox" }];
}

function count<T>(result: PromiseSettledResult<{ totalCount: number }>): number {
  return result.status === "fulfilled" ? result.value.totalCount : 0;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  const empty = {
    user,
    counts: { projects: 0, media: 0, shared: 0, trash: 0 },
    recent: [] as ProjectDto[],
    error: "Your session expired. Please sign in again." as string | null,
  };
  if (!accessToken) return empty;

  const [projects, media, sharedProjects, sharedMedia, projectTrash, mediaTrash] =
    await Promise.allSettled([
      listProjects(accessToken, PERSONAL),
      listMedia(accessToken, PERSONAL),
      listSharedProjects(accessToken),
      listSharedMedia(accessToken),
      listProjectTrash(accessToken, PERSONAL),
      listMediaTrash(accessToken, PERSONAL),
    ]);

  const recent = projects.status === "fulfilled" ? projects.value.items.slice(0, 6) : [];
  const anyFailed = [projects, media, sharedProjects, sharedMedia, projectTrash, mediaTrash].some(
    (result) => result.status === "rejected",
  );

  return {
    user,
    counts: {
      projects: count(projects),
      media: count(media),
      shared: count(sharedProjects) + count(sharedMedia),
      trash: count(projectTrash) + count(mediaTrash),
    },
    recent,
    error: anyFailed ? "Some dashboard data couldn't be loaded." : null,
  };
}

const STATS = [
  { key: "projects", label: "Projects", icon: "movie", to: "/dashboard/projects" },
  { key: "media", label: "Media", icon: "perm_media", to: "/dashboard/media" },
  { key: "shared", label: "Shared with me", icon: "group", to: "/dashboard/shared" },
  { key: "trash", label: "Trash", icon: "delete", to: "/dashboard/trash" },
] as const;

export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  const { user, counts, recent, error } = loaderData;

  return (
    <section>
      <SectionHeader
        title={`Welcome back, ${user.displayName}`}
        subtitle="Your personal workspace at a glance."
      />

      {error && <ErrorBanner message={error} />}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Link
            key={stat.key}
            to={stat.to}
            className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-primary">{stat.icon}</span>
            <p className="mt-2 text-headline-lg text-on-surface">{counts[stat.key]}</p>
            <p className="text-body-sm text-on-surface-variant">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New project
        </Link>
        <Link
          to="/dashboard/media"
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-4 py-2 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Import media
        </Link>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">Recent projects</h2>
          <Link
            to="/dashboard/projects"
            className="text-label-md text-on-surface-variant transition-colors hover:text-primary"
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
            No projects yet — create one to get started.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((project) => (
              <Link
                key={project.id}
                to={
                  project.kind === ProjectKind.Video
                    ? `/editor/${project.id}`
                    : `/projects/${project.id}`
                }
                className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="material-symbols-outlined text-primary">
                    {project.kind === ProjectKind.Video ? "movie" : "image"}
                  </span>
                  <Chip>{projectKindLabel(project.kind)}</Chip>
                </div>
                <h3 className="mt-3 truncate text-body-lg text-on-surface">{project.name}</h3>
                <span className="mt-1 text-label-md text-on-surface-variant">{project.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
