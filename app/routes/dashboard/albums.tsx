import { useEffect, useMemo, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import {
  CardOverflowMenu,
  FilterTabs,
  FormActions,
  GradientThumbnail,
  MetricCard,
  PageHeader,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { AlbumKind, MediaKind, PERSONAL, type AlbumDto, type MediaDto } from "~/lib/api";
import { albumsApi, ApiError, listMedia } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/albums";

type AlbumView = "all" | "mixed" | "photo" | "video" | "audio" | "shared" | "favorites";

interface AlbumRouteData {
  albums: AlbumDto[];
  media: MediaDto[];
  albumMedia: Record<string, MediaDto[]>;
  error: string | null;
}

const albumViews: Array<{ value: AlbumView; label: string }> = [
  { value: "all", label: "All" },
  { value: "mixed", label: "Mixed" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "shared", label: "Shared" },
  { value: "favorites", label: "Favorites" },
];

const albumKindOptions = [
  { value: AlbumKind.Mixed, label: "Mixed", icon: "collections" },
  { value: AlbumKind.Photo, label: "Photo", icon: "photo_library" },
  { value: AlbumKind.Video, label: "Video", icon: "videocam" },
  { value: AlbumKind.Audio, label: "Audio", icon: "music_note" },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Albums - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs): Promise<AlbumRouteData> {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      albums: [],
      media: [],
      albumMedia: {},
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    const [allAlbums, mediaPage] = await Promise.all([
      albumsApi.listAlbums(accessToken, reqLog),
      listMedia(accessToken, PERSONAL, reqLog),
    ]);
    const albums = allAlbums.filter((album) => album.isDeleteAble);
    const albumMediaEntries = await Promise.all(
      albums.map(async (album) => {
        const page = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
        return [album.id, page.items] as const;
      }),
    );

    return {
      albums,
      media: mediaPage.items,
      albumMedia: Object.fromEntries(albumMediaEntries),
      error: null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your albums.";
    reqLog.error({ err: error }, "failed to load albums");
    return { albums: [], media: [], albumMedia: {}, error: message };
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
    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? "collections").trim();
      const kind = Number(formData.get("kind") ?? AlbumKind.Mixed);

      if (!name) {
        return { error: "Enter a name for the album." };
      }

      if (!(Object.values(AlbumKind) as number[]).includes(kind)) {
        return { error: "Choose a valid album type." };
      }

      await albumsApi.createAlbum(
        accessToken,
        PERSONAL,
        { name, description, kind, materialSymbol },
        reqLog,
      );
      return { ok: true, intent };
    }

    if (intent === "delete-album") {
      const id = String(formData.get("id") ?? "");
      if (!id) {
        return { error: "Choose an album to delete." };
      }

      await albumsApi.deleteAlbum(accessToken, id, reqLog);
      return { ok: true, intent };
    }

    if (intent === "add-media") {
      const albumId = String(formData.get("albumId") ?? "");
      const mediaIds = formData.getAll("mediaIds").map((id) => String(id));
      if (!albumId) {
        return { error: "Choose an album." };
      }
      if (mediaIds.length === 0) {
        return { error: "Select at least one media item." };
      }

      await albumsApi.addMedia(accessToken, albumId, mediaIds, reqLog);
      return { ok: true, intent };
    }

    if (intent === "remove-media") {
      const albumId = String(formData.get("albumId") ?? "");
      const mediaId = String(formData.get("mediaId") ?? "");
      if (!albumId || !mediaId) {
        return { error: "Choose a media item to remove." };
      }

      await albumsApi.removeMedia(accessToken, albumId, [mediaId], reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "album action failed");
    return { error: message };
  }
}

export default function Albums({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const currentView = normalizeView(searchParams.get("view"));

  useEffect(() => {
    if (actionData?.ok) {
      if (actionData.intent === "create-album") setCreateOpen(false);
      if (actionData.intent === "add-media") setAddMediaOpen(false);
    }
  }, [actionData]);

  const albumCounts = useMemo(
    () => ({
      all: loaderData.albums.length,
      mixed: loaderData.albums.filter((album) => album.kind === AlbumKind.Mixed).length,
      photo: loaderData.albums.filter((album) => album.kind === AlbumKind.Photo).length,
      video: loaderData.albums.filter((album) => album.kind === AlbumKind.Video).length,
      audio: loaderData.albums.filter((album) => album.kind === AlbumKind.Audio).length,
      shared: 0,
      favorites: 0,
    }),
    [loaderData.albums],
  );
  const filterItems = albumViews.map((view) => ({
    ...view,
    count: albumCounts[view.value],
  }));
  const filteredAlbums = useMemo(
    () => filterAlbums(loaderData.albums, currentView),
    [currentView, loaderData.albums],
  );
  const selectedAlbum =
    loaderData.albums.find((album) => album.id === selectedAlbumId) ?? filteredAlbums[0] ?? null;
  const selectedAlbumMedia = selectedAlbum ? loaderData.albumMedia[selectedAlbum.id] ?? [] : [];
  const compatibleMedia = selectedAlbum
    ? loaderData.media.filter(
        (media) =>
          acceptsMediaKind(selectedAlbum.kind, media.kind) &&
          !selectedAlbumMedia.some((item) => item.id === media.id),
      )
    : [];
  const totalAlbumItems = Object.values(loaderData.albumMedia).reduce(
    (total, items) => total + items.length,
    0,
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title="Albums"
        subtitle="Organize photos, videos, and audio into reusable media collections."
      >
        <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create album
        </button>
      </PageHeader>

      {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      {actionData?.error ? <ErrorBanner message={actionData.error} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon="collections" label="Total Albums" value={loaderData.albums.length} />
        <MetricCard
          icon="perm_media"
          label="Album Items"
          value={totalAlbumItems}
          detail="Media organized"
          tone="secondary"
        />
        <MetricCard
          icon="category"
          label="Mixed Albums"
          value={albumCounts.mixed}
          detail="Accept all media"
        />
      </div>

      <FilterTabs
        items={filterItems}
        value={currentView}
        onChange={(value) => {
          if (value === "all") {
            setSearchParams({});
            return;
          }
          setSearchParams({ view: value });
        }}
        variant="boxed"
      />

      {currentView === "shared" || currentView === "favorites" ? (
        <EmptyState
          icon={currentView === "shared" ? "share" : "favorite_border"}
          title={currentView === "shared" ? "Shared albums are not available yet" : "Favorite albums are not available yet"}
          hint="The backend album response does not expose this state yet."
        />
      ) : filteredAlbums.length === 0 ? (
        <EmptyState
          icon="collections_bookmark"
          title="No albums found"
          hint="Create an album to start organizing your media."
          action={
            <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create album
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="grid content-start grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredAlbums.map((album, index) => (
              <AlbumCard
                key={album.id}
                album={album}
                count={loaderData.albumMedia[album.id]?.length ?? 0}
                index={index}
                selected={album.id === selectedAlbum?.id}
                onSelect={() => setSelectedAlbumId(album.id)}
              />
            ))}
          </div>

          <AlbumDetail
            album={selectedAlbum}
            media={selectedAlbumMedia}
            onAddMedia={() => setAddMediaOpen(true)}
          />
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create album">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create-album" />
          <TextField name="name" label="Album name" placeholder="Campaign launch" required />
          <TextArea
            name="description"
            label="Description"
            placeholder="Assets for the launch edit"
            rows={3}
          />
          <label className="block">
            <span className="mb-1 block text-label-md text-on-surface-variant">Album type</span>
            <select
              name="kind"
              defaultValue={AlbumKind.Mixed}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
            >
              {albumKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <IconPicker name="materialSymbol" label="Album icon" />
          <FormActions
            onCancel={() => setCreateOpen(false)}
            submitLabel={isSubmitting ? "Creating..." : "Create album"}
            isSubmitting={isSubmitting}
          />
        </Form>
      </Modal>

      <Modal
        open={addMediaOpen && Boolean(selectedAlbum)}
        onClose={() => setAddMediaOpen(false)}
        title={selectedAlbum ? `Add media to ${selectedAlbum.name}` : "Add media"}
      >
        {selectedAlbum ? (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="add-media" />
            <input type="hidden" name="albumId" value={selectedAlbum.id} />
            {compatibleMedia.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant p-4 text-center text-body-sm text-on-surface-variant">
                No compatible media is available to add.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {compatibleMedia.map((media) => (
                  <label
                    key={media.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40"
                  >
                    <input
                      type="checkbox"
                      name="mediaIds"
                      value={media.id}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                      {mediaKindIcon(media.kind)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-on-surface">
                      {media.filename}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {mediaKindLabel(media.kind)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <FormActions
              onCancel={() => setAddMediaOpen(false)}
              submitLabel={isSubmitting ? "Adding..." : "Add selected"}
              isSubmitting={isSubmitting}
              disabled={compatibleMedia.length === 0}
            />
          </Form>
        ) : null}
      </Modal>
    </section>
  );
}

function AlbumCard({
  album,
  count,
  index,
  selected,
  onSelect,
}: {
  album: AlbumDto;
  count: number;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`group overflow-hidden rounded-xl border bg-surface-container-low transition-colors ${
        selected ? "border-primary/70" : "border-outline-variant hover:border-primary/40"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative aspect-video overflow-hidden border-b border-outline-variant">
          <GradientThumbnail
            index={index}
            icon={album.materialSymbol || albumKindIcon(album.kind)}
            iconClassName="text-[34px] text-on-surface-variant/35"
          />
          <div className="absolute left-3 top-3">
            <StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} />
          </div>
          {!album.isDeleteAble ? (
            <div className="absolute right-3 top-3 rounded-lg bg-surface-container-lowest/70 px-2 py-1 backdrop-blur-md">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
            </div>
          ) : null}
        </div>
      </button>
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={album.name}>
            {album.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-9 text-label-md text-on-surface-variant">
            {album.description || `${count} media item${count === 1 ? "" : "s"}`}
          </p>
          <p className="mt-3 text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {count} item{count === 1 ? "" : "s"}
          </p>
        </button>
        {album.isDeleteAble ? (
          <CardOverflowMenu
            id={album.id}
            itemLabel={album.name}
            intent="delete-album"
            confirmMessage="Delete this album permanently? Media files will remain in your library."
          />
        ) : null}
      </div>
    </article>
  );
}

function AlbumDetail({
  album,
  media,
  onAddMedia,
}: {
  album: AlbumDto | null;
  media: MediaDto[];
  onAddMedia: () => void;
}) {
  if (!album) {
    return null;
  }

  return (
    <aside className="sticky top-6 h-fit rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
          <span className="material-symbols-outlined text-[24px]">
            {album.materialSymbol || albumKindIcon(album.kind)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-headline-sm font-bold text-on-surface">{album.name}</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {album.description || "No description provided."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} />
        <StatusBadge
          label={album.isDeleteAble ? "User album" : "System album"}
          tone={album.isDeleteAble ? "neutral" : "warning"}
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-label-md font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          Media
        </h3>
        <button type="button" onClick={onAddMedia} className={primaryButtonClass("px-3 py-1.5")}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add
        </button>
      </div>

      {media.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-outline-variant p-4 text-center text-body-sm text-on-surface-variant">
          No media in this album yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {media.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container p-2"
            >
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                {mediaKindIcon(item.kind)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-md font-semibold text-on-surface" title={item.filename}>
                  {item.filename}
                </p>
                <p className="text-label-sm text-on-surface-variant">{mediaKindLabel(item.kind)}</p>
              </div>
              <ConfirmSubmitButton
                fields={{ intent: "remove-media", albumId: album.id, mediaId: item.id }}
                title="Remove media from album?"
                message={
                  <>
                    Remove <span className="font-medium text-on-surface">{item.filename}</span> from{" "}
                    <span className="font-medium text-on-surface">{album.name}</span>?
                  </>
                }
                confirmLabel="Remove media"
                ariaLabel={`Remove ${item.filename} from ${album.name}`}
                buttonClassName="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </ConfirmSubmitButton>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function normalizeView(value: string | null): AlbumView {
  if (
    value === "mixed" ||
    value === "photo" ||
    value === "video" ||
    value === "audio" ||
    value === "shared" ||
    value === "favorites"
  ) {
    return value;
  }
  return "all";
}

function filterAlbums(albums: AlbumDto[], view: AlbumView) {
  if (view === "mixed") return albums.filter((album) => album.kind === AlbumKind.Mixed);
  if (view === "photo") return albums.filter((album) => album.kind === AlbumKind.Photo);
  if (view === "video") return albums.filter((album) => album.kind === AlbumKind.Video);
  if (view === "audio") return albums.filter((album) => album.kind === AlbumKind.Audio);
  if (view === "shared" || view === "favorites") return [];
  return albums;
}

function acceptsMediaKind(albumKind: number, mediaKind: number) {
  if (albumKind === AlbumKind.Mixed) return true;
  if (albumKind === AlbumKind.Photo) return mediaKind === MediaKind.Image;
  if (albumKind === AlbumKind.Video) return mediaKind === MediaKind.Video;
  if (albumKind === AlbumKind.Audio) return mediaKind === MediaKind.Audio;
  return false;
}

function albumKindLabel(kind: number) {
  if (kind === AlbumKind.Photo) return "Photo";
  if (kind === AlbumKind.Video) return "Video";
  if (kind === AlbumKind.Audio) return "Audio";
  return "Mixed";
}

function albumKindIcon(kind: number) {
  if (kind === AlbumKind.Photo) return "photo_library";
  if (kind === AlbumKind.Video) return "videocam";
  if (kind === AlbumKind.Audio) return "music_note";
  return "collections";
}

function albumKindTone(kind: number) {
  if (kind === AlbumKind.Photo) return "info" as const;
  if (kind === AlbumKind.Video) return "primary" as const;
  if (kind === AlbumKind.Audio) return "success" as const;
  return "neutral" as const;
}

function mediaKindIcon(kind: number) {
  if (kind === MediaKind.Image) return "image";
  if (kind === MediaKind.Audio) return "graphic_eq";
  return "movie";
}

function mediaKindLabel(kind: number) {
  if (kind === MediaKind.Image) return "Photo";
  if (kind === MediaKind.Audio) return "Audio";
  return "Video";
}
