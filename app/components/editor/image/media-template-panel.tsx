import { EditorIcon } from "../editor-ui";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { imageTemplateFixtures } from "./fixtures";
import type { MediaDto } from "~/lib/api";
import type { ImageEditorPanelTab } from "~/store/slices/image-editor-slice";
import type { DragEvent } from "react";

interface UploadQueueItem {
  id: string;
  fileName: string;
  progress: number;
  status: "queued" | "uploading" | "uploaded" | "failed";
  error: string | null;
  uploadedMedia: MediaDto | null;
}

interface MediaTemplatePanelProps {
  className?: string;
  activeTab: ImageEditorPanelTab;
  onTabChange: (tab: ImageEditorPanelTab) => void;
  imageMedia: MediaDto[];
  mediaError?: string | null;
  uploadQueue?: UploadQueueItem[];
  dragActive?: boolean;
  onDropFiles?: (event: DragEvent<HTMLElement>) => void;
  onDragStateChange?: (active: boolean) => void;
  onAddMedia: (media: MediaDto) => void;
}

export function MediaTemplatePanel({
  className = "",
  activeTab,
  onTabChange,
  imageMedia,
  mediaError,
  uploadQueue = [],
  dragActive = false,
  onDropFiles,
  onDragStateChange,
  onAddMedia,
}: MediaTemplatePanelProps) {
  return (
    <aside
      className={`min-h-0 border-r border-white/10 bg-[#15171b] ${className}`}
      onDrop={onDropFiles}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange?.(true);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragStateChange?.(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onDragStateChange?.(false);
      }}
    >
      <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
        <EditorIcon className="text-[18px] text-[#8fd6c8]">perm_media</EditorIcon>
        <h2 className="min-w-0 truncate text-label-md font-semibold uppercase tracking-wide text-white/70">
          Assets
        </h2>
      </div>

      <div className="flex border-b border-white/10 p-2">
        {(["templates", "media"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`h-8 flex-1 rounded-[4px] text-label-md font-semibold capitalize ${
              activeTab === tab
                ? "bg-white/12 text-white"
                : "text-white/50 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
        {activeTab === "templates" ? (
          <TemplateGrid />
        ) : (
          <MediaList
            imageMedia={imageMedia}
            mediaError={mediaError}
            uploadQueue={uploadQueue}
            dragActive={dragActive}
            onAddMedia={onAddMedia}
          />
        )}
      </div>
    </aside>
  );
}

function TemplateGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {imageTemplateFixtures.map((template) => (
        <button
          key={template.id}
          type="button"
          className="group flex min-h-28 flex-col justify-between rounded-[6px] border border-white/10 bg-white/[0.035] p-3 text-left transition-colors hover:border-[#8fd6c8]/60 hover:bg-white/[0.055]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-[#8fd6c8]/12 text-[#8fd6c8]">
            <EditorIcon className="text-[22px]">{template.icon}</EditorIcon>
          </span>
          <span>
            <span className="block text-label-md font-semibold text-white/85">{template.name}</span>
            <span className="mt-1 block text-label-sm text-white/40">{template.preset}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function MediaList({
  imageMedia,
  mediaError,
  uploadQueue,
  dragActive,
  onAddMedia,
}: {
  imageMedia: MediaDto[];
  mediaError?: string | null;
  uploadQueue: UploadQueueItem[];
  dragActive: boolean;
  onAddMedia: (media: MediaDto) => void;
}) {
  if (mediaError) {
    return (
      <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/10 px-3 py-4 text-label-md text-amber-100/80">
        {mediaError}
      </div>
    );
  }

  if (imageMedia.length === 0) {
    return (
      <div className="space-y-3">
        <MediaDropZone dragActive={dragActive} />
        <UploadQueueList uploadQueue={uploadQueue} />
        <div className="rounded-[6px] border border-dashed border-white/12 bg-black/15 px-3 py-6 text-center">
          <EditorIcon className="text-[24px] text-white/25">image</EditorIcon>
          <p className="mt-2 text-label-md font-semibold text-white/55">No images yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <MediaDropZone dragActive={dragActive} />
      <UploadQueueList uploadQueue={uploadQueue} />
      {imageMedia.map((asset, index) => (
        <button
          key={asset.id}
          type="button"
          onClick={() => onAddMedia(asset)}
          className="flex w-full items-center gap-3 rounded-[6px] border border-white/10 bg-white/[0.035] p-2 text-left transition-colors hover:border-[#8fd6c8]/60 hover:bg-white/[0.055]"
        >
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[5px] bg-[#253239]">
            <MediaThumbnail media={asset} index={index} icon="image" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-label-md font-semibold text-white/85">{asset.filename}</span>
            <span className="mt-1 block truncate text-label-sm text-white/40">{mediaDetail(asset)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function mediaDetail(media: MediaDto) {
  const width = Number(media.width);
  const height = Number(media.height);
  const dimensions =
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? `${width} x ${height}`
      : null;
  return [media.status, dimensions].filter(Boolean).join(" / ") || "Ready";
}

function MediaDropZone({ dragActive }: { dragActive: boolean }) {
  return (
    <div
      className={`rounded-[6px] border border-dashed px-3 py-3 text-center ${
        dragActive
          ? "border-[#8fd6c8]/70 bg-[#8fd6c8]/12 text-[#d8fff8]"
          : "border-white/12 bg-black/15 text-white/45"
      }`}
    >
      <EditorIcon className="text-[20px]">upload_file</EditorIcon>
      <p className="mt-1 truncate text-label-md font-semibold">Drop images</p>
    </div>
  );
}

function UploadQueueList({ uploadQueue }: { uploadQueue: UploadQueueItem[] }) {
  if (uploadQueue.length === 0) return null;

  return (
    <div className="space-y-2">
      {uploadQueue.slice(0, 6).map((item) => (
        <div
          key={item.id}
          className={`rounded-[6px] border px-2 py-2 ${
            item.status === "failed"
              ? "border-[#ff6b6b]/25 bg-[#ff6b6b]/10"
              : "border-white/10 bg-white/[0.035]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <EditorIcon
              className={`shrink-0 text-[16px] ${
                item.status === "failed" ? "text-[#ffb4b4]" : "text-[#8fd6c8]"
              }`}
            >
              {item.status === "uploaded"
                ? "check_circle"
                : item.status === "failed"
                  ? "error"
                  : "progress_activity"}
            </EditorIcon>
            <span className="min-w-0 flex-1 truncate text-label-md font-semibold text-white/80">
              {item.fileName}
            </span>
            <span className="shrink-0 text-label-sm uppercase text-white/35">
              {uploadStatusLabel(item)}
            </span>
          </div>
          {item.status === "failed" && item.error ? (
            <p className="mt-1 whitespace-normal break-words text-label-sm text-[#ffb4b4]">
              {item.error}
            </p>
          ) : (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#8fd6c8]"
                style={{ width: `${Math.max(2, Math.min(100, item.progress))}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function uploadStatusLabel(item: UploadQueueItem) {
  if (item.status === "queued") return "Queued";
  if (item.status === "uploading") return `${Math.round(item.progress)}%`;
  if (item.status === "uploaded") return "Added";
  return "Failed";
}
