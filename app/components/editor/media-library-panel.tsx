import { useMemo, useState, useEffect, useRef, useCallback, type DragEvent } from "react";

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
import {
  createVideoOperationBatch,
  removeEffectOperation,
  removeTransitionOperation,
  upsertEffectOperation,
  upsertTransitionOperation,
} from "~/lib/editor/video-operations";
import type { MediaRealtimeUpdate } from "~/lib/media-realtime";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  libraryOpenChanged,
  libraryTabChanged,
  libraryWidthChanged,
  mediaAssetAddedToTimeline,
  modalOpened,
  searchQueryChanged,
  selectCurrentTimeSeconds,
  selectLibraryPanelState,
  selectSelectedItemIds,
  selectVideoDocument,
  textItemCreated,
  toastShown,
  videoOperationApplied,
  type LibraryTab,
} from "~/store/slices/editor-slice";

import { INITIAL_KITS, type BrandKit, type BrandAsset } from "~/routes/dashboard/brand-kits";

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

const allowedIconifyPrefixes = [
  "lucide",
  "tabler",
  "heroicons",
  "ph",
  "material-symbols",
] as const;

const elementQuickQueries = [
  "heart",
  "arrow",
  "music",
  "sparkles",
  "camera",
  "play",
  "star",
  "social",
  "shape",
  "badge",
  "emoji",
  "business",
];

type IconifyIconResult = {
  name: string;
  prefix: string;
  iconName: string;
  svgUrl: string;
};

export interface MediaLibraryPanelProps {
  activeTab?: string;
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
  activeTab,
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
      data-tour="media-library"
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
      {activeTab && activeTab === "brand_kits" ? (
        <BrandKitsLibraryPanelContent
          onClose={() => {
            dispatch(libraryOpenChanged(false));
            onRequestClose?.();
          }}
          onAddMedia={onAddMedia}
        />
      ) : activeTab && activeTab === "elements" ? (
        <ElementsLibraryPanelContent
          onClose={() => {
            dispatch(libraryOpenChanged(false));
            onRequestClose?.();
          }}
          onAddMedia={onAddMedia}
        />
      ) : activeTab && activeTab !== "media" ? (
        <MockLibraryPanelContent
          tab={activeTab}
          onClose={() => {
            dispatch(libraryOpenChanged(false));
            onRequestClose?.();
          }}
        />
      ) : (
        <>
          <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 border-b border-outline-variant/30">
            <div>
              <h2 className="text-body-sm font-bold text-on-surface leading-tight">Media</h2>
              <p className="text-[10px] text-on-surface-variant/75 leading-none mt-0.5">Project library</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Add media"
                data-tour="import-media"
                onClick={() => dispatch(modalOpened("import-media"))}
                className="flex h-[30px] items-center gap-1 rounded-[5px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high hover:border-on-surface-variant focus:outline-none"
              >
                <EditorIcon className="text-[14px]">add</EditorIcon>
                Import
              </button>
              <EditorIconButton
                icon="close"
                label="Close media library"
                className="hidden h-[30px] w-[30px] min-[760px]:flex min-[1180px]:hidden"
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

          <div className="flex shrink-0 gap-2 border-b border-outline-variant px-3 py-2">
            <label className="relative min-w-0 flex-1">
              <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">
                search
              </EditorIcon>
              <input
                value={searchQuery}
                onChange={(event) => dispatch(searchQueryChanged(event.currentTarget.value))}
                placeholder="Search filename"
                aria-label="Search media filename"
                data-editor-shortcuts="ignore"
                className="h-8 w-full rounded-[6px] border border-outline-variant bg-surface-container-low pl-8 pr-2 text-[11px] font-medium text-on-surface outline-none transition-colors placeholder:text-[11px] placeholder:text-on-surface-variant/70 focus:border-primary motion-reduce:transition-none"
              />
            </label>
            <label className="sr-only" htmlFor="media-readiness-filter">
              Media readiness
            </label>
            <select
              id="media-readiness-filter"
              aria-label="Media readiness"
              value={readinessFilter}
              onChange={(event) => setReadinessFilter(event.currentTarget.value as ReadinessFilterValue)}
              className="h-8 w-[82px] rounded-[6px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface-variant outline-none focus:border-primary"
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
                {usingCachedMedia
                  ? "Media refresh failed. Showing cached media."
                  : "Media refresh failed. Project media could not be loaded."}
              </span>
              {onRetryMediaLoad ? (
                <button
                  type="button"
                  disabled={mediaRetrying}
                  onClick={onRetryMediaLoad}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[4px] bg-on-error-container px-2 text-[11px] font-semibold text-error-container hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
                >
                  <EditorIcon className="text-[14px]">
                    {mediaRetrying ? "progress_activity" : "refresh"}
                  </EditorIcon>
                  {mediaRetrying ? "Retrying" : "Retry media"}
                </button>
              ) : null}
            </div>
          ) : failedOrProcessingAssets > 0 ? (
            <div className="min-h-9 shrink-0 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant">
              {failedOrProcessingAssets} item{failedOrProcessingAssets === 1 ? "" : "s"} processing or failed in
              this tab.
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
        </>
      )}

      {fileDragActive ? (
        <div className="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-[10px] border-2 border-dashed border-primary bg-surface/90">
          <div className="text-center text-primary">
            <EditorIcon className="text-[32px]">upload_file</EditorIcon>
            <p className="mt-2 text-body-sm font-bold">Drop files to import</p>
          </div>
        </div>
      ) : null}

      {/* Resize handle */}
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

function MockLibraryPanelContent({ tab, onClose }: { tab: string; onClose: () => void }) {
  const document = useAppSelector(selectVideoDocument);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const sections = getMockSections(tab);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  const [activeTransition, setActiveTransition] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kuvox_active_transition");
    }
    return null;
  });

  const [activeEffect, setActiveEffect] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kuvox_active_effect");
    }
    return null;
  });

  useEffect(() => {
    const handleTransitionChange = () => {
      setActiveTransition(localStorage.getItem("kuvox_active_transition"));
    };
    const handleEffectChange = () => {
      setActiveEffect(localStorage.getItem("kuvox_active_effect"));
    };
    window.addEventListener("kuvox-transition-changed", handleTransitionChange);
    window.addEventListener("kuvox-effect-changed", handleEffectChange);
    return () => {
      window.removeEventListener("kuvox-transition-changed", handleTransitionChange);
      window.removeEventListener("kuvox-effect-changed", handleEffectChange);
    };
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    setActiveSectionIdx(0);
  }, [tab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [sections, checkScroll]);

  // Recalculate scroll whenever tab changes
  useEffect(() => {
    const raf = requestAnimationFrame(checkScroll);
    return () => cancelAnimationFrame(raf);
  }, [tab, checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 150;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const dispatch = useAppDispatch();

  if (tab === "elements") {
    return <IconifyElementsPanel onClose={onClose} />;
  }

  const handleItemClick = (itemName: string) => {
    if (tab === "text") {
      dispatch(textItemCreated({
        preset: itemName === "Heading" || itemName === "Subheading" || itemName === "Intro Title" || itemName === "Lower Third" ? "title" : "caption",
        text: itemName,
      }));
    } else if (tab === "effects") {
      const targetItemIds = selectedItemIds.filter((itemId) =>
        document?.tracks.some((track) => track.items.some((item) => item.id === itemId && item.type !== "audio")),
      );
      if (targetItemIds.length === 0) {
        dispatch(toastShown("Select a visual item before applying an effect"));
        return;
      }
      if (itemName === "None") {
        const operations = (document?.effects ?? [])
          .filter((effect) => effect.targetItemIds.some((itemId) => targetItemIds.includes(itemId)))
          .map((effect) => removeEffectOperation(effect.id));
        if (operations.length === 1) {
          dispatch(videoOperationApplied(operations[0]));
        } else if (operations.length > 1) {
          dispatch(videoOperationApplied(createVideoOperationBatch({
            source: "manual",
            label: "Remove effects",
            operations,
          })));
        }
        localStorage.removeItem("kuvox_active_effect");
        setActiveEffect(null);
        dispatch(toastShown("Effect removed"));
        return;
      }
      const effectType = normalizeEditorFeatureType(itemName);
      dispatch(videoOperationApplied(upsertEffectOperation({
        id: `effect-${effectType}-${targetItemIds.join("-")}`,
        type: effectType,
        targetItemIds,
        enabled: true,
        parameters: {},
      }, `Apply ${itemName}`)));
      localStorage.setItem("kuvox_active_effect", itemName);
      setActiveEffect(itemName);
      dispatch(toastShown(`Effect applied: ${itemName}`));
    } else if (tab === "transitions") {
      const targetItemIds = transitionTargets(document, selectedItemIds);
      if (targetItemIds.length < 2) {
        dispatch(toastShown("Select two adjacent visual items before applying a transition"));
        return;
      }
      if (itemName === "None") {
        const operations = (document?.transitions ?? [])
          .filter((transition) => transition.targetItemIds.every((itemId) => targetItemIds.includes(itemId)))
          .map((transition) => removeTransitionOperation(transition.id));
        if (operations.length === 1) {
          dispatch(videoOperationApplied(operations[0]));
        } else if (operations.length > 1) {
          dispatch(videoOperationApplied(createVideoOperationBatch({
            source: "manual",
            label: "Remove transitions",
            operations,
          })));
        }
        localStorage.removeItem("kuvox_active_transition");
        setActiveTransition(null);
        dispatch(toastShown("Transition removed"));
        return;
      }
      const transitionType = normalizeEditorFeatureType(itemName);
      dispatch(videoOperationApplied(upsertTransitionOperation({
        id: `transition-${targetItemIds.join("-")}`,
        type: transitionType,
        targetItemIds,
        duration: document?.settings.defaultTransitionDuration ?? 0.4,
        easing: "ease-in-out",
      }, `Apply ${itemName}`)));
      localStorage.setItem("kuvox_active_transition", itemName);
      setActiveTransition(itemName);
      dispatch(toastShown(`Transition selected: ${itemName}`));
    } else if (tab === "elements") {
      let svgUrl = "";
      let elementWidth = 100;
      let elementHeight = 100;
      if (itemName === "Circle") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="%238B7CFF"/></svg>`;
      } else if (itemName === "Square" || itemName === "Classic Border" || itemName === "Soft Gradient") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="5" y="5" width="90" height="90" rx="8" fill="%2300B894"/></svg>`;
      } else if (itemName === "Triangle") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50,5 95,90 5,90" fill="%23FDCB6E"/></svg>`;
      } else if (itemName === "Star") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="%23FF7675"/></svg>`;
      } else if (itemName === "Heart") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50,30 C35,10 10,20 10,45 C10,70 50,90 50,90 C50,90 90,70 90,45 C90,20 65,10 50,30 Z" fill="%23FF7675"/></svg>`;
      } else if (itemName === "Line" || itemName === "Curve Line") {
        elementHeight = 10;
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" width="100" height="10"><line x1="5" y1="5" x2="95" y2="5" stroke="%23A29BFE" stroke-width="6" stroke-linecap="round"/></svg>`;
      } else if (itemName === "Arrow" || itemName === "Double Arrow") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,40 L70,40 L70,20 L95,50 L70,80 L70,60 L10,60 Z" fill="%2374B9FF"/></svg>`;
      } else if (itemName === "Speech Bubble") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,20 L90,20 L90,70 L40,70 L20,90 L20,70 L10,70 Z" fill="%23FFEAA7"/><text x="40" y="50" fill="%23111827" font-size="16">💬</text></svg>`;
      } else {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="10" y="10" width="80" height="80" rx="10" fill="%2374B9FF"/><text x="25" y="55" fill="white" font-size="12">${encodeURIComponent(itemName.substring(0, 8))}</text></svg>`;
      }

      const elementMediaDto: MediaDto = {
        id: `el_${itemName.toLowerCase().replace(/\s/g, "_")}_${uniqueElementId()}`,
        ownerId: "brand-kit-user",
        ownerKind: 1,
        ownerEmail: null,
        ownerDisplayName: null,
        kind: MediaKind.Image,
        filename: itemName,
        storageKey: svgUrl,
        canonicalStorageKey: svgUrl,
        proxyStorageKey: null,
        thumbnailStorageKey: null,
        errorMessage: null,
        durationSeconds: null,
        width: elementWidth,
        height: elementHeight,
        codec: null,
        frameRate: null,
        sizeBytes: 512,
        status: "ready",
        createdAt: new Date().toISOString(),
        isFavorite: false,
        pipeline: {
          stage: "ready",
          label: "Ready",
          detail: "Ready",
          step: 4,
          stepCount: 4,
          terminal: true,
        },
      };

      dispatch(mediaAssetAddedToTimeline(elementMediaDto));
    }
  };
  
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 border-b border-outline-variant/30">
        <div>
          <h2 className="text-body-sm font-bold text-on-surface leading-tight capitalize">{tab.replace('_', ' ')}</h2>
          <p className="text-[10px] text-on-surface-variant/75 leading-none mt-0.5">{getMockDescription(tab)}</p>
        </div>
        <EditorIconButton
          icon="close"
          label={`Close ${tab}`}
          className="hidden h-[30px] w-[30px] min-[760px]:flex min-[1180px]:hidden"
          onClick={onClose}
        />
      </div>
      
      {['text', 'effects', 'transitions', 'elements'].includes(tab) && (
        <div className="flex shrink-0 gap-2 border-b border-outline-variant px-3 py-2">
          <label className="relative min-w-0 flex-1">
            <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">
              search
            </EditorIcon>
            <input
              placeholder="Search..."
              className="h-8 w-full rounded-[6px] border border-outline-variant bg-surface-container-low pl-8 pr-2 text-[11px] font-medium text-on-surface outline-none transition-colors placeholder:text-[11px] placeholder:text-on-surface-variant/70 focus:border-primary motion-reduce:transition-none"
            />
          </label>
        </div>
      )}

      {sections.length > 1 && (
        <div className="relative flex shrink-0 items-center border-b border-outline-variant bg-surface">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface cursor-pointer border-none outline-none"
              aria-label="Scroll left"
            >
              <EditorIcon className="text-[14px]">chevron_left</EditorIcon>
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto flex shrink-0 px-8 scroll-smooth custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {sections.map((section, idx) => {
              const active = activeSectionIdx === idx;
              return (
                <button
                  key={section.title}
                  type="button"
                  onClick={() => setActiveSectionIdx(idx)}
                  className={`relative flex h-11 min-w-max items-center justify-center px-3 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
                    active
                      ? "text-on-surface after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {section.title}
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface cursor-pointer border-none outline-none"
              aria-label="Scroll right"
            >
              <EditorIcon className="text-[14px]">chevron_right</EditorIcon>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {sections[activeSectionIdx] && (
          <div className="grid grid-cols-2 gap-2">
             {sections[activeSectionIdx].items.map(item => {
                const isNone = item === "None";
                const isActive =
                  (tab === "transitions" && ((isNone && !activeTransition) || (activeTransition === item))) ||
                  (tab === "effects" && ((isNone && !activeEffect) || (activeEffect === item)));
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`flex min-h-10 items-center justify-center rounded-[4px] p-2 text-center text-[11px] font-semibold cursor-pointer transition-colors border outline-none ${
                      isActive
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant/50 focus:border-primary"
                    }`}
                  >
                    {isNone ? "🚫 None" : item}
                  </button>
                );
             })}
          </div>
        )}
      </div>
    </div>
  );
}

function IconifyElementsPanel({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const [query, setQuery] = useState("heart");
  const [results, setResults] = useState<IconifyIconResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

  const checkCategoryScroll = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollCategoriesLeft(el.scrollLeft > 1);
    setCanScrollCategoriesRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scrollCategories = (direction: "left" | "right") => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      fetch(`/api/iconify/search?query=${encodeURIComponent(normalizedQuery)}&limit=48`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Iconify search failed");
          return response.json() as Promise<{ icons?: string[] }>;
        })
        .then((payload) => {
          setResults((payload.icons ?? []).map(iconifyResultFromName).filter(isIconifyResult));
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
          console.error(error);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    checkCategoryScroll();
    el.addEventListener("scroll", checkCategoryScroll);
    window.addEventListener("resize", checkCategoryScroll);
    const raf = requestAnimationFrame(checkCategoryScroll);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", checkCategoryScroll);
      window.removeEventListener("resize", checkCategoryScroll);
    };
  }, [checkCategoryScroll]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 border-b border-outline-variant/30">
        <div>
          <h2 className="text-body-sm font-bold text-on-surface leading-tight">Elements</h2>
          <p className="text-[10px] text-on-surface-variant/75 leading-none mt-0.5">
            Iconify SVG icons
          </p>
        </div>
        <EditorIconButton
          icon="close"
          label="Close elements"
          className="hidden h-[30px] w-[30px] min-[760px]:flex min-[1180px]:hidden"
          onClick={onClose}
        />
      </div>

      <div className="flex shrink-0 gap-2 border-b border-outline-variant px-3 py-2">
        <label className="relative min-w-0 flex-1">
          <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">
            search
          </EditorIcon>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search icons"
            aria-label="Search Iconify elements"
            data-editor-shortcuts="ignore"
            className="h-8 w-full rounded-[6px] border border-outline-variant bg-surface-container-low pl-8 pr-2 text-[11px] font-medium text-on-surface outline-none transition-colors placeholder:text-[11px] placeholder:text-on-surface-variant/70 focus:border-primary motion-reduce:transition-none"
          />
        </label>
      </div>

      <div className="relative flex shrink-0 items-center border-b border-outline-variant bg-surface px-2 py-2">
        {canScrollCategoriesLeft ? (
          <button
            type="button"
            onClick={() => scrollCategories("left")}
            aria-label="Scroll element categories left"
            className="absolute left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface"
          >
            <EditorIcon className="text-[14px]">chevron_left</EditorIcon>
          </button>
        ) : null}
        <div
          ref={categoryScrollRef}
          className="flex flex-1 gap-1 overflow-x-auto scroll-smooth px-7 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {elementQuickQueries.map((item) => {
            const active = query.trim().toLowerCase() === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setQuery(item)}
                className={`h-7 shrink-0 rounded-[4px] border px-2 text-[10px] font-semibold capitalize transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
                }`}
              >
                {item}
              </button>
            );
          })}
          {allowedIconifyPrefixes.map((prefix) => (
            <button
              key={prefix}
              type="button"
              onClick={() => setQuery(prefix)}
              className="h-7 shrink-0 rounded-[4px] border border-outline-variant/50 bg-surface-container-high px-2 text-[10px] font-semibold text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
            >
              {prefix}
            </button>
          ))}
        </div>
        {canScrollCategoriesRight ? (
          <button
            type="button"
            onClick={() => scrollCategories("right")}
            aria-label="Scroll element categories right"
            className="absolute right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface"
          >
            <EditorIcon className="text-[14px]">chevron_right</EditorIcon>
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {status === "error" ? (
          <PanelMessage icon="sync_problem" title="Icon search failed" body="Try another keyword in a moment." />
        ) : status === "loading" && results.length === 0 ? (
          <PanelMessage icon="progress_activity" title="Searching icons" body="Loading approved Iconify sets." />
        ) : results.length === 0 ? (
          <PanelMessage icon="search" title="No icons found" body="Try a simpler keyword such as heart, arrow, or music." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {results.map((icon) => (
              <button
                key={icon.name}
                type="button"
                title={`Add ${icon.name}`}
                onClick={() => dispatch(mediaAssetAddedToTimeline({
                  media: createIconifyMedia(icon),
                  timelineStart: currentTime,
                }))}
                className="group flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-[6px] border border-outline-variant/50 bg-surface-container-low p-2 text-center transition-colors hover:border-primary/60 hover:bg-surface-container-high"
              >
                <img
                  src={icon.svgUrl}
                  alt=""
                  className="h-8 w-8 opacity-95 drop-shadow-[0_0_10px_rgba(139,124,255,0.35)] transition-opacity group-hover:opacity-100"
                  loading="lazy"
                />
                <span className="w-full truncate text-[9px] font-semibold text-on-surface-variant">
                  {icon.iconName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelMessage({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center rounded-[8px] border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-center">
      <EditorIcon className="text-[28px] text-on-surface-variant">{icon}</EditorIcon>
      <p className="mt-2 text-body-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-1 max-w-[220px] text-label-md text-on-surface-variant">{body}</p>
    </div>
  );
}

function iconifyResultFromName(name: string): IconifyIconResult | null {
  const [prefix, iconName] = name.split(":");
  if (!prefix || !iconName || !allowedIconifyPrefixes.includes(prefix as typeof allowedIconifyPrefixes[number])) {
    return null;
  }
  return {
    name,
    prefix,
    iconName,
    svgUrl: iconifySvgUrl(name),
  };
}

function isIconifyResult(value: IconifyIconResult | null): value is IconifyIconResult {
  return value !== null;
}

function createIconifyMedia(icon: IconifyIconResult): MediaDto {
  return {
    id: `iconify_${icon.prefix}_${icon.iconName}_${uniqueElementId()}`,
    ownerId: "iconify",
    ownerKind: 1,
    ownerEmail: null,
    ownerDisplayName: "Iconify",
    kind: MediaKind.Image,
    filename: icon.name,
    storageKey: icon.svgUrl,
    canonicalStorageKey: icon.svgUrl,
    proxyStorageKey: null,
    thumbnailStorageKey: null,
    errorMessage: null,
    durationSeconds: null,
    width: 24,
    height: 24,
    codec: "svg",
    frameRate: null,
    sizeBytes: 0,
    status: "ready",
    createdAt: new Date().toISOString(),
    isFavorite: false,
    pipeline: {
      stage: "ready",
      label: "Ready",
      detail: "Iconify SVG",
      step: 4,
      stepCount: 4,
      terminal: true,
    },
  };
}

function uniqueElementId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function iconifySvgUrl(iconName: string): string {
  const [prefix, name] = iconName.split(":");
  return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?color=%23f1f2fb`;
}

function normalizeEditorFeatureType(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function transitionTargets(
  document: ReturnType<typeof selectVideoDocument>,
  selectedItemIds: string[],
): string[] {
  if (!document) return [];
  const selected = new Set(selectedItemIds);
  const visualItems = document.tracks
    .filter((track) => track.kind !== "audio")
    .flatMap((track) => track.items)
    .filter((item) => item.type !== "audio")
    .sort((left, right) => left.timelineStart - right.timelineStart);
  const explicit = visualItems.filter((item) => selected.has(item.id));
  if (explicit.length >= 2) return explicit.slice(0, 2).map((item) => item.id);
  if (explicit.length === 1) {
    const index = visualItems.findIndex((item) => item.id === explicit[0].id);
    const neighbor = visualItems[index + 1] ?? visualItems[index - 1];
    return neighbor ? [explicit[0].id, neighbor.id] : [];
  }
  return [];
}

function getMockDescription(tab: string) {
  switch (tab) {
    case 'text': return "Thêm chữ, tiêu đề, phụ đề.";
    case 'effects': return "Hiệu ứng kéo thả lên clip.";
    case 'transitions': return "Transition giữa hai clip.";
    case 'brand_kits': return "Đây là điểm khác biệt so với editor thông thường.";
    case 'elements': return "Các asset đồ họa.";
    case 'ai_tools': return "Đây là nơi Kuvox khác biệt.";
    default: return "";
  }
}

function getMockSections(tab: string) {
  switch(tab) {
    case 'text': return [
      { title: "Basic", items: ["Heading", "Subheading", "Body", "Paragraph"] },
      { title: "Titles", items: ["Intro Title", "Lower Third", "End Credits", "Callout", "Quote"] },
      { title: "Captions", items: ["Subtitle", "Auto Caption Template", "Karaoke", "Transcript"] },
      { title: "Templates", items: ["YouTube", "TikTok", "Instagram", "Podcast"] },
      { title: "Favorites", items: ["Brand Fonts", "Favorites", "Recently Used"] }
    ];
    case 'effects': return [
      { title: "Favorites", items: ["None", "Favorites", "Recent"] },
      { title: "Blur", items: ["Gaussian", "Box Blur", "Motion Blur"] },
      { title: "Stylize", items: ["Glow", "Bloom", "Sharpen", "Vignette", "Film Grain"] },
      { title: "Distortion", items: ["Wave", "Glitch", "RGB Split", "Lens"] },
      { title: "Lighting", items: ["Shadow", "Light Leak", "Lens Flare"] },
      { title: "AI Effects", items: ["Background Blur", "Portrait"] },
    ];
    case 'transitions': return [
      { title: "Basic", items: ["None", "Cut", "Fade", "Cross Dissolve"] },
      { title: "Slide", items: ["Left", "Right", "Up", "Down"] },
      { title: "Zoom", items: ["Zoom In", "Zoom Out"] },
      { title: "Motion", items: ["Push", "Whip", "Spin"] },
      { title: "Stylized", items: ["Glitch", "Flash", "Light Leak"] },
      { title: "Favorites", items: ["Favorites", "Recent"] }
    ];
    case 'brand_kits': return [
      { title: "Current Brand", items: ["Logos", "Colors", "Fonts", "Typography", "Watermarks", "Intro", "Outro", "Lower Third", "Templates"] },
      { title: "Shared Assets", items: ["Shared Assets", "Favorites"] },
      { title: "Ví dụ (Acme Brand)", items: ["Logo.svg", "Primary #6C5CE7", "Secondary #111827", "Font Inter", "Watermark", "Intro.mp4"] }
    ];
    case 'elements': return [
      { title: "Shapes", items: ["Circle", "Square", "Triangle", "Star", "Heart", "Speech Bubble"] },
      { title: "Lines & Arrows", items: ["Line", "Arrow", "Double Arrow", "Curve Line"] },
      { title: "Gradients & Borders", items: ["Soft Gradient", "Classic Border", "Neon Border"] },
    ];
    case 'ai_tools': return [
      { title: "Editing", items: ["Auto Caption", "Smart Cut", "Remove Silence", "Scene Detection"] },
      { title: "Video", items: ["Background Removal", "Object Tracking", "Auto Reframe", "Video Upscale"] },
      { title: "Audio", items: ["Voice Enhance", "Noise Removal", "Voice Clone"] },
      { title: "Creative", items: ["Thumbnail Generator", "Script Generator", "AI Title", "Clip Generator"] },
      { title: "Translation", items: ["Subtitle Translation", "Voice Translation"] },
      { title: "Assistant", items: ["Ask AI", "Prompt History", "AI Presets"] },
    ];
  }
  return [];
}

function BrandKitsLibraryPanelContent({ onClose, onAddMedia }: { onClose: () => void; onAddMedia: (media: MediaDto) => void }) {
  const dispatch = useAppDispatch();
  const [kits, setKits] = useState<BrandKit[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kuvox_brand_kits");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_KITS;
  });

  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);

  const selectedKit = useMemo(() => {
    return kits.find(k => k.id === selectedKitId) || null;
  }, [kits, selectedKitId]);

  const [activeCategory, setActiveCategory] = useState<"colors" | "logos" | "fonts" | "images" | "audio" | "others">("colors");

  // LISTING VIEW
  if (selectedKitId === null) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 border-b border-outline-variant/30">
          <div>
            <h2 className="text-body-sm font-bold text-on-surface leading-tight">Brand Kits</h2>
            <p className="text-[10px] text-on-surface-variant/75 leading-none mt-0.5">Select a brand to view assets</p>
          </div>
          <EditorIconButton
            icon="close"
            label="Close Brand Kits"
            className="hidden h-[30px] w-[30px] min-[760px]:flex min-[1180px]:hidden"
            onClick={onClose}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          {kits.map((kit) => {
            const previewColors = kit.palettes.flatMap((p) => p.colors).slice(0, 5);
            return (
              <button
                key={kit.id}
                type="button"
                onClick={() => setSelectedKitId(kit.id)}
                className="w-full text-left flex flex-col gap-3 p-4 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:border-primary/50 hover:bg-surface-container transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-body-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                    {kit.name}
                  </span>
                  {kit.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5 items-center">
                  {previewColors.map((color) => (
                    <div
                      key={color}
                      className="h-5 w-5 rounded-full border border-outline-variant/20 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {previewColors.length === 0 && (
                    <span className="text-[10px] text-on-surface-variant/60">No colors set</span>
                  )}
                </div>

                <div className="text-[10px] text-on-surface-variant flex items-center justify-between border-t border-outline-variant/20 pt-2 w-full">
                  <span>
                    {kit.logos.length + kit.images.length + kit.illustrations.length} assets · {kit.fonts.length} fonts
                  </span>
                  <span className="flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                    View
                    <EditorIcon className="text-[12px]">chevron_right</EditorIcon>
                  </span>
                </div>
              </button>
            );
          })}
          
          {kits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <EditorIcon className="text-[28px] text-on-surface-variant">palette</EditorIcon>
              <p className="mt-2 text-body-sm font-semibold text-on-surface">No Brand Kits Found</p>
              <p className="mt-1 text-label-md text-on-surface-variant">Please create a Brand Kit in the Dashboard page first.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FALLBACK DETAIL NOT FOUND
  if (!selectedKit) {
    return (
      <div className="flex h-full flex-col bg-surface p-4 items-center justify-center text-center">
        <EditorIcon className="text-[28px] text-on-surface-variant">palette</EditorIcon>
        <p className="mt-2 text-body-sm font-semibold text-on-surface">No Brand Kit Selected</p>
        <button
          type="button"
          onClick={() => setSelectedKitId(null)}
          className="mt-4 flex h-8 items-center justify-center rounded-[6px] border border-outline-variant bg-surface-container-low px-3 text-label-md font-bold text-on-surface cursor-pointer"
        >
          Back
        </button>
      </div>
    );
  }

  const categories = [
    { id: "colors", label: "Colors", icon: "color_lens" },
    { id: "logos", label: "Logos", icon: "qr_code_2" },
    { id: "fonts", label: "Fonts", icon: "text_fields" },
    { id: "images", label: "Images", icon: "image" },
    { id: "audio", label: "Audio", icon: "music_note" },
    { id: "others", label: "Graphics", icon: "brush" },
  ] as const;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-13 shrink-0 items-center gap-3 px-3 border-b border-outline-variant/30">
        <button
          type="button"
          onClick={() => setSelectedKitId(null)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer border-none outline-none bg-transparent"
          aria-label="Back to Brand Kits"
        >
          <EditorIcon className="text-[18px]">arrow_back</EditorIcon>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-body-sm font-bold text-on-surface leading-tight truncate">{selectedKit.name}</h2>
          <p className="text-[10px] text-on-surface-variant/75 leading-none mt-0.5">Brand Kit Assets</p>
        </div>
        <EditorIconButton
          icon="close"
          label="Close Brand Kits"
          className="hidden h-[30px] w-[30px] min-[760px]:flex min-[1180px]:hidden"
          onClick={onClose}
        />
      </div>

      <div className="flex shrink-0 overflow-x-auto border-b border-outline-variant px-2 custom-scrollbar">
        {categories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`relative flex h-11 min-w-max items-center justify-center px-3 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
                active
                  ? "text-on-surface after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-on-surface-variant hover:text-on-surface cursor-pointer"
              }`}
            >
              <span className="flex items-center gap-1">
                <EditorIcon className="text-[12px]">{cat.icon}</EditorIcon>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <BrandKitCategoryContent
          kit={selectedKit}
          category={activeCategory}
          onAddMedia={onAddMedia}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}

function BrandKitCategoryContent({
  kit,
  category,
  onAddMedia,
  dispatch,
}: {
  kit: BrandKit;
  category: "colors" | "logos" | "fonts" | "images" | "audio" | "others";
  onAddMedia: (media: MediaDto) => void;
  dispatch: any;
}) {
  const handleColorClick = (color: string) => {
    navigator.clipboard.writeText(color);
    dispatch(toastShown(`Copied Hex: ${color}`));
  };

  const handleFontClick = (font: BrandAsset) => {
    navigator.clipboard.writeText(font.name.replace(/\.[^/.]+$/, ""));
    dispatch(toastShown(`Copied Font Name: ${font.name}`));
  };

  const addBrandAssetToProject = (asset: BrandAsset, kind: number) => {
    let url = asset.url;
    if (!url) {
      if (asset.name.endsWith(".svg")) {
        url = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" rx="8" fill="%236C5CE7"/><text x="20" y="25" fill="white" font-family="sans-serif" font-weight="bold" font-size="16">${encodeURIComponent(asset.name.replace(/\.[^/.]+$/, ""))}</text></svg>`;
      } else if (kind === 2) {
        url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      } else {
        url = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60";
      }
    }

    const brandMediaDto: MediaDto = {
      id: asset.id,
      ownerId: "brand-kit-user",
      ownerKind: 1,
      ownerEmail: null,
      ownerDisplayName: null,
      kind: kind as any,
      filename: asset.name,
      storageKey: url,
      canonicalStorageKey: url,
      proxyStorageKey: null,
      thumbnailStorageKey: null,
      errorMessage: null,
      durationSeconds: kind === 2 ? 180 : null,
      width: null,
      height: null,
      codec: null,
      frameRate: null,
      sizeBytes: 1024,
      status: "ready",
      createdAt: new Date().toISOString(),
      isFavorite: false,
      pipeline: {
        stage: "ready",
        label: "Ready",
        detail: "Ready",
        step: 4,
        stepCount: 4,
        terminal: true,
      },
    };

    dispatch(mediaAssetAddedToTimeline(brandMediaDto));
  };

  switch (category) {
    case "colors":
      return (
        <div className="flex flex-col gap-4">
          {kit.palettes.map((palette) => (
            <div key={palette.name} className="flex flex-col gap-2">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{palette.name}</div>
              <div className="grid grid-cols-4 gap-2">
                {palette.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorClick(color)}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-[6px] border border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low transition-all cursor-pointer bg-transparent"
                  >
                    <div
                      className="h-10 w-full rounded-[4px] border border-outline-variant/20 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[9px] font-mono font-semibold text-on-surface">{color}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {kit.palettes.length === 0 && (
            <div className="text-center text-label-md text-on-surface-variant py-4">No color palettes configured.</div>
          )}
        </div>
      );

    case "logos":
      return (
        <div className="grid grid-cols-2 gap-2">
          {kit.logos.map((logo) => {
            const logoUrl = logo.url || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" rx="8" fill="%236C5CE7"/><text x="12" y="25" fill="white" font-family="sans-serif" font-weight="bold" font-size="12">${encodeURIComponent(logo.name)}</text></svg>`;
            return (
              <div
                key={logo.id}
                onClick={() => addBrandAssetToProject(logo, 1)}
                className="group relative flex aspect-[4/3] items-center justify-center rounded-[8px] border border-outline-variant/50 bg-surface-container-low p-2 hover:border-primary/60 cursor-pointer overflow-hidden transition-all"
                title="Click to add logo to timeline"
              >
                <img src={logoUrl} alt={logo.name} className="max-h-full max-w-full object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                  <span className="text-[9px] text-white font-semibold truncate w-full">{logo.name}</span>
                  <span className="text-[8px] text-white/70">{logo.size}</span>
                </div>
              </div>
            );
          })}
          {kit.logos.length === 0 && (
            <div className="col-span-2 text-center text-label-md text-on-surface-variant py-4">No logos uploaded.</div>
          )}
        </div>
      );

    case "fonts":
      return (
        <div className="flex flex-col gap-2">
          {kit.fonts.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => handleFontClick(font)}
              className="flex items-center justify-between p-3 rounded-[6px] border border-outline-variant/40 bg-surface-container-low hover:border-primary/50 hover:bg-surface-container transition-all cursor-pointer text-left w-full"
            >
              <div className="min-w-0">
                <div className="text-body-sm font-semibold text-on-surface truncate">{font.name.replace(/\.[^/.]+$/, "")}</div>
                <div className="text-[9px] text-on-surface-variant font-mono">{font.type} · {font.size}</div>
              </div>
              <EditorIcon className="text-[16px] text-on-surface-variant">content_copy</EditorIcon>
            </button>
          ))}
          {kit.fonts.length === 0 && (
            <div className="text-center text-label-md text-on-surface-variant py-4">No fonts uploaded.</div>
          )}
        </div>
      );

    case "images":
      return (
        <div className="grid grid-cols-2 gap-2">
          {kit.images.map((img) => {
            const imgUrl = img.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60";
            return (
              <div
                key={img.id}
                onClick={() => addBrandAssetToProject(img, 1)}
                className="group relative flex aspect-[4/3] items-center justify-center rounded-[8px] border border-outline-variant/50 bg-surface-container-low overflow-hidden hover:border-primary/60 cursor-pointer transition-all"
                title="Click to add image to timeline"
              >
                <img src={imgUrl} alt={img.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                  <span className="text-[9px] text-white font-semibold truncate w-full">{img.name}</span>
                  <span className="text-[8px] text-white/70">{img.size}</span>
                </div>
              </div>
            );
          })}
          {kit.images.length === 0 && (
            <div className="col-span-2 text-center text-label-md text-on-surface-variant py-4">No images uploaded.</div>
          )}
        </div>
      );

    case "audio":
      return (
        <div className="flex flex-col gap-2">
          {kit.audio.map((aud) => (
            <div
              key={aud.id}
              onClick={() => addBrandAssetToProject(aud, 2)}
              className="flex items-center gap-3 p-3 rounded-[6px] border border-outline-variant/40 bg-surface-container-low hover:border-primary/50 hover:bg-surface-container transition-all cursor-pointer text-left w-full"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-primary/10 text-primary">
                <EditorIcon className="text-[18px]">graphic_eq</EditorIcon>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-semibold text-on-surface truncate">{aud.name}</div>
                <div className="text-[9px] text-on-surface-variant font-mono">{aud.size}</div>
              </div>
              <EditorIcon className="text-[16px] text-primary">add</EditorIcon>
            </div>
          ))}
          {kit.audio.length === 0 && (
            <div className="text-center text-label-md text-on-surface-variant py-4">No audio assets uploaded.</div>
          )}
        </div>
      );

    case "others":
      const graphics = [...kit.illustrations, ...kit.icons];
      return (
        <div className="grid grid-cols-2 gap-2">
          {graphics.map((graphic) => {
            const gUrl = graphic.url || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" rx="8" fill="%2374B9FF"/><text x="8" y="34" fill="white" font-family="sans-serif" font-weight="bold" font-size="8">${encodeURIComponent(graphic.name.substring(0, 8))}</text></svg>`;
            return (
              <div
                key={graphic.id}
                onClick={() => addBrandAssetToProject(graphic, 1)}
                className="group relative flex aspect-square items-center justify-center rounded-[8px] border border-outline-variant/50 bg-surface-container-low p-2 hover:border-primary/60 cursor-pointer overflow-hidden transition-all"
                title="Click to add graphic to timeline"
              >
                <img src={gUrl} alt={graphic.name} className="max-h-full max-w-full object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2 transition-opacity">
                  <span className="text-[9px] text-white font-semibold truncate w-full">{graphic.name}</span>
                  <span className="text-[8px] text-white/70">{graphic.size}</span>
                </div>
              </div>
            );
          })}
          {graphics.length === 0 && (
            <div className="col-span-2 text-center text-label-md text-on-surface-variant py-4">No graphics or icons uploaded.</div>
          )}
        </div>
      );
  }
  return null;
}

// ==========================================
// REDESIGNED ELEMENTS LIBRARY PANEL
// ==========================================

export interface KuvoxElement {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  tags: string[];
  colors: string[];
  animated: boolean;
  premium: boolean;
  type: "svg" | "png" | "video" | "lottie" | "gif";
  downloadUrl: string;
  thumbnail: string;
  previewUrl: string;
  trending?: boolean;
  recommended?: boolean;
}

const INITIAL_ELEMENTS: KuvoxElement[] = [
  // Brushes
  {
    id: "brush_watercolor_blue",
    title: "Watercolor Blue",
    category: "Brushes",
    subcategory: "Watercolor",
    tags: ["blue", "watercolor", "paint", "brush", "artistic"],
    colors: ["blue"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><path d="M10,50 C40,20 60,80 100,50 C140,20 160,80 190,50" fill="none" stroke="%233498db" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity="0.65" filter="blur(1px)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><path d="M10,50 C40,20 60,80 100,50 C140,20 160,80 190,50" fill="none" stroke="%233498db" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity="0.65" filter="blur(1px)"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  {
    id: "brush_watercolor_pink",
    title: "Watercolor Splash",
    category: "Brushes",
    subcategory: "Watercolor",
    tags: ["pink", "splatter", "watercolor", "paint", "brush"],
    colors: ["pink", "red"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="25" fill="%23ff7675" opacity="0.7" filter="blur(2px)"/><circle cx="35" cy="45" r="10" fill="%23ff7675" opacity="0.6" filter="blur(1px)"/><circle cx="65" cy="60" r="12" fill="%23ff7675" opacity="0.5" filter="blur(1px)"/><circle cx="50" cy="25" r="6" fill="%23ff7675" opacity="0.8"/><circle cx="55" cy="75" r="5" fill="%23ff7675" opacity="0.7"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="25" fill="%23ff7675" opacity="0.7" filter="blur(2px)"/><circle cx="35" cy="45" r="10" fill="%23ff7675" opacity="0.6" filter="blur(1px)"/><circle cx="65" cy="60" r="12" fill="%23ff7675" opacity="0.5" filter="blur(1px)"/><circle cx="50" cy="25" r="6" fill="%23ff7675" opacity="0.8"/><circle cx="55" cy="75" r="5" fill="%23ff7675" opacity="0.7"/></svg>`,
    previewUrl: "",
    recommended: true,
  },
  {
    id: "brush_oil_gold",
    title: "Oil Paint Gold",
    category: "Brushes",
    subcategory: "Oil",
    tags: ["gold", "oil", "paint", "stroke", "texture"],
    colors: ["yellow", "orange"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M15,25 C70,75 130,5 185,55" fill="none" stroke="%23f1c40f" stroke-width="18" stroke-linecap="round" opacity="0.9"/><path d="M25,30 C75,70 125,15 175,50" fill="none" stroke="%23d4af37" stroke-width="8" stroke-linecap="round" opacity="0.95"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M15,25 C70,75 130,5 185,55" fill="none" stroke="%23f1c40f" stroke-width="18" stroke-linecap="round" opacity="0.9"/><path d="M25,30 C75,70 125,15 175,50" fill="none" stroke="%23d4af37" stroke-width="8" stroke-linecap="round" opacity="0.95"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  {
    id: "brush_ink_splat",
    title: "Zen Ink Splat",
    category: "Brushes",
    subcategory: "Ink",
    tags: ["black", "ink", "brush", "splat", "asian", "traditional"],
    colors: ["black"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M45,45 C35,25 15,35 25,50 C15,65 35,75 50,60 C65,75 75,55 60,45 C75,25 55,15 45,45 Z" fill="%23222222" opacity="0.95"/><circle cx="20" cy="25" r="4" fill="%23222222"/><circle cx="80" cy="70" r="5" fill="%23222222"/><circle cx="75" cy="30" r="3" fill="%23222222"/><circle cx="30" cy="80" r="4" fill="%23222222"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M45,45 C35,25 15,35 25,50 C15,65 35,75 50,60 C65,75 75,55 60,45 C75,25 55,15 45,45 Z" fill="%23222222" opacity="0.95"/><circle cx="20" cy="25" r="4" fill="%23222222"/><circle cx="80" cy="70" r="5" fill="%23222222"/><circle cx="75" cy="30" r="3" fill="%23222222"/><circle cx="30" cy="80" r="4" fill="%23222222"/></svg>`,
    previewUrl: "",
  },
  // Shapes
  {
    id: "shape_circle_neon",
    title: "Neon Circle",
    category: "Shapes",
    subcategory: "Geometric",
    tags: ["circle", "neon", "purple", "glow", "cyberpunk"],
    colors: ["purple"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="42" fill="none" stroke="%238a75ff" stroke-width="5" filter="drop-shadow(0 0 6px %238a75ff)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="42" fill="none" stroke="%238a75ff" stroke-width="5" filter="drop-shadow(0 0 6px %238a75ff)"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  {
    id: "shape_square_glass",
    title: "Glassmorphic Card",
    category: "Shapes",
    subcategory: "UI",
    tags: ["glass", "blur", "card", "white", "ui", "mockup"],
    colors: ["white"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><rect x="5" y="5" width="110" height="70" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/><rect x="15" y="15" width="30" height="30" rx="15" fill="rgba(255,255,255,0.15)"/><rect x="55" y="20" width="50" height="6" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="55" y="32" width="35" height="6" rx="3" fill="rgba(255,255,255,0.2)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><rect x="5" y="5" width="110" height="70" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/><rect x="15" y="15" width="30" height="30" rx="15" fill="rgba(255,255,255,0.15)"/><rect x="55" y="20" width="50" height="6" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="55" y="32" width="35" height="6" rx="3" fill="rgba(255,255,255,0.2)"/></svg>`,
    previewUrl: "",
    recommended: true,
  },
  {
    id: "shape_star_3d_gold",
    title: "Premium 3D Star",
    category: "Shapes",
    subcategory: "Star",
    tags: ["star", "3d", "gold", "yellow", "premium"],
    colors: ["yellow"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="url(%23goldGradient)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.2))"/><defs><linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ffeaa7"/><stop offset="50%" stop-color="%23d4af37"/><stop offset="100%" stop-color="%23aa7c11"/></linearGradient></defs></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="url(%23goldGradient)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.2))"/><defs><linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ffeaa7"/><stop offset="50%" stop-color="%23d4af37"/><stop offset="100%" stop-color="%23aa7c11"/></linearGradient></defs></svg>`,
    previewUrl: "",
    trending: true,
  },
  // Lines & Arrows
  {
    id: "line_neon_cyan",
    title: "Neon Laser Line",
    category: "Lines & Arrows",
    subcategory: "Laser",
    tags: ["line", "cyan", "neon", "glow", "horizontal"],
    colors: ["blue"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20" width="200" height="20"><line x1="10" y1="10" x2="190" y2="10" stroke="%238ADBE7" stroke-width="4" stroke-linecap="round" filter="drop-shadow(0 0 4px %238ADBE7)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20" width="200" height="20"><line x1="10" y1="10" x2="190" y2="10" stroke="%238ADBE7" stroke-width="4" stroke-linecap="round" filter="drop-shadow(0 0 4px %238ADBE7)"/></svg>`,
    previewUrl: "",
  },
  {
    id: "line_arrow_white",
    title: "Minimal Arrow",
    category: "Lines & Arrows",
    subcategory: "Minimalist",
    tags: ["arrow", "white", "minimal", "direction", "pointer"],
    colors: ["white"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,50 L90,50 M60,20 L90,50 L60,80" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,50 L90,50 M60,20 L90,50 L60,80" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    previewUrl: "",
  },
  // Nature
  {
    id: "nature_leaf_green",
    title: "Minimalist Leaf",
    category: "Nature",
    subcategory: "Leaves",
    tags: ["leaf", "green", "minimal", "plant", "organic"],
    colors: ["green"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 15 C20 40, 25 80, 50 90 C75 80, 80 40, 50 15 Z" fill="%232ecc71" opacity="0.8"/><line x1="50" y1="15" x2="50" y2="90" stroke="%2327ae60" stroke-width="2"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 15 C20 40, 25 80, 50 90 C75 80, 80 40, 50 15 Z" fill="%232ecc71" opacity="0.8"/><line x1="50" y1="15" x2="50" y2="90" stroke="%2327ae60" stroke-width="2"/></svg>`,
    previewUrl: "",
    recommended: true,
  },
  {
    id: "nature_palm_leaf",
    title: "Tropical Palm",
    category: "Nature",
    subcategory: "Palm",
    tags: ["palm", "leaf", "beach", "tropical", "travel", "green"],
    colors: ["green"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><path d="M60 110 C50 70, 20 40, 10 20 C30 35, 55 55, 60 70 C65 55, 90 35, 110 20 C100 40, 70 70, 60 110 Z" fill="%231abc9c" opacity="0.85"/><path d="M60 110 C55 80, 35 60, 25 35 C40 50, 55 65, 60 80 C65 65, 80 50, 95 35 C85 60, 65 80, 60 110 Z" fill="%2316a085" opacity="0.9"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><path d="M60 110 C50 70, 20 40, 10 20 C30 35, 55 55, 60 70 C65 55, 90 35, 110 20 C100 40, 70 70, 60 110 Z" fill="%231abc9c" opacity="0.85"/><path d="M60 110 C55 80, 35 60, 25 35 C40 50, 55 65, 60 80 C65 65, 80 50, 95 35 C85 60, 65 80, 60 110 Z" fill="%2316a085" opacity="0.9"/></svg>`,
    previewUrl: "",
    recommended: true,
  },
  {
    id: "nature_sun_warm",
    title: "Warm Golden Sun",
    category: "Nature",
    subcategory: "Sun",
    tags: ["sun", "gold", "yellow", "summer", "warm", "circle"],
    colors: ["yellow", "orange"],
    animated: false,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="30" fill="%23C9A962" opacity="0.8"/><circle cx="50" cy="50" r="42" fill="none" stroke="%23C9A962" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="30" fill="%23C9A962" opacity="0.8"/><circle cx="50" cy="50" r="42" fill="none" stroke="%23C9A962" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/></svg>`,
    previewUrl: "",
    recommended: true,
  },
  {
    id: "nature_wave_kanagawa",
    title: "Japanese Wave",
    category: "Nature",
    subcategory: "Sea",
    tags: ["wave", "ocean", "sea", "blue", "japanese", "traditional"],
    colors: ["blue"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100"><path d="M10,80 C30,85 45,70 55,60 C65,45 80,30 100,55 C110,65 115,80 110,90 L10,90 Z" fill="%232980b9" opacity="0.8"/><path d="M10,80 Q 30 60, 50 75 T 90 60 T 110 80 L110 90 L10,90 Z" fill="%233498db" opacity="0.9"/><path d="M50,75 C45,55 35,45 30,50" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100"><path d="M10,80 C30,85 45,70 55,60 C65,45 80,30 100,55 C110,65 115,80 110,90 L10,90 Z" fill="%232980b9" opacity="0.8"/><path d="M10,80 Q 30 60, 50 75 T 90 60 T 110 80 L110 90 L10,90 Z" fill="%233498db" opacity="0.9"/><path d="M50,75 C45,55 35,45 30,50" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  // Effects
  {
    id: "effect_light_leak",
    title: "Light Leak Glow",
    category: "Effects",
    subcategory: "Light Effects",
    tags: ["light", "leak", "glow", "orange", "bokeh", "vintage", "overlay"],
    colors: ["orange", "yellow"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100" width="150" height="100"><ellipse cx="20" cy="20" rx="60" ry="40" fill="%23C9A962" opacity="0.55" filter="blur(12px)"/><ellipse cx="130" cy="80" rx="50" ry="30" fill="%23ff7675" opacity="0.45" filter="blur(10px)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100" width="150" height="100"><ellipse cx="20" cy="20" rx="60" ry="40" fill="%23C9A962" opacity="0.55" filter="blur(12px)"/><ellipse cx="130" cy="80" rx="50" ry="30" fill="%23ff7675" opacity="0.45" filter="blur(10px)"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  {
    id: "effect_lens_flare",
    title: "Anamorphic Flare",
    category: "Effects",
    subcategory: "Light Effects",
    tags: ["lens", "flare", "cyan", "blue", "sci-fi", "cinematic", "overlay"],
    colors: ["blue"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><ellipse cx="100" cy="50" rx="90" ry="3.5" fill="%238ADBE7" opacity="0.8" filter="blur(1.5px)"/><circle cx="100" cy="50" r="12" fill="white" opacity="0.9" filter="blur(6px)"/><ellipse cx="100" cy="50" rx="40" ry="40" fill="none" stroke="%238ADBE7" stroke-width="1" opacity="0.3" filter="blur(2px)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><ellipse cx="100" cy="50" rx="90" ry="3.5" fill="%238ADBE7" opacity="0.8" filter="blur(1.5px)"/><circle cx="100" cy="50" r="12" fill="white" opacity="0.9" filter="blur(6px)"/><ellipse cx="100" cy="50" rx="40" ry="40" fill="none" stroke="%238ADBE7" stroke-width="1" opacity="0.3" filter="blur(2px)"/></svg>`,
    previewUrl: "",
  },
  // Stickers
  {
    id: "sticker_airplane",
    title: "Airplane Flight",
    category: "Stickers",
    subcategory: "Lottie",
    tags: ["airplane", "flight", "sticker", "travel", "animated", "white"],
    colors: ["white"],
    animated: true,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M15,80 C30,70 50,55 85,30 L80,25 L88,22 L83,32 Z" fill="none" stroke="white" stroke-width="3" stroke-dasharray="5 3"/><path d="M80,25 L65,35 L62,30 L80,25 Z" fill="white"/><path d="M72,30 L55,42 L53,38 L72,30 Z" fill="white"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M15,80 C30,70 50,55 85,30 L80,25 L88,22 L83,32 Z" fill="none" stroke="white" stroke-width="3" stroke-dasharray="5 3"/><path d="M80,25 L65,35 L62,30 L80,25 Z" fill="white"/><path d="M72,30 L55,42 L53,38 L72,30 Z" fill="white"/></svg>`,
    previewUrl: "",
    trending: true,
    recommended: true,
  },
  {
    id: "sticker_sparkles",
    title: "Glowing Sparkles",
    category: "Stickers",
    subcategory: "Lottie",
    tags: ["sparkles", "magic", "stars", "gold", "animated", "glow"],
    colors: ["yellow"],
    animated: true,
    premium: false,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M30,10 Q30,30 10,30 Q30,30 30,50 Q30,30 50,30 Q30,30 30,10 Z" fill="%23FFEAA7" filter="drop-shadow(0 0 4px %23FFEAA7)"/><path d="M75,50 Q75,65 60,65 Q75,65 75,80 Q75,65 90,65 Q75,65 75,50 Z" fill="%23ffeaa7" filter="drop-shadow(0 0 3px %23ffeaa7)"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M30,10 Q30,30 10,30 Q30,30 30,50 Q30,30 50,30 Q30,30 30,10 Z" fill="%23FFEAA7" filter="drop-shadow(0 0 4px %23FFEAA7)"/><path d="M75,50 Q75,65 60,65 Q75,65 75,80 Q75,65 90,65 Q75,65 75,50 Z" fill="%23ffeaa7" filter="drop-shadow(0 0 3px %23ffeaa7)"/></svg>`,
    previewUrl: "",
    trending: true,
  },
  // Mockups
  {
    id: "mockup_iphone15",
    title: "iPhone 15 Pro",
    category: "Mockups",
    subcategory: "Apple",
    tags: ["iphone", "mockup", "phone", "apple", "device", "mobile"],
    colors: ["black"],
    animated: false,
    premium: true,
    type: "svg",
    downloadUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180" width="100" height="180"><rect x="5" y="5" width="90" height="170" rx="15" fill="none" stroke="%23333333" stroke-width="5"/><rect x="35" y="12" width="30" height="6" rx="3" fill="%23000000"/><rect x="8" y="8" width="84" height="164" rx="12" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></svg>`,
    thumbnail: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180" width="100" height="180"><rect x="5" y="5" width="90" height="170" rx="15" fill="none" stroke="%23333333" stroke-width="5"/><rect x="35" y="12" width="30" height="6" rx="3" fill="%23000000"/><rect x="8" y="8" width="84" height="164" rx="12" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></svg>`,
    previewUrl: "",
    recommended: true,
  }
];

export function ElementsLibraryPanelContent({
  onClose,
  onAddMedia,
}: {
  onClose: () => void;
  onAddMedia: (media: MediaDto) => void;
}) {
  const dispatch = useAppDispatch();

  // Tabs: browse vs recommend
  const [activeTab, setActiveTab] = useState<"browse" | "recommend">("browse");

  // Search & Basic Categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quickCategory, setQuickCategory] = useState<"all" | "trending" | "favorites" | "recent">("all");

  // Format Filter Row
  const [formatFilter, setFormatFilter] = useState<"all" | "svg" | "png" | "animated" | "premium" | "free">("all");

  // Advanced Filters
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<{
    color: null | string;
    orientation: null | string;
    sortBy: "popularity" | "newest";
  }>({
    color: null,
    orientation: null,
    sortBy: "popularity",
  });

  // Favorites & Recents in LocalStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("kuvox_favorite_elements") || "[]");
      } catch (e) {}
    }
    return [];
  });

  const [recents, setRecents] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("kuvox_recent_elements") || "[]");
      } catch (e) {}
    }
    return [];
  });

  // AI Theme Context Selection
  const [aiContext, setAiContext] = useState<"travel" | "tech" | "gaming" | "corporate" | "cooking">("travel");
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoryNavLeft, setCanScrollCategoryNavLeft] = useState(false);
  const [canScrollCategoryNavRight, setCanScrollCategoryNavRight] = useState(false);

  const checkCategoryNavScroll = useCallback(() => {
    const el = categoryNavRef.current;
    if (!el) return;
    setCanScrollCategoryNavLeft(el.scrollLeft > 1);
    setCanScrollCategoryNavRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scrollCategoryNav = (direction: "left" | "right") => {
    const el = categoryNavRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -180 : 180,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const el = categoryNavRef.current;
    if (!el) return;
    checkCategoryNavScroll();
    el.addEventListener("scroll", checkCategoryNavScroll);
    window.addEventListener("resize", checkCategoryNavScroll);
    const raf = requestAnimationFrame(checkCategoryNavScroll);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", checkCategoryNavScroll);
      window.removeEventListener("resize", checkCategoryNavScroll);
    };
  }, [checkCategoryNavScroll]);

  // Helper to persist favorites
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(id)
      ? favorites.filter((fid) => fid !== id)
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem("kuvox_favorite_elements", JSON.stringify(updated));
    dispatch(toastShown(favorites.includes(id) ? "Removed from Favorites" : "Added to Favorites"));
  };

  // Helper to add element to project
  const handleAddElement = (element: KuvoxElement) => {
    // Register recent
    const updatedRecents = [element.id, ...recents.filter((rid) => rid !== element.id)].slice(0, 10);
    setRecents(updatedRecents);
    localStorage.setItem("kuvox_recent_elements", JSON.stringify(updatedRecents));

    // Construct MediaDto
    const mediaId = `el_${element.id}_${Date.now()}`;
    const elementMediaDto: MediaDto = {
      id: mediaId,
      ownerId: "elements-library",
      ownerKind: 1,
      ownerEmail: null,
      ownerDisplayName: null,
      kind: element.type === "video" ? MediaKind.Video : MediaKind.Image,
      filename: element.title,
      storageKey: element.downloadUrl,
      canonicalStorageKey: element.downloadUrl,
      proxyStorageKey: null,
      thumbnailStorageKey: element.thumbnail,
      errorMessage: null,
      durationSeconds: element.type === "video" ? "5.0" : null,
      width: 100,
      height: 100,
      codec: null,
      frameRate: null,
      sizeBytes: 1024,
      status: "ready",
      createdAt: new Date().toISOString(),
      isFavorite: false,
      pipeline: {
        stage: "ready",
        label: "Ready",
        detail: "Ready",
        step: 4,
        stepCount: 4,
        terminal: true,
      },
    };

    onAddMedia(elementMediaDto);
    dispatch(toastShown(`Added ${element.title} to timeline`));
  };

  // Drag start helper
  const handleDragStart = (event: React.DragEvent, element: KuvoxElement) => {
    const mediaId = `el_${element.id}_${Date.now()}`;
    const elementMediaDto: MediaDto = {
      id: mediaId,
      ownerId: "elements-library",
      ownerKind: 1,
      ownerEmail: null,
      ownerDisplayName: null,
      kind: element.type === "video" ? MediaKind.Video : MediaKind.Image,
      filename: element.title,
      storageKey: element.downloadUrl,
      canonicalStorageKey: element.downloadUrl,
      proxyStorageKey: null,
      thumbnailStorageKey: element.thumbnail,
      errorMessage: null,
      durationSeconds: element.type === "video" ? "5.0" : null,
      width: 100,
      height: 100,
      codec: null,
      frameRate: null,
      sizeBytes: 1024,
      status: "ready",
      createdAt: new Date().toISOString(),
      isFavorite: false,
      pipeline: {
        stage: "ready",
        label: "Ready",
        detail: "Ready",
        step: 4,
        stepCount: 4,
        terminal: true,
      },
    };

    dispatch(mediaAssetAddedToTimeline(elementMediaDto));
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-kuvox-media-id", mediaId);
    event.dataTransfer.setData("application/x-kuvox-media-kind", String(element.type === "video" ? MediaKind.Video : MediaKind.Image));
    event.dataTransfer.setData("text/plain", element.title);
    setActiveDraggedMedia({ id: mediaId, kind: element.type === "video" ? MediaKind.Video : MediaKind.Image });
  };

  const handleDragEnd = () => {
    setActiveDraggedMedia(null);
  };

  // Categories list
  const categories = ["All", "Brushes", "Shapes", "Lines & Arrows", "Nature", "Effects", "Stickers", "Mockups"];

  // Quick Chips logic
  const handleQuickChipClick = (chip: string) => {
    if (chip === "🔥 Trending") {
      setQuickCategory("trending");
      setSelectedCategory("All");
      setSearchQuery("");
    } else if (chip === "✨ New") {
      setQuickCategory("all");
      setSelectedCategory("All");
      setSearchQuery("");
      setAdvancedFilters((prev) => ({ ...prev, sortBy: "newest" }));
    } else if (chip === "🎨 Watercolor") {
      setSearchQuery("Watercolor");
      setSelectedCategory("All");
      setQuickCategory("all");
    } else if (chip === "🌿 Nature") {
      setSelectedCategory("Nature");
      setQuickCategory("all");
      setSearchQuery("");
    } else if (chip === "✨ Minimal") {
      setSearchQuery("minimal");
      setSelectedCategory("All");
      setQuickCategory("all");
    } else if (chip === "🎬 Overlays") {
      setSelectedCategory("Effects");
      setQuickCategory("all");
      setSearchQuery("");
    }
  };

  // Filter elements
  const filteredElements = useMemo(() => {
    return INITIAL_ELEMENTS.filter((el) => {
      // 1. Tab Recommend
      if (activeTab === "recommend") {
        if (aiContext === "travel") return ["sticker_airplane", "nature_palm_leaf", "nature_sun_warm", "nature_wave_kanagawa"].includes(el.id);
        if (aiContext === "tech") return ["mockup_iphone15", "shape_square_glass", "effect_lens_flare", "line_neon_cyan"].includes(el.id);
        if (aiContext === "gaming") return ["shape_circle_neon", "sticker_sparkles", "line_neon_cyan", "effect_light_leak"].includes(el.id);
        if (aiContext === "corporate") return ["line_arrow_white", "shape_square_glass", "brush_ink_splat"].includes(el.id);
        if (aiContext === "cooking") return ["nature_leaf_green", "nature_sun_warm", "brush_watercolor_pink"].includes(el.id);
        return el.recommended;
      }

      // 2. Quick Category
      if (quickCategory === "trending") {
        if (!el.trending) return false;
      } else if (quickCategory === "favorites") {
        if (!favorites.includes(el.id)) return false;
      } else if (quickCategory === "recent") {
        if (!recents.includes(el.id)) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          el.title.toLowerCase().includes(query) ||
          el.category.toLowerCase().includes(query) ||
          el.subcategory.toLowerCase().includes(query) ||
          el.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // 4. Category selection
      if (selectedCategory !== "All" && el.category !== selectedCategory) {
        return false;
      }

      // 5. Format Filter
      if (formatFilter === "svg" && el.type !== "svg") return false;
      if (formatFilter === "png" && el.type !== "png") return false;
      if (formatFilter === "animated" && !el.animated) return false;
      if (formatFilter === "premium" && !el.premium) return false;
      if (formatFilter === "free" && el.premium) return false;

      // 6. Advanced Filters
      if (advancedFilters.color && !el.colors.includes(advancedFilters.color)) return false;
      if (advancedFilters.orientation) {
        const isHorizontal = el.category === "Brushes" || el.category === "Lines & Arrows";
        const isVertical = el.category === "Mockups";
        const isSquare = el.category === "Shapes" || el.category === "Nature";
        if (advancedFilters.orientation === "horizontal" && !isHorizontal) return false;
        if (advancedFilters.orientation === "vertical" && !isVertical) return false;
        if (advancedFilters.orientation === "square" && !isSquare) return false;
      }

      return true;
    });
  }, [activeTab, aiContext, quickCategory, searchQuery, selectedCategory, formatFilter, advancedFilters, favorites, recents]);

  // Visual collections logic
  const isBrowsingCollections = activeTab === "browse" && !searchQuery && selectedCategory === "All" && quickCategory === "all" && formatFilter === "all" && !advancedFilters.color && !advancedFilters.orientation;

  // Group elements for collections view
  const collections = useMemo(() => {
    const map: Record<string, KuvoxElement[]> = {};
    INITIAL_ELEMENTS.forEach((el) => {
      if (!map[el.category]) map[el.category] = [];
      map[el.category].push(el);
    });
    return Object.entries(map).map(([name, items]) => ({ name, items }));
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-surface select-none">
      {/* HEADER SECTION WITH TABS */}
      <div className="flex h-13 shrink-0 flex-col px-4 border-b border-outline-variant/30 justify-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("browse")}
              className={`text-[11px] font-bold pb-1 cursor-pointer transition-colors relative ${
                activeTab === "browse" ? "text-on-surface after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setActiveTab("recommend")}
              className={`text-[11px] font-bold pb-1 cursor-pointer transition-colors relative flex items-center gap-1 ${
                activeTab === "recommend" ? "text-on-surface after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <EditorIcon className="text-[14px]">auto_awesome</EditorIcon>
              AI Recommend
            </button>
          </div>
          <EditorIconButton
            icon="close"
            label="Close Elements"
            className="h-[28px] w-[28px] shrink-0"
            onClick={onClose}
          />
        </div>
      </div>

      {activeTab === "browse" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* SEARCH & QUICK CHIPS PANEL */}
          <div className="flex min-h-0 max-h-[48%] shrink-0 flex-col gap-2.5 overflow-x-hidden overflow-y-auto overscroll-contain border-b border-outline-variant/20 bg-surface-container-lowest px-3.5 py-3 custom-scrollbar">
            {/* Search Input */}
            <div className="relative">
              <EditorIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">
                search
              </EditorIcon>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setQuickCategory("all");
                }}
                placeholder="Search 100,000+ elements..."
                className="h-8.5 w-full rounded-[6px] border border-outline-variant bg-surface-container-low pl-8.5 pr-8 text-[11px] font-medium text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer border-none outline-none bg-transparent"
                >
                  <EditorIcon className="text-[13px]">close</EditorIcon>
                </button>
              )}
            </div>

            {/* Quick Chips (Horizontal Scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {["🔥 Trending", "✨ New", "🎨 Watercolor", "🌿 Nature", "✨ Minimal", "🎬 Overlays"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleQuickChipClick(chip)}
                  className="h-6.5 shrink-0 rounded-full border border-outline-variant/50 bg-surface-container px-3 text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Filters Row */}
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {[
                  { value: "all", label: "All" },
                  { value: "svg", label: "SVG" },
                  { value: "png", label: "PNG" },
                  { value: "animated", label: "Motion" },
                  { value: "free", label: "Free" },
                  { value: "premium", label: "PRO" },
                ].map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setFormatFilter(fmt.value as any)}
                    className={`h-6 shrink-0 rounded-[4px] px-2 text-[10px] font-semibold cursor-pointer transition-all ${
                      formatFilter === fmt.value
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                className={`h-6 w-6 shrink-0 rounded-[4px] border flex items-center justify-center cursor-pointer transition-colors ${
                  advancedFiltersOpen || advancedFilters.color || advancedFilters.orientation
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
                title="Advanced filters"
              >
                <EditorIcon className="text-[14px]">filter_list</EditorIcon>
              </button>
            </div>

            {/* Advanced Filters Panel */}
            {advancedFiltersOpen && (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-[6px] border border-outline-variant/50 bg-surface-container-low text-[11px] font-medium text-on-surface-variant shadow-inner transition-all">
                {/* Colors filter */}
                <div className="flex flex-col gap-1">
                  <span>Filter by color:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setAdvancedFilters((prev) => ({ ...prev, color: null }))}
                      className={`h-4 px-1.5 rounded-full border text-[8px] font-semibold transition-all ${
                        !advancedFilters.color ? "border-primary text-primary" : "border-outline-variant"
                      }`}
                    >
                      Clear
                    </button>
                    {[
                      { name: "red", hex: "#ff7675" },
                      { name: "blue", hex: "#3498db" },
                      { name: "green", hex: "#2ecc71" },
                      { name: "yellow", hex: "#ffeaa7" },
                      { name: "orange", hex: "#e67e22" },
                      { name: "purple", hex: "#8a75ff" },
                      { name: "black", hex: "#222222" },
                      { name: "white", hex: "#ffffff" },
                    ].map((col) => (
                      <button
                        key={col.name}
                        onClick={() => setAdvancedFilters((prev) => ({ ...prev, color: col.name }))}
                        className={`h-4.5 w-4.5 rounded-full border border-black/20 shadow-sm relative shrink-0 transition-transform ${
                          advancedFilters.color === col.name ? "scale-120 ring-1 ring-primary ring-offset-1 ring-offset-surface-container-low" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Orientation & Sort */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-outline-variant/20">
                  <div className="flex flex-col gap-1">
                    <span>Orientation:</span>
                    <select
                      value={advancedFilters.orientation || ""}
                      onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, orientation: e.target.value || null }))}
                      className="h-6 w-full rounded-[4px] border border-outline-variant bg-surface-container text-[10px] text-on-surface px-1 focus:border-primary outline-none"
                    >
                      <option value="">All</option>
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span>Sort by:</span>
                    <select
                      value={advancedFilters.sortBy}
                      onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
                      className="h-6 w-full rounded-[4px] border border-outline-variant bg-surface-container text-[10px] text-on-surface px-1 focus:border-primary outline-none"
                    >
                      <option value="popularity">Popularity</option>
                      <option value="newest">Recently Added</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Level 1 Categories Navigation */}
            <div className="flex items-center gap-x-3 gap-y-1.5 text-[10.5px] font-bold text-on-surface-variant py-1 border-t border-outline-variant/15 mt-1.5 flex-wrap min-w-0">
              <button
                onClick={() => {
                  setQuickCategory("all");
                  setSelectedCategory("All");
                }}
                className={`cursor-pointer transition-colors flex items-center gap-1 ${
                  quickCategory === "all" && selectedCategory === "All" ? "text-primary" : "hover:text-on-surface"
                }`}
              >
                <EditorIcon className="text-[13px]">grid_view</EditorIcon>
                All
              </button>
              <button
                onClick={() => {
                  setQuickCategory("trending");
                  setSelectedCategory("All");
                }}
                className={`cursor-pointer transition-colors flex items-center gap-1 ${
                  quickCategory === "trending" ? "text-primary" : "hover:text-on-surface"
                }`}
              >
                <EditorIcon className="text-[13px]">trending_up</EditorIcon>
                Trending
              </button>
              <button
                onClick={() => {
                  setQuickCategory("favorites");
                  setSelectedCategory("All");
                }}
                className={`cursor-pointer transition-colors flex items-center gap-1 ${
                  quickCategory === "favorites" ? "text-primary" : "hover:text-on-surface"
                }`}
              >
                <EditorIcon className="text-[13px]">favorite</EditorIcon>
                Favs ({favorites.length})
              </button>
              <button
                onClick={() => {
                  setQuickCategory("recent");
                  setSelectedCategory("All");
                }}
                className={`cursor-pointer transition-colors flex items-center gap-1 ${
                  quickCategory === "recent" ? "text-primary" : "hover:text-on-surface"
                }`}
              >
                <EditorIcon className="text-[13px]">history</EditorIcon>
                Recent
              </button>
            </div>
          </div>

          {/* ASSET CATEGORIES HORIZONTAL NAVIGATION (Level 2) */}
          <div className="relative flex shrink-0 items-center border-b border-outline-variant/30 bg-surface">
            {canScrollCategoryNavLeft ? (
              <button
                type="button"
                onClick={() => scrollCategoryNav("left")}
                aria-label="Scroll element categories left"
                className="absolute left-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-r from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface"
              >
                <EditorIcon className="text-[14px]">chevron_left</EditorIcon>
              </button>
            ) : null}
            <div
              ref={categoryNavRef}
              className="flex flex-1 items-center overflow-x-auto scroll-smooth px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setQuickCategory("all");
                    }}
                    className={`relative flex h-10 shrink-0 items-center justify-center px-3 text-[10.5px] font-bold cursor-pointer transition-colors active:scale-95 ${
                      active ? "text-primary after:absolute after:bottom-0 after:inset-x-2 after:h-0.5 after:bg-primary" : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {canScrollCategoryNavRight ? (
              <button
                type="button"
                onClick={() => scrollCategoryNav("right")}
                aria-label="Scroll element categories right"
                className="absolute right-0 z-10 flex h-full w-8 items-center justify-center bg-gradient-to-l from-surface via-surface to-transparent text-on-surface-variant hover:text-on-surface"
              >
                <EditorIcon className="text-[14px]">chevron_right</EditorIcon>
              </button>
            ) : null}
          </div>

          {/* MAIN BROWSE SCROLLABLE CONTENT */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface-container-lowest p-4 custom-scrollbar">
            {isBrowsingCollections ? (
              // Pinterest/Canva visual collections view
              <div className="flex flex-col gap-5.5">
                {collections.map((col) => (
                  <div key={col.name} className="flex flex-col gap-2 border-b border-outline-variant/15 pb-4 last:border-none">
                    <div className="flex items-center justify-between">
                      <h3 className="text-body-sm font-bold text-on-surface">{col.name}</h3>
                      <button
                        onClick={() => setSelectedCategory(col.name)}
                        className="text-[9.5px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        See all
                        <EditorIcon className="text-[10px]">chevron_right</EditorIcon>
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 overflow-x-auto py-1 px-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {col.items.slice(0, 5).map((el) => (
                        <div key={el.id} className="w-24 shrink-0">
                          <ElementCard element={el} onAdd={handleAddElement} onFavorite={toggleFavorite} favorited={favorites.includes(el.id)} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Dynamic Grid view (Search Results / Filtered View)
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant/80 px-0.5 font-bold uppercase tracking-[0.02em]">
                  <span>
                    {selectedCategory !== "All" ? selectedCategory : "Search Results"} ({filteredElements.length})
                  </span>
                  {quickCategory !== "all" && (
                    <button
                      onClick={() => setQuickCategory("all")}
                      className="text-primary hover:underline cursor-pointer text-[9.5px]"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))] gap-2.5">
                  {filteredElements.map((el) => (
                    <ElementCard
                      key={el.id}
                      element={el}
                      onAdd={handleAddElement}
                      onFavorite={toggleFavorite}
                      favorited={favorites.includes(el.id)}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {filteredElements.length === 0 && (
                    <div className="col-span-full py-10 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant">
                      <EditorIcon className="text-3xl text-on-surface-variant/40">search_off</EditorIcon>
                      <div>
                        <p className="text-body-sm font-semibold text-on-surface">No elements found</p>
                        <p className="text-[10px] mt-0.5 text-on-surface-variant/70">Try adjusting your filters or query</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* AI RECOMMENDATION TAB */
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface-container-lowest p-3.5 flex flex-col gap-3 custom-scrollbar">
          {/* AI Info Card */}
          <div className="rounded-[8px] border border-primary/20 bg-primary/5 p-3.5 flex flex-col gap-2.5 shadow-sm min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/25 text-primary shrink-0">
                <EditorIcon className="text-[15px]">auto_awesome</EditorIcon>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">AI Creative Assistant</span>
                <span className="text-body-xs font-semibold text-on-surface block mt-0.5 truncate">Recommended for this project</span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-on-surface-variant">
              Based on your timeline metadata, we detected you are editing a professional creative project. Choose your video's theme below to get highly relevant, curated element sets:
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-outline-variant/15 justify-between min-w-0">
              <span className="text-[10.5px] font-bold text-on-surface shrink-0">Theme:</span>
              <select
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value as any)}
                className="h-7 min-w-[112px] max-w-full flex-1 rounded-[4px] border border-outline-variant bg-surface-container text-[11px] font-semibold text-on-surface px-1 focus:border-primary outline-none cursor-pointer truncate"
              >
                <option value="travel">✈️ Travel</option>
                <option value="tech">💻 Tech</option>
                <option value="gaming">🎮 Gaming</option>
                <option value="corporate">📈 Corporate</option>
                <option value="cooking">🍳 Cooking</option>
              </select>
            </div>
          </div>

          {/* AI Recommended Elements Grid */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-on-surface-variant/80 font-bold uppercase tracking-[0.05em] px-0.5">
              Curated Assets ({filteredElements.length})
            </span>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,5.5rem),1fr))] gap-2.5">
              {filteredElements.map((el) => (
                <ElementCard
                  key={el.id}
                  element={el}
                  onAdd={handleAddElement}
                  onFavorite={toggleFavorite}
                  favorited={favorites.includes(el.id)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Single Element Card Component
function ElementCard({
  element,
  onAdd,
  onFavorite,
  favorited,
  onDragStart,
  onDragEnd,
}: {
  element: KuvoxElement;
  onAdd: (element: KuvoxElement) => void;
  onFavorite: (id: string, e: React.MouseEvent) => void;
  favorited: boolean;
  onDragStart: (event: React.DragEvent, element: KuvoxElement) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      onClick={() => onAdd(element)}
      draggable
      onDragStart={(e) => onDragStart(e, element)}
      onDragEnd={onDragEnd}
      className="group relative aspect-square w-full min-w-0 overflow-hidden rounded-[8px] border border-outline-variant/40 bg-surface-container-low p-2.5 hover:border-primary/50 hover:bg-surface-container hover:shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center transition-all duration-200 motion-reduce:transition-none"
      title={`Drag or click to add ${element.title} to timeline`}
    >
      {/* SVG Image Preview */}
      <img src={element.thumbnail} alt={element.title} className="max-h-[70%] max-w-[70%] object-contain" />

      {/* Floating Badges */}
      {element.premium && (
        <span className="absolute top-1.5 right-1.5 flex h-4.5 items-center justify-center rounded-[3px] bg-[#d4af37]/15 border border-[#d4af37]/30 px-1 text-[8px] font-extrabold text-[#d4af37] tracking-wider uppercase">
          PRO
        </span>
      )}
      {element.animated && (
        <span className="absolute top-1.5 left-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
          <EditorIcon className="text-[10px]">play_arrow</EditorIcon>
        </span>
      )}

      {/* Hover Action Overlay */}
      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2 rounded-[7px] transition-all duration-200">
        <div className="flex justify-end">
          <button
            onClick={(e) => onFavorite(element.id, e)}
            className={`h-6 w-6 rounded-full flex items-center justify-center cursor-pointer border border-white/20 transition-transform hover:scale-115 active:scale-90 ${
              favorited ? "bg-red-500/90 text-white border-none" : "bg-black/40 text-white/80 hover:text-white"
            }`}
          >
            <EditorIcon className="text-[12px]">{favorited ? "favorite" : "favorite_border"}</EditorIcon>
          </button>
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[9px] text-white font-bold truncate leading-tight">{element.title}</span>
          <span className="text-[7.5px] text-white/70 truncate">{element.subcategory}</span>
        </div>
      </div>
    </div>
  );
}
