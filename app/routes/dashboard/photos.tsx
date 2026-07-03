import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import {
  CardOverflowMenu,
  FormActions,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { MediaKind, AlbumKind, PERSONAL, type MediaDto, type AlbumDto } from "~/lib/api";
import { ApiError, listMedia, softDelete, albumsApi } from "~/lib/api.server";
import { useLiveMedia } from "~/lib/media-realtime";
import type { MediaPipeline } from "~/lib/media-pipeline";
import { TextField, TextArea } from "~/components/dashboard/shared/form";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/photos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Photos - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      media: [] as MediaDto[],
      albums: [] as AlbumDto[],
      albumMediaCounts: {} as Record<string, number>,
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    const page = await listMedia(accessToken, PERSONAL, reqLog);
    const albums = (await albumsApi.listAlbums(accessToken, reqLog)).filter(
      (album) => album.kind === AlbumKind.Photo && album.isDeleteAble,
    );
    const albumMediaCounts = Object.fromEntries(
      await Promise.all(
        albums.map(async (album) => {
          const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
          return [album.id, albumMedia.items.filter((item) => item.kind === MediaKind.Image).length] as const;
        }),
      ),
    );
    return { media: page.items, albums, albumMediaCounts, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your media.";
    reqLog.error({ err: error }, "failed to load media");
    return { media: [] as MediaDto[], albums: [] as AlbumDto[], albumMediaCounts: {} as Record<string, number>, error: message };
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

    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? "folder").trim();
      
      if (!name) {
        return { error: "Enter a name for the album." };
      }
      
      await albumsApi.createAlbum(accessToken, PERSONAL, {
        name,
        description,
        kind: AlbumKind.Photo,
        materialSymbol
      }, reqLog);
      
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "media action failed");
    return { error: message };
  }
}



function formatSize(value: MediaDto["sizeBytes"]): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Pending";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function photoLabel(photo: MediaDto): string {
  const dimensions = photo.width && photo.height ? `${photo.width} x ${photo.height}` : null;
  return [dimensions, formatSize(photo.sizeBytes)].filter(Boolean).join(" / ");
}

function countAddedThisMonth(items: MediaDto[]): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return items.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt.getMonth() === month && createdAt.getFullYear() === year;
  }).length;
}

function PhotoCard({
  photo,
  index,
  listView,
  pipeline,
  onPreview,
}: {
  photo: MediaDto;
  index: number;
  listView: boolean;
  pipeline?: MediaPipeline | null;
  onPreview: (photo: MediaDto) => void;
}) {
  if (listView) {
    return (
      <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40">
        <button
          type="button"
          onClick={() => onPreview(photo)}
          className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-outline-variant"
          aria-label={`Preview ${photo.filename}`}
        >
          <MediaThumbnail media={photo} index={index} icon="image" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={photo.filename}>
            {photo.filename}
          </h3>
          <p className="mt-1 text-label-md text-on-surface-variant">{photoLabel(photo)}</p>
          <div className="mt-2">
            <MediaPipelineStatus media={photo} pipeline={pipeline} compact />
          </div>
        </div>
        <span className="hidden text-label-sm text-on-surface-variant sm:block">
          {formatDate(photo.createdAt)}
        </span>
        <CardOverflowMenu id={photo.id} itemLabel={photo.filename} />
      </div>
    );
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onPreview(photo)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPreview(photo);
          }
        }}
        className="relative aspect-[4/3] cursor-pointer overflow-hidden"
        aria-label={`Preview ${photo.filename}`}
      >
        <MediaThumbnail media={photo} index={index} icon="image" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute left-3 top-3 max-w-[calc(100%-5rem)]">
          <MediaPipelineStatus media={photo} pipeline={pipeline} compact />
        </div>
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          <CardOverflowMenu
            id={photo.id}
            itemLabel={photo.filename}
            buttonClassName="bg-surface-container-lowest/70 backdrop-blur-md hover:bg-surface-container-lowest/90"
          />
        </div>
        <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <h3 className="truncate text-label-md font-bold text-white" title={photo.filename}>
            {photo.filename}
          </h3>
          <p className="mt-1 text-label-sm text-white/75">{photoLabel(photo)}</p>
        </div>
      </div>
    </div>
  );
}

export default function Photos({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [searchParams] = useSearchParams();
  const pageView = searchParams.get("view");
  const [importOpen, setImportOpen] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [sort, setSort] = useState<"latest" | "name" | "size">("latest");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const initialPhotos = useMemo(
    () => loaderData.media.filter((item) => item.kind === MediaKind.Image),
    [loaderData.media],
  );
  const live = useLiveMedia(initialPhotos, { kind: MediaKind.Image });

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
    if (actionData?.ok) {
      if (actionData.intent === "create-album") setAlbumModalOpen(false);
    }
  }, [actionData]);

  const photos = useMemo(() => {
    return [...live.media].sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "size") return Number(b.sizeBytes) - Number(a.sizeBytes);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [live.media, sort]);

  const storageBytes = photos.reduce((total, photo) => total + Number(photo.sizeBytes), 0);
  const storageGb = storageBytes / (1024 * 1024 * 1024);
  const photosWithDimensions = photos.filter((photo) => photo.width && photo.height).length;
  const photosAddedThisMonth = countAddedThisMonth(photos);
  const previewPhoto = previewPhotoId
    ? photos.find((photo) => photo.id === previewPhotoId) ?? null
    : null;

  return (
    <section className="space-y-10">
      <PageHeader title="Photos" subtitle="Your photo library. Organize, edit, and enhance your visual assets.">
        <ViewToggle mode={layoutMode} onChange={setLayoutMode} />
        <SortDropdown
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { label: "Latest Added", value: "latest" },
            { label: "Name", value: "name" },
            { label: "File Size", value: "size" },
          ]}
        />
        <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Import photos
        </button>
      </PageHeader>

      {loaderData.error && <ErrorBanner message={loaderData.error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon="image" label="Total Photos" value={photos.length} detail={`${photosAddedThisMonth} added this month`} />
        <MetricCard icon="favorite" label="Favorites" value="0" detail="Coming soon" tone="tertiary" />
        <MetricCard icon="folder" label="Albums" value={loaderData.albums.length} tone="secondary" />
        <MetricCard
          icon="cloud"
          label="Storage Used"
          value={`${storageGb.toFixed(storageGb >= 10 ? 0 : 1)} GB`}
          detail="Personal library"
        />
        <MetricCard
          icon="auto_fix_high"
          label="Ready To Edit"
          value={photosWithDimensions}
          detail="With metadata"
          tone="tertiary"
        />
      </div>

      <section>
        <SectionHeader title="Recent Photos" actionOnClick={() => {}} />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/3] animate-pulse rounded-xl border border-outline-variant bg-surface-container-low"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState
            icon="photo_library"
            title="No photos yet"
            hint="Import an image file to start building your photo library."
            action={
              <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass()}>
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Import photos
              </button>
            }
          />
        ) : (
          <div
            className={
              layoutMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                : "space-y-3"
            }
          >
            {photos.slice(0, layoutMode === "grid" ? 12 : 10).map((photo, index) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={index}
                listView={layoutMode === "list"}
                pipeline={live.updatesById[photo.id]?.pipeline}
                onPreview={(nextPhoto) => setPreviewPhotoId(nextPhoto.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Albums" actionOnClick={() => {}} />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-xl border border-outline-variant bg-surface-container-low"
              />
            ))}
          </div>
        ) : loaderData.albums.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="No albums yet"
            hint="Create an album to start organizing your photos."
            action={
              <button type="button" onClick={() => setAlbumModalOpen(true)} className={primaryButtonClass()}>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Album
              </button>
            }
          />
        ) : (
          <AlbumGrid
            albums={loaderData.albums}
            counts={loaderData.albumMediaCounts}
            mediaLabel="photo"
            icon="folder_open"
            emptyTitle="No albums yet"
            emptyHint="Create an album to start organizing your photos."
            onCreate={() => setAlbumModalOpen(true)}
          />
        )}
      </section>

      <section ref={favoritesRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Favorites" />
        <EmptyState
          icon="favorite_border"
          title="No favorite photos yet"
          hint="Mark photos as favorites to find them quickly here."
        />
      </section>

      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import photo"
        fixedKind={MediaKind.Image}
        onUploaded={live.mergeMedia}
      />

      <MediaPreviewOverlay
        media={previewPhoto}
        pipeline={previewPhoto ? live.updatesById[previewPhoto.id]?.pipeline : null}
        onClose={() => setPreviewPhotoId(null)}
      />

      <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title="Create Album">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create-album" />
          
          <TextField 
            name="name" 
            label="Album Name" 
            placeholder="Summer Vacation" 
            required 
          />
          
          <TextArea 
            name="description" 
            label="Description (Optional)" 
            placeholder="Photos from our trip to Hawaii" 
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
