import { useState } from "react";

import {
  EmptyState,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Videos · Kuvox" }];
}

/* ── Mock data (to be replaced by real API integration) ─────────────────── */

interface MockVideo {
  id: string;
  title: string;
  editedAgo: string;
  status: "ready" | "uploading" | "processing" | "failed";
  duration: string;
  resolution: string;
  fps: string;
  uploadProgress?: number;
  uploadSize?: string;
  errorMessage?: string;
}

const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "v1",
    title: "Cinematic B-Roll Vol 1",
    editedAgo: "2 hours ago",
    status: "ready",
    duration: "04:20",
    resolution: "4K",
    fps: "24fps",
  },
  {
    id: "v2",
    title: "Client Interview Raw",
    editedAgo: "Uploading 2.4 GB of 4 GB",
    status: "uploading",
    duration: "—",
    resolution: "1080p",
    fps: "30fps",
    uploadProgress: 45,
    uploadSize: "2.4 GB of 4 GB",
  },
  {
    id: "v3",
    title: "Drone Footage - City Night",
    editedAgo: "Yesterday",
    status: "processing",
    duration: "12:05",
    resolution: "4K",
    fps: "60fps",
  },
  {
    id: "v4",
    title: "Corrupted_File_01.mp4",
    editedAgo: "Import failed",
    status: "failed",
    duration: "—",
    resolution: "—",
    fps: "—",
    errorMessage: "Import failed. Retry?",
  },
  {
    id: "v5",
    title: "Music Video Teaser",
    editedAgo: "3 days ago",
    status: "ready",
    duration: "01:15",
    resolution: "4K",
    fps: "24fps",
  },
];

const MOCK_METRICS = {
  totalProjects: 24,
  inProgress: 6,
  rendering: 2,
  renderingProgress: 45,
  completed: 14,
  failed: 2,
};

const THUMBNAIL_GRADIENTS = [
  "from-primary/20 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
  "from-secondary/15 via-surface-container to-primary/15",
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function VideoThumbnail({ index }: { index: number }) {
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

function StatusBadge({ status }: { status: MockVideo["status"] }) {
  const config = {
    ready: {
      label: "Ready",
      dotCls: "bg-secondary",
      cls: "bg-secondary/20 text-secondary",
    },
    processing: {
      label: "Processing",
      dotCls: "bg-tertiary animate-pulse",
      cls: "bg-tertiary/20 text-tertiary",
    },
    uploading: {
      label: "Uploading",
      dotCls: "bg-primary",
      cls: "bg-primary/20 text-primary",
    },
    failed: {
      label: "Failed",
      dotCls: "bg-error",
      cls: "bg-error/20 text-error",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold backdrop-blur-md ${config.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotCls}`} />
      {config.label}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "primary",
  children,
}: {
  icon: string;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "primary" | "secondary" | "tertiary" | "error";
  children?: React.ReactNode;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
    error: "bg-error/10 text-error",
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <span className="text-label-md font-medium text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-headline-md font-bold text-on-surface">
            {value}
          </span>
          {detail && (
            <p className="mt-1 text-label-sm text-on-surface-variant">
              {detail}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** SVG circular progress ring for the Rendering metric. */
function ProgressRing({
  progress,
  size = 44,
  strokeWidth = 3,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-tertiary"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "stroke-dashoffset 0.35s ease",
          }}
        />
      </svg>
      <span className="absolute text-label-sm font-bold text-on-surface">
        {progress}%
      </span>
    </div>
  );
}

function VideoCard({
  video,
  index,
  listView,
}: {
  video: MockVideo;
  index: number;
  listView: boolean;
}) {
  /* ── List view ────────────────────────────────────────────────────────── */
  if (listView) {
    return (
      <div
        className={`group flex items-center gap-4 rounded-xl border bg-surface-container-low p-3 transition-colors ${
          video.status === "failed"
            ? "border-error/30 hover:border-error/50"
            : "border-outline-variant hover:border-primary/40"
        }`}
      >
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-outline-variant">
          {video.status === "failed" ? (
            <div className="flex h-full w-full items-center justify-center bg-error/5">
              <span className="material-symbols-outlined text-[24px] text-error">
                error
              </span>
            </div>
          ) : video.status === "uploading" ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-surface-container p-2">
              <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${video.uploadProgress ?? 0}%` }}
                />
              </div>
              <span className="text-label-sm text-primary">
                {video.uploadProgress}%
              </span>
            </div>
          ) : (
            <VideoThumbnail index={index} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-body-sm font-bold ${video.status === "failed" ? "text-error" : "text-on-surface"}`}
            title={video.title}
          >
            {video.title}
          </h3>
          <p
            className={`mt-1 text-label-md ${video.status === "failed" ? "text-error/70" : "text-on-surface-variant"}`}
          >
            {video.status === "failed"
              ? video.errorMessage
              : video.editedAgo}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-label-sm text-on-surface-variant sm:flex">
          {video.duration !== "—" && <span>{video.duration}</span>}
          {video.resolution !== "—" && (
            <>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span>{video.resolution}</span>
            </>
          )}
        </div>
        <StatusBadge status={video.status} />
        <button
          type="button"
          className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">
            more_horiz
          </span>
        </button>
      </div>
    );
  }

  /* ── Grid view: Failed card ───────────────────────────────────────────── */
  if (video.status === "failed") {
    return (
      <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-error/40">
        <div className="relative flex aspect-video items-center justify-center bg-error/5">
          <div className="flex flex-col items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-error">
              <span className="material-symbols-outlined text-[20px] font-bold text-error">
                priority_high
              </span>
            </div>
          </div>
          <div className="absolute left-3 top-3">
            <StatusBadge status="failed" />
          </div>
        </div>
        <div className="p-4">
          <h3 className="truncate text-body-sm font-bold text-error">
            {video.title}
          </h3>
          <p className="mt-1 text-label-md text-error/70">
            {video.errorMessage}
          </p>
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">
                more_horiz
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  /* ── Grid view: Uploading card ────────────────────────────────────────── */
  if (video.status === "uploading") {
    return (
      <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
        <div className="relative flex aspect-video items-center justify-center bg-surface-container">
          <div className="w-full px-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-sm font-bold text-primary">
                Uploading
              </span>
              <span className="text-label-sm text-primary">
                {video.uploadProgress}% • 2 mins left
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${video.uploadProgress}%` }}
              />
            </div>
          </div>
          <div className="absolute left-3 top-3">
            <StatusBadge status="uploading" />
          </div>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="truncate text-body-sm font-bold text-on-surface">
              {video.title}
            </h3>
            <button
              type="button"
              className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">
                more_horiz
              </span>
            </button>
          </div>
          <p className="mb-3 text-label-md text-on-surface-variant">
            Uploading {video.uploadSize}
          </p>
          <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
            <span>{video.resolution}</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span>{video.fps}</span>
          </div>
        </div>
      </article>
    );
  }

  /* ── Grid view: Ready / Processing card ───────────────────────────────── */
  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <div className="relative aspect-video overflow-hidden">
        <VideoThumbnail index={index} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <StatusBadge status={video.status} />
        </div>

        {/* Processing overlay */}
        {video.status === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/40">
            <span className="text-label-md font-bold text-on-surface">
              Ready to edit
            </span>
          </div>
        )}

        {/* Duration badge */}
        {video.duration !== "—" && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
            <span className="material-symbols-outlined text-[12px]">
              play_arrow
            </span>
            {video.duration}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="truncate text-body-sm font-bold text-on-surface">
            {video.title}
          </h3>
          <button
            type="button"
            className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">
              more_horiz
            </span>
          </button>
        </div>
        <p className="mb-3 text-label-md text-on-surface-variant">
          {video.editedAgo}
        </p>
        <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">
              videocam
            </span>
            {video.resolution}
          </span>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <span>{video.fps}</span>
        </div>
      </div>
    </article>
  );
}

function CreateNewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 transition-colors hover:border-primary/40 hover:bg-surface-container"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high transition-transform group-hover:scale-110">
        <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
          add
        </span>
      </div>
      <h3 className="text-body-sm font-bold text-on-surface">
        Create New Project
      </h3>
      <p className="mt-1 text-label-md text-on-surface-variant">
        Start from scratch
      </p>
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Videos() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "name">("latest");
  const [importOpen, setImportOpen] = useState(false);

  const videos = [...MOCK_VIDEOS].sort((a, b) => {
    if (sort === "name") return a.title.localeCompare(b.title);
    return 0; // "latest" — mock data is already in order
  });

  return (
    <section className="space-y-10">
      {/* ── Page Header + Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            Videos
          </h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Manage and edit your video projects.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* View toggle */}
          <div className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              View
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={`rounded-md p-1.5 transition-colors ${
                  view === "grid"
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  grid_view
                </span>
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  view === "list"
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  view_list
                </span>
              </button>
            </div>
          </div>

          {/* Sort */}
          <label className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Sort by
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none transition-colors hover:border-primary/40 focus:border-primary"
            >
              <option value="latest">Latest Modified</option>
              <option value="name">Name</option>
            </select>
          </label>

          {/* Filter */}
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">
              filter_list
            </span>
            Filter
          </button>

          {/* Import CTA */}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={primaryButtonClass()}
          >
            <span className="material-symbols-outlined text-[18px]">
              upload
            </span>
            Import Video
          </button>
        </div>
      </div>

      {/* ── Hero Drop Zone ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-10 transition-colors hover:border-primary/30">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-secondary/5 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-high">
            <span className="material-symbols-outlined text-[28px] text-primary">
              upload_file
            </span>
          </div>
          <h3 className="text-headline-md font-bold text-on-surface">
            New video project
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Drag and drop video files here, or click to browse.
          </p>
          <p className="mt-2 text-label-sm text-on-surface-variant/50">
            MP4, MOV, WebM up to 4GB
          </p>

          <div className="mt-8 flex gap-6">
            {[
              { icon: "note_add", label: "Import Files" },
              { icon: "screen_record", label: "Record Screen" },
              { icon: "auto_awesome", label: "AI Auto Edit" },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                className="group flex flex-col items-center gap-2 rounded-xl p-4 transition-colors hover:bg-surface-container"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low transition-colors group-hover:border-primary/30 group-hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-colors group-hover:text-primary">
                    {action.icon}
                  </span>
                </div>
                <span className="text-label-md font-medium text-on-surface-variant">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Metrics Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon="folder"
          label="Total Projects"
          value={MOCK_METRICS.totalProjects}
          tone="primary"
        >
          <span className="text-label-sm font-bold text-secondary">
            ↑ 12%{" "}
            <span className="font-normal text-on-surface-variant">
              vs last month
            </span>
          </span>
        </MetricCard>

        <MetricCard
          icon="pending"
          label="In Progress"
          value={MOCK_METRICS.inProgress}
          detail="Currently editing"
          tone="primary"
        />

        <MetricCard
          icon="bolt"
          label="Rendering"
          value={MOCK_METRICS.rendering}
          detail="Rendering videos"
          tone="tertiary"
        >
          <ProgressRing progress={MOCK_METRICS.renderingProgress} />
        </MetricCard>

        <MetricCard
          icon="check_circle"
          label="Completed"
          value={MOCK_METRICS.completed}
          detail="Ready to export"
          tone="secondary"
        />

        <MetricCard
          icon="error"
          label="Failed"
          value={MOCK_METRICS.failed}
          detail="Need attention"
          tone="error"
        />
      </div>

      {/* ── Recent Projects ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">
            Recent Projects
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>

        {videos.length === 0 ? (
          <EmptyState
            icon="videocam"
            title="No videos yet"
            hint="Upload or record videos to get started."
            action={
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className={primaryButtonClass()}
              >
                <span className="material-symbols-outlined text-[18px]">
                  upload
                </span>
                Import Video
              </button>
            }
          />
        ) : view === "list" ? (
          <div className="space-y-3">
            {videos.map((video, i) => (
              <VideoCard
                key={video.id}
                video={video}
                index={i}
                listView
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video, i) => (
              <VideoCard
                key={video.id}
                video={video}
                index={i}
                listView={false}
              />
            ))}
            <CreateNewCard onClick={() => setImportOpen(true)} />
          </div>
        )}
      </section>

      {/* ── Import Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import video"
      >
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Registers a video record now; real file upload to storage lands in a
          later phase.
        </p>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="video-filename"
              className="block text-label-md text-on-surface-variant"
            >
              Filename
            </label>
            <input
              id="video-filename"
              type="text"
              placeholder="travel-vlog-final.mp4"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className={primaryButtonClass()}
            >
              Import
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
