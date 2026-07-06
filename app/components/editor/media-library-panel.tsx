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

const readinessFilters: Array<{ value: MediaReadiness | "all"; label: string }> = [
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
];

interface MediaLibraryPanelProps {
  media: MediaDto[];
  updatesById?: Record<string, MediaRealtimeUpdate>;
  mediaLoadError?: string | null;
  usingCachedMedia?: boolean;
  onAddMedia: (media: MediaDto) => void;
}

export function MediaLibraryPanel({
  media,
  updatesById = {},
  mediaLoadError,
  usingCachedMedia = false,
  onAddMedia,
}: MediaLibraryPanelProps) {
  const dispatch = useAppDispatch();
  const [readinessFilter, setReadinessFilter] = useState<MediaReadiness | "all">("ready");
  const {
    activeTab,
    open: libraryOpen,
    width: libraryWidth,
    selectedMediaId,
    searchQuery,
  } = useAppSelector(selectLibraryPanelState);
  const visibleAssets = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...media]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .filter((asset) => mediaLibraryKind(asset) === activeTab)
      .filter((asset) => readinessFilter === "all" || mediaReadiness(asset) === readinessFilter)
      .filter((asset) => !normalizedSearch || asset.filename.toLowerCase().includes(normalizedSearch));
  }, [activeTab, media, readinessFilter, searchQuery]);
  const handleResizeStart = useDragResize({
    axis: "x",
    value: libraryWidth,
    min: 220,
    max: 360,
    onChange: (value) => dispatch(libraryWidthChanged(value)),
  });

  if (!libraryOpen) {
    return null;
  }

  function handleAddMedia(asset: MediaDto) {
    dispatch(assetSelected(asset.id));
    if (!isMediaReadyForTimeline(asset)) {
      dispatch(toastShown("Media is not ready for timeline placement"));
      return;
    }

    onAddMedia(asset);
  }

  return (
    <aside
      className="relative z-40 flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface"
      style={{ width: libraryWidth }}
    >
      <PanelHeader
        title="Library"
        eyebrow="Workspace Media"
        action={
          <div className="flex items-center gap-1">
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

      <div className="flex gap-1 border-b border-outline-variant bg-surface-container-lowest p-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => dispatch(libraryTabChanged(tab.value))}
              className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-[4px] px-2 text-label-md font-semibold transition-colors ${
                active
                  ? "border border-primary/35 bg-surface-container-high text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <EditorIcon className="text-[16px]">{tab.icon}</EditorIcon>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-b border-outline-variant bg-surface-container-lowest p-2">
        <label className="relative block">
          <EditorIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
            search
          </EditorIcon>
          <input
            value={searchQuery}
            onChange={(event) => dispatch(searchQueryChanged(event.currentTarget.value))}
            placeholder="Search filename"
            className="h-8 w-full rounded-[4px] border border-outline-variant bg-surface pl-8 pr-2 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-4 gap-1">
          {readinessFilters.map((filter) => {
            const active = readinessFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setReadinessFilter(filter.value)}
                className={`h-7 rounded-[4px] px-1 text-[10px] font-semibold uppercase text-on-surface-variant transition-colors ${
                  active
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {mediaLoadError ? (
        <div className="border-b border-outline-variant bg-error-container/40 px-3 py-2 text-label-md text-on-error-container">
          {usingCachedMedia ? "Showing cached media. " : null}Media refresh failed.
        </div>
      ) : null}

      <div className="grid flex-1 content-start grid-cols-2 gap-2 overflow-y-auto p-2 2xl:p-3">
        {visibleAssets.map((asset, index) => (
          <MediaCard
            key={asset.id}
            media={asset}
            index={index}
            selected={selectedMediaId === asset.id}
            update={updatesById[asset.id]}
            onAdd={() => handleAddMedia(asset)}
          />
        ))}
        {visibleAssets.length === 0 ? (
          <div className="col-span-2 rounded-[4px] border border-dashed border-outline-variant p-4 text-center text-body-sm text-on-surface-variant">
            No media matches the current filters.
          </div>
        ) : null}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Resize media library"
        onPointerDown={handleResizeStart}
        className="absolute right-[-3px] top-0 z-50 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40"
      />
    </aside>
  );
}

function MediaCard({
  media,
  index,
  selected,
  update,
  onAdd,
}: {
  media: MediaDto;
  index: number;
  selected: boolean;
  update?: MediaRealtimeUpdate;
  onAdd: () => void;
}) {
  const pipeline = resolveMediaPipeline(media, update?.pipeline);
  const ready = isMediaReadyForTimeline(media);

  return (
    <button
      type="button"
      draggable
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = ready ? "copy" : "none";
        event.dataTransfer.setData("application/x-kuvox-media-id", media.id);
        event.dataTransfer.setData("application/x-kuvox-media-kind", String(media.kind));
        event.dataTransfer.setData("text/plain", media.filename);
      }}
      className={`group relative overflow-hidden rounded-[4px] border bg-surface-container-low text-left transition-colors ${
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
