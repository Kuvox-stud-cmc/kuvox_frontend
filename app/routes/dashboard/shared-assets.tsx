import { Link, useNavigation } from "react-router";

import {
  CardGridSkeleton,
  Chip,
  EmptyState,
  ErrorBanner,
  SectionHeader,
} from "~/components/dashboard/section";
import {
  mediaKindLabel,
  ProjectKind,
  projectKindLabel,
  type MediaDto,
  type ProjectDto,
} from "~/lib/api";
import { listSharedMedia, listSharedProjects } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/shared-assets";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Shared Assets · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      projects: [] as ProjectDto[],
      media: [] as MediaDto[],
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  const [projectsResult, mediaResult] = await Promise.allSettled([
    listSharedProjects(accessToken),
    listSharedMedia(accessToken),
  ]);

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value.items : [];
  const media = mediaResult.status === "fulfilled" ? mediaResult.value.items : [];
  const error =
    projectsResult.status === "rejected" || mediaResult.status === "rejected"
      ? "Some shared items couldn't be loaded."
      : null;

  return { projects, media, error };
}

/** Shorten an owner GUID for display (the API doesn't yet resolve owner display names here). */
function shortOwner(ownerId: string): string {
  return ownerId.slice(0, 8);
}

export default function Shared({ loaderData }: Route.ComponentProps) {
  const { projects, media, error } = loaderData;
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const isEmpty = projects.length === 0 && media.length === 0;

  return (
    <section>
      <SectionHeader
        title="Shared Assets"
        subtitle="Projects and media other people shared with you."
      />

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <CardGridSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon="group"
          title="Nothing shared with you yet"
          hint="When a teammate shares a project or media item, it shows up here."
        />
      ) : (
        <div className="mt-6 space-y-8">
          {projects.length > 0 && (
            <div>
              <h2 className="text-headline-md text-on-surface">Projects</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
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
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Owner · {shortOwner(project.ownerId)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {media.length > 0 && (
            <div>
              <h2 className="text-headline-md text-on-surface">Media</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-low p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="material-symbols-outlined text-primary">perm_media</span>
                      <Chip>{mediaKindLabel(item.kind)}</Chip>
                    </div>
                    <h3 className="mt-3 truncate text-body-lg text-on-surface" title={item.filename}>
                      {item.filename}
                    </h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Owner · {shortOwner(item.ownerId)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
