import { useEffect, useMemo, useState } from "react";
import { Link, redirect, useNavigation } from "react-router";

import { PageHeader, SectionHeader, StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import { ConfirmSubmitButton, EmptyState, ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import { AlbumAddItemsModal } from "~/components/dashboard/albums/album-add-items-modal";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { AlbumKind, MediaKind, OwnerKind, canWriteStudioContent, type AlbumDto, type MediaDto, type Workspace } from "~/lib/api";
import { albumsApi, ApiError, listAllMedia, listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/media-album-detail";

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.album ? `${data.album.name} - Studio albums - Kuvox` : "Studio album - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;
  const albumId = params.albumId;

  if (!accessToken) {
    return { album: null as AlbumDto | null, media: [] as MediaDto[], compatibleMedia: [] as MediaDto[], canWrite: false, error: "Your session expired. Please sign in again." };
  }

  try {
    const ws = studioWs(studioId);
    const [albums, allMedia, studios] = await Promise.all([
      albumsApi.listAlbums(accessToken, ws, reqLog),
      listAllMedia(accessToken, ws, reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const album = albums.find((item) => item.id === albumId && isStudioAlbum(item, studioId) && item.isDeleteAble === true) ?? null;
    if (!album) return { album: null, media: [], compatibleMedia: [], canWrite: false, error: "Album not found." };

    const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, ws, reqLog);
    const albumMediaIds = new Set(albumMedia.items.map((item) => item.id));
    const compatibleMedia = allMedia.filter((item) => acceptsMediaKind(album.kind, item.kind) && !albumMediaIds.has(item.id));
    const role = studios.find((studio) => studio.id === studioId)?.role;

    return {
      album,
      media: albumMedia.items,
      compatibleMedia,
      canWrite: role != null ? canWriteStudioContent(role) : false,
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load this Studio album.";
    reqLog.error({ err: error, studioId, albumId }, "failed to load Studio album detail");
    return { album: null, media: [] as MediaDto[], compatibleMedia: [] as MediaDto[], canWrite: false, error: message };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const albumId = String(params.albumId ?? "");
  const studioId = String(params.studioId ?? "");

  if (!accessToken) return { error: "Your session expired. Please sign in again." };

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const ws = studioWs(studioId);

  try {
    if (intent === "delete-album") {
      await albumsApi.deleteAlbum(accessToken, albumId, ws, reqLog);
      return redirect(`/teams/${studioId}/media/albums`);
    }
    if (intent === "add-media") {
      const mediaIds = formData.getAll("mediaIds").map((id) => String(id));
      if (mediaIds.length === 0) return { error: "Select at least one media item." };
      await albumsApi.addMedia(accessToken, albumId, mediaIds, ws, reqLog);
      return { ok: true, intent };
    }
    if (intent === "remove-media") {
      const mediaId = String(formData.get("mediaId") ?? "");
      if (!mediaId) return { error: "Choose a media item to remove." };
      await albumsApi.removeMedia(accessToken, albumId, [mediaId], ws, reqLog);
      return { ok: true, intent };
    }
    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent, studioId, albumId }, "Studio album detail action failed");
    return { error: message };
  }
}

export default function TeamAlbumDetail({ loaderData, actionData, params }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const album = loaderData.album;
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "add-media") setAddMediaOpen(false);
  }, [actionData]);

  const previewMedia = useMemo(() => loaderData.media.find((item) => item.id === previewMediaId) ?? null, [loaderData.media, previewMediaId]);

  if (!album) {
    return (
      <section className="space-y-6">
        <Link to={`/teams/${params.studioId}/media/albums`} className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Studio albums
        </Link>
        {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link to={`/teams/${params.studioId}/media/albums?view=${albumKindView(album.kind)}`} className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-fixed">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Studio albums
        </Link>
        <PageHeader title={album.name} subtitle={album.description || "No description provided."}>
          {loaderData.canWrite ? (
            <>
              <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass()}>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add media
              </button>
              <ConfirmSubmitButton fields={{ intent: "delete-album", id: album.id }} title="Delete album" message="Delete this Studio album permanently? Media files will remain in the Studio library." confirmLabel="Delete album" buttonClassName="inline-flex items-center gap-1.5 rounded-lg border border-error/30 px-4 py-2 text-label-md font-medium text-error transition-colors hover:bg-error/10">
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
        <StatusBadge label="Studio album" tone="neutral" />
      </div>

      <SectionHeader title="Media" count={loaderData.media.length}>
        {loaderData.canWrite ? (
          <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass("px-3 py-1.5")}>
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        ) : null}
      </SectionHeader>

      {loaderData.media.length === 0 ? (
        <EmptyState icon={album.materialSymbol || albumKindIcon(album.kind)} title="No media in this album yet" hint="Add compatible media from this Studio's library to build this collection." action={loaderData.canWrite ? (
          <button type="button" onClick={() => setAddMediaOpen(true)} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add media
          </button>
        ) : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loaderData.media.map((item, index) => (
            <AlbumMediaCard key={item.id} media={item} album={album} index={index} canWrite={loaderData.canWrite} onPreview={() => setPreviewMediaId(item.id)} />
          ))}
        </div>
      )}

      {loaderData.canWrite ? (
        <AlbumAddItemsModal open={addMediaOpen} album={album} media={loaderData.compatibleMedia} isSubmitting={isSubmitting} studioId={params.studioId} onClose={() => setAddMediaOpen(false)} />
      ) : null}
      <MediaPreviewOverlay media={previewMedia} onClose={() => setPreviewMediaId(null)} />
    </section>
  );
}

function AlbumMediaCard({ media, album, index, canWrite, onPreview }: { media: MediaDto; album: AlbumDto; index: number; canWrite: boolean; onPreview: () => void }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <button type="button" onClick={onPreview} className="relative block aspect-video w-full overflow-hidden text-left" aria-label={`Preview ${media.filename}`}>
        <MediaThumbnail media={media} index={index} icon={mediaKindIcon(media.kind)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute left-3 top-3 rounded-md bg-surface-container-lowest/70 px-2 py-0.5 text-label-sm font-medium text-on-surface backdrop-blur-md">{mediaKindLabel(media.kind)}</span>
      </button>
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-sm font-bold text-on-surface" title={media.filename}>{media.filename}</h3>
          <p className="mt-1 text-label-sm text-on-surface-variant">{formatDate(media.createdAt)}</p>
        </div>
        {canWrite ? (
          <ConfirmSubmitButton fields={{ intent: "remove-media", albumId: album.id, mediaId: media.id }} title="Remove media from album?" message={`Remove ${media.filename} from ${album.name}?`} confirmLabel="Remove media" ariaLabel={`Remove ${media.filename} from ${album.name}`} buttonClassName="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </ConfirmSubmitButton>
        ) : null}
      </div>
    </article>
  );
}

function acceptsMediaKind(albumKind: number, mediaKind: number) {
  if (albumKind === AlbumKind.Mixed) return true;
  if (albumKind === AlbumKind.Photo) return mediaKind === MediaKind.Image;
  if (albumKind === AlbumKind.Video) return mediaKind === MediaKind.Video;
  if (albumKind === AlbumKind.Audio) return mediaKind === MediaKind.Audio;
  return false;
}

function isStudioAlbum(album: AlbumDto, studioId: string): boolean {
  return album.ownerKind === OwnerKind.Studio && album.ownerId === studioId;
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
