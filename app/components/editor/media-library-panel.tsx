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
import { upsertEffectOperation, upsertTransitionOperation } from "~/lib/editor/video-operations";
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
      const effectType = normalizeEditorFeatureType(itemName);
      dispatch(videoOperationApplied(upsertEffectOperation({
        id: `effect-${effectType}-${targetItemIds.join("-")}`,
        type: effectType,
        targetItemIds,
        enabled: true,
        parameters: {},
      }, `Apply ${itemName}`)));
      dispatch(toastShown(`Effect applied: ${itemName}`));
    } else if (tab === "transitions") {
      const targetItemIds = transitionTargets(document, selectedItemIds);
      if (targetItemIds.length < 2) {
        dispatch(toastShown("Select two adjacent visual items before applying a transition"));
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
      dispatch(toastShown(`Transition selected: ${itemName}`));
    } else if (tab === "elements") {
      let svgUrl = "";
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
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" width="100" height="10"><line x1="5" y1="5" x2="95" y2="5" stroke="%23A29BFE" stroke-width="6" stroke-linecap="round"/></svg>`;
      } else if (itemName === "Arrow" || itemName === "Double Arrow") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,40 L70,40 L70,20 L95,50 L70,80 L70,60 L10,60 Z" fill="%2374B9FF"/></svg>`;
      } else if (itemName === "Speech Bubble") {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,20 L90,20 L90,70 L40,70 L20,90 L20,70 L10,70 Z" fill="%23FFEAA7"/><text x="40" y="50" fill="%23111827" font-size="16">💬</text></svg>`;
      } else {
        svgUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="10" y="10" width="80" height="80" rx="10" fill="%2374B9FF"/><text x="25" y="55" fill="white" font-size="12">${encodeURIComponent(itemName.substring(0, 8))}</text></svg>`;
      }

      const elementMediaDto: MediaDto = {
        id: `el_${itemName.toLowerCase().replace(/\s/g, "_")}_${Date.now()}`,
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
        width: null,
        height: null,
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
             {sections[activeSectionIdx].items.map(item => (
                <div
                  key={item}
                  onClick={() => handleItemClick(item)}
                  className="flex min-h-10 items-center justify-center rounded-[4px] bg-surface-container-low p-2 text-center text-[11px] font-medium text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors border border-outline-variant/50"
                >
                  {item}
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
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
      { title: "Favorites", items: ["Favorites", "Recent"] },
      { title: "Blur", items: ["Gaussian", "Box Blur", "Motion Blur"] },
      { title: "Stylize", items: ["Glow", "Bloom", "Sharpen", "Vignette", "Film Grain"] },
      { title: "Distortion", items: ["Wave", "Glitch", "RGB Split", "Lens"] },
      { title: "Lighting", items: ["Shadow", "Light Leak", "Lens Flare"] },
      { title: "AI Effects", items: ["Background Blur", "Portrait"] },
    ];
    case 'transitions': return [
      { title: "Basic", items: ["Cut", "Fade", "Cross Dissolve"] },
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
