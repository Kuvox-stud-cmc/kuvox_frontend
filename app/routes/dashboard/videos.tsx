import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import {
  AssetCard,
  FilterButton,
  FormActions,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, ErrorBanner, Modal, primaryButtonClass } from "~/components/dashboard/section";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";

import { ApiError, albumsApi, listMedia, renameMedia, setMediaFavorite, softDelete } from "~/lib/api.server";
import { getSession } from "~/lib/session.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { AlbumKind, MediaKind, PERSONAL, type AlbumDto, type MediaDto } from "~/lib/api";
import { useLiveMedia } from "~/lib/media-realtime";
import {
  isMediaInProgress,
  resolveMediaPipeline,
} from "~/lib/media-pipeline";
import type { Route } from "./+types/videos";

export function meta() {
  return [{ title: "Videos - Kuvox" }];
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
      albums: [] as AlbumDto[],
      albumMediaCounts: {} as Record<string, number>,
      error: "Your session expired. Please sign in again.",
    };
  }

  const url = new URL(request.url);
  const studioId = url.searchParams.get("studioId");
  const workspace = studioId ? { kind: "studio" as const, studioId } : PERSONAL;

  try {
    const [videosRes, allAlbums] = await Promise.all([
      listMedia(accessToken, workspace, reqLog),
      albumsApi.listAlbums(accessToken, reqLog),
    ]);
    const albums = allAlbums.filter((album) => album.kind === AlbumKind.Video && album.isDeleteAble === true);
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
      albums,
      albumMediaCounts,
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your videos.";
    reqLog.error({ err: error }, "failed to load videos");
    return {
      videos: [] as MediaDto[],
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
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (id) {
        await setMediaFavorite(accessToken, id, isFavorite, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-album-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (id) {
        await albumsApi.setFavorite(accessToken, id, isFavorite, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? "video_library").trim();

      if (!name) {
        return { error: "Enter a name for the album." };
      }

      const url = new URL(request.url);
      const studioId = url.searchParams.get("studioId");
      const workspace = studioId ? { kind: "studio" as const, studioId } : PERSONAL;

      await albumsApi.createAlbum(accessToken, workspace, {
        name,
        description,
        kind: AlbumKind.Video,
        materialSymbol,
      }, reqLog);

      return { ok: true, intent };
    }

    if (intent === "rename") {
      const id = String(formData.get("id") ?? "").trim();
      const name = String(formData.get("name") ?? "").trim();
      if (id && name) {
        await renameMedia(accessToken, id, name, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent }, "video action failed");
    return { error: message };
  }
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

// Main component

export default function Videos({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { videos: apiVideos, albums, albumMediaCounts } = loaderData;
  const [searchParams] = useSearchParams();
  const studioId = searchParams.get("studioId");
  const initialVideos = useMemo(
    () => apiVideos.filter((item) => item.kind === MediaKind.Video),
    [apiVideos],
  );
  const live = useLiveMedia(initialVideos, { kind: MediaKind.Video });
  const pageView = searchParams.get("view");
  const assetDetailsId = searchParams.get("asset");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "name">("latest");
  const [importOpen, setImportOpen] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  const albumsRef = useRef<HTMLElement>(null);
  const favoritesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (pageView === "albums" && albumsRef.current) {
      albumsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (pageView === "favorites" && favoritesRef.current) {
      favoritesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pageView]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create-album") {
      setAlbumModalOpen(false);
    }
  }, [actionData]);

  const videos = [...live.media].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const favoriteVideos = useMemo(() => videos.filter((video) => video.isFavorite), [videos]);
  const previewVideo = previewVideoId
    ? videos.find((video) => video.id === previewVideoId) ?? null
    : null;
  const showAllRecent = pageView === "recent";
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
      favorites: live.media.filter((video) => video.isFavorite).length,
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

      {/* Hero Drop Zone */}
      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="w-full relative overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-10 transition-colors hover:border-primary/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
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
        </div>
      </button>

      {/* Metrics Row */}
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
          icon="favorite"
          label="Favorites"
          value={metrics.favorites}
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

      {/* All Videos */}
      <section>
        <SectionHeader title="All Videos" actionTo="/dashboard/videos?view=recent" />

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
            {(showAllRecent ? videos : videos.slice(0, 4)).map((video, i) => (
              <AssetCard
                key={video.id}
                media={video}
                index={i}
                workspaceKind="personal"
                listView
                pipeline={live.updatesById[video.id]?.pipeline}
                onPreview={(nextVideo) => setPreviewVideoId(nextVideo.id)}
                defaultDetailsOpen={assetDetailsId === video.id}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(showAllRecent ? videos : videos.slice(0, 4)).map((video, i) => (
              <AssetCard
                key={video.id}
                media={video}
                index={i}
                workspaceKind="personal"
                pipeline={live.updatesById[video.id]?.pipeline}
                onPreview={(nextVideo) => setPreviewVideoId(nextVideo.id)}
                defaultDetailsOpen={assetDetailsId === video.id}
              />
            ))}
            <CreateNewCard onClick={() => setImportOpen(true)} />
          </div>
        )}
      </section>

      {/* Albums */}
      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader
          title="Albums"
          actionTo="/dashboard/albums?view=video"
        />
        {albums.length === 0 ? (
          <EmptyState
            icon="video_library"
            title="No video albums yet"
            hint="Create an album to start organizing your videos."
            action={
              <button type="button" onClick={() => setAlbumModalOpen(true)} className={primaryButtonClass()}>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Album
              </button>
            }
          />
        ) : (
          <AlbumGrid
            albums={albums}
            counts={albumMediaCounts}
            mediaLabel="video"
            icon="video_library"
            emptyTitle="No video albums yet"
            emptyHint="Create an album to start organizing your videos."
            columns="wide"
            onCreate={() => setAlbumModalOpen(true)}
            limit={5}
            getAlbumTo={(album) => `/dashboard/albums/${album.id}`}
          />
        )}
      </section>

      {/* Favorites */}
      <section ref={favoritesRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Favorites" />
        {favoriteVideos.length === 0 ? (
          <EmptyState
            icon="favorite_border"
            title="No favorite videos yet"
            hint="Mark videos as favorites to find them quickly here."
          />
        ) : (
          <div className={view === "list" ? "space-y-3" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {favoriteVideos.map((video, i) => (
              <AssetCard
                key={`fav-${video.id}`}
                media={video}
                index={i}
                workspaceKind="personal"
                listView={view === "list"}
                pipeline={live.updatesById[video.id]?.pipeline}
                onPreview={(nextVideo) => setPreviewVideoId(nextVideo.id)}
                defaultDetailsOpen={assetDetailsId === video.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Import Modal */}
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
      <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title="Create Video Album">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create-album" />

          <TextField
            name="name"
            label="Album Name"
            placeholder="Launch videos"
            required
          />

          <TextArea
            name="description"
            label="Description (Optional)"
            placeholder="Video clips and edits for this collection"
            rows={3}
          />

          <IconPicker
            name="materialSymbol"
            label="Album Icon"
          />

          <FormActions
            onCancel={() => setAlbumModalOpen(false)}
            submitLabel={navigation.state === "submitting" ? "Creating..." : "Create Album"}
            isSubmitting={navigation.state === "submitting"}
          />
        </Form>
      </Modal>
    </section>
  );
}
