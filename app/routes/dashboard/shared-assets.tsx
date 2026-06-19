import { useMemo, useState } from "react";
import { Link, useNavigation } from "react-router";

import {
  FilterButton,
  GradientPlaceholder,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  CardGridSkeleton,
  Chip,
  EmptyState,
  ErrorBanner,
} from "~/components/dashboard/section";
import {
  MediaKind,
  mediaKindLabel,
  ProjectKind,
  projectKindLabel,
  type MediaDto,
  type ProjectDto,
} from "~/lib/api";
import { listSharedMedia, listSharedProjects } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/shared-assets";

/* ── Meta ───────────────────────────────────────────────────────────────── */

export function meta(_: Route.MetaArgs) {
  return [{ title: "Shared Assets · Kuvox" }];
}

/* ── Loader ─────────────────────────────────────────────────────────────── */

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      projects: [] as ProjectDto[],
      media: [] as MediaDto[],
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  const [projectsResult, mediaResult] = await Promise.allSettled([
    listSharedProjects(accessToken),
    listSharedMedia(accessToken),
  ]);

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value.items : [];
  const media = mediaResult.status === "fulfilled" ? mediaResult.value.items : [];
  const error =
    projectsResult.status === "rejected" || mediaResult.status === "rejected"
      ? "Some shared items couldn't be loaded."
      : null;

  return { projects, media, error };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function shortOwner(ownerId: string): string {
  return ownerId.slice(0, 8);
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "Pending";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function mediaIcon(kind: number): string {
  if (kind === MediaKind.Image) return "image";
  if (kind === MediaKind.Audio) return "audiotrack";
  return "movie";
}

function mediaIconTone(kind: number): string {
  if (kind === MediaKind.Image) return "text-primary";
  if (kind === MediaKind.Audio) return "text-tertiary";
  return "text-secondary";
}



type TabFilter = "all" | "photos" | "videos" | "audio";

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All Assets" },
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
  { key: "audio", label: "Audio" },
];

/** A unified item for display — either a project or a media record. */
interface SharedItem {
  id: string;
  kind: "project" | "media";
  label: string;
  icon: string;
  iconTone: string;
  typeLabel: string;
  ownerId: string;
  sizeBytes: number;
  createdAt: string;
  mediaKind?: number;
  projectKind?: number;
  linkTo?: string;
}

function toSharedItems(projects: ProjectDto[], media: MediaDto[]): SharedItem[] {
  const items: SharedItem[] = [];

  for (const project of projects) {
    items.push({
      id: project.id,
      kind: "project",
      label: project.name,
      icon: project.kind === ProjectKind.Video ? "movie" : "image",
      iconTone: project.kind === ProjectKind.Video ? "text-secondary" : "text-primary",
      typeLabel: projectKindLabel(project.kind),
      ownerId: project.ownerId,
      sizeBytes: 0,
      createdAt: project.createdAt,
      projectKind: project.kind,
      linkTo:
        project.kind === ProjectKind.Video
          ? `/editor/${project.id}`
          : `/projects/${project.id}`,
    });
  }

  for (const item of media) {
    items.push({
      id: item.id,
      kind: "media",
      label: item.filename,
      icon: mediaIcon(item.kind),
      iconTone: mediaIconTone(item.kind),
      typeLabel: mediaKindLabel(item.kind),
      ownerId: item.ownerId,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      mediaKind: item.kind,
    });
  }

  return items;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */



function AssetCard({ item, index }: { item: SharedItem; index: number }) {
  const inner = (
    <div className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-all hover:border-primary/40">
      {/* Thumbnail area */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <GradientPlaceholder index={index} icon={item.icon} iconSize="text-[40px]" />
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {/* Type badge */}
        <div className="absolute left-3 top-3">
          <span className="rounded-md bg-surface-container-lowest/70 px-2 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
            {item.typeLabel}
          </span>
        </div>
        {/* Action buttons on hover */}
        <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest/70 text-on-surface-variant backdrop-blur-md transition-colors hover:text-primary"
            aria-label="Download"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest/70 text-on-surface-variant backdrop-blur-md transition-colors hover:text-primary"
            aria-label="More options"
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        </div>
        {/* Bottom info on hover */}
        <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <h3 className="truncate text-label-md font-bold text-white" title={item.label}>
            {item.label}
          </h3>
          <p className="mt-1 text-label-sm text-white/75">
            Shared by: {shortOwner(item.ownerId)}
          </p>
        </div>
      </div>
      {/* Card body */}
      <div className="p-4">
        <h3 className="truncate text-body-sm font-semibold text-on-surface" title={item.label}>
          {item.label}
        </h3>
        <div className="mt-2 flex items-center gap-2">
          {/* Owner avatar circle */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-on-primary-container">
            {shortOwner(item.ownerId).charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-label-sm text-on-surface-variant">
            Shared by: {shortOwner(item.ownerId)}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3">
          <span className="text-label-sm font-bold uppercase text-outline">
            {item.typeLabel} {item.sizeBytes > 0 ? `· ${formatSize(item.sizeBytes)}` : ""}
          </span>
          <span className="text-label-sm text-on-surface-variant">{formatDate(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  if (item.linkTo) {
    return (
      <Link to={item.linkTo} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}

function AssetListItem({ item }: { item: SharedItem }) {
  const inner = (
    <div className="group flex items-center justify-between rounded-xl border border-transparent p-3 transition-colors hover:border-outline-variant hover:bg-surface-container-high">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest">
          <span className={`material-symbols-outlined ${item.iconTone}`}>{item.icon}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-body-sm font-semibold text-on-surface">{item.label}</div>
          <div className="text-label-sm text-on-surface-variant">
            Shared by {shortOwner(item.ownerId)} · {formatDate(item.createdAt)}
          </div>
        </div>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-6">
        {item.sizeBytes > 0 && (
          <div className="hidden text-label-sm font-mono text-outline md:block">
            {formatSize(item.sizeBytes)}
          </div>
        )}
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" className="p-1.5 text-on-surface-variant hover:text-primary" aria-label="Favorite">
            <span className="material-symbols-outlined text-[18px]">star</span>
          </button>
          <button type="button" className="p-1.5 text-on-surface-variant hover:text-primary" aria-label="Download">
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
          <button type="button" className="p-1.5 text-on-surface-variant hover:text-primary" aria-label="Share">
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (item.linkTo) {
    return (
      <Link to={item.linkTo} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function OwnerRow({ ownerId, count }: { ownerId: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-body-sm font-bold text-on-primary-container">
          {shortOwner(ownerId).charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-body-sm font-semibold text-on-surface">{shortOwner(ownerId)}</div>
          <div className="text-label-sm text-on-surface-variant">{count} assets</div>
        </div>
      </div>
      <span className="text-label-sm font-bold text-primary">View</span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function Shared({ loaderData }: Route.ComponentProps) {
  const { projects, media, error } = loaderData;
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const isEmpty = projects.length === 0 && media.length === 0;

  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "name" | "size">("latest");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // Merge projects + media into a unified display list
  const allItems = useMemo(() => toSharedItems(projects, media), [projects, media]);

  // Filter by tab
  const filteredItems = useMemo(() => {
    if (activeTab === "all") return allItems;
    return allItems.filter((item) => {
      if (activeTab === "photos") {
        return (
          (item.kind === "media" && item.mediaKind === MediaKind.Image) ||
          (item.kind === "project" && item.projectKind === ProjectKind.Image)
        );
      }
      if (activeTab === "videos") {
        return (
          (item.kind === "media" && item.mediaKind === MediaKind.Video) ||
          (item.kind === "project" && item.projectKind === ProjectKind.Video)
        );
      }
      if (activeTab === "audio") {
        return item.kind === "media" && item.mediaKind === MediaKind.Audio;
      }
      return true;
    });
  }, [allItems, activeTab]);

  // Sort
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredItems, sort]);

  // Featured items (first 6) and recent items (rest, or all if list view)
  const featuredItems = sortedItems.slice(0, 6);
  const recentItems = sortedItems.slice(6);

  // Stats
  const totalCount = allItems.length;
  const projectCount = projects.length;
  const mediaCount = media.length;
  const videoCount = allItems.filter(
    (i) =>
      (i.kind === "media" && i.mediaKind === MediaKind.Video) ||
      (i.kind === "project" && i.projectKind === ProjectKind.Video),
  ).length;
  const imageCount = allItems.filter(
    (i) =>
      (i.kind === "media" && i.mediaKind === MediaKind.Image) ||
      (i.kind === "project" && i.projectKind === ProjectKind.Image),
  ).length;
  const audioCount = allItems.filter(
    (i) => i.kind === "media" && i.mediaKind === MediaKind.Audio,
  ).length;

  // Owner breakdown
  const ownerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) {
      map.set(item.ownerId, (map.get(item.ownerId) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allItems]);

  // Storage
  const totalBytes = media.reduce((sum, m) => sum + m.sizeBytes, 0);

  return (
    <section className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title="Shared Assets"
        subtitle="Manage, discover, and organize assets collaboratively across your workspace."
      >
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
        <FilterButton />
      </PageHeader>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="folder_shared" label="Total Shared" value={totalCount} detail="Projects + Media" />
        <MetricCard
          icon="folder"
          label="Projects"
          value={projectCount}
          detail={`${videoCount} video · ${imageCount - (imageCount > projectCount ? projectCount : 0)} image`}
          tone="secondary"
        />
        <MetricCard
          icon="perm_media"
          label="Media Files"
          value={mediaCount}
          detail={formatSize(totalBytes)}
          tone="tertiary"
        />
        <MetricCard
          icon="category"
          label="Type Breakdown"
          value={`${videoCount}V · ${imageCount}I · ${audioCount}A`}
          detail="Across all types"
        />
      </div>

      {/* ── Category Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 overflow-x-auto border-b border-outline-variant">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap pb-3 text-body-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary font-bold text-primary"
                : "border-b-2 border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon="group"
          title="Nothing shared with you yet"
          hint="When a teammate shares a project or media item, it shows up here."
        />
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon="filter_list"
          title="No matching assets"
          hint="Try a different filter or tab to find what you're looking for."
        />
      ) : (
        <div className="grid grid-cols-12 gap-8">
          {/* ── Left: Main content ─────────────────────────────────────── */}
          <div className="col-span-12 space-y-10 lg:col-span-9">
            {/* Featured section */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-headline-md font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    auto_awesome
                  </span>
                  Featured Assets
                </h2>
                {sortedItems.length > 6 && (
                  <span className="text-label-md font-medium text-on-surface-variant">
                    Showing {featuredItems.length} of {sortedItems.length}
                  </span>
                )}
              </div>

              {layoutMode === "grid" ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {featuredItems.map((item, index) => (
                    <AssetCard key={item.id} item={item} index={index} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {featuredItems.map((item) => (
                    <AssetListItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            {/* Recently shared section */}
            {recentItems.length > 0 && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-headline-md font-bold text-on-surface">Recently Shared</h2>
                </div>
                <div className="space-y-1">
                  {recentItems.map((item) => (
                    <AssetListItem key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right: Side panels ─────────────────────────────────────── */}
          <div className="col-span-12 space-y-6 lg:col-span-3">
            {/* Shared By panel */}
            {ownerCounts.length > 0 && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
                <h3 className="mb-4 text-body-sm font-bold text-on-surface">Shared By</h3>
                <div className="space-y-4">
                  {ownerCounts.map(([ownerId, count]) => (
                    <OwnerRow key={ownerId} ownerId={ownerId} count={count} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats panel */}
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
              <h3 className="mb-4 text-body-sm font-bold text-on-surface">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary">movie</span>
                    <span className="text-label-md text-on-surface-variant">Videos</span>
                  </div>
                  <span className="text-body-sm font-bold text-on-surface">{videoCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">image</span>
                    <span className="text-label-md text-on-surface-variant">Images</span>
                  </div>
                  <span className="text-body-sm font-bold text-on-surface">{imageCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-tertiary">audiotrack</span>
                    <span className="text-label-md text-on-surface-variant">Audio</span>
                  </div>
                  <span className="text-body-sm font-bold text-on-surface">{audioCount}</span>
                </div>
                <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">folder</span>
                    <span className="text-label-md text-on-surface-variant">Projects</span>
                  </div>
                  <span className="text-body-sm font-bold text-on-surface">{projectCount}</span>
                </div>
              </div>
            </div>

            {/* Storage Insight panel */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  info
                </span>
                <h3 className="text-body-sm font-bold text-on-surface">Storage Insight</h3>
              </div>
              <p className="mb-4 text-label-md leading-relaxed text-on-surface-variant">
                {totalCount} shared assets use{" "}
                <span className="font-semibold text-on-surface">{formatSize(totalBytes)}</span> of
                storage across {ownerCounts.length} contributor{ownerCounts.length !== 1 ? "s" : ""}.
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(2, (totalBytes / (1024 * 1024 * 1024)) * 10))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
