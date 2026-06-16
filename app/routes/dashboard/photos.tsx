import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import {
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { MediaKind, PERSONAL, type MediaDto } from "~/lib/api";
import { ApiError, createMedia, listMedia, softDelete } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/photos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Photos - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { media: [] as MediaDto[], error: "Your session expired. Please sign in again." };
  }

  try {
    const page = await listMedia(accessToken, PERSONAL);
    return { media: page.items, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your media.";
    return { media: [] as MediaDto[], error: message };
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "create") {
      const filename = String(formData.get("filename") ?? "").trim();
      const kind = Number(formData.get("kind") ?? MediaKind.Image);
      if (!filename) {
        return { error: "Enter a filename to import." };
      }
      // Metadata/record only in Phase 2; real byte upload to object storage is later.
      await createMedia(accessToken, PERSONAL, {
        kind,
        filename,
        storageKey: `raw/${filename}`,
        sizeBytes: 0,
      });
      return { ok: true, intent };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    return { error: message };
  }
}

const PHOTO_ALBUMS = [
  { name: "Travel", count: 156, icon: "flight_takeoff" },
  { name: "Client Work", count: 235, icon: "work" },
  { name: "Mountains", count: 128, icon: "landscape" },
  { name: "City Nights", count: 92, icon: "location_city" },
  { name: "Nature", count: 342, icon: "eco" },
];

const PHOTO_GRADIENTS = [
  "from-primary/25 via-surface-container-high to-secondary/10",
  "from-tertiary/25 via-surface-container-high to-primary/10",
  "from-secondary/20 via-surface-container-high to-tertiary/10",
  "from-primary/15 via-surface-container-low to-tertiary/20",
];

function formatSize(bytes: number): string {
  if (bytes <= 0) return "Pending";
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
  return [photo.status, dimensions, formatSize(photo.sizeBytes)].filter(Boolean).join(" · ");
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "primary" | "secondary" | "tertiary";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
  }[tone];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <span className="text-label-md font-medium text-on-surface-variant">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-headline-md font-bold text-on-surface">{value}</span>
        {detail && <span className="text-right text-label-sm text-on-surface-variant">{detail}</span>}
      </div>
    </div>
  );
}

function PhotoPlaceholder({ index }: { index: number }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
        PHOTO_GRADIENTS[index % PHOTO_GRADIENTS.length]
      }`}
    >
      <span className="material-symbols-outlined text-[40px] text-on-surface-variant/25">
        image
      </span>
    </div>
  );
}

function DeletePhotoButton({ photo, compact = false }: { photo: MediaDto; compact?: boolean }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={photo.id} />
      <button
        type="submit"
        aria-label={`Move ${photo.filename} to Trash`}
        className={
          compact
            ? "rounded-lg bg-surface-container-lowest/70 p-1.5 text-on-surface-variant backdrop-blur-md transition-colors hover:text-error"
            : "rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-error group-hover:opacity-100"
        }
      >
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </Form>
  );
}

function PhotoCard({
  photo,
  index,
  listView,
}: {
  photo: MediaDto;
  index: number;
  listView: boolean;
}) {
  if (listView) {
    return (
      <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-outline-variant">
          <PhotoPlaceholder index={index} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={photo.filename}>
            {photo.filename}
          </h3>
          <p className="mt-1 text-label-md text-on-surface-variant">{photoLabel(photo)}</p>
        </div>
        <span className="hidden text-label-sm text-on-surface-variant sm:block">
          {formatDate(photo.createdAt)}
        </span>
        <DeletePhotoButton photo={photo} />
      </div>
    );
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PhotoPlaceholder index={index} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute left-3 top-3">
          <span className="rounded-md bg-surface-container-lowest/70 px-2 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
            {photo.width && photo.height ? "HD" : "IMG"}
          </span>
        </div>
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          <DeletePhotoButton photo={photo} compact />
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

function AlbumCard({
  album,
  index,
}: {
  album: { name: string; count: number; icon: string };
  index: number;
}) {
  return (
    <div className="group cursor-pointer space-y-3">
      <div className="aspect-square overflow-hidden rounded-xl border border-outline-variant transition-colors group-hover:border-primary/40">
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
            PHOTO_GRADIENTS[index % PHOTO_GRADIENTS.length]
          }`}
        >
          <span className="material-symbols-outlined text-[34px] text-on-surface-variant/35">
            {album.icon}
          </span>
        </div>
      </div>
      <div>
        <h4 className="truncate text-label-md font-bold text-on-surface">{album.name}</h4>
        <p className="text-label-sm text-on-surface-variant">{album.count} photos</p>
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
  const [sort, setSort] = useState<"latest" | "name" | "size">("latest");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");

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
    if (actionData?.ok && actionData.intent === "create") {
      setImportOpen(false);
    }
  }, [actionData]);

  const photos = useMemo(() => {
    const onlyPhotos = loaderData.media.filter((item) => item.kind === MediaKind.Image);
    return [...onlyPhotos].sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [loaderData.media, sort]);

  const storageBytes = photos.reduce((total, photo) => total + photo.sizeBytes, 0);
  const storageGb = storageBytes / (1024 * 1024 * 1024);
  const photosWithDimensions = photos.filter((photo) => photo.width && photo.height).length;

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">Photos</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Your photo library. Organize, edit, and enhance your visual assets.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              View
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setLayoutMode("grid")}
                className={`rounded-md p-1.5 transition-colors ${
                  layoutMode === "grid"
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setLayoutMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  layoutMode === "list"
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">view_list</span>
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Sort by
            </span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none transition-colors hover:border-primary/40 focus:border-primary"
            >
              <option value="latest">Latest Added</option>
              <option value="name">Name</option>
              <option value="size">File Size</option>
            </select>
          </label>

          <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import photos
          </button>
        </div>
      </div>

      {loaderData.error && <ErrorBanner message={loaderData.error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon="image" label="Total Photos" value={photos.length} detail="+12% this month" />
        <StatCard icon="favorite" label="Favorites" value="0" detail="Coming soon" tone="tertiary" />
        <StatCard icon="folder" label="Albums" value={PHOTO_ALBUMS.length} tone="secondary" />
        <StatCard
          icon="cloud"
          label="Storage Used"
          value={`${storageGb.toFixed(storageGb >= 10 ? 0 : 1)} GB`}
          detail="Personal library"
        />
        <StatCard
          icon="auto_fix_high"
          label="Ready To Edit"
          value={photosWithDimensions}
          detail="With metadata"
          tone="tertiary"
        />
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Recent Photos</h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

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
              <PhotoCard key={photo.id} photo={photo} index={index} listView={layoutMode === "list"} />
            ))}
          </div>
        )}
      </section>

      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Albums</h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PHOTO_ALBUMS.map((album, index) => (
            <AlbumCard key={album.name} album={album} index={index} />
          ))}
          <button
            type="button"
            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
            <span className="mt-2 text-label-md font-medium">Create Album</span>
          </button>
        </div>
      </section>

      <section ref={favoritesRef} style={{ scrollMarginTop: "6rem" }}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Favorites</h2>
        </div>
        <EmptyState
          icon="favorite_border"
          title="No favorite photos yet"
          hint="Mark photos as favorites to find them quickly here."
        />
      </section>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import photo">
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Registers a photo record now; real file upload to storage lands in a later phase.
        </p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="kind" value={MediaKind.Image} />
          <div>
            <label htmlFor="filename" className="block text-label-md text-on-surface-variant">
              Filename
            </label>
            <input
              id="filename"
              name="filename"
              type="text"
              required
              placeholder="mountain-view.jpg"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className={primaryButtonClass()}
            >
              {navigation.state === "submitting" ? "Importing..." : "Import"}
            </button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}
