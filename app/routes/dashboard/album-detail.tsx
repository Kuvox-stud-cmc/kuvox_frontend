import { useEffect, useMemo, useState } from "react";
import { Link, redirect, useNavigation } from "react-router";

import {
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { AlbumAddItemsModal } from "~/components/dashboard/albums/album-add-items-modal";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { MediaPreviewOverlay, resolveMediaObjectSource } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { AlbumKind, MediaKind, PERSONAL, type AlbumDto, type MediaDto } from "~/lib/api";
import { albumsApi, ApiError, listAllMedia } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/album-detail";

interface AlbumDetailRouteData {
  album: AlbumDto | null;
  media: MediaDto[];
  compatibleMedia: MediaDto[];
  error: string | null;
}

export function meta({ data }: Route.MetaArgs) {
  const title = data?.album ? `${data.album.name} - Albums - Kuvox` : "Album - Kuvox";
  return [{ title }];
}

export async function loader({ request, params }: Route.LoaderArgs): Promise<AlbumDetailRouteData> {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const albumId = params.albumId;

  if (!accessToken) {
    return {
      album: null,
      media: [],
      compatibleMedia: [],
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    const [albums, allMedia] = await Promise.all([
      albumsApi.listAlbums(accessToken, reqLog),
      listAllMedia(accessToken, PERSONAL, reqLog),
    ]);
    const album = albums.find((item) => item.id === albumId && item.isDeleteAble === true && !isReservedAudioCategoryAlbum(item)) ?? null;
    if (!album) {
      return {
        album: null,
        media: [],
        compatibleMedia: [],
        error: "Album not found.",
      };
    }

    const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
    const albumMediaIds = new Set(albumMedia.items.map((item) => item.id));
    const compatibleMedia = allMedia.filter(
      (item) => acceptsMediaKind(album.kind, item.kind) && !albumMediaIds.has(item.id),
    );

    return {
      album,
      media: albumMedia.items,
      compatibleMedia,
      error: null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load this album.";
    reqLog.error({ err: error, albumId }, "failed to load album detail");
    return { album: null, media: [], compatibleMedia: [], error: message };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
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
  const albumId = String(formData.get("albumId") ?? params.albumId ?? "");

  try {
    const albums = await albumsApi.listAlbums(accessToken, reqLog);
    const album = albums.find((item) => item.id === albumId);
    if (!album || album.isDeleteAble !== true || isReservedAudioCategoryAlbum(album)) {
      return { error: "Album not found." };
    }

    if (intent === "toggle-album-favorite") {
      const id = String(formData.get("id") ?? albumId);
      if (id !== album.id) {
        return { error: "Choose an album." };
      }
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (!id) {
        return { error: "Choose an album." };
      }

      await albumsApi.setFavorite(accessToken, id, isFavorite, reqLog);
      return { ok: true, intent };
    }

    if (intent === "delete-album") {
      const id = String(formData.get("id") ?? albumId);
      if (id !== album.id) {
        return { error: "Choose an album to delete." };
      }
      if (!id) {
        return { error: "Choose an album to delete." };
      }

      await albumsApi.deleteAlbum(accessToken, id, reqLog);
      return redirect("/dashboard/albums");
    }

    if (intent === "add-media") {
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
    reqLog.error({ err: error, intent, albumId }, "album detail action failed");
    return { error: message };
  }
}

export default function AlbumDetail({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const [audioPreviewId, setAudioPreviewId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const album = loaderData.album;

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "add-media") {
      setAddMediaOpen(false);
    }
  }, [actionData]);

  const previewMedia = useMemo(
    () => loaderData.media.find((item) => item.id === previewMediaId) ?? null,
    [loaderData.media, previewMediaId],
  );
  const audioPreview = useMemo(
    () => loaderData.media.find((item) => item.id === audioPreviewId) ?? null,
    [loaderData.media, audioPreviewId],
  );

  if (!album) {
    return (
      <section className="space-y-6">
        <Link
          to="/dashboard/albums"
          className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Albums
        </Link>
        {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link
          to={`/dashboard/albums?view=${albumKindView(album.kind)}`}
          className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Albums
        </Link>
        <PageHeader
          title={album.name}
          subtitle={album.description || "No description provided."}
        >
          <IconToggleButton
            id={album.id}
            active={album.isFavorite}
            intent="toggle-album-favorite"
            activeIcon="favorite"
            inactiveIcon="favorite_border"
            activeClassName="text-error"
            label={`${album.isFavorite ? "Remove from" : "Add to"} favorites`}
          />
          <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add media
          </button>
          <ConfirmSubmitButton
            fields={{ intent: "delete-album", id: album.id }}
            title="Delete album"
            message="Delete this album permanently? Media files will remain in your library."
            confirmLabel="Delete album"
            buttonClassName="inline-flex items-center gap-1.5 rounded-lg border border-error/30 px-4 py-2 text-label-md font-medium text-error transition-colors hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </ConfirmSubmitButton>
        </PageHeader>
      </div>

      {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      {actionData?.error ? <ErrorBanner message={actionData.error} /> : null}

      <div className="flex flex-wrap gap-2">
        <StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} />
        <StatusBadge label={`${loaderData.media.length} item${loaderData.media.length === 1 ? "" : "s"}`} tone="neutral" />
        <StatusBadge label="User album" tone="neutral" />
      </div>

      <SectionHeader title="Media" count={loaderData.media.length}>
        <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass("px-3 py-1.5")}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add
        </button>
      </SectionHeader>

      {loaderData.media.length === 0 ? (
        <EmptyState
          icon={album.materialSymbol || albumKindIcon(album.kind)}
          title="No media in this album yet"
          hint="Add compatible media from your library to build this collection."
          action={
            <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass()}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add media
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loaderData.media.map((item, index) => (
            <AlbumMediaCard
              key={item.id}
              media={item}
              album={album}
              index={index}
              onPreview={() => {
                if (item.kind === MediaKind.Audio) {
                  setAudioPreviewId(item.id);
                } else {
                  setPreviewMediaId(item.id);
                }
              }}
            />
          ))}
        </div>
      )}

      <AlbumAddItemsModal
        open={addMediaOpen}
        album={album}
        media={loaderData.compatibleMedia}
        isSubmitting={isSubmitting}
        onClose={() => setAddMediaOpen(false)}
      />

      <MediaPreviewOverlay
        media={previewMedia}
        onClose={() => setPreviewMediaId(null)}
      />
      <CompactAudioPreview
        media={audioPreview}
        onClose={() => setAudioPreviewId(null)}
      />
    </section>
  );
}

function AlbumMediaCard({
  media,
  album,
  index,
  onPreview,
}: {
  media: MediaDto;
  album: AlbumDto;
  index: number;
  onPreview: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onPreview}
        className="relative block aspect-video w-full overflow-hidden text-left"
        aria-label={`Preview ${media.filename}`}
      >
        <MediaThumbnail media={media} index={index} icon={mediaKindIcon(media.kind)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute left-3 top-3 rounded-md bg-surface-container-lowest/70 px-2 py-0.5 text-label-sm font-medium text-on-surface backdrop-blur-md">
          {mediaKindLabel(media.kind)}
        </span>
      </button>
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-sm font-bold text-on-surface" title={media.filename}>
            {media.filename}
          </h3>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {formatDate(media.createdAt)}
          </p>
        </div>
        <ConfirmSubmitButton
          fields={{ intent: "remove-media", albumId: album.id, mediaId: media.id }}
          title="Remove media from album?"
          message={
            <>
              Remove <span className="font-medium text-on-surface">{media.filename}</span> from{" "}
              <span className="font-medium text-on-surface">{album.name}</span>?
            </>
          }
          confirmLabel="Remove media"
          ariaLabel={`Remove ${media.filename} from ${album.name}`}
          buttonClassName="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </ConfirmSubmitButton>
      </div>
    </article>
  );
}

function CompactAudioPreview({
  media,
  onClose,
}: {
  media: MediaDto | null;
  onClose: () => void;
}) {
  const source = useMemo(
    () => (media ? resolveMediaObjectSource(media, ["canonical"]) : null),
    [media?.id, media?.canonicalStorageKey],
  );

  if (!media) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-body-md font-bold text-on-surface">{media.filename}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Close audio preview"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          {source ? (
            <audio key={source.src} src={source.src} controls autoPlay className="mt-3 w-full" />
          ) : (
            <p className="mt-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant">
              This audio file is still processing or has no playable canonical object yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function acceptsMediaKind(albumKind: number, mediaKind: number) {
  if (albumKind === AlbumKind.Mixed) return true;
  if (albumKind === AlbumKind.Photo) return mediaKind === MediaKind.Image;
  if (albumKind === AlbumKind.Video) return mediaKind === MediaKind.Video;
  if (albumKind === AlbumKind.Audio) return mediaKind === MediaKind.Audio;
  return false;
}

function normalizeAudioAlbumName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function audioCategoryKeyForAlbum(name: string): "music" | "sfx" | "voiceovers" | null {
  const normalized = normalizeAudioAlbumName(name);
  if (normalized === "music") return "music";
  if (normalized === "soundeffects" || normalized === "soundeffect" || normalized === "sfx") return "sfx";
  if (normalized === "voiceover" || normalized === "voiceovers") return "voiceovers";
  return null;
}

function isReservedAudioCategoryAlbum(album: AlbumDto): boolean {
  return album.kind === AlbumKind.Audio && audioCategoryKeyForAlbum(album.name) !== null;
}

function albumKindView(kind: number) {
  if (kind === AlbumKind.Photo) return "photo";
  if (kind === AlbumKind.Video) return "video";
  if (kind === AlbumKind.Audio) return "audio";
  return "all";
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
