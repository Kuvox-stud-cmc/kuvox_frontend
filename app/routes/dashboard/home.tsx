import { actionErrorMessage } from "~/lib/action-error.server";
import { Link } from "react-router";

import {
  CardOverflowMenu,
  GradientThumbnail,
  MetricCard,
  QuickActionCard,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { ShareDialog } from "~/components/dashboard/shared/resource-dialogs";
import { ErrorBanner } from "~/components/dashboard/section";
import {
  PERSONAL,
  ProjectKind,
  TaskIssueKind,
  TaskIssueStatus,
  isTaskOpen,
  projectKindLabel,
  taskKindLabel,
  taskStatusLabel,
  type ProjectDto,
  type TaskIssueDto,
} from "~/lib/api";
import {
  listMedia,
  listMediaTrash,
  listProjects,
  listProjectTrash,
  listAssignedTasks,
  listSharedMedia,
  listSharedProjects,
  setProjectStar,
  softDelete,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Dashboard Â· Kuvox" }];
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

  const recent = projects.status === "fulfilled" ? projects.value.items.slice(0, 6) : [];
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
    currentWork:
      currentWork.status === "fulfilled"
        ? currentWork.value.filter((item) => isTaskOpen(item.status)).slice(0, 5)
        : [],
    error: coreFailed ? "Some dashboard data couldn't be loaded." : null,
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
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent }, "dashboard home action failed");
    return { error: message };
  }
}

/* â”€â”€ Mock data (to be replaced by real API integration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
  return project.kind === ProjectKind.Video ? `/editor/${project.id}` : "/dashboard/projects";
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

/* â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ProjectCard({ project, index }: { project: ProjectDto; index: number }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <Link to={projectHref(project)} className="block">
        <div className="relative h-44">
          <GradientThumbnail index={index} icon="play_circle" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
          <div className="absolute left-3 top-3">
            <StatusBadge
              label={formatStatus(project.status)}
              {...projectStatusBadge(project.status)}
            />
          </div>
        </div>
      </Link>
      <div className="absolute bottom-3 right-3">
        <div className="flex items-center gap-1">
          <ShareDialog resourceType="project" resourceId={project.id} resourceName={project.name} />
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
      </div>

      <div className="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <Link to={projectHref(project)} className="min-w-0">
              <h3 className="truncate text-body-sm font-bold text-on-surface">
                {project.name}
              </h3>
              <p className="mt-2 text-label-md text-on-surface-variant">
                {formatUpdatedAt(project.updatedAt)}
              </p>
          </Link>
          <CardOverflowMenu id={project.id} itemLabel={project.name} />
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
  const { welcomeMessage, counts, recent, currentWork, error } = loaderData;

  return (
    <div className="space-y-8">
      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {/* â”€â”€ Hero Welcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Customize
          <span className="material-symbols-outlined ml-1 text-[14px]">expand_more</span>
        </button>
      </section>

      {/* â”€â”€ Stats Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-12 gap-6">
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

      {/* â”€â”€ Continue Editing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
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

      {/* â”€â”€ Three Column Middle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-12 gap-8">
        {currentWork.length > 0 && (
          <div className="col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-bold text-on-surface">
                Current Work{" "}
                <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-label-sm text-primary">
                  {currentWork.length}
                </span>
              </h3>
              <Link
                to="/dashboard/reviews"
                className="text-label-sm font-bold uppercase tracking-wider text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {currentWork.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px]">
                      {item.kind === TaskIssueKind.Review ? "rate_review" : "task_alt"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-label-md font-bold text-on-surface">
                      {item.title}
                    </h4>
                    <p className="truncate text-label-sm text-on-surface-variant">
                      {taskKindLabel(item.kind)} · {item.projectName ?? "Studio task"} · {formatDueDate(item.dueDate)}
                    </p>
                  </div>
                  <StatusBadge
                    label={taskStatusLabel(item.status)}
                    {...taskStatusBadge(item.status)}
                    className="bg-transparent px-0 py-0"
                    dotPosition="end"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={`col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 ${currentWork.length > 0 ? "lg:col-span-4" : "lg:col-span-12"}`}>
          <h3 className="mb-6 font-bold text-on-surface">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                {
                  icon: "add",
                  label: "New Project",
                  to: "/dashboard/projects",
                  color: "text-primary bg-primary/20",
                },
                {
                  icon: "upload",
                  label: "Import Media",
                  to: "/dashboard/photos",
                  color: "text-primary bg-primary/20",
                },
                {
                  icon: "collections",
                  label: "Create Album",
                  to: "/dashboard/albums",
                  color: "text-primary bg-primary/20",
                },
                {
                  icon: "auto_awesome",
                  label: "AI Assistant",
                  to: "/dashboard/ai-tools",
                  color: "text-tertiary bg-tertiary/20",
                },
              ] as const
            ).map((action) => (
              <QuickActionCard
                key={action.label}
                icon={action.icon}
                title={action.label}
                to={action.to}
                variant="compact"
                className={action.color.includes("tertiary") ? "[&_div:first-child]:bg-tertiary/20 [&_div:first-child]:text-tertiary" : ""}
              />
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Bottom Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              No projects yet â€” create one to get started.
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
    </div>
  );
}
