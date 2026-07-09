import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useState } from "react";
import { Link, redirect, useNavigation } from "react-router";

import { AssetCard, PageHeader, SectionHeader, StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import { ConfirmSubmitButton, EmptyState, ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import { AlbumAddItemsModal } from "~/components/dashboard/albums/album-add-items-modal";
import { MediaPreviewOverlay } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { AccessDialog } from "~/components/dashboard/shared/resource-dialogs";
import { AlbumKind, MediaKind, canManageStudioAccess, canWriteStudioContent, type AlbumDto, type MediaDto, type Workspace } from "~/lib/api";
import { albumsApi, ApiError, listAllMedia, listMyStudios, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";
import { isAlbumInStudioScope } from "./studio-albums";

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
    return { album: null as AlbumDto | null, media: [] as MediaDto[], compatibleMedia: [] as MediaDto[], canWrite: false, canManageAccess: false, error: "Your session expired. Please sign in again." };
  }

  try {
    const ws = studioWs(studioId);
    const [albums, allMedia, studios] = await Promise.all([
      albumsApi.listAlbums(accessToken, ws, reqLog),
      listAllMedia(accessToken, ws, reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const studioAlbums = albums.filter((item) => isAlbumInStudioScope(item, studioId));
    const album = studioAlbums.find((item) => item.id === albumId && item.isDeleteAble === true) ?? null;
    if (!album) return { album: null, media: [], compatibleMedia: [], canWrite: false, canManageAccess: false, error: "Album not found." };

    const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, ws, reqLog);
    const albumMediaIds = new Set(albumMedia.items.map((item) => item.id));
    const compatibleMedia = allMedia.filter((item) => acceptsMediaKind(album.kind, item.kind) && !albumMediaIds.has(item.id));
    const role = studios.find((studio) => studio.id === studioId)?.role;

    return {
      album,
      media: albumMedia.items,
      compatibleMedia,
      canWrite: role != null ? canWriteStudioContent(role) : false,
      canManageAccess: role != null ? canManageStudioAccess(role) : false,
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load this Studio album.";
    reqLog.error({ err: error, studioId, albumId }, "failed to load Studio album detail");
    return { album: null, media: [] as MediaDto[], compatibleMedia: [] as MediaDto[], canWrite: false, canManageAccess: false, error: message };
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
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

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
    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) await softDelete(accessToken, "media", id, reqLog);
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
    const message = actionErrorMessage(error);
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
          <AccessDialog resourceType="album" resourceId={album.id} resourceName={album.name} canManageAccess={loaderData.canManageAccess} />
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
            <AlbumMediaCard key={item.id} media={item} album={album} index={index} canWrite={loaderData.canWrite} canManageAccess={loaderData.canManageAccess} onPreview={() => setPreviewMediaId(item.id)} />
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

function AlbumMediaCard({ media, album, index, canWrite, canManageAccess, onPreview }: { media: MediaDto; album: AlbumDto; index: number; canWrite: boolean; canManageAccess: boolean; onPreview: () => void }) {
  return (
    <AssetCard
      media={media}
      index={index}
      workspaceKind="studio"
      canMoveToRecycleBin={canWrite}
      canManageAccess={canManageAccess}
      onPreview={onPreview}
      secondaryAction={
        canWrite ? (
          <ConfirmSubmitButton fields={{ intent: "remove-media", albumId: album.id, mediaId: media.id }} title="Remove media from album?" message={`Remove ${media.filename} from ${album.name}?`} confirmLabel="Remove media" ariaLabel={`Remove ${media.filename} from ${album.name}`} buttonClassName="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </ConfirmSubmitButton>
        ) : null
      }
    />
  );
}
function acceptsMediaKind(albumKind: number, mediaKind: number) {
  if (albumKind === AlbumKind.Mixed) return true;
  if (albumKind === AlbumKind.Photo) return mediaKind === MediaKind.Image;
  if (albumKind === AlbumKind.Video) return mediaKind === MediaKind.Video;
  if (albumKind === AlbumKind.Audio) return mediaKind === MediaKind.Audio;
  return false;
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

