import { useMemo } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  assetSelected,
  libraryOpenChanged,
  libraryTabChanged,
  libraryWidthChanged,
  modalOpened,
  type LibraryTab,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton, PanelHeader } from "./editor-ui";
import type { MediaAssetMock } from "./mock-editor-data";
import { useDragResize } from "./use-drag-resize";

interface MediaLibraryPanelProps {
  assets: MediaAssetMock[];
}

const tabs: Array<{ value: LibraryTab; label: string; icon: string }> = [
  { value: "clips", label: "Clips", icon: "video_file" },
  { value: "audio", label: "Audio", icon: "audio_file" },
  { value: "stills", label: "Stills", icon: "imagesmode" },
];

export function MediaLibraryPanel({ assets }: MediaLibraryPanelProps) {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.editor.activeLibraryTab);
  const libraryOpen = useAppSelector((state) => state.editor.libraryOpen);
  const libraryWidth = useAppSelector((state) => state.editor.libraryWidth);
  const selectedAssetId = useAppSelector((state) => state.editor.selectedAssetId);
  const searchQuery = useAppSelector((state) => state.editor.searchQuery);
  const visibleAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.type === activeTab &&
          asset.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [activeTab, assets, searchQuery],
  );
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

  return (
    <aside
      className="relative z-40 flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface"
      style={{ width: libraryWidth }}
    >
      <PanelHeader
        title="Library"
        eyebrow="Media Assets"
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

      <div className="grid flex-1 content-start grid-cols-2 gap-2 overflow-y-auto p-2 2xl:p-3">
        {visibleAssets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => dispatch(assetSelected(asset.id))}
            className={`group relative overflow-hidden rounded-[4px] border bg-surface-container-low text-left transition-colors ${
              selectedAssetId === asset.id
                ? "border-primary shadow-[0_0_0_1px_rgba(192,193,255,0.18)]"
                : "border-outline-variant hover:border-primary/60"
            }`}
          >
            <div className="relative aspect-video overflow-hidden border-b border-outline-variant/80 bg-surface-container-high">
              <div
                className="absolute inset-0 opacity-80 transition-opacity group-hover:opacity-95"
                style={{ background: asset.gradient }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.5),transparent_65%)]" />
              <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[4px] bg-black/35 text-white/80">
                <EditorIcon className="text-[16px]">{asset.icon}</EditorIcon>
              </div>
              <span className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white/85">
                {asset.duration}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <span className="block truncate text-[11px] font-medium text-on-surface">
                {asset.title}
              </span>
              <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.08em] text-on-surface-variant">
                {asset.type}
              </span>
            </div>
          </button>
        ))}
        {visibleAssets.length === 0 ? (
          <div className="col-span-2 rounded-[4px] border border-dashed border-outline-variant p-4 text-center text-body-sm text-on-surface-variant">
            No media matches the current search.
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
