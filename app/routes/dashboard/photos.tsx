import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import {
  AssetCard,
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
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { MediaKind, AlbumKind, PERSONAL, type MediaDto, type AlbumDto } from "~/lib/api";
import { ApiError, listMedia, renameMedia, setMediaFavorite, softDelete, albumsApi } from "~/lib/api.server";
import { useLiveMedia } from "~/lib/media-realtime";
import { TextField, TextArea } from "~/components/dashboard/shared/form";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
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
      (album) => album.kind === AlbumKind.Photo && album.isDeleteAble === true,
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
    reqLog.error({ err: error, intent }, "media action failed");
    return { error: message };
  }
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

export default function Photos({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [searchParams] = useSearchParams();
  const pageView = searchParams.get("view");
  const assetDetailsId = searchParams.get("asset");
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
  const favoritePhotos = photos.filter((photo) => photo.isFavorite);
  const showAllRecent = pageView === "recent";
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
        <MetricCard icon="favorite" label="Favorites" value={favoritePhotos.length} tone="tertiary" />
        <MetricCard icon="folder" label="Albums" value={loaderData.albums.length} tone="secondary" />
        <MetricCard
          icon="cloud"
          label="Loaded Photo Storage"
          value={`${storageGb.toFixed(storageGb >= 10 ? 0 : 1)} GB`}
          detail="Current page summary"
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
        <SectionHeader title="All Photos" actionTo="/dashboard/photos?view=recent" />

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
            {(showAllRecent ? photos : photos.slice(0, 4)).map((photo, index) => (
              <AssetCard
                key={photo.id}
                media={photo}
                index={index}
                workspaceKind="personal"
                listView={layoutMode === "list"}
                pipeline={live.updatesById[photo.id]?.pipeline}
                onPreview={(nextPhoto) => setPreviewPhotoId(nextPhoto.id)}
                defaultDetailsOpen={assetDetailsId === photo.id}
              />
            ))}
          </div>
        )}
      </section>

      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Albums" actionTo="/dashboard/albums?view=photo" />
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
            limit={5}
            getAlbumTo={(album) => `/dashboard/albums/${album.id}`}
          />
        )}
      </section>

      <section ref={favoritesRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Favorites" />
        {favoritePhotos.length === 0 ? (
          <EmptyState
            icon="favorite_border"
            title="No favorite photos yet"
            hint="Mark photos as favorites to find them quickly here."
          />
        ) : (
          <div
            className={
              layoutMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                : "space-y-3"
            }
          >
            {favoritePhotos.map((photo, index) => (
              <AssetCard
                key={photo.id}
                media={photo}
                index={index}
                workspaceKind="personal"
                listView={layoutMode === "list"}
                pipeline={live.updatesById[photo.id]?.pipeline}
                onPreview={(nextPhoto) => setPreviewPhotoId(nextPhoto.id)}
                defaultDetailsOpen={assetDetailsId === photo.id}
              />
            ))}
          </div>
        )}
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
