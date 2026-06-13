import { Link } from "react-router";

import { ErrorBanner } from "~/components/dashboard/section";
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

/* ── Mock data (to be replaced by real API integration) ─────────────────── */

interface MockProject {
  id: string;
  title: string;
  editedAgo: string;
  status: "ready" | "processing" | "uploading";
  duration: string;
  resolution: string;
  fps: string;
  uploadProgress?: number;
}

const MOCK_CONTINUE_EDITING: MockProject[] = [
  {
    id: "mock-1",
    title: "Cinematic Travel Vlog",
    editedAgo: "2 hours ago",
    status: "ready",
    duration: "04:20",
    resolution: "4K",
    fps: "24fps",
  },
  {
    id: "mock-2",
    title: "Drone Footage - City Night",
    editedAgo: "Yesterday",
    status: "processing",
    duration: "12:05",
    resolution: "4K",
    fps: "60fps",
  },
  {
    id: "mock-3",
    title: "Ocean Waves - Slow Motion",
    editedAgo: "Uploading 2.4 GB of 4 GB",
    status: "uploading",
    duration: "—",
    resolution: "1080p",
    fps: "60fps",
    uploadProgress: 45,
  },
  {
    id: "mock-4",
    title: "Music Video Teaser",
    editedAgo: "3 days ago",
    status: "ready",
    duration: "01:15",
    resolution: "4K",
    fps: "24fps",
  },
];

const MOCK_REVIEWS = [
  { id: "r1", title: "Travel Vlog", reviewer: "Sarah Chen", status: "waiting_approval" as const },
  {
    id: "r2",
    title: "Product Promo",
    reviewer: "John Smith",
    status: "changes_requested" as const,
  },
  {
    id: "r3",
    title: "Instagram Reel",
    reviewer: "Emma Davis",
    status: "waiting_review" as const,
  },
];

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

const TEAM_INITIALS = ["A", "S", "J", "M", "E"];

/* ── Sub-components ─────────────────────────────────────────────────────── */

const THUMBNAIL_GRADIENTS = [
  "from-primary/20 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
];

/** Gradient placeholder when no thumbnailUrl is available; drop-in swap later. */
function ProjectThumbnail({
  index,
  thumbnailUrl,
}: {
  index: number;
  thumbnailUrl?: string | null;
}) {
  if (thumbnailUrl) {
    return (
      <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length]}`}
    >
      <span className="material-symbols-outlined text-[40px] text-on-surface-variant/20">
        play_circle
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: MockProject["status"] }) {
  const config = {
    ready: { label: "Ready", dotCls: "bg-secondary", cls: "bg-secondary/20 text-secondary" },
    processing: {
      label: "Processing",
      dotCls: "bg-tertiary animate-pulse",
      cls: "bg-tertiary/20 text-tertiary",
    },
    uploading: { label: "Uploading", dotCls: "bg-primary", cls: "bg-primary/20 text-primary" },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold backdrop-blur-md ${config.cls}`}
    >
      <span className={`h-1 w-1 rounded-full ${config.dotCls}`} />
      {config.label}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; text: string; dot: string }> = {
    waiting_approval: {
      label: "Waiting Approval",
      text: "text-tertiary",
      dot: "bg-tertiary",
    },
    changes_requested: {
      label: "Changes Requested",
      text: "text-error",
      dot: "bg-error",
    },
    waiting_review: {
      label: "Waiting Review",
      text: "text-primary",
      dot: "bg-primary",
    },
  };
  const c = map[status] ?? { label: status, text: "text-on-surface-variant", dot: "bg-outline" };
  return (
    <span className={`flex items-center gap-1 text-label-sm font-bold ${c.text}`}>
      {c.label}
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
    </span>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
  suffix,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        </div>
      </div>
      <p className="mb-1 text-label-sm font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-headline-lg font-bold leading-none text-on-surface">{value}</span>
        {trend && (
          <span className="text-label-sm font-bold text-secondary">
            ↑ {trend.value}%{" "}
            <span className="font-normal text-on-surface-variant">vs last month</span>
          </span>
        )}
        {suffix && (
          <span className="text-label-sm text-on-surface-variant">{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  const { user, counts, recent, error } = loaderData;

  return (
    <div className="space-y-8">
      {error && <ErrorBanner message={error} />}

      {/* ── Hero Welcome ──────────────────────────────────────────────────── */}
      <section className="flex items-end justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            Welcome back, {user.displayName} 👋
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

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8 xl:col-span-9 lg:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="folder"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Total Projects"
            value={counts.projects}
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            icon="schedule"
            iconBg="bg-tertiary/10"
            iconColor="text-tertiary"
            label="Hours Edited"
            value="86.4 h"
            trend={{ value: 18, positive: true }}
          />
          <StatCard
            icon="download"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Exports"
            value="52"
            trend={{ value: 8, positive: true }}
          />
          <StatCard
            icon="inventory_2"
            iconBg="bg-secondary/10"
            iconColor="text-secondary"
            label="Storage Used"
            value="128 GB"
            suffix="12.8% of 1 TB"
          />
        </div>

        {/* Team Members card */}
        <div className="col-span-12 flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary/5 p-6 lg:col-span-4 xl:col-span-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <span className="material-symbols-outlined text-[20px] text-primary">group</span>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">Team Members</p>
              <p className="text-headline-md font-bold text-on-surface">8</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex -space-x-2">
              {TEAM_INITIALS.map((initial, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-label-sm font-bold text-on-surface ring-2 ring-surface"
                >
                  {initial}
                </div>
              ))}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-label-sm font-bold text-on-surface-variant ring-2 ring-surface">
                +3
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <span className="text-label-md text-on-surface-variant">6 active today</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Continue Editing ──────────────────────────────────────────────── */}
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {MOCK_CONTINUE_EDITING.map((project, i) => (
            <div
              key={project.id}
              className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30"
            >
              {/* Thumbnail */}
              <div className="relative h-44">
                <ProjectThumbnail index={i} />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

                {/* Status badge */}
                <div className="absolute left-3 top-3">
                  <StatusBadge status={project.status} />
                </div>

                {/* Upload overlay */}
                {project.status === "uploading" && project.uploadProgress != null && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/20 p-6">
                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface/60">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${project.uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-label-sm font-bold text-on-surface">
                      {project.uploadProgress}% • 2 mins left
                    </p>
                  </div>
                )}

                {/* Duration badge */}
                {project.duration !== "—" && (
                  <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
                    <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                    {project.duration}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="truncate text-body-sm font-bold text-on-surface">
                    {project.title}
                  </h3>
                  <button
                    type="button"
                    className="shrink-0 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                  </button>
                </div>
                <p className="mb-4 text-label-md text-on-surface-variant">{project.editedAgo}</p>
                <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
                  <span>{project.resolution}</span>
                  <span className="h-1 w-1 rounded-full bg-outline-variant" />
                  <span>{project.fps}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three Column Middle ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">
        {/* Pending Reviews */}
        <div className="col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-bold text-on-surface">
              Pending Reviews{" "}
              <span className="ml-2 rounded-full bg-error/20 px-1.5 py-0.5 text-label-sm text-error">
                5
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
            {MOCK_REVIEWS.map((review) => (
              <div key={review.id} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-label-md font-bold text-on-surface-variant">
                  {review.title.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-label-md font-bold text-on-surface">
                    {review.title}
                  </h4>
                  <p className="text-label-sm text-on-surface-variant">By {review.reviewer}</p>
                </div>
                <ReviewStatusBadge status={review.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Team Overview */}
        <div className="col-span-12 flex flex-col rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-5">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="font-bold text-on-surface">Team Overview</h3>
            <select className="rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-label-sm text-on-surface-variant outline-none">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="mb-8 grid grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { icon: "group", label: "Active Members", value: "6 / 8" },
                { icon: "assignment", label: "Projects in Progress", value: "12" },
                { icon: "check_circle", label: "Completed Projects", value: "8" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    {stat.icon}
                  </span>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-label-sm text-on-surface-variant">{stat.label}</span>
                    <span className="text-label-md font-bold text-on-surface">{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Mini activity chart */}
            <div className="flex items-end justify-between px-2">
              {[50, 75, 100, 90, 75, 40, 25].map((h, i) => (
                <div
                  key={i}
                  className={`w-3 rounded-t-sm ${i >= 2 && i <= 4 ? "bg-primary" : "bg-surface-container-high"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="flex w-fit items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-label-md font-bold text-primary transition-colors hover:bg-primary/20"
          >
            Invite Members
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="col-span-12 rounded-2xl border border-outline-variant bg-surface-container-low p-6 lg:col-span-3">
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
                  icon: "auto_awesome",
                  label: "AI Assistant",
                  to: "/dashboard/ai-tools",
                  color: "text-tertiary bg-tertiary/20",
                },
                {
                  icon: "create_new_folder",
                  label: "New Folder",
                  to: "/dashboard/projects",
                  color: "text-secondary bg-secondary/20",
                },
              ] as const
            ).map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="group flex flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container p-4 transition-colors hover:bg-surface-container-high"
              >
                <div
                  className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${action.color}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
                </div>
                <span className="text-label-sm font-bold text-on-surface-variant">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Section ────────────────────────────────────────────────── */}
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
              No projects yet — create one to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
              {recent.slice(0, 4).map((project, i) => (
                <Link
                  key={project.id}
                  to={
                    project.kind === ProjectKind.Video
                      ? `/editor/${project.id}`
                      : `/projects/${project.id}`
                  }
                  className="group space-y-3"
                >
                  <div className="aspect-video overflow-hidden rounded-xl border border-outline-variant transition-colors group-hover:border-primary/30">
                    <ProjectThumbnail index={i} />
                  </div>
                  <div>
                    <h4 className="truncate text-label-md font-bold text-on-surface">
                      {project.name}
                    </h4>
                    <p className="text-label-sm text-on-surface-variant">{project.status}</p>
                    <div className="mt-1 flex items-center gap-2 text-label-sm text-on-surface-variant">
                      <span>{projectKindLabel(project.kind)}</span>
                    </div>
                  </div>
                </Link>
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
