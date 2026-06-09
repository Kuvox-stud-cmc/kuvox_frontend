import { Link } from "react-router";

import { Chip, ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import {
  ProjectKind,
  projectKindLabel,
  mediaKindLabel,
  type MediaDto,
  type ProjectDto,
  type Workspace,
} from "~/lib/api";
import {
  listMedia,
  listMediaTrash,
  listProjects,
  listProjectTrash,
  listStudioMembers,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team · Kuvox" }];
}

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

function count(result: PromiseSettledResult<{ totalCount: number }>): number {
  return result.status === "fulfilled" ? result.value.totalCount : 0;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  const empty = {
    studioId,
    counts: { projects: 0, media: 0, members: 0, trash: 0 },
    recentProjects: [] as ProjectDto[],
    recentMedia: [] as MediaDto[],
    error: "Your session expired. Please sign in again." as string | null,
  };
  if (!accessToken) return empty;

  const ws = studioWs(studioId);
  const [projects, media, members, projectTrash, mediaTrash] = await Promise.allSettled([
    listProjects(accessToken, ws),
    listMedia(accessToken, ws),
    listStudioMembers(accessToken, studioId),
    listProjectTrash(accessToken, ws),
    listMediaTrash(accessToken, ws),
  ]);

  const anyFailed = [projects, media, projectTrash, mediaTrash].some(
    (result) => result.status === "rejected",
  );

  return {
    studioId,
    counts: {
      projects: count(projects),
      media: count(media),
      members: members.status === "fulfilled" ? members.value.length : 0,
      trash: count(projectTrash) + count(mediaTrash),
    },
    recentProjects: projects.status === "fulfilled" ? projects.value.items.slice(0, 3) : [],
    recentMedia: media.status === "fulfilled" ? media.value.items.slice(0, 3) : [],
    error: anyFailed ? "Some team data couldn't be loaded." : null,
  };
}

export default function TeamHome({ loaderData }: Route.ComponentProps) {
  const { studioId, counts, recentProjects, recentMedia, error } = loaderData;

  const stats = [
    { key: "projects" as const, label: "Projects", icon: "movie", to: `/teams/${studioId}/projects` },
    { key: "media" as const, label: "Media", icon: "perm_media", to: `/teams/${studioId}/media` },
    { key: "members" as const, label: "Members", icon: "group", to: `/teams/${studioId}/members` },
    { key: "trash" as const, label: "Trash", icon: "delete", to: `/teams/${studioId}/trash` },
  ];

  return (
    <section>
      <SectionHeader title="Team overview" subtitle="What's happening in this workspace." />

      {error && <ErrorBanner message={error} />}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
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

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">Recent projects</h2>
            <Link
              to={`/teams/${studioId}/projects`}
              className="text-label-md text-on-surface-variant transition-colors hover:text-primary"
            >
              View all
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
              No team projects yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={
                    project.kind === ProjectKind.Video
                      ? `/editor/${project.id}`
                      : `/projects/${project.id}`
                  }
                  className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40"
                >
                  <span className="truncate text-body-md text-on-surface">{project.name}</span>
                  <Chip>{projectKindLabel(project.kind)}</Chip>
                </Link>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">Recent media</h2>
            <Link
              to={`/teams/${studioId}/media`}
              className="text-label-md text-on-surface-variant transition-colors hover:text-primary"
            >
              View all
            </Link>
          </div>
          {recentMedia.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
              No team media yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentMedia.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3"
                >
                  <span className="truncate text-body-md text-on-surface">{item.filename}</span>
                  <Chip>{mediaKindLabel(item.kind)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
