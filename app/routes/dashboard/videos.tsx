import { useEffect, useRef, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";

import {
  CARD_GRADIENTS,
  FilterButton,
  GradientPlaceholder,
  MetricCard,
  PageHeader,
  ProgressRing,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, Modal, primaryButtonClass } from "~/components/dashboard/section";

import { listMedia, listMediaTrash } from "~/lib/api.server";
import { getSession } from "~/lib/session.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { PERSONAL, type MediaDto, type MediaTrashItem } from "~/lib/api";
import type { Route } from "./+types/videos";

export function meta() {
  return [{ title: "Videos · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken")!;

  const url = new URL(request.url);
  const studioId = url.searchParams.get("studioId");
  const workspace = studioId ? { kind: "studio" as const, studioId } : PERSONAL;

  const [videosRes, trashRes] = await Promise.all([
    listMedia(accessToken, workspace, reqLog),
    listMediaTrash(accessToken, workspace, reqLog),
  ]);

  return { videos: videosRes.items, archived: trashRes.items };
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ── Mock data (to be replaced by real API integration) ─────────────────── */

// Mock data replaced with loader data.

const MOCK_METRICS = {
  totalProjects: 24,
  inProgress: 6,
  rendering: 2,
  renderingProgress: 45,
  completed: 14,
  failed: 2,
};



function StatusBadge({ status }: { status: string }) {
  const normStatus = status.toLowerCase();
  const config = {
    ready: {
      label: "Ready",
      dotCls: "bg-secondary",
      cls: "bg-secondary/20 text-secondary",
    },
    uploaded: {
      label: "Uploaded",
      dotCls: "bg-primary",
      cls: "bg-primary/20 text-primary",
    },
    processing: {
      label: "Processing",
      dotCls: "bg-tertiary animate-pulse",
      cls: "bg-tertiary/20 text-tertiary",
    },
    failed: {
      label: "Failed",
      dotCls: "bg-error",
      cls: "bg-error/20 text-error",
    },
  }[normStatus] || {
    label: status,
    dotCls: "bg-outline",
    cls: "bg-surface-container-high text-on-surface-variant",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold backdrop-blur-md ${config.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotCls}`} />
      {config.label}
    </span>
  );
}



function VideoCard({
  video,
  index,
  listView,
}: {
  video: MediaDto;
  index: number;
  listView: boolean;
}) {
  const status = video.status.toLowerCase();
  const res = video.width && video.height ? `${video.width}x${video.height}` : "—";
  const fpsStr = "—";

  /* ── List view ────────────────────────────────────────────────────────── */
  if (listView) {
    return (
      <div
        className={`group flex items-center gap-4 rounded-xl border bg-surface-container-low p-3 transition-colors ${status === "failed"
            ? "border-error/30 hover:border-error/50"
            : "border-outline-variant hover:border-primary/40"
          }`}
      >
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-outline-variant">
          {status === "failed" ? (
            <div className="flex h-full w-full items-center justify-center bg-error/5">
              <span className="material-symbols-outlined text-[24px] text-error">
                error
              </span>
            </div>
          ) : status === "uploading" || status === "uploaded" ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-surface-container p-2">
              <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `100%` }}
                />
              </div>
              <span className="text-label-sm text-primary">
                100%
              </span>
            </div>
          ) : (
            <GradientPlaceholder index={index} icon="play_circle" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-body-sm font-bold ${status === "failed" ? "text-error" : "text-on-surface"}`}
            title={video.filename}
          >
            {video.filename}
          </h3>
          <p
            className={`mt-1 text-label-md ${status === "failed" ? "text-error/70" : "text-on-surface-variant"}`}
          >
            {new Date(video.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-label-sm text-on-surface-variant sm:flex">
          {video.durationSeconds != null && <span>{formatDuration(video.durationSeconds)}</span>}
          {res !== "—" && (
            <>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span>{res}</span>
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
  if (status === "failed") {
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
            {video.filename}
          </h3>
          <p className="mt-1 text-label-md text-error/70">
            Import failed.
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
  if (status === "uploading" || status === "uploaded") {
    return (
      <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
        <div className="relative flex aspect-video items-center justify-center bg-surface-container">
          <div className="w-full px-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-sm font-bold text-primary">
                Uploading
              </span>
              <span className="text-label-sm text-primary">
                100%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `100%` }}
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
              {video.filename}
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
            {(video.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
            <span>{res}</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span>{fpsStr}</span>
          </div>
        </div>
      </article>
    );
  }

  /* ── Grid view: Ready / Processing card ───────────────────────────────── */
  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <div className="relative aspect-video overflow-hidden">
        <GradientPlaceholder index={index} icon="play_circle" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <StatusBadge status={video.status} />
        </div>

        {/* Processing overlay */}
        {status === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/40">
            <span className="text-label-md font-bold text-on-surface">
              Ready to edit
            </span>
          </div>
        )}

        {/* Duration badge */}
        {video.durationSeconds != null && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
            <span className="material-symbols-outlined text-[12px]">
              play_arrow
            </span>
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="truncate text-body-sm font-bold text-on-surface">
            {video.filename}
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
          {new Date(video.createdAt).toLocaleDateString()}
        </p>
        <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">
              videocam
            </span>
            {res}
          </span>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <span>{fpsStr}</span>
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

function ArchivedVideoCard({
  video,
  index,
  listView,
}: {
  video: MediaTrashItem;
  index: number;
  listView: boolean;
}) {
  if (listView) {
    return (
      <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40">
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-outline-variant">
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} opacity-50`}
          >
            <span className="material-symbols-outlined text-[24px] text-on-surface-variant/30">
              archive
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-sm font-bold text-on-surface/70" title={video.filename}>
            {video.filename}
          </h3>
          <p className="mt-1 text-label-md text-on-surface-variant">
            Archived {new Date(video.deletedAt).toLocaleDateString()}
          </p>
        </div>
        <span className="hidden rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant sm:inline-flex">
          Purges in {video.purgesInDays} days
        </span>
        <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
          {/* Missing duration / resolution on trash items */}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-secondary/10 hover:text-secondary"
            title="Restore"
          >
            <span className="material-symbols-outlined text-[18px]">unarchive</span>
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
            title="Delete permanently"
          >
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
      <div className="relative aspect-video overflow-hidden">
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} opacity-40`}
        >
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant/20">
            archive
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high/80 px-2 py-0.5 text-label-sm font-bold text-on-surface-variant backdrop-blur-md">
            <span className="material-symbols-outlined text-[12px]">archive</span>
            Archived
          </span>
        </div>
        {/* Trash item no duration atm */}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="truncate text-body-sm font-bold text-on-surface/70">{video.filename}</h3>
          <button
            type="button"
            className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        </div>
        <p className="mb-2 text-label-md text-on-surface-variant">
          Archived {new Date(video.deletedAt).toLocaleDateString()}
        </p>
        <p className="mb-3 text-label-sm text-on-surface-variant/60">Purges in {video.purgesInDays} days</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
            {/* Resolution missing in DTO */}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg px-2.5 py-1 text-label-sm font-medium text-secondary transition-colors hover:bg-secondary/10"
            >
              Restore
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:text-error"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Videos({ loaderData }: Route.ComponentProps) {
  const { videos: apiVideos, archived: apiArchived } = loaderData;
  const [searchParams] = useSearchParams();
  const pageView = searchParams.get("view");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "name">("latest");
  const [importOpen, setImportOpen] = useState(false);

  const archivedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (pageView === "archived" && archivedRef.current) {
      archivedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pageView]);

  const videos = [...apiVideos].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <section className="space-y-10">
      <PageHeader title="Videos" subtitle="Manage and edit your video projects.">
        <ViewToggle mode={view} onChange={setView} />
        <SortDropdown
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { label: "Latest Modified", value: "latest" },
            { label: "Name", value: "name" },
          ]}
        />
        <FilterButton />
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className={primaryButtonClass()}
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Import Video
        </button>
      </PageHeader>

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
        <SectionHeader title="Recent Projects" actionOnClick={() => {}} />

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

      {/* ── Archived Videos ────────────────────────────────────────────────── */}
      <section ref={archivedRef} style={{ scrollMarginTop: "6rem" }}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                archive
              </span>
            </div>
            <div>
              <h2 className="text-headline-md font-bold text-on-surface">Archived</h2>
              <p className="text-label-sm text-on-surface-variant">
                {apiArchived.length} archived project{apiArchived.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {apiArchived.length === 0 ? (
          <EmptyState
            icon="archive"
            title="No archived videos"
            hint="Archive videos you no longer need to keep your workspace clean."
          />
        ) : view === "list" ? (
          <div className="space-y-3">
            {apiArchived.map((video, i) => (
              <ArchivedVideoCard key={video.id} video={video} index={i} listView />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {apiArchived.map((video, i) => (
              <ArchivedVideoCard key={video.id} video={video} index={i} listView={false} />
            ))}
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
