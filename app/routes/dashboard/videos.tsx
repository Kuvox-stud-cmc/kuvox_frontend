import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import {
  CardOverflowMenu,
  FilterButton,
  GradientThumbnail,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";

import { ApiError, albumsApi, listMedia, listMediaTrash, softDelete } from "~/lib/api.server";
import { getSession } from "~/lib/session.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { AlbumKind, MediaKind, PERSONAL, type AlbumDto, type MediaDto, type MediaTrashItem } from "~/lib/api";
import { useLiveMedia } from "~/lib/media-realtime";
import {
  isMediaInProgress,
  resolveMediaPipeline,
  type MediaPipeline,
} from "~/lib/media-pipeline";
import type { Route } from "./+types/videos";

export function meta() {
  return [{ title: "Videos · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return {
      videos: [] as MediaDto[],
      archived: [] as MediaTrashItem[],
      albums: [] as AlbumDto[],
      albumMediaCounts: {} as Record<string, number>,
      error: "Your session expired. Please sign in again.",
    };
  }

  const url = new URL(request.url);
  const studioId = url.searchParams.get("studioId");
  const workspace = studioId ? { kind: "studio" as const, studioId } : PERSONAL;

  try {
    const [videosRes, trashRes, allAlbums] = await Promise.all([
      listMedia(accessToken, workspace, reqLog),
      listMediaTrash(accessToken, workspace, reqLog),
      albumsApi.listAlbums(accessToken, reqLog),
    ]);
    const albums = allAlbums.filter((album) => album.kind === AlbumKind.Video && album.isDeleteAble);
    const albumMediaCounts = Object.fromEntries(
      await Promise.all(
        albums.map(async (album) => {
          const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
          return [album.id, albumMedia.items.filter((item) => item.kind === MediaKind.Video).length] as const;
        }),
      ),
    );

    return {
      videos: videosRes.items,
      archived: trashRes.items,
      albums,
      albumMediaCounts,
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your videos.";
    reqLog.error({ err: error }, "failed to load videos");
    return {
      videos: [] as MediaDto[],
      archived: [] as MediaTrashItem[],
      albums: [] as AlbumDto[],
      albumMediaCounts: {} as Record<string, number>,
      error: message,
    };
  }
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
    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "video action failed");
    return { error: message };
  }
}

function formatDuration(value: number | string | null): string {
  const sec = Number(value);
  if (!sec) return "—";
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function VideoPreviewFrame({
  label,
  onPreview,
  className,
  children,
}: {
  label: string;
  onPreview: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className={`group/preview relative block overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low ${className}`}
      aria-label={label}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/preview:bg-black/20 group-focus-visible/preview:bg-black/20" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest/75 text-on-surface shadow-xl backdrop-blur-md">
          <span className="material-symbols-outlined text-[22px]">play_arrow</span>
        </span>
      </span>
    </button>
  );
}

function VideoCard({
  video,
  index,
  listView,
  pipeline,
  onPreview,
}: {
  video: MediaDto;
  index: number;
  listView: boolean;
  pipeline?: MediaPipeline | null;
  onPreview: (video: MediaDto) => void;
}) {
  const pipelineState = resolveMediaPipeline(video, pipeline);
  const status = pipelineState.stage === "failed" ? "failed" : video.status.toLowerCase();
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
        <VideoPreviewFrame
          onPreview={() => onPreview(video)}
          className="h-20 w-32 shrink-0 rounded-lg border border-outline-variant"
          label={`Preview ${video.filename}`}
        >
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
            <MediaThumbnail media={video} index={index} icon="play_circle" />
          )}
        </VideoPreviewFrame>
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
        <MediaPipelineStatus media={video} pipeline={pipeline} compact />
        <CardOverflowMenu id={video.id} itemLabel={video.filename} />
      </div>
    );
  }

  /* ── Grid view: Failed card ───────────────────────────────────────────── */
  if (status === "failed") {
    return (
      <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-error/40">
        <VideoPreviewFrame
          onPreview={() => onPreview(video)}
          className="flex aspect-video w-full items-center justify-center bg-error/5"
          label={`Preview ${video.filename}`}
        >
          <div className="flex flex-col items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-error">
              <span className="material-symbols-outlined text-[20px] font-bold text-error">
                priority_high
              </span>
            </div>
          </div>
          <div className="absolute left-3 top-3">
            <MediaPipelineStatus media={video} pipeline={pipeline} compact />
          </div>
        </VideoPreviewFrame>
        <div className="p-4">
          <h3 className="truncate text-body-sm font-bold text-error">
            {video.filename}
          </h3>
          <p className="mt-1 text-label-md text-error/70">
            {pipelineState.detail}
          </p>
          <div className="mt-3 flex items-center justify-end">
            <CardOverflowMenu id={video.id} itemLabel={video.filename} />
          </div>
        </div>
      </article>
    );
  }

  /* ── Grid view: Uploading card ────────────────────────────────────────── */
  if (status === "uploading" || status === "uploaded") {
    return (
      <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30">
        <VideoPreviewFrame
          onPreview={() => onPreview(video)}
          className="flex aspect-video w-full items-center justify-center bg-surface-container"
          label={`Preview ${video.filename}`}
        >
          <div className="w-full px-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-sm font-bold text-primary">
                {pipelineState.label}
              </span>
              <span className="text-label-sm text-primary">
                {pipelineState.step}/{pipelineState.stepCount}
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
            <MediaPipelineStatus media={video} pipeline={pipeline} compact />
          </div>
        </VideoPreviewFrame>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="truncate text-body-sm font-bold text-on-surface">
              {video.filename}
            </h3>
            <CardOverflowMenu id={video.id} itemLabel={video.filename} />
          </div>
          <p className="mb-3 text-label-md text-on-surface-variant">
            {pipelineState.detail}
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
      <VideoPreviewFrame
        onPreview={() => onPreview(video)}
        className="aspect-video w-full"
        label={`Preview ${video.filename}`}
      >
        <MediaThumbnail media={video} index={index} icon="play_circle" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <MediaPipelineStatus media={video} pipeline={pipeline} compact />
        </div>

        {/* Processing overlay */}
        {status === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/40">
            <span className="text-label-md font-bold text-on-surface">
              {pipelineState.label}
            </span>
            <span className="mt-1 max-w-56 text-center text-label-sm text-on-surface-variant">
              {pipelineState.detail}
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
      </VideoPreviewFrame>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="truncate text-body-sm font-bold text-on-surface">
            {video.filename}
          </h3>
          <CardOverflowMenu id={video.id} itemLabel={video.filename} />
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
          <GradientThumbnail
            index={index}
            icon="archive"
            iconClassName="text-[24px] text-on-surface-variant/30"
            className="opacity-50"
          />
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
        <GradientThumbnail index={index} icon="archive" className="opacity-40" />
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

export default function Videos({ loaderData, actionData }: Route.ComponentProps) {
  const { videos: apiVideos, archived: apiArchived, albums, albumMediaCounts } = loaderData;
  const [searchParams] = useSearchParams();
  const studioId = searchParams.get("studioId");
  const initialVideos = useMemo(
    () => apiVideos.filter((item) => item.kind === MediaKind.Video),
    [apiVideos],
  );
  const live = useLiveMedia(initialVideos, { kind: MediaKind.Video });
  const pageView = searchParams.get("view");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "name">("latest");
  const [importOpen, setImportOpen] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  const archivedRef = useRef<HTMLElement>(null);
  const albumsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (pageView === "archived" && archivedRef.current) {
      archivedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (pageView === "albums" && albumsRef.current) {
      albumsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pageView]);

  const videos = [...live.media].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const previewVideo = previewVideoId
    ? videos.find((video) => video.id === previewVideoId) ?? null
    : null;
  const metrics = live.media.reduce(
    (acc, video) => {
      const pipeline = resolveMediaPipeline(video, live.updatesById[video.id]?.pipeline);
      const status = pipeline.stage;

      if (isMediaInProgress(video) || (!pipeline.terminal && ["queued", "optimizing", "ingesting"].includes(status))) {
        acc.inProgress += 1;
      }

      if (status === "ready") {
        acc.completed += 1;
      }

      if (status === "failed") {
        acc.failed += 1;
      }

      return acc;
    },
    {
      totalVideos: live.media.length,
      inProgress: 0,
      archived: apiArchived.length,
      completed: 0,
      failed: 0,
    },
  );

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
      {loaderData.error && <ErrorBanner message={loaderData.error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

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
          icon="videocam"
          label="Total Videos"
          value={metrics.totalVideos}
          tone="primary"
        />

        <MetricCard
          icon="pending"
          label="In Progress"
          value={metrics.inProgress}
          detail="Processing or uploaded"
          tone="primary"
        />

        <MetricCard
          icon="archive"
          label="Archived"
          value={metrics.archived}
          detail="In trash"
          tone="tertiary"
        />

        <MetricCard
          icon="check_circle"
          label="Completed"
          value={metrics.completed}
          detail="Ready"
          tone="secondary"
        />

        <MetricCard
          icon="error"
          label="Failed"
          value={metrics.failed}
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
                pipeline={live.updatesById[video.id]?.pipeline}
                onPreview={(nextVideo) => setPreviewVideoId(nextVideo.id)}
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
                pipeline={live.updatesById[video.id]?.pipeline}
                onPreview={(nextVideo) => setPreviewVideoId(nextVideo.id)}
              />
            ))}
            <CreateNewCard onClick={() => setImportOpen(true)} />
          </div>
        )}
      </section>

      {/* Albums */}
      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Albums" actionOnClick={() => {}} />
        {albums.length === 0 ? (
          <EmptyState
            icon="video_library"
            title="No video albums yet"
            hint="Create video albums from the Albums page to organize projects."
          />
        ) : (
          <AlbumGrid
            albums={albums}
            counts={albumMediaCounts}
            mediaLabel="video"
            icon="video_library"
            emptyTitle="No video albums yet"
            emptyHint="Create video albums from the Albums page to organize projects."
            columns="wide"
          />
        )}
      </section>

      {/* Archived Videos */}
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
      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import video"
        fixedKind={MediaKind.Video}
        studioId={studioId}
        onUploaded={live.mergeMedia}
      />
      <MediaPreviewOverlay
        media={previewVideo}
        pipeline={previewVideo ? live.updatesById[previewVideo.id]?.pipeline : null}
        onClose={() => setPreviewVideoId(null)}
      />
    </section>
  );
}
