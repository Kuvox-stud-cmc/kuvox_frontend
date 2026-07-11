import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, redirect, useNavigation } from "react-router";

import {
  AssetCard,
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
import { ShareDialog } from "~/components/dashboard/shared/resource-dialogs";
import { MediaPreviewOverlay, resolveMediaObjectSource } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { AlbumKind, MediaKind, PERSONAL, type AlbumDto, type MediaDto } from "~/lib/api";
import { albumsApi, ApiError, listAllMedia, listSharedAlbums, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/album-detail";

interface AlbumDetailRouteData {
  album: AlbumDto | null;
  media: MediaDto[];
  compatibleMedia: MediaDto[];
  isShared: boolean;
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
  const isShared = new URL(request.url).searchParams.get("shared") === "true";

  if (!accessToken) {
    return {
      album: null,
      media: [],
      compatibleMedia: [],
      isShared,
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    const [albums, allMedia] = await Promise.all([
      isShared ? listSharedAlbums(accessToken, reqLog) : albumsApi.listAlbums(accessToken, reqLog),
      isShared ? Promise.resolve([] as MediaDto[]) : listAllMedia(accessToken, PERSONAL, reqLog),
    ]);
    const album = albums.find((item) => item.id === albumId && item.isDeleteAble === true && !isReservedAudioCategoryAlbum(item)) ?? null;
    if (!album) {
      return {
        album: null,
        media: [],
        compatibleMedia: [],
        isShared,
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
      compatibleMedia: isShared ? [] : compatibleMedia,
      isShared,
      error: null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load this album.";
    reqLog.error({ err: error, albumId }, "failed to load album detail");
    return { album: null, media: [], compatibleMedia: [], isShared, error: message };
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
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

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

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
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
    const message = actionErrorMessage(error);
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
  const isShared = loaderData.isShared;

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
          to={loaderData.isShared ? "/dashboard/shared-assets" : "/dashboard/albums"}
          className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {loaderData.isShared ? "Shared Assets" : "Albums"}
        </Link>
        {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link
          to={isShared ? "/dashboard/shared-assets" : `/dashboard/albums?view=${albumKindView(album.kind)}`}
          className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {isShared ? "Shared Assets" : "Albums"}
        </Link>
        <PageHeader
          title={album.name}
          subtitle={album.description || "No description provided."}
        >
          {!isShared ? (
            <>
              <IconToggleButton
                id={album.id}
                active={album.isFavorite}
                intent="toggle-album-favorite"
                activeIcon="favorite"
                inactiveIcon="favorite_border"
                activeClassName="text-error"
                label={`${album.isFavorite ? "Remove from" : "Add to"} favorites`}
              />
              <ShareDialog resourceType="album" resourceId={album.id} resourceName={album.name} />
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
            </>
          ) : null}
        </PageHeader>
      </div>

      {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      {actionData?.error ? <ErrorBanner message={actionData.error} /> : null}

      <div className="flex flex-wrap gap-2">
        <StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} />
        <StatusBadge label={`${loaderData.media.length} item${loaderData.media.length === 1 ? "" : "s"}`} tone="neutral" />
        <StatusBadge label={isShared ? "Shared album" : "User album"} tone="neutral" />
      </div>

      <SectionHeader title="Media" count={loaderData.media.length}>
        {!isShared ? (
          <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass("px-3 py-1.5")}>
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        ) : null}
      </SectionHeader>

      {loaderData.media.length === 0 ? (
        <EmptyState
          icon={album.materialSymbol || albumKindIcon(album.kind)}
          title="No media in this album yet"
          hint={isShared ? "The owner has not added media to this shared album yet." : "Add compatible media from your library to build this collection."}
          action={!isShared ? (
            <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass()}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add media
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loaderData.media.map((item, index) => (
            <AlbumMediaCard
              key={item.id}
              media={item}
              album={album}
              index={index}
              canManage={!isShared}
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

      {!isShared ? (
        <AlbumAddItemsModal
          open={addMediaOpen}
          album={album}
          media={loaderData.compatibleMedia}
          isSubmitting={isSubmitting}
          onClose={() => setAddMediaOpen(false)}
        />
      ) : null}

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
  canManage,
  onPreview,
}: {
  media: MediaDto;
  album: AlbumDto;
  index: number;
  canManage: boolean;
  onPreview: () => void;
}) {
  return (
    <AssetCard
      media={media}
      index={index}
      workspaceKind="personal"
      canMoveToRecycleBin={canManage}
      onPreview={onPreview}
      secondaryAction={
        canManage ? (
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
        ) : null
      }
    />
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [media?.id]);

  useEffect(() => {
    if (!source) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => setIsPlaying(false));
    }
  }, [source?.src]);

  if (!media) return null;

  const resolvedDuration = duration > 0 ? duration : Number(media.durationSeconds ?? 0);
  const progress =
    resolvedDuration > 0 ? Math.min(100, Math.max(0, (currentTime / resolvedDuration) * 100)) : 0;

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !source) return;
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise) playPromise.catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || resolvedDuration <= 0) return;
    const nextTime = Math.min(Math.max(ratio, 0), 1) * resolvedDuration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    seekToRatio((event.clientX - rect.left) / rect.width);
  };

  const skipBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = clampAudioTime(audio.currentTime + seconds, resolvedDuration);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-lg border border-outline-variant bg-surface-container-low p-3 shadow-xl">
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!source}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isPlaying ? "Pause audio preview" : "Play audio preview"}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">
                graphic_eq
              </span>
              <h2 className="truncate text-body-sm font-semibold text-on-surface">{media.filename}</h2>
            </div>
            <p className="mt-0.5 text-label-sm text-on-surface-variant">
              Shared audio preview
            </p>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => skipBy(-10)}
              disabled={!source}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Skip back 10 seconds"
            >
              <span className="material-symbols-outlined text-[18px]">replay_10</span>
            </button>
            <button
              type="button"
              onClick={() => skipBy(10)}
              disabled={!source}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Skip forward 10 seconds"
            >
              <span className="material-symbols-outlined text-[18px]">forward_10</span>
            </button>
          </div>

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
          <>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span className="w-10 font-mono text-label-sm text-on-surface-variant">
                {formatDurationLabel(currentTime)}
              </span>
              <div
                ref={seekRef}
                role="slider"
                aria-label="Seek audio preview"
                aria-valuemin={0}
                aria-valuemax={Math.round(resolvedDuration || 0)}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
                onPointerDown={(event) => {
                  event.preventDefault();
                  seekFromPointer(event);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    skipBy(-5);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    skipBy(5);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    seekToRatio(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    seekToRatio(1);
                  } else if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    togglePlayback();
                  }
                }}
                className="group flex h-8 cursor-pointer items-center outline-none"
              >
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-surface-container-low opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ left: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="w-10 text-right font-mono text-label-sm text-on-surface-variant">
                {formatDurationLabel(resolvedDuration)}
              </span>
            </div>

            <audio
              key={source.src}
              ref={audioRef}
              src={source.src}
              preload="metadata"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
              onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={(event) => {
                setIsPlaying(false);
                setCurrentTime(event.currentTarget.duration || 0);
              }}
              onError={() => setIsPlaying(false)}
            />
          </>
        ) : (
          <p className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant">
            This audio file is still processing or has no playable canonical object yet.
          </p>
        )}
      </div>
    </div>
  );
}

function clampAudioTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(value, 0), duration);
}

function formatDurationLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

