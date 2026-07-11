import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";

import {
  FilterTabs,
  FormActions,
  GradientThumbnail,
  MetricCard,
  PageHeader,
  StatusBadge,
  AssetCardContextMenu,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, ErrorBanner, Modal, primaryButtonClass } from "~/components/dashboard/section";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { AlbumKind, canManageStudioAccess, canWriteStudioContent, MediaKind, type AlbumDto, type MediaDto, type Workspace } from "~/lib/api";
import { albumsApi, ApiError, listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";
import { isAlbumInStudioScope } from "./studio-albums";

import type { Route } from "./+types/media-albums";

type AlbumView = "all" | "mixed" | "photo" | "video" | "audio";
const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

const albumViews: Array<{ value: AlbumView; label: string }> = [
  { value: "all", label: "All" },
  { value: "mixed", label: "Mixed" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
];

const albumKindOptions = [
  { value: AlbumKind.Mixed, label: "Mixed" },
  { value: AlbumKind.Photo, label: "Photo" },
  { value: AlbumKind.Video, label: "Video" },
  { value: AlbumKind.Audio, label: "Audio" },
];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio albums - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  if (!accessToken) {
    return { albums: [] as AlbumDto[], albumMediaCounts: {} as Record<string, number>, canWrite: false, canManageAccess: false, error: "Your session expired. Please sign in again." };
  }

  try {
    const ws = studioWs(studioId);
    const [allAlbums, studios] = await Promise.all([
      albumsApi.listAlbums(accessToken, ws, reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const albums = allAlbums.filter((album) => isAlbumInStudioScope(album, studioId) && album.isDeleteAble === true);
    const albumMediaEntries = await Promise.all(albums.map(async (album) => {
      const page = await albumsApi.listAlbumMedia(accessToken, album.id, ws, reqLog);
      return [album.id, page.items.length] as const;
    }));
    const role = studios.find((studio) => studio.id === studioId)?.role;
    return {
      albums,
      albumMediaCounts: Object.fromEntries(albumMediaEntries),
      canWrite: role != null ? canWriteStudioContent(role) : false,
      canManageAccess: role != null ? canManageStudioAccess(role) : false,
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load Studio albums.";
    reqLog.error({ err: error, studioId }, "failed to load Studio albums");
    return { albums: [] as AlbumDto[], albumMediaCounts: {}, canWrite: false, canManageAccess: false, error: message };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) return { error: "Your session expired. Please sign in again." };

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const ws = studioWs(params.studioId);

  try {
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? "collections").trim();
      const kind = Number(formData.get("kind") ?? AlbumKind.Mixed);
      if (!name) return { error: "Enter a name for the album." };
      if (!(Object.values(AlbumKind) as number[]).includes(kind)) return { error: "Choose a valid album type." };
      await albumsApi.createAlbum(accessToken, ws, { name, description, kind, materialSymbol }, reqLog);
      return { ok: true, intent };
    }
    if (intent === "delete-album") {
      const id = String(formData.get("id") ?? "");
      if (!id) return { error: "Choose an album to delete." };
      await albumsApi.deleteAlbum(accessToken, id, ws, reqLog);
      return { ok: true, intent };
    }
    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent, studioId: params.studioId }, "Studio album action failed");
    return { error: message };
  }
}

export default function TeamAlbums({ loaderData, actionData, params }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const currentView = normalizeView(searchParams.get("view"));
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create-album") setCreateOpen(false);
  }, [actionData]);

  const albumCounts = useMemo(() => ({
    all: loaderData.albums.length,
    mixed: loaderData.albums.filter((album) => album.kind === AlbumKind.Mixed).length,
    photo: loaderData.albums.filter((album) => album.kind === AlbumKind.Photo).length,
    video: loaderData.albums.filter((album) => album.kind === AlbumKind.Video).length,
    audio: loaderData.albums.filter((album) => album.kind === AlbumKind.Audio).length,
  }), [loaderData.albums]);
  const filteredAlbums = useMemo(() => filterAlbums(loaderData.albums, currentView), [currentView, loaderData.albums]);
  const totalAlbumItems = Object.values(loaderData.albumMediaCounts).reduce((total, count) => total + count, 0);

  return (
    <section className="space-y-8">
      <PageHeader title="Studio Albums" subtitle="Organize this Studio's media into reusable collections.">
        {loaderData.canWrite ? (
          <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create album
          </button>
        ) : null}
      </PageHeader>

      {loaderData.error ? <ErrorBanner message={loaderData.error} /> : null}
      {actionData?.error ? <ErrorBanner message={actionData.error} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon="collections" label="Total Albums" value={loaderData.albums.length} />
        <MetricCard icon="perm_media" label="Album Items" value={totalAlbumItems} detail="Studio media organized" tone="secondary" />
        <MetricCard icon="category" label="Mixed Albums" value={albumCounts.mixed} detail="Accept all media" />
      </div>

      <FilterTabs
        items={albumViews.map((view) => ({ ...view, count: albumCounts[view.value] }))}
        value={currentView}
        onChange={(value) => value === "all" ? setSearchParams({}) : setSearchParams({ view: value })}
        variant="boxed"
      />

      {filteredAlbums.length === 0 ? (
        <EmptyState
          icon="collections_bookmark"
          title="No Studio albums found"
          hint="Create an album to start organizing this Studio's media."
          action={loaderData.canWrite ? (
            <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create album
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid content-start grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAlbums.map((album, index) => (
            <AlbumCard key={album.id} album={album} count={loaderData.albumMediaCounts[album.id] ?? 0} index={index} studioId={params.studioId} canWrite={loaderData.canWrite} canManageAccess={loaderData.canManageAccess} />
          ))}
        </div>
      )}

      {loaderData.canWrite ? (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Studio album">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-album" />
            <TextField name="name" label="Album name" placeholder="Campaign launch" required />
            <TextArea name="description" label="Description" placeholder="Assets for the Studio edit" rows={3} />
            <label className="block">
              <span className="mb-1 block text-label-md text-on-surface-variant">Album type</span>
              <select name="kind" defaultValue={AlbumKind.Mixed} className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none transition-colors focus:border-primary">
                {albumKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <IconPicker name="materialSymbol" label="Album icon" />
            <FormActions onCancel={() => setCreateOpen(false)} submitLabel={isSubmitting ? "Creating..." : "Create album"} isSubmitting={isSubmitting} />
          </Form>
        </Modal>
      ) : null}
    </section>
  );
}

function AlbumCard({ album, count, index, studioId, canWrite, canManageAccess }: { album: AlbumDto; count: number; index: number; studioId: string; canWrite: boolean; canManageAccess: boolean }) {
  const media = {
    id: album.id,
    filename: album.name,
    kind: MediaKind.Image,
    sizeBytes: "0",
    createdAt: new Date().toISOString(),
  } as unknown as MediaDto;

  return (
    <article className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <div className="relative aspect-video overflow-hidden border-b border-outline-variant">
        <Link to={`/teams/${studioId}/media/albums/${album.id}`} className="block w-full h-full text-left">
          <GradientThumbnail index={index} icon={album.materialSymbol || albumKindIcon(album.kind)} iconClassName="text-[34px] text-on-surface-variant/35" />
          <div className="absolute left-3 top-3"><StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} /></div>
        </Link>
        {canWrite ? (
          <div className="absolute right-3 top-3 z-10">
            <AssetCardContextMenu
              media={media}
              workspaceKind="studio"
              resourceType="albums"
              copyUrl={`/teams/${studioId}/media/albums/${album.id}`}
              canManageAccess={canManageAccess}
              deleteIntent="delete-album"
              deleteConfirmTitle="Delete Album"
              deleteConfirmMessage="Delete this Studio album permanently? Media files will remain in the Studio library."
            />
          </div>
        ) : null}
      </div>
      <div className="flex items-start gap-3 p-4">
        <Link to={`/teams/${studioId}/media/albums/${album.id}`} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={album.name}>{album.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-9 text-label-md text-on-surface-variant">{album.description || `${count} media item${count === 1 ? "" : "s"}`}</p>
          <p className="mt-3 text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{count} item{count === 1 ? "" : "s"}</p>
        </Link>
      </div>
    </article>
  );
}

function normalizeView(value: string | null): AlbumView {
  if (value === "mixed" || value === "photo" || value === "video" || value === "audio") return value;
  return "all";
}

function filterAlbums(albums: AlbumDto[], view: AlbumView) {
  if (view === "mixed") return albums.filter((album) => album.kind === AlbumKind.Mixed);
  if (view === "photo") return albums.filter((album) => album.kind === AlbumKind.Photo);
  if (view === "video") return albums.filter((album) => album.kind === AlbumKind.Video);
  if (view === "audio") return albums.filter((album) => album.kind === AlbumKind.Audio);
  return albums;
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
