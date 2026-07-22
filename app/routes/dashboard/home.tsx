import { actionErrorMessage } from "~/lib/action-error.server";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ThemeManager, THEMES, type ThemeId } from "~/lib/theme";

import {
  AssetCard,
  GradientThumbnail,
  MetricCard,
  QuickActionCard,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { AssetCardContextMenu } from "~/components/dashboard/shared/AssetCardContextMenu";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { ErrorBanner } from "~/components/dashboard/section";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import {
  MediaKind,
  PERSONAL,
  ProjectKind,
  TaskIssueKind,
  TaskIssueStatus,
  isTaskOpen,
  projectKindLabel,
  taskKindLabel,
  taskStatusLabel,
  type MediaDto,
  type ProjectDto,
  type ProjectMediaDto,
  type TaskIssueDto,
} from "~/lib/api";
import {
  listMedia,
  listMediaTrash,
  listProjectMedia,
  listProjects,
  listProjectTrash,
  listAssignedTasks,
  listSharedMedia,
  listSharedProjects,
  renameMedia,
  renameProject,
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
  return [{ title: "Dashboard - Kuvox" }];
}

function count<T>(result: PromiseSettledResult<{ totalCount: number }>): number {
  return result.status === "fulfilled" ? result.value.totalCount : 0;
}

function randomPositiveMessage(displayName: string): string {
  const name = displayName.trim() || "creator";
  const messages = [
    `Great to see you, ${name} \u2728`,
    `Ready to make something amazing, ${name} \u{1F680}`,
    `Your next idea starts here, ${name} \u{1F4A1}`,
    `Let's build something sharp, ${name} \u{1F3AC}`,
    `You've got this, ${name} \u{1F4AA}`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  const empty = {
    user,
    welcomeMessage: randomPositiveMessage(user.displayName),
    counts: { projects: 0, media: 0, shared: 0, trash: 0 },
    recent: [] as ProjectDto[],
    recentMedia: [] as MediaDto[],
    currentWork: [] as TaskIssueDto[],
    error: "Your session expired. Please sign in again." as string | null,
  };
  if (!accessToken) return empty;

  const [projects, media, sharedProjects, sharedMedia, projectTrash, mediaTrash, currentWork] =
    await Promise.allSettled([
      listProjects(accessToken, PERSONAL, reqLog),
      listMedia(accessToken, PERSONAL, reqLog),
      listSharedProjects(accessToken, reqLog),
      listSharedMedia(accessToken, reqLog),
      listProjectTrash(accessToken, PERSONAL, reqLog),
      listMediaTrash(accessToken, PERSONAL, reqLog),
      listAssignedTasks(accessToken, {}, reqLog),
    ]);

  const recentItems = projects.status === "fulfilled" ? projects.value.items.slice(0, 6) : [];
  const recent = await hydrateProjectPreviewMedia(accessToken, recentItems, reqLog);
  const recentMedia = media.status === "fulfilled" ? media.value.items.slice(0, 4) : [];
  const coreFailed = [projects, media].some(
    (result) => result.status === "rejected",
  );

  const optionalResults = [
    ["sharedProjects", sharedProjects],
    ["sharedMedia", sharedMedia],
    ["projectTrash", projectTrash],
    ["mediaTrash", mediaTrash],
    ["currentWork", currentWork],
  ] as const;
  const failedOptional = optionalResults.filter(([, result]) => result.status === "rejected");
  if (coreFailed || failedOptional.length > 0) {
    reqLog.warn(
      {
        failedOptional: failedOptional.map(([name]) => name),
        coreFailed,
      },
      "some dashboard home data failed to load",
    );
  }

  return {
    user,
    welcomeMessage: randomPositiveMessage(user.displayName),
    counts: {
      projects: count(projects),
      media: count(media),
      shared: count(sharedProjects) + count(sharedMedia),
      trash: count(projectTrash) + count(mediaTrash),
    },
    recent,
    recentMedia,
    currentWork:
      currentWork.status === "fulfilled"
        ? currentWork.value.filter((item) => isTaskOpen(item.status)).slice(0, 5)
        : [],
    error: coreFailed ? "Some dashboard data couldn't be loaded." : null,
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
        log.warn({ err: result.reason, projectId: project.id }, "failed to load dashboard project preview media");
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

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      const resourceType = String(formData.get("resourceType") ?? "projects");
      if (id) {
        await softDelete(accessToken, resourceType === "media" ? "media" : "projects", id, reqLog);
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
    reqLog.error({ err: error, intent }, "dashboard home action failed");
    return { error: message };
  }
}

// Mock data (to be replaced by real API integration)

const MOCK_AI_SUGGESTIONS = [
  { id: "ai1", icon: "mic", title: "Remove silence", description: "Save 12s" },
  {
    id: "ai2",
    icon: "palette",
    title: "Improve color grading",
    description: "Apply cinematic look",
  },
  {
    id: "ai3",
    icon: "subtitles",
    title: "Generate subtitles",
    description: "Auto-detect speech",
  },
];

// Sub-components

function formatStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

function projectHref(project: ProjectDto) {
  return projectEditorHref(project);
}

function projectStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  const statusTones: Record<string, { tone: Parameters<typeof StatusBadge>[0]["tone"]; pulse?: boolean }> = {
    ready: { tone: "success" },
    completed: { tone: "success" },
    processing: { tone: "warning", pulse: true },
    uploading: { tone: "primary" },
    draft: { tone: "neutral" },
  };
  return statusTones[normalized] ?? { tone: "neutral" as const };
}

function taskStatusBadge(status: number) {
  if (status === TaskIssueStatus.ChangesRequested) return { tone: "danger" as const };
  if (status === TaskIssueStatus.Approved || status === TaskIssueStatus.Done) return { tone: "success" as const };
  if (status === TaskIssueStatus.InReview) return { tone: "warning" as const };
  if (status === TaskIssueStatus.InProgress) return { tone: "primary" as const };
  return { tone: "neutral" as const };
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) return "No due date";
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return "No due date";
  return `Due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date)}`;
}

function projectToMedia(project: ProjectDto): MediaDto {
  return {
    id: project.id,
    filename: project.name,
    kind: project.kind === ProjectKind.Image ? MediaKind.Image : MediaKind.Video,
    sizeBytes: "0",
    createdAt: project.createdAt || project.updatedAt,
  } as unknown as MediaDto;
}

type ProjectWithPreviewMedia = ProjectDto & {
  projectMediaItems?: ProjectMediaDto[] | null;
};

function projectPreviewMedia(project: ProjectDto): MediaDto | null {
  const row = (project as ProjectWithPreviewMedia).projectMediaItems?.[0];
  if (!row || row.kind === null || !row.filename || !row.storageKey || !row.status) return null;

  return {
    id: row.mediaId,
    ownerId: row.ownerId ?? "project-preview",
    ownerKind: row.ownerKind ?? 0,
    ownerEmail: null,
    ownerDisplayName: null,
    kind: row.kind,
    filename: row.filename,
    storageKey: row.storageKey,
    sizeBytes: row.sizeBytes ?? 0,
    status: row.status,
    canonicalStorageKey: row.canonicalStorageKey,
    proxyStorageKey: row.proxyStorageKey,
    thumbnailStorageKey: row.thumbnailStorageKey,
    errorMessage: row.errorMessage,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    codec: row.codec,
    frameRate: row.frameRate,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
    isFavorite: false,
    pipeline: {
      stage: row.status,
      label: row.status,
      detail: row.status,
      step: 4,
      stepCount: 4,
      terminal: true,
    },
  };
}

function ProjectCard({ project, index }: { project: ProjectDto; index: number }) {
  const media = projectToMedia(project);
  const previewMedia = projectPreviewMedia(project);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <Link to={projectHref(project)} className="block">
        <div className="relative h-44">
          {previewMedia ? (
            <MediaThumbnail
              media={previewMedia}
              index={index}
              icon={project.kind === ProjectKind.Image ? "image" : "play_circle"}
            />
          ) : (
            <GradientThumbnail index={index} icon={project.kind === ProjectKind.Image ? "image" : "play_circle"} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
          <div className="absolute left-3 top-3">
            <StatusBadge
              label={formatStatus(project.status)}
              {...projectStatusBadge(project.status)}
            />
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <AssetCardContextMenu
          media={media}
          workspaceKind="personal"
          resourceType="projects"
          copyUrl={projectHref(project)}
        />
      </div>
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
        <div className="mb-4">
          <Link to={projectHref(project)} className="min-w-0">
              <h3 className="truncate text-body-sm font-bold text-on-surface">
                {project.name}
              </h3>
              <p className="mt-2 text-label-md text-on-surface-variant">
                {formatUpdatedAt(project.updatedAt)}
              </p>
          </Link>
        </div>
        <div className="flex items-center gap-2 pr-10 text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">
            {project.kind === ProjectKind.Image ? "image" : "movie"}
          </span>
          <span>{projectKindLabel(project.kind)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome({ loaderData, actionData }: Route.ComponentProps) {
  const { welcomeMessage, counts, recent, recentMedia, currentWork, error } = loaderData;
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const previewMedia = previewMediaId ? recentMedia.find((item) => item.id === previewMediaId) ?? null : null;

  const [showCustomize, setShowCustomize] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeId>("midnight-jade");

  useEffect(() => {
    setActiveTheme(ThemeManager.getTheme());
    return ThemeManager.subscribe((newTheme) => {
      setActiveTheme(newTheme);
    });
  }, []);

  return (
    <div className="space-y-8">
      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {/* Hero Welcome */}
      <section className="flex items-end justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            {welcomeMessage}
          </h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Let's continue creating amazing content together.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCustomize(!showCustomize)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-body-sm font-medium transition-colors ${
            showCustomize
              ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Customize
          <span className="material-symbols-outlined ml-1 text-[14px]">
            {showCustomize ? "expand_less" : "expand_more"}
          </span>
        </button>
      </section>

      {/* Collapsible Customize Panel */}
      {showCustomize && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6 animate-fade-in-up shadow-xl transition-all duration-300">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">palette</span>
                Workspace Theme Engine
              </h3>
              <p className="text-label-md text-on-surface-variant mt-1">
                Select a visual profile to customize your dashboard and editor workspace. Hover to preview instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomize(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              aria-label="Close panel"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
            {THEMES.map((theme) => {
              const isActive = activeTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => ThemeManager.setTheme(theme.id)}
                  onMouseEnter={() => ThemeManager.applyTheme(theme.id)}
                  onMouseLeave={() => ThemeManager.applyTheme(ThemeManager.getTheme())}
                  className={`flex items-center gap-3 text-left rounded-lg border p-2.5 transition-all duration-200 group relative ${
                    isActive
                      ? "border-primary bg-surface-container-high ring-1 ring-primary shadow-sm"
                      : "border-outline-variant/60 bg-surface-container-low hover:border-primary/40 hover:bg-surface-container"
                  }`}
                >
                  {/* Swatch circle containing 4 colors */}
                  <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-outline-variant/50 shadow-inner">
                    <span className="h-full w-[25%]" style={{ backgroundColor: theme.colors.background }} />
                    <span className="h-full w-[25%]" style={{ backgroundColor: theme.colors.surface }} />
                    <span className="h-full w-[25%]" style={{ backgroundColor: theme.colors.primary }} />
                    <span className="h-full w-[25%]" style={{ backgroundColor: theme.colors.accent }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-body-sm font-bold text-on-surface truncate">
                        {theme.name}
                      </h4>
                      <span className="text-[10px] text-on-surface-variant/40 truncate">
                        • {theme.inspiration}
                      </span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      {theme.description}
                    </p>
                  </div>

                  {isActive && (
                    <span className="text-primary material-symbols-outlined text-[18px] shrink-0 pr-1">
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div data-tour="dashboard-metrics" className="grid grid-cols-12 gap-6">
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            variant="stacked"
            icon="folder"
            iconBgClassName="bg-primary/10"
            iconClassName="text-primary"
            label="Total Projects"
            value={counts.projects}
          />
          <MetricCard
            variant="stacked"
            icon="perm_media"
            iconBgClassName="bg-tertiary/10"
            iconClassName="text-tertiary"
            label="Media Files"
            value={counts.media}
          />
          <MetricCard
            variant="stacked"
            icon="groups"
            iconBgClassName="bg-primary/10"
            iconClassName="text-primary"
            label="Shared Items"
            value={counts.shared}
          />
          <MetricCard
            variant="stacked"
            icon="delete"
            iconBgClassName="bg-secondary/10"
            iconClassName="text-secondary"
            label="Trash Items"
            value={counts.trash}
          />
        </div>
      </div>

      {/* Continue Editing */}
      <section data-tour="dashboard-recent-projects">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">Continue Editing</h2>
          <Link
            to="/dashboard/projects"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
            No projects yet - create one to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {recent.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </section>

      <section data-tour="dashboard-recent-assets">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">Recent Assets</h2>
          <Link
            to="/dashboard/photos"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        {recentMedia.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
            No assets yet - import media to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {recentMedia.map((item, index) => (
              <AssetCard
                key={item.id}
                media={item}
                index={index}
                workspaceKind="personal"
                onPreview={item.kind === MediaKind.Audio ? undefined : (asset) => setPreviewMediaId(asset.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bottom Section */}
      <div className="grid grid-cols-12 gap-8">
        {/* Recent Projects (real data) */}
        <div className="col-span-12 lg:col-span-9">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-headline-md font-bold text-on-surface">Recent Projects</h2>
            <Link
              to="/dashboard/projects"
              className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
            >
              View All
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant">
              No projects yet - create one to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
              {recent.slice(0, 4).map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* AI Assistant panel */}
        <div className="col-span-12 self-start rounded-2xl border border-primary/20 bg-primary/5 p-6 lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-container">
                <span className="material-symbols-outlined text-[14px] text-on-primary-container">
                  bolt
                </span>
              </div>
              <h3 className="font-bold text-on-surface">AI Assistant</h3>
            </div>
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-on-surface"
              aria-label="Close AI Assistant"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <p className="mb-6 text-label-md text-on-surface-variant">
            You have <span className="font-bold text-on-surface">3 suggestions</span>
          </p>

          <div className="mb-6 space-y-3">
            {MOCK_AI_SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion.id}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container/30 p-4 transition-colors hover:bg-surface-container/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                    <span className="material-symbols-outlined text-[16px]">
                      {suggestion.icon}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-label-md font-bold text-on-surface">
                      {suggestion.title}
                    </h4>
                    <p className="text-label-sm text-on-surface-variant">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                  chevron_right
                </span>
              </div>
            ))}
          </div>

          <Link
            to="/dashboard/ai-tools"
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary/20 py-2.5 text-label-md font-bold text-primary transition-colors hover:bg-primary/30"
          >
            View All Suggestions
            <span className="material-symbols-outlined text-[14px] transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
      <MediaPreviewOverlay
        media={previewMedia?.kind === MediaKind.Audio ? null : previewMedia}
        onClose={() => setPreviewMediaId(null)}
      />
    </div>
  );
}
