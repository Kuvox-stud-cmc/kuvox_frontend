import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Form } from "react-router";

import { ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { AlbumKind, MediaKind, type AlbumDto, type MediaDto } from "~/lib/api";
import { uploadMediaFile } from "~/lib/media-upload.client";

type PickerTab = "library" | "upload";
type KindFilter = "all" | "video" | "image" | "audio";
type SortMode = "newest" | "name" | "type";
type UploadStatus = "queued" | "uploading" | "uploaded" | "failed";

interface UploadItem {
  id: string;
  file: File;
  filename: string;
  kind: number | null;
  progress: number;
  status: UploadStatus;
  media?: MediaDto;
  error?: string;
}

interface AlbumAddItemsModalProps {
  open: boolean;
  album: AlbumDto;
  media: MediaDto[];
  isSubmitting: boolean;
  onClose: () => void;
}

const UPLOAD_CONCURRENCY = 3;

export function AlbumAddItemsModal({
  open,
  album,
  media,
  isSubmitting,
  onClose,
}: AlbumAddItemsModalProps) {
  const [tab, setTab] = useState<PickerTab>("library");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const uploadingCount = uploadItems.filter((item) => item.status === "uploading").length;
  const queuedCount = uploadItems.filter((item) => item.status === "queued" || item.status === "failed").length;
  const uploadedMedia = uploadItems
    .map((item) => item.media)
    .filter((item): item is MediaDto => Boolean(item));
  const allCandidates = useMemo(() => mergeMedia(media, uploadedMedia), [media, uploadedMedia]);
  const filteredMedia = useMemo(
    () => filterAndSortMedia(allCandidates, query, kindFilter, sort),
    [allCandidates, kindFilter, query, sort],
  );
  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && uploadingCount === 0 && !isSubmitting;
  const uploadAccept = acceptForAlbum(album.kind);
  const kindFilterOptions = kindFiltersForAlbum(album.kind);

  useEffect(() => {
    if (!open) {
      setTab("library");
      setQuery("");
      setKindFilter("all");
      setSort("newest");
      setSelectedIds(new Set());
      setUploadItems([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const toggleMedia = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFiles = (files: FileList | File[]) => {
    const parsed = Array.from(files)
      .map((file) => ({ file, kind: kindForFile(file, album.kind) }))
      .filter((item) => item.kind !== null);
    const invalidCount = Array.from(files).length - parsed.length;

    if (invalidCount > 0) {
      setError(`${invalidCount} file${invalidCount === 1 ? "" : "s"} could not be added to this album.`);
    } else {
      setError(null);
    }

    if (parsed.length === 0) return;

    const nextItems: UploadItem[] = parsed.map(({ file, kind }) => ({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      file,
      filename: file.name,
      kind,
      progress: 0,
      status: "queued",
    }));
    setUploadItems((current) => [...nextItems, ...current]);
    setTab("upload");
  };

  const uploadQueuedItems = async () => {
    const items = uploadItems
      .filter((item) => item.status === "queued" || item.status === "failed")
      .map((item) => ({ ...item, filename: normalizeUploadFilename(item.filename, item.file.name) }));
    if (items.length === 0) return;

    let index = 0;
    const workerCount = Math.min(UPLOAD_CONCURRENCY, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        if (!item || item.kind === null) continue;

        updateUploadItem(item.id, { status: "uploading", progress: 1, error: undefined });
        try {
          const uploaded = await uploadMediaFile({
            file: item.file,
            kind: item.kind,
            filename: item.filename,
            onProgress: (progress) => updateUploadItem(item.id, { progress }),
          });
          updateUploadItem(item.id, { status: "uploaded", progress: 100, media: uploaded });
          setSelectedIds((current) => new Set(current).add(uploaded.id));
        } catch (uploadError) {
          updateUploadItem(item.id, {
            status: "failed",
            progress: 0,
            error: uploadError instanceof Error ? uploadError.message : "Upload failed.",
          });
        }
      }
    });

    await Promise.all(workers);
  };

  const updateUploadItem = (id: string, patch: Partial<UploadItem>) => {
    setUploadItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const renameUploadItem = (id: string, filename: string) => {
    setUploadItems((current) =>
      current.map((item) => (item.id === id ? { ...item, filename } : item)),
    );
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files);
    }
  };

  return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={uploadingCount > 0 || isSubmitting ? undefined : onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[min(760px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-headline-sm font-bold text-on-surface">
              Add items to {album.name}
            </h2>
            <p className="mt-0.5 text-label-md text-on-surface-variant">
              {selectedCount} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploadingCount > 0 || isSubmitting}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-outline-variant px-4 py-3 sm:px-5">
          <TabButton active={tab === "library"} icon="perm_media" label="Library" onClick={() => setTab("library")} />
          <TabButton active={tab === "upload"} icon="upload" label="Upload" onClick={() => setTab("upload")} />
        </div>

        {error ? (
          <div className="px-4 sm:px-5">
            <ErrorBanner message={error} />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "library" ? (
            <div className="flex h-full flex-col">
              <div className="grid gap-3 border-b border-outline-variant px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:px-5">
                <label className="relative block">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
                    search
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search media"
                    className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-high py-2 pl-10 pr-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                  />
                </label>
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.currentTarget.value as KindFilter)}
                  className="h-10 rounded-lg border border-outline-variant bg-surface-container-high px-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                >
                  {kindFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.currentTarget.value as SortMode)}
                  className="h-10 rounded-lg border border-outline-variant bg-surface-container-high px-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                >
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {filteredMedia.length === 0 ? (
                  <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant text-center">
                    <span className="material-symbols-outlined text-[34px] text-on-surface-variant">
                      search_off
                    </span>
                    <p className="mt-2 text-body-md font-medium text-on-surface">No items found</p>
                    <p className="mt-1 text-body-sm text-on-surface-variant">Try Upload instead.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {filteredMedia.map((item, index) => (
                      <MediaPickerCard
                        key={item.id}
                        media={item}
                        index={index}
                        selected={selectedIds.has(item.id)}
                        onToggle={() => toggleMedia(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-y-auto px-4 py-4 sm:px-5">
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center transition hover:border-primary/50"
              >
                <span className="material-symbols-outlined text-[34px] text-primary">upload_file</span>
                <span className="mt-3 text-body-md font-medium text-on-surface">Select files</span>
                <span className="mt-1 text-label-md text-on-surface-variant">{uploadLabelForAlbum(album.kind)}</span>
                <input
                  type="file"
                  multiple
                  accept={uploadAccept}
                  className="sr-only"
                  onChange={(event) => {
                    if (event.currentTarget.files?.length) {
                      handleFiles(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }
                  }}
                />
              </label>

              {uploadItems.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                  <p className="text-label-md text-on-surface-variant">
                    {queuedCount} ready to upload / {uploadingCount} uploading
                  </p>
                  <button
                    type="button"
                    onClick={() => void uploadQueuedItems()}
                    disabled={queuedCount === 0 || uploadingCount > 0}
                    className={primaryButtonClass("px-3 py-1.5")}
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    Upload queued
                  </button>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {uploadItems.length === 0 ? (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-5 text-center text-body-sm text-on-surface-variant">
                    No uploads queued.
                  </div>
                ) : (
                  uploadItems.map((item) => (
                    <UploadRow
                      key={item.id}
                      item={item}
                      selected={item.media ? selectedIds.has(item.media.id) : false}
                      onRename={(filename) => renameUploadItem(item.id, filename)}
                      onToggle={() => item.media && toggleMedia(item.media.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Form method="post" className="border-t border-outline-variant bg-surface-container px-4 py-3 sm:px-5">
          <input type="hidden" name="intent" value="add-media" />
          <input type="hidden" name="albumId" value={album.id} />
          {Array.from(selectedIds).map((id) => (
            <input key={id} type="hidden" name="mediaIds" value={id} />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-label-md text-on-surface-variant">
              {uploadingCount > 0 ? `${uploadingCount} uploading` : `${selectedCount} selected`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploadingCount > 0 || isSubmitting}
                className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} className={primaryButtonClass()}>
                {isSubmitting ? "Adding..." : "Add selected"}
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-label-md font-medium transition ${
        active
          ? "bg-primary text-on-primary"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );
}

function MediaPickerCard({
  media,
  index,
  selected,
  onToggle,
}: {
  media: MediaDto;
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group overflow-hidden rounded-xl border text-left transition ${
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-outline-variant bg-surface-container-low hover:border-primary/50"
      }`}
      aria-pressed={selected}
    >
      <div className="relative aspect-video overflow-hidden border-b border-outline-variant">
        <MediaThumbnail media={media} index={index} icon={mediaKindIcon(media.kind)} />
        <span
          className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border ${
            selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-low text-on-surface-variant"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{selected ? "check" : "add"}</span>
        </span>
      </div>
      <div className="p-3">
        <h3 className="truncate text-body-sm font-bold text-on-surface" title={media.filename}>
          {media.filename}
        </h3>
        <p className="mt-1 text-label-sm text-on-surface-variant">{mediaKindLabel(media.kind)}</p>
      </div>
    </button>
  );
}

function UploadRow({
  item,
  selected,
  onRename,
  onToggle,
}: {
  item: UploadItem;
  selected: boolean;
  onRename: (filename: string) => void;
  onToggle: () => void;
}) {
  const complete = item.status === "uploaded" && item.media;
  const canRename = item.status === "queued" || item.status === "failed";
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">{item.kind === null ? "draft" : mediaKindIcon(item.kind)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            {canRename ? (
              <label className="min-w-0 flex-1">
                <span className="sr-only">Save as</span>
                <input
                  value={item.filename}
                  onChange={(event) => onRename(event.currentTarget.value)}
                  maxLength={512}
                  className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 text-body-sm font-medium text-on-surface outline-none transition focus:border-primary"
                />
              </label>
            ) : (
              <p className="truncate text-body-sm font-medium text-on-surface" title={item.media?.filename ?? item.filename}>
                {item.media?.filename ?? item.filename}
              </p>
            )}
            {complete ? (
              <button
                type="button"
                onClick={onToggle}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  selected ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                }`}
                aria-label={selected ? "Selected" : "Select upload"}
              >
                <span className="material-symbols-outlined text-[18px]">{selected ? "check" : "add"}</span>
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {item.status === "failed" ? item.error : `${uploadStatusLabel(item.status)} / ${item.file.name}`}
          </p>
          {item.status === "uploading" || item.status === "queued" ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function mergeMedia(base: MediaDto[], uploaded: MediaDto[]) {
  const seen = new Set<string>();
  const merged: MediaDto[] = [];
  for (const item of [...uploaded, ...base]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function filterAndSortMedia(media: MediaDto[], query: string, kindFilter: KindFilter, sort: SortMode) {
  const normalizedQuery = query.trim().toLowerCase();
  return media
    .filter((item) => {
      if (kindFilter !== "all" && item.kind !== mediaKindForFilter(kindFilter)) return false;
      return !normalizedQuery || item.filename.toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "type") return mediaKindLabel(a.kind).localeCompare(mediaKindLabel(b.kind)) || a.filename.localeCompare(b.filename);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function kindFiltersForAlbum(albumKind: number): Array<{ value: KindFilter; label: string }> {
  if (albumKind === AlbumKind.Mixed) {
    return [
      { value: "all", label: "All media" },
      { value: "video", label: "Videos" },
      { value: "image", label: "Images" },
      { value: "audio", label: "Audio" },
    ];
  }

  return [{ value: "all", label: albumKindLabel(albumKind) }];
}

function mediaKindForFilter(filter: KindFilter): number {
  if (filter === "image") return MediaKind.Image;
  if (filter === "audio") return MediaKind.Audio;
  return MediaKind.Video;
}

function kindForFile(file: File, albumKind: number): number | null {
  const detected = mediaKindForMime(file.type);
  if (albumKind === AlbumKind.Mixed) return detected;
  const required = requiredMediaKindForAlbum(albumKind);
  return detected === required ? required : null;
}

function mediaKindForMime(type: string): number | null {
  if (type.startsWith("video/")) return MediaKind.Video;
  if (type.startsWith("image/")) return MediaKind.Image;
  if (type.startsWith("audio/")) return MediaKind.Audio;
  return null;
}

function requiredMediaKindForAlbum(albumKind: number): number | null {
  if (albumKind === AlbumKind.Photo) return MediaKind.Image;
  if (albumKind === AlbumKind.Video) return MediaKind.Video;
  if (albumKind === AlbumKind.Audio) return MediaKind.Audio;
  return null;
}

function acceptForAlbum(albumKind: number): string {
  if (albumKind === AlbumKind.Photo) return "image/*";
  if (albumKind === AlbumKind.Video) return "video/*";
  if (albumKind === AlbumKind.Audio) return "audio/*";
  return "video/*,image/*,audio/*";
}

function uploadLabelForAlbum(albumKind: number): string {
  if (albumKind === AlbumKind.Photo) return "Images";
  if (albumKind === AlbumKind.Video) return "Videos";
  if (albumKind === AlbumKind.Audio) return "Audio";
  return "Videos, images, and audio";
}

function albumKindLabel(kind: number) {
  if (kind === AlbumKind.Photo) return "Images";
  if (kind === AlbumKind.Video) return "Videos";
  if (kind === AlbumKind.Audio) return "Audio";
  return "All media";
}

function mediaKindIcon(kind: number) {
  if (kind === MediaKind.Image) return "image";
  if (kind === MediaKind.Audio) return "graphic_eq";
  return "movie";
}

function mediaKindLabel(kind: number) {
  if (kind === MediaKind.Image) return "Image";
  if (kind === MediaKind.Audio) return "Audio";
  return "Video";
}

function uploadStatusLabel(status: UploadStatus): string {
  if (status === "queued") return "Queued";
  if (status === "uploading") return "Uploading";
  if (status === "uploaded") return "Uploaded";
  return "Failed";
}

function normalizeUploadFilename(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}
