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
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { ShareDialog } from "~/components/dashboard/shared/resource-dialogs";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { AlbumKind, PERSONAL, type AlbumDto } from "~/lib/api";
import { albumsApi, ApiError } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/albums";

type AlbumView = "all" | "mixed" | "photo" | "video" | "audio" | "shared" | "favorites";

interface AlbumRouteData {
  albums: AlbumDto[];
  albumMediaCounts: Record<string, number>;
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
      albumMediaCounts: {},
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    const allAlbums = await albumsApi.listAlbums(accessToken, reqLog);
    const albums = allAlbums.filter((album) => album.isDeleteAble === true && !isReservedAudioCategoryAlbum(album));
    const albumMediaEntries = await Promise.all(
      albums.map(async (album) => {
        const page = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
        return [album.id, page.items.length] as const;
      }),
    );

    return {
      albums,
      albumMediaCounts: Object.fromEntries(albumMediaEntries),
      error: null,
    };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your albums.";
    reqLog.error({ err: error }, "failed to load albums");
    return { albums: [], albumMediaCounts: {}, error: message };
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

      if (kind === AlbumKind.Audio && audioCategoryKeyForAlbum(name)) {
        return { error: "That audio category name is reserved." };
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

    if (intent === "toggle-album-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (!id) {
        return { error: "Choose an album." };
      }

      await albumsApi.setFavorite(accessToken, id, isFavorite, reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent }, "album action failed");
    return { error: message };
  }
}

export default function Albums({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const currentView = normalizeView(searchParams.get("view"));

  useEffect(() => {
    if (actionData?.ok) {
      if (actionData.intent === "create-album") setCreateOpen(false);
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
      favorites: loaderData.albums.filter((album) => album.isFavorite).length,
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
  const totalAlbumItems = Object.values(loaderData.albumMediaCounts).reduce(
    (total, count) => total + count,
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

      {currentView === "shared" ? (
        <EmptyState
          icon="share"
          title="Shared albums are not available yet"
          hint="Shared album management is not available on this page yet."
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
        <div className="grid content-start grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAlbums.map((album, index) => (
            <AlbumCard
              key={album.id}
              album={album}
              count={loaderData.albumMediaCounts[album.id] ?? 0}
              index={index}
            />
          ))}
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

    </section>
  );
}

function AlbumCard({
  album,
  count,
  index,
}: {
  album: AlbumDto;
  count: number;
  index: number;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <Link to={`/dashboard/albums/${album.id}`} className="block w-full text-left">
        <div className="relative aspect-video overflow-hidden border-b border-outline-variant">
          <GradientThumbnail
            index={index}
            icon={album.materialSymbol || albumKindIcon(album.kind)}
            iconClassName="text-[34px] text-on-surface-variant/35"
          />
          <div className="absolute left-3 top-3">
            <StatusBadge label={albumKindLabel(album.kind)} tone={albumKindTone(album.kind)} />
          </div>
        </div>
      </Link>
      <div className="flex items-start gap-3 p-4">
        <Link to={`/dashboard/albums/${album.id}`} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={album.name}>
            {album.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-9 text-label-md text-on-surface-variant">
            {album.description || `${count} media item${count === 1 ? "" : "s"}`}
          </p>
          <p className="mt-3 text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {count} item{count === 1 ? "" : "s"}
          </p>
        </Link>
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
        <ConfirmSubmitButton
          fields={{ intent: "delete-album", id: album.id }}
          title="Delete album"
          message="Delete this album permanently? Media files will remain in your library."
          confirmLabel="Delete album"
          ariaLabel={`Delete ${album.name}`}
          buttonClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </ConfirmSubmitButton>
      </div>
    </article>
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
  if (view === "favorites") return albums.filter((album) => album.isFavorite);
  if (view === "shared") return [];
  return albums;
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
