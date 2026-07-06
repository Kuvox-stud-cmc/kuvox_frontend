import { actionErrorMessage } from "~/lib/action-error.server";
import { Link } from "react-router";
import { useState } from "react";

import {
  CardOverflowMenu,
  GradientThumbnail,
  MetricCard,
  QuickActionCard,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { ErrorBanner } from "~/components/dashboard/section";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { AccessDialog } from "~/components/dashboard/shared/resource-dialogs";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import {
  MediaKind,
  ProjectKind,
  TaskIssueKind,
  TaskIssueStatus,
  canManageStudioAccess,
  canWriteStudioContent,
  projectKindLabel,
  mediaKindLabel,
  taskStatusLabel,
  type MediaDto,
  type ProjectDto,
  type TaskIssueDto,
  type Workspace,
} from "~/lib/api";
import {
  albumsApi,
  listMedia,
  listMediaTrash,
  listMyStudios,
  listProjects,
  listProjectTrash,
  listTasks,
  listStudioMembers,
  setProjectStar,
  softDelete,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { projectEditorHref } from "~/lib/project-routes";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team Kuvox" }];
}

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

function count(result: PromiseSettledResult<{ totalCount: number }>): number {
  return result.status === "fulfilled" ? result.value.totalCount : 0;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  const empty = {
    studioId,
    counts: { projects: 0, media: 0, albums: 0, members: 0, trash: 0 },
    recentProjects: [] as ProjectDto[],
    recentMedia: [] as MediaDto[],
    reviewQueue: [] as TaskIssueDto[],
    canWrite: false,
    canManageAccess: false,
    error: "Your session expired. Please sign in again." as string | null,
  };
  if (!accessToken) return empty;

  const ws = studioWs(studioId);
  const [projects, media, albums, members, studios, projectTrash, mediaTrash, reviewTasks] = await Promise.allSettled([
    listProjects(accessToken, ws, reqLog),
    listMedia(accessToken, ws, reqLog),
    albumsApi.listAlbums(accessToken, ws, reqLog),
    listStudioMembers(accessToken, studioId, reqLog),
    listMyStudios(accessToken, reqLog),
    listProjectTrash(accessToken, ws, reqLog),
    listMediaTrash(accessToken, ws, reqLog),
    listTasks(accessToken, studioId, { kind: TaskIssueKind.Review }, reqLog),
  ]);

  const anyFailed = [projects, media, projectTrash, mediaTrash, reviewTasks].some(
    (result) => result.status === "rejected",
  );
  if (anyFailed) reqLog.warn({ studioId }, "some team data failed to load");

  const role = studios.status === "fulfilled"
    ? studios.value.find((studio) => studio.id === studioId)?.role
    : undefined;

  return {
    studioId,
    counts: {
      projects: count(projects),
      media: count(media),
      albums: albums.status === "fulfilled" ? albums.value.filter((album) => album.isDeleteAble).length : 0,
      members: members.status === "fulfilled" ? members.value.length : 0,
      trash: count(projectTrash) + count(mediaTrash),
    },
    recentProjects: projects.status === "fulfilled" ? projects.value.items.slice(0, 3) : [],
    recentMedia: media.status === "fulfilled" ? media.value.items.slice(0, 3) : [],
    reviewQueue: reviewTasks.status === "fulfilled"
      ? reviewTasks.value
          .filter((task) => task.status !== TaskIssueStatus.Done && task.status !== TaskIssueStatus.Closed)
          .slice(0, 3)
      : [],
    canWrite: role != null ? canWriteStudioContent(role) : false,
    canManageAccess: role != null ? canManageStudioAccess(role) : false,
    error: anyFailed ? "Some team data couldn't be loaded." : null,
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
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "toggle-star") {
      const id = String(formData.get("id") ?? "");
      const isStarred = String(formData.get("value") ?? "") === "true";
      if (id) await setProjectStar(accessToken, id, isStarred, reqLog);
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) await softDelete(accessToken, "projects", id, reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent }, "team home action failed");
    return { error: message };
  }
}

function projectHref(project: ProjectDto, studioId: string) {
  return projectEditorHref(project);
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "ready" || normalized === "completed") return "success" as const;
  if (normalized === "processing" || normalized === "uploading") return "warning" as const;
  return "neutral" as const;
}

function taskTone(status: number) {
  if (status === TaskIssueStatus.ChangesRequested) return "danger" as const;
  if (status === TaskIssueStatus.Approved || status === TaskIssueStatus.Done) return "success" as const;
  if (status === TaskIssueStatus.InReview || status === TaskIssueStatus.InProgress) return "warning" as const;
  return "primary" as const;
}

function ProjectCard({
  project,
  index,
  studioId,
  canWrite,
  canManageAccess,
}: {
  project: ProjectDto;
  index: number;
  studioId: string;
  canWrite: boolean;
  canManageAccess: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <Link to={projectHref(project, studioId)} className="block">
        <div className="relative aspect-video">
          <GradientThumbnail index={index} icon={project.kind === ProjectKind.Image ? "image" : "movie"} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
          <div className="absolute left-3 top-3">
            <StatusBadge label={project.status} tone={statusTone(project.status)} />
          </div>
        </div>
      </Link>
      <div className="absolute bottom-3 right-3">
        <IconToggleButton
          id={project.id}
          active={project.isStarred}
          intent="toggle-star"
          activeIcon="star"
          inactiveIcon="star_border"
          activeClassName="text-yellow-500"
          label={`${project.isStarred ? "Unstar" : "Star"} ${project.name}`}
        />
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Link to={projectHref(project, studioId)} className="min-w-0">
            <h3 className="truncate text-body-sm font-bold text-on-surface">{project.name}</h3>
            <p className="mt-1 text-label-md text-on-surface-variant">{formatUpdatedAt(project.updatedAt)}</p>
          </Link>
          <div className="flex items-center gap-1">
            <AccessDialog resourceType="project" resourceId={project.id} resourceName={project.name} canManageAccess={canManageAccess} />
            {canWrite ? <CardOverflowMenu id={project.id} itemLabel={project.name} /> : null}
          </div>
        </div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">{project.kind === ProjectKind.Image ? "image" : "movie"}</span>
          {projectKindLabel(project.kind)}
        </p>
      </div>
    </article>
  );
}

function mediaHref(item: MediaDto, studioId: string) {
  if (item.kind === MediaKind.Audio) {
    return `/teams/${studioId}/media/audio?play=${encodeURIComponent(item.id)}#quick-preview`;
  }
  if (item.kind === MediaKind.Image) return `/teams/${studioId}/media/photos`;
  return `/teams/${studioId}/media/videos`;
}

function mediaIcon(kind: number) {
  if (kind === MediaKind.Image) return "image";
  if (kind === MediaKind.Audio) return "music_note";
  return "play_circle";
}

function MediaCard({
  item,
  index,
  studioId,
  onPreview,
  canManageAccess,
}: {
  item: MediaDto;
  index: number;
  studioId: string;
  onPreview: (item: MediaDto) => void;
  canManageAccess: boolean;
}) {
  const isAudio = item.kind === MediaKind.Audio;
  const previewLabel = isAudio ? `Open ${item.filename}` : `Preview ${item.filename}`;
  const previewSurface = (
    <div className="relative aspect-video w-full">
      <MediaThumbnail media={item} index={index} icon={mediaIcon(item.kind)} />
      <div className="absolute left-3 top-3">
        <StatusBadge label={mediaKindLabel(item.kind)} tone="primary" />
      </div>
    </div>
  );

  return (
    <article className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
      <div className="absolute right-3 top-3 z-10">
        <AccessDialog
          resourceType="media"
          resourceId={item.id}
          resourceName={item.filename}
          canManageAccess={canManageAccess}
          buttonClassName="bg-surface-container-lowest/70 backdrop-blur-md hover:bg-surface-container-lowest/90"
        />
      </div>
      {isAudio ? (
        <Link to={mediaHref(item, studioId)} className="block text-left" aria-label={previewLabel}>
          {previewSurface}
          <div className="p-4">
            <h3 className="truncate text-body-sm font-bold text-on-surface" title={item.filename}>{item.filename}</h3>
            <p className="mt-1 text-label-md text-on-surface-variant">{formatUpdatedAt(item.createdAt)}</p>
          </div>
        </Link>
      ) : (
        <button type="button" onClick={() => onPreview(item)} className="block w-full text-left" aria-label={previewLabel}>
          {previewSurface}
          <div className="p-4">
            <h3 className="truncate text-body-sm font-bold text-on-surface" title={item.filename}>{item.filename}</h3>
            <p className="mt-1 text-label-md text-on-surface-variant">{formatUpdatedAt(item.createdAt)}</p>
          </div>
        </button>
      )}
    </article>
  );
}

export default function TeamHome({ loaderData, actionData }: Route.ComponentProps) {
  const { studioId, counts, recentProjects, recentMedia, reviewQueue, canWrite, canManageAccess, error } = loaderData;
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const previewMedia = previewMediaId
    ? recentMedia.find((item) => item.id === previewMediaId) ?? null
    : null;

  return (
    <section className="space-y-8">
      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">Studio Home</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Track projects, media, members, and review work for this Studio.
          </p>
        </div>
        <Link
          to={canManageAccess ? `/teams/${studioId}/settings/workspace` : `/teams/${studioId}/members`}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]">
            {canManageAccess ? "tune" : "group"}
          </span>
          {canManageAccess ? "Studio settings" : "Member directory"}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard variant="stacked" icon="folder" label="Projects" value={counts.projects} iconBgClassName="bg-primary/10" iconClassName="text-primary" />
        <MetricCard variant="stacked" icon="perm_media" label="Media Files" value={counts.media} iconBgClassName="bg-tertiary/10" iconClassName="text-tertiary" />
        <MetricCard variant="stacked" icon="collections" label="Albums" value={counts.albums} iconBgClassName="bg-secondary/10" iconClassName="text-secondary" />
        <MetricCard variant="stacked" icon="groups" label="Members" value={counts.members} iconBgClassName="bg-primary/10" iconClassName="text-primary" />
        <MetricCard variant="stacked" icon="delete" label="Trash Items" value={counts.trash} iconBgClassName="bg-error/10" iconClassName="text-error" />
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">Continue Editing</h2>
          <Link to={`/teams/${studioId}/projects`} className="flex items-center gap-1 text-label-md font-medium text-primary">
            View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
            No Studio projects yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {recentProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} studioId={studioId} canWrite={canWrite} canManageAccess={canManageAccess} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-bold text-on-surface">Studio Review Queue</h3>
            <Link to={`/teams/${studioId}/tasks`} className="text-label-sm font-bold uppercase tracking-wider text-primary hover:underline">View all</Link>
          </div>
          {reviewQueue.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-body-sm text-on-surface-variant">
              No open reviews in this Studio.
            </p>
          ) : (
            reviewQueue.map((task) => (
              <Link key={task.id} to={`/teams/${studioId}/tasks?kind=${TaskIssueKind.Review}`} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <span className="material-symbols-outlined text-[18px]">rate_review</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-label-md font-bold text-on-surface">{task.title}</h4>
                  <p className="truncate text-label-sm text-on-surface-variant">
                    {task.projectName ?? "Studio workspace review"}
                  </p>
                </div>
                <StatusBadge label={taskStatusLabel(task.status)} tone={taskTone(task.status)} />
              </Link>
            ))
          )}
        </div>

        <div className="col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-4">
          <h3 className="mb-6 font-bold text-on-surface">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {canWrite ? <QuickActionCard icon="add" title="New Project" to={`/teams/${studioId}/projects`} variant="compact" /> : null}
            {canWrite ? <QuickActionCard icon="upload" title="Import Media" to={`/teams/${studioId}/media/videos`} variant="compact" /> : null}
            <QuickActionCard icon="collections" title="Albums" to={`/teams/${studioId}/media/albums`} variant="compact" />
            <QuickActionCard icon="auto_awesome" title="AI Tools" to="/dashboard/ai-tools" variant="compact" />
          </div>
        </div>
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">Recent Media</h2>
          <Link to={`/teams/${studioId}/media/videos`} className="flex items-center gap-1 text-label-md font-medium text-primary">
            View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        {recentMedia.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
            No Studio media yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {recentMedia.map((item, index) => (
              <MediaCard
                key={item.id}
                item={item}
                index={index}
                studioId={studioId}
                canManageAccess={canManageAccess}
                onPreview={(media) => setPreviewMediaId(media.id)}
              />
            ))}
          </div>
        )}
      </section>
      <MediaPreviewOverlay
        media={previewMedia?.kind === MediaKind.Audio ? null : previewMedia}
        onClose={() => setPreviewMediaId(null)}
      />
    </section>
  );
}
