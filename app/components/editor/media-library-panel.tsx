import { useMemo, useState } from "react";

import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaKind, type MediaDto } from "~/lib/api";
import {
  isMediaReadyForTimeline,
  mediaLibraryKind,
  mediaReadiness,
  type MediaReadiness,
} from "~/lib/editor/editor-media";
import { resolveMediaPipeline } from "~/lib/media-pipeline";
import type { MediaRealtimeUpdate } from "~/lib/media-realtime";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  libraryOpenChanged,
  libraryTabChanged,
  libraryWidthChanged,
  modalOpened,
  searchQueryChanged,
  selectLibraryPanelState,
  toastShown,
  type LibraryTab,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton, PanelHeader } from "./editor-ui";
import { useDragResize } from "./use-drag-resize";

const tabs: Array<{ value: LibraryTab; label: string; icon: string }> = [
  { value: "clips", label: "Videos", icon: "video_file" },
  { value: "audio", label: "Audio", icon: "audio_file" },
  { value: "stills", label: "Images", icon: "imagesmode" },
];

type ReadinessFilterValue = MediaReadiness | "all";

const readinessFilters: Array<{ value: ReadinessFilterValue; label: string; icon: string }> = [
  { value: "ready", label: "Ready", icon: "check_circle" },
  { value: "processing", label: "Processing", icon: "progress_activity" },
  { value: "failed", label: "Failed", icon: "error" },
  { value: "all", label: "All", icon: "filter_alt" },
];

interface MediaLibraryPanelProps {
  media: MediaDto[];
  updatesById?: Record<string, MediaRealtimeUpdate>;
  mediaLoadError?: string | null;
  mediaRetrying?: boolean;
  usingCachedMedia?: boolean;
  canPlaceMedia?: boolean;
  onRetryMediaLoad?: () => void;
  onAddMedia: (media: MediaDto) => void;
}

export function MediaLibraryPanel({
  media,
  updatesById = {},
  mediaLoadError,
  mediaRetrying = false,
  usingCachedMedia = false,
  canPlaceMedia = true,
  onRetryMediaLoad,
  onAddMedia,
}: MediaLibraryPanelProps) {
  const dispatch = useAppDispatch();
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilterValue>("ready");
  const {
    activeTab,
    open: libraryOpen,
    width: libraryWidth,
    selectedMediaId,
    searchQuery,
  } = useAppSelector(selectLibraryPanelState);
  const visibleAssets = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return filteredLibraryAssets(media, activeTab, readinessFilter, normalizedSearch);
  }, [activeTab, media, readinessFilter, searchQuery]);
  const activeTabAssets = useMemo(
    () => sortedMedia(media).filter((asset) => mediaLibraryKind(asset) === activeTab),
    [activeTab, media],
  );
  const readinessCounts = useMemo(() => countReadiness(activeTabAssets), [activeTabAssets]);
  const readinessAssets = useMemo(
    () =>
      activeTabAssets.filter(
        (asset) => readinessFilter === "all" || mediaReadiness(asset) === readinessFilter,
      ),
    [activeTabAssets, readinessFilter],
  );
  const emptyState = mediaLibraryEmptyState({
    mediaCount: media.length,
    tabAssetCount: activeTabAssets.length,
    readinessAssetCount: readinessAssets.length,
    searchQuery,
    activeTab,
    readinessFilter,
    mediaLoadError,
    usingCachedMedia,
  });
  const failedOrProcessingAssets = activeTabAssets.filter((asset) => {
    const readiness = mediaReadiness(asset);
    return readiness === "failed" || readiness === "processing";
  }).length;
  const compactLibraryControls = libraryWidth < 292;

  const handleResizeStart = useDragResize({
    axis: "x",
    value: libraryWidth,
    min: 240,
    max: 360,
    onChange: (value) => dispatch(libraryWidthChanged(value)),
  });

  if (!libraryOpen) {
    return null;
  }

  function handleAddMedia(asset: MediaDto) {
    dispatch(assetSelected(asset.id));
    if (!canPlaceMedia) {
      dispatch(toastShown("View only: you cannot place media on this timeline"));
      return;
    }

    if (!isMediaReadyForTimeline(asset)) {
      dispatch(toastShown("Media is not ready for timeline placement"));
      return;
    }

    onAddMedia(asset);
  }

  return (
    <aside
      className="relative z-40 hidden h-full min-w-video-library-min max-w-video-library-max shrink-0 flex-col border-r border-outline-variant bg-surface lg:flex"
      style={{ width: libraryWidth }}
    >
      <PanelHeader
        title="Library"
        eyebrow="Workspace Media"
        compact={compactLibraryControls}
        action={
          <div className="flex shrink-0 items-center gap-1">
            <EditorIconButton
              icon="add"
              label="Add media"
              active
              className="h-8 w-8 border-primary/40 bg-primary text-on-primary hover:opacity-90"
              onClick={() => dispatch(modalOpened("import-media"))}
            />
            <EditorIconButton
              icon="close"
              label="Close media library"
              className="h-8 w-8"
              onClick={() => dispatch(libraryOpenChanged(false))}
            />
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="Media kind"
        className={`grid shrink-0 grid-cols-3 gap-1 border-b border-outline-variant bg-surface-container-lowest p-2 ${
          compactLibraryControls ? "h-[58px]" : "h-12"
        }`}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-label={`${tab.label} library`}
              aria-selected={active}
              title={`${tab.label} library`}
              onClick={() => dispatch(libraryTabChanged(tab.value))}
              className={`flex min-w-0 items-center justify-center rounded-[4px] border text-label-md font-semibold transition-colors motion-reduce:transition-none ${
                active
                  ? "border-primary/40 bg-surface-container-high text-primary"
                  : "border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              } ${compactLibraryControls ? "h-full flex-col gap-0.5 px-1 py-1" : "h-8 gap-1.5 px-2"}`}
            >
              <EditorIcon className={compactLibraryControls ? "text-[18px]" : "text-[16px]"}>
                {tab.icon}
              </EditorIcon>
              <span
                className={`min-w-0 max-w-full truncate ${
                  compactLibraryControls ? "text-[10px] leading-none" : ""
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 border-b border-outline-variant bg-surface-container-lowest p-2">
        <label className="relative block">
          <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
            search
          </EditorIcon>
          <input
            value={searchQuery}
            onChange={(event) => dispatch(searchQueryChanged(event.currentTarget.value))}
            placeholder="Search filename"
            aria-label="Search media filename"
            data-editor-shortcuts="ignore"
            className="h-8 w-full rounded-[4px] border border-outline-variant bg-surface pl-8 pr-2 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary motion-reduce:transition-none"
          />
        </label>

        <div
          role="radiogroup"
          aria-label="Media readiness"
          className="mt-2 rounded-[6px] border border-outline-variant bg-surface p-1"
        >
          <div className="grid grid-cols-2 gap-1">
            {readinessFilters.map((filter) => {
              const active = readinessFilter === filter.value;
              const count = readinessCounts[filter.value];
              return (
                <button
                  key={filter.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={`${filter.label} media`}
                  onClick={() => setReadinessFilter(filter.value)}
                  className={`flex h-9 min-w-0 items-center gap-1.5 rounded-[4px] border px-2 text-left transition-colors motion-reduce:transition-none ${
                    active
                      ? "border-primary/50 bg-primary/10 text-on-surface shadow-[inset_0_0_0_1px_rgba(192,193,255,0.18)]"
                      : "border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <EditorIcon
                    className={`shrink-0 text-[16px] ${readinessFilterIconClass(filter.value, active)}`}
                  >
                    {filter.icon}
                  </EditorIcon>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                    {filter.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mediaLoadError ? (
        <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-error-container/40 px-3 py-2 text-label-md text-on-error-container">
          <span className="min-w-0 truncate">
            {usingCachedMedia ? "Media refresh failed. Showing cached media." : "Media refresh failed. Project media could not be loaded."}
          </span>
          {onRetryMediaLoad ? (
            <button
              type="button"
              disabled={mediaRetrying}
              onClick={onRetryMediaLoad}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[4px] bg-on-error-container px-2 text-[11px] font-semibold text-error-container hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
            >
              <EditorIcon className="text-[14px]">{mediaRetrying ? "progress_activity" : "refresh"}</EditorIcon>
              {mediaRetrying ? "Retrying" : "Retry media"}
            </button>
          ) : null}
        </div>
      ) : failedOrProcessingAssets > 0 ? (
        <div className="min-h-9 shrink-0 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant">
          {failedOrProcessingAssets} item{failedOrProcessingAssets === 1 ? "" : "s"} processing or failed in this tab.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 content-start grid-cols-2 gap-2 overflow-y-auto p-2 2xl:p-3">
        {visibleAssets.map((asset, index) => (
          <MediaCard
            key={asset.id}
            media={asset}
            index={index}
            selected={selectedMediaId === asset.id}
            update={updatesById[asset.id]}
            canPlaceMedia={canPlaceMedia}
            onAdd={() => handleAddMedia(asset)}
          />
        ))}
        {visibleAssets.length === 0 ? <MediaLibraryEmptyState state={emptyState} /> : null}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Resize media library"
        onPointerDown={handleResizeStart}
        className="absolute right-[-3px] top-0 z-50 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 motion-reduce:transition-none"
      />
    </aside>
  );
}

function sortedMedia(media: MediaDto[]): MediaDto[] {
  return [...media]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function filteredLibraryAssets(
  media: MediaDto[],
  activeTab: LibraryTab,
  readinessFilter: ReadinessFilterValue,
  normalizedSearch: string,
): MediaDto[] {
  return sortedMedia(media)
    .filter((asset) => mediaLibraryKind(asset) === activeTab)
    .filter((asset) => readinessFilter === "all" || mediaReadiness(asset) === readinessFilter)
    .filter((asset) => !normalizedSearch || asset.filename.toLowerCase().includes(normalizedSearch));
}

function countReadiness(media: MediaDto[]): Record<ReadinessFilterValue, number> {
  const counts: Record<ReadinessFilterValue, number> = {
    all: media.length,
    ready: 0,
    processing: 0,
    failed: 0,
  };

  for (const asset of media) {
    counts[mediaReadiness(asset)] += 1;
  }

  return counts;
}

function readinessFilterIconClass(value: ReadinessFilterValue, active: boolean): string {
  if (active) return "text-primary";
  if (value === "failed") return "text-error";
  if (value === "processing") return "text-on-surface-variant";
  if (value === "ready") return "text-primary";
  return "text-on-surface-variant";
}

type MediaLibraryEmptyStateModel = {
  title: string;
  body: string;
  icon: string;
};

function mediaLibraryEmptyState({
  mediaCount,
  tabAssetCount,
  readinessAssetCount,
  searchQuery,
  activeTab,
  readinessFilter,
  mediaLoadError,
  usingCachedMedia,
}: {
  mediaCount: number;
  tabAssetCount: number;
  readinessAssetCount: number;
  searchQuery: string;
  activeTab: LibraryTab;
  readinessFilter: MediaReadiness | "all";
  mediaLoadError?: string | null;
  usingCachedMedia: boolean;
}): MediaLibraryEmptyStateModel {
  if (mediaLoadError && !usingCachedMedia) {
    return {
      title: "Media refresh failed",
      body: "No cached project media is available in this browser.",
      icon: "sync_problem",
    };
  }

  if (mediaCount === 0) {
    return {
      title: "No project media",
      body: "Import clips, images, or audio before building the timeline.",
      icon: "perm_media",
    };
  }

  if (tabAssetCount === 0) {
    return {
      title: `No ${libraryTabLabel(activeTab).toLowerCase()} yet`,
      body: "Switch tabs or import media for this type.",
      icon: "filter_alt_off",
    };
  }

  if (readinessAssetCount === 0 && readinessFilter !== "all") {
    return {
      title: `No ${readinessFilter} media`,
      body: "Change the readiness filter to see other project media.",
      icon: "hourglass_empty",
    };
  }

  if (searchQuery.trim()) {
    return {
      title: "No filter matches",
      body: "Clear the search or change media filters.",
      icon: "search_off",
    };
  }

  return {
    title: "No filter matches",
    body: "Change media filters to show more assets.",
    icon: "filter_alt_off",
  };
}

function libraryTabLabel(tab: LibraryTab): string {
  if (tab === "audio") return "audio";
  if (tab === "stills") return "images";
  return "videos";
}

function MediaLibraryEmptyState({ state }: { state: MediaLibraryEmptyStateModel }) {
  return (
    <div className="col-span-2 flex min-h-[180px] flex-col items-center justify-center rounded-[4px] border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-center">
      <EditorIcon className="text-[28px] text-on-surface-variant">{state.icon}</EditorIcon>
      <p className="mt-2 text-body-sm font-semibold text-on-surface">{state.title}</p>
      <p className="mt-1 max-w-[220px] text-label-md text-on-surface-variant">{state.body}</p>
    </div>
  );
}

function MediaCard({
  media,
  index,
  selected,
  update,
  canPlaceMedia,
  onAdd,
}: {
  media: MediaDto;
  index: number;
  selected: boolean;
  update?: MediaRealtimeUpdate;
  canPlaceMedia: boolean;
  onAdd: () => void;
}) {
  const pipeline = resolveMediaPipeline(media, update?.pipeline);
  const ready = isMediaReadyForTimeline(media);
  const readiness = mediaReadiness(media);

  return (
    <button
      type="button"
      draggable={canPlaceMedia && ready}
      onClick={onAdd}
      onDragStart={(event) => {
        if (!canPlaceMedia || !ready) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = ready ? "copy" : "none";
        event.dataTransfer.setData("application/x-kuvox-media-id", media.id);
        event.dataTransfer.setData("application/x-kuvox-media-kind", String(media.kind));
        event.dataTransfer.setData("text/plain", media.filename);
      }}
      title={`${media.filename} - ${pipeline.label}`}
      className={`group relative overflow-hidden rounded-[4px] border bg-surface-container-low text-left transition-colors motion-reduce:transition-none ${
        selected
          ? "border-primary shadow-[0_0_0_1px_rgba(192,193,255,0.18)]"
          : "border-outline-variant hover:border-primary/60"
      }`}
    >
      <div className="relative aspect-video overflow-hidden border-b border-outline-variant/80 bg-surface-container-high">
        <MediaThumbnail media={media} index={index} className="absolute inset-0" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.58),transparent_65%)]" />
        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[4px] bg-black/45 text-white/85">
          <EditorIcon className="text-[16px]">{iconForMedia(media)}</EditorIcon>
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
          {durationLabel(media)}
        </span>
        {readiness !== "ready" ? (
          <span className={`absolute bottom-1.5 left-1.5 rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${readiness === "failed" ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface"}`}>
            {readiness}
          </span>
        ) : null}
      </div>
      <div className="px-2 py-1.5">
        <span className="block truncate text-[11px] font-medium text-on-surface">
          {media.filename}
        </span>
        <span className={`mt-0.5 block truncate text-[9px] uppercase tracking-[0.08em] ${statusClass(pipeline.stage)}`}>
          {pipeline.label}
        </span>
      </div>
    </button>
  );
}

function iconForMedia(media: MediaDto): string {
  if (media.kind === MediaKind.Audio) return "graphic_eq";
  if (media.kind === MediaKind.Image) return "imagesmode";
  return "movie";
}

function durationLabel(media: MediaDto): string {
  if (media.kind === MediaKind.Image) return "Still";
  const duration = Number(media.durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return "--:--";
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function statusClass(stage: string): string {
  if (stage === "ready") return "text-primary";
  if (stage === "failed") return "text-error";
  return "text-on-surface-variant";
}
