import { useMemo, useState, type DragEvent } from "react";

import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaKind, type MediaDto } from "~/lib/api";
import {
  isMediaReadyForTimeline,
  mediaLibraryKind,
  mediaReadiness,
  type MediaReadiness,
  setActiveDraggedMedia,
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

import { EditorIcon, EditorIconButton } from "./editor-ui";
import { useDragResize } from "./use-drag-resize";

type LibraryKindFilter = "all" | LibraryTab;

const tabs: Array<{ value: LibraryKindFilter; label: string; icon: string }> = [
  { value: "all", label: "All", icon: "perm_media" },
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
  className?: string;
  resizable?: boolean;
  onRequestClose?: () => void;
  onImportFiles?: (files: File[]) => void;
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
  className = "hidden lg:flex",
  resizable = true,
  onRequestClose,
  onImportFiles,
}: MediaLibraryPanelProps) {
  const dispatch = useAppDispatch();
  const [kindFilter, setKindFilter] = useState<LibraryKindFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilterValue>("all");
  const [fileDragActive, setFileDragActive] = useState(false);
  const {
    open: libraryOpen,
    width: libraryWidth,
    selectedMediaId,
    searchQuery,
  } = useAppSelector(selectLibraryPanelState);
  const visibleAssets = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return filteredLibraryAssets(media, kindFilter, readinessFilter, normalizedSearch);
  }, [kindFilter, media, readinessFilter, searchQuery]);
  const activeTabAssets = useMemo(
    () => sortedMedia(media).filter((asset) => kindFilter === "all" || mediaLibraryKind(asset) === kindFilter),
    [kindFilter, media],
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
    activeTab: kindFilter,
    readinessFilter,
    mediaLoadError,
    usingCachedMedia,
  });
  const failedOrProcessingAssets = activeTabAssets.filter((asset) => {
    const readiness = mediaReadiness(asset);
    return readiness === "failed" || readiness === "processing";
  }).length;
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
      className={`relative z-40 h-full min-w-video-library-min max-w-video-library-max shrink-0 flex-col border-r border-outline-variant bg-surface ${className}`}
      style={{ width: resizable ? libraryWidth : undefined }}
      aria-label="Media library"
      onDragEnter={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setFileDragActive(true);
      }}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setFileDragActive(false);
      }}
      onDrop={(event: DragEvent<HTMLElement>) => {
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return;
        event.preventDefault();
        setFileDragActive(false);
        onImportFiles?.(files);
      }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4">
        <div>
          <h2 className="text-body-lg font-bold text-on-surface">Media</h2>
          <p className="mt-0.5 text-label-sm text-on-surface-variant">Project library</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Add media"
            onClick={() => dispatch(modalOpened("import-media"))}
            className="flex h-9 items-center gap-1.5 rounded-[7px] border border-primary/30 bg-primary/10 px-3 text-label-md font-bold text-primary hover:bg-primary/20"
          >
            <EditorIcon className="text-[17px]">add</EditorIcon>
            Import
          </button>
          <EditorIconButton
            icon="close"
            label="Close media library"
            className="hidden h-9 w-9 min-[760px]:flex min-[1180px]:hidden"
            onClick={() => {
              dispatch(libraryOpenChanged(false));
              onRequestClose?.();
            }}
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Media kind"
        className="grid h-11 shrink-0 grid-cols-4 border-b border-outline-variant px-3"
      >
        {tabs.map((tab) => {
          const active = kindFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-label={`${tab.label} library`}
              aria-selected={active}
              title={`${tab.label} library`}
              onClick={() => {
                setKindFilter(tab.value);
                if (tab.value !== "all") dispatch(libraryTabChanged(tab.value));
              }}
              className={`relative flex min-w-0 items-center justify-center text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
                active
                  ? "text-on-surface after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 gap-2 border-b border-outline-variant px-3 py-2.5">
        <label className="relative min-w-0 flex-1">
          <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
            search
          </EditorIcon>
          <input
            value={searchQuery}
            onChange={(event) => dispatch(searchQueryChanged(event.currentTarget.value))}
            placeholder="Search filename"
            aria-label="Search media filename"
            data-editor-shortcuts="ignore"
            className="h-9 w-full rounded-[6px] border border-outline-variant bg-surface-container-low pl-8 pr-2 text-label-md text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary motion-reduce:transition-none"
          />
        </label>
        <label className="sr-only" htmlFor="media-readiness-filter">Media readiness</label>
        <select
          id="media-readiness-filter"
          aria-label="Media readiness"
          value={readinessFilter}
          onChange={(event) => setReadinessFilter(event.currentTarget.value as ReadinessFilterValue)}
          className="h-9 w-[82px] rounded-[6px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface-variant outline-none focus:border-primary"
        >
          {readinessFilters.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label} {readinessCounts[filter.value]}
            </option>
          ))}
        </select>
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

      <div className="grid min-h-0 flex-1 content-start grid-cols-2 gap-3 overflow-y-auto p-3">
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
        {visibleAssets.length === 0 ? (
          <MediaLibraryEmptyState
            state={emptyState}
            onImport={() => dispatch(modalOpened("import-media"))}
          />
        ) : null}
      </div>
      {fileDragActive ? (
        <div className="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-[10px] border-2 border-dashed border-primary bg-surface/90">
          <div className="text-center text-primary">
            <EditorIcon className="text-[32px]">upload_file</EditorIcon>
            <p className="mt-2 text-body-sm font-bold">Drop files to import</p>
          </div>
        </div>
      ) : null}
      {resizable ? (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Resize media library"
          onPointerDown={handleResizeStart}
          className="absolute right-[-3px] top-0 z-50 hidden h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 motion-reduce:transition-none min-[1180px]:block"
        />
      ) : null}
    </aside>
  );
}

function sortedMedia(media: MediaDto[]): MediaDto[] {
  return [...media]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function filteredLibraryAssets(
  media: MediaDto[],
  activeTab: LibraryKindFilter,
  readinessFilter: ReadinessFilterValue,
  normalizedSearch: string,
): MediaDto[] {
  return sortedMedia(media)
    .filter((asset) => activeTab === "all" || mediaLibraryKind(asset) === activeTab)
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
  activeTab: LibraryKindFilter;
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

function libraryTabLabel(tab: LibraryKindFilter): string {
  if (tab === "all") return "media";
  if (tab === "audio") return "audio";
  if (tab === "stills") return "images";
  return "videos";
}

function MediaLibraryEmptyState({
  state,
  onImport,
}: {
  state: MediaLibraryEmptyStateModel;
  onImport: () => void;
}) {
  return (
    <div className="col-span-2 flex min-h-[190px] flex-col items-center justify-center rounded-[8px] border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-center">
      <EditorIcon className="text-[28px] text-on-surface-variant">{state.icon}</EditorIcon>
      <p className="mt-2 text-body-sm font-semibold text-on-surface">{state.title}</p>
      <p className="mt-1 max-w-[220px] text-label-md text-on-surface-variant">{state.body}</p>
      <button
        type="button"
        onClick={onImport}
        className="mt-4 flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-3 text-label-md font-bold text-on-primary"
      >
        <EditorIcon className="text-[16px]">add</EditorIcon>
        Import media
      </button>
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
      data-media-id={media.id}
      aria-label={`Add ${media.filename} to timeline`}
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
        setActiveDraggedMedia({ id: media.id, kind: media.kind });
      }}
      onDragEnd={() => {
        setActiveDraggedMedia(null);
      }}
      title={`${media.filename} - ${pipeline.label}`}
      className={`group relative aspect-[4/3] cursor-grab overflow-hidden rounded-[8px] border bg-surface-container-low text-left transition-all active:cursor-grabbing motion-reduce:transition-none ${
        selected
          ? "border-primary shadow-[0_0_0_1px_rgba(139,124,255,0.22)]"
          : "border-outline-variant hover:border-primary/60 hover:-translate-y-0.5"
      }`}
    >
      <div className="absolute inset-0 overflow-hidden bg-surface-container-high">
        <MediaThumbnail media={media} index={index} className="absolute inset-0" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,5,12,0.9),transparent_70%)]" />
        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[5px] bg-black/55 text-white/90">
          <EditorIcon className="text-[16px]">{iconForMedia(media)}</EditorIcon>
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
          {durationLabel(media)}
        </span>
        <span className="absolute bottom-2 left-2 right-12 truncate text-[10px] font-semibold text-white">
          {media.filename}
        </span>
        {readiness !== "ready" ? (
          <span className={`absolute bottom-1.5 left-1.5 rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${readiness === "failed" ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface"}`}>
            {readiness}
          </span>
        ) : null}
      </div>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
          <EditorIcon className="text-[20px]">add</EditorIcon>
        </span>
      </span>
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
