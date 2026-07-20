import { useEffect, useMemo, useState, type DragEvent } from "react";

import { ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaKind, type AlbumDto, type MediaDto, type ProjectMediaDto } from "~/lib/api";
import { attachProjectMediaFromBff } from "~/lib/editor/project-media-api.client";
import {
  loadPickerAlbumMedia,
  loadProjectMediaPickerData,
} from "~/lib/editor/project-media-picker.client";
import { uploadMediaFile } from "~/lib/media-upload.client";

type PickerTab = "media" | "albums" | "upload";
type KindFilter = "all" | "video" | "image" | "audio";
type SortMode = "newest" | "name" | "type";
type UploadRow = { id: string; name: string; status: "uploading" | "attached" | "failed"; error?: string };

const PAGE_SIZE = 24;

interface ProjectAddMediaModalProps {
  open: boolean;
  projectId: string;
  studioId?: string | null;
  attachedMediaIds: ReadonlySet<string>;
  onClose: () => void;
  onAttached: (rows: ProjectMediaDto[]) => void;
}

export function ProjectAddMediaModal({
  open,
  projectId,
  studioId,
  attachedMediaIds,
  onClose,
  onAttached,
}: ProjectAddMediaModalProps) {
  const [tab, setTab] = useState<PickerTab>("media");
  const [media, setMedia] = useState<MediaDto[]>([]);
  const [albums, setAlbums] = useState<AlbumDto[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<AlbumDto | null>(null);
  const [albumMedia, setAlbumMedia] = useState<MediaDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTab("media");
      setActiveAlbum(null);
      setAlbumMedia([]);
      setSelectedIds(new Set());
      setQuery("");
      setKindFilter("all");
      setSort("newest");
      setPage(1);
      setUploadRows([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadProjectMediaPickerData(studioId)
      .then((result) => {
        if (cancelled) return;
        setMedia(result.media);
        setAlbums(result.albums);
      })
      .catch((loadError) => {
        if (!cancelled) setError(messageFrom(loadError, "Media choices could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, studioId]);

  useEffect(() => setPage(1), [activeAlbum, kindFilter, query, sort, tab]);

  const selectableMedia = useMemo(
    () => media.filter((item) => !attachedMediaIds.has(item.id)),
    [attachedMediaIds, media],
  );
  const selectableAlbumMedia = useMemo(
    () => albumMedia.filter((item) => !attachedMediaIds.has(item.id)),
    [albumMedia, attachedMediaIds],
  );
  const filteredMedia = useMemo(
    () => filterAndSort(activeAlbum ? selectableAlbumMedia : selectableMedia, query, kindFilter, sort),
    [activeAlbum, kindFilter, query, selectableAlbumMedia, selectableMedia, sort],
  );
  const filteredAlbums = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return albums
      .filter((album) => !normalized || album.name.toLowerCase().includes(normalized))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [albums, query]);
  const mediaPageCount = Math.max(1, Math.ceil(filteredMedia.length / PAGE_SIZE));
  const albumPageCount = Math.max(1, Math.ceil(filteredAlbums.length / PAGE_SIZE));
  const pageCount = tab === "albums" && !activeAlbum ? albumPageCount : mediaPageCount;
  const visibleMedia = filteredMedia.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleAlbums = filteredAlbums.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!open) return null;

  const toggle = (mediaId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const openAlbum = async (album: AlbumDto) => {
    setLoading(true);
    setError(null);
    try {
      setAlbumMedia(await loadPickerAlbumMedia(album.id));
      setActiveAlbum(album);
      setQuery("");
    } catch (albumError) {
      setError(messageFrom(albumError, "Album media could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  const attachSelected = async () => {
    const mediaIds = Array.from(selectedIds).filter((id) => !attachedMediaIds.has(id));
    if (mediaIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const rows = await attachProjectMediaFromBff(projectId, mediaIds);
      onAttached(rows);
      setSelectedIds(new Set());
      onClose();
    } catch (attachError) {
      setError(messageFrom(attachError, "Media could not be attached to this project."));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const accepted = files.flatMap((file) => {
      const kind = mediaKindForFile(file);
      return kind === null ? [] : [{ file, kind, id: crypto.randomUUID() }];
    });
    if (accepted.length === 0) {
      setError("Choose video, image, or audio files.");
      return;
    }

    setError(null);
    setSubmitting(true);
    setUploadRows((current) => [
      ...accepted.map(({ file, id }) => ({ id, name: file.name, status: "uploading" as const })),
      ...current,
    ]);
    const results = await Promise.allSettled(accepted.map(({ file, kind }) => uploadMediaFile({
      file,
      kind,
      filename: file.name,
      studioId,
    })));
    const uploaded: Array<{ inputId: string; media: MediaDto }> = [];
    results.forEach((result, index) => {
      const input = accepted[index];
      if (!input) return;
      if (result.status === "fulfilled") uploaded.push({ inputId: input.id, media: result.value });
      else {
        setUploadRows((current) => current.map((row) => row.id === input.id
          ? { ...row, status: "failed", error: messageFrom(result.reason, "Upload failed.") }
          : row));
      }
    });

    if (uploaded.length > 0) {
      try {
        const rows = await attachProjectMediaFromBff(projectId, uploaded.map((item) => item.media.id));
        onAttached(rows);
        const uploadedInputIds = new Set(uploaded.map((item) => item.inputId));
        setUploadRows((current) => current.map((row) => uploadedInputIds.has(row.id)
          ? { ...row, status: "attached", error: undefined }
          : row));
      } catch (attachError) {
        setError(`Files were uploaded and remain in the media library, but could not be attached: ${messageFrom(attachError, "Attachment failed.")}`);
        const uploadedInputIds = new Set(uploaded.map((item) => item.inputId));
        setUploadRows((current) => current.map((row) => uploadedInputIds.has(row.id)
          ? { ...row, status: "failed", error: "Uploaded, but not attached. Retry from the Media tab." }
          : row));
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/55" onClick={submitting ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-label="Add media to project" className="relative z-10 flex h-[min(780px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-headline-sm font-bold text-on-surface">Add media to project</h2>
            <p className="text-label-md text-on-surface-variant">{selectedIds.size} selected</p>
          </div>
          <button type="button" aria-label="Close" disabled={submitting} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="flex gap-2 border-b border-outline-variant px-4 py-3 sm:px-5">
          <TabButton active={tab === "media"} icon="perm_media" label="Media" onClick={() => { setActiveAlbum(null); setTab("media"); }} />
          <TabButton active={tab === "albums"} icon="photo_album" label="Albums" onClick={() => setTab("albums")} />
          <TabButton active={tab === "upload"} icon="upload" label="Upload" onClick={() => setTab("upload")} />
        </div>

        {error ? <div className="px-4 pt-3 sm:px-5"><ErrorBanner message={error} /></div> : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "upload" ? (
            <UploadTab rows={uploadRows} submitting={submitting} onFiles={(files) => void uploadFiles(files)} />
          ) : (
            <div className="flex h-full flex-col">
              <div className="grid gap-3 border-b border-outline-variant px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:px-5">
                <label className="relative block">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
                  <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={tab === "albums" && !activeAlbum ? "Search albums" : "Search media"} className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-high py-2 pl-10 pr-3 text-body-sm text-on-surface outline-none focus:border-primary" />
                </label>
                {(tab === "media" || activeAlbum) ? (
                  <select value={kindFilter} onChange={(event) => setKindFilter(event.currentTarget.value as KindFilter)} className="h-10 rounded-lg border border-outline-variant bg-surface-container-high px-3 text-body-sm text-on-surface outline-none focus:border-primary">
                    <option value="all">All types</option><option value="video">Videos</option><option value="image">Images</option><option value="audio">Audio</option>
                  </select>
                ) : <span />}
                {(tab === "media" || activeAlbum) ? (
                  <select value={sort} onChange={(event) => setSort(event.currentTarget.value as SortMode)} className="h-10 rounded-lg border border-outline-variant bg-surface-container-high px-3 text-body-sm text-on-surface outline-none focus:border-primary">
                    <option value="newest">Newest</option><option value="name">Name</option><option value="type">Type</option>
                  </select>
                ) : <span />}
              </div>

              {activeAlbum ? (
                <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-2 sm:px-5">
                  <button type="button" onClick={() => { setActiveAlbum(null); setAlbumMedia([]); }} className="inline-flex items-center gap-1 text-label-md font-semibold text-primary"><span className="material-symbols-outlined text-[18px]">arrow_back</span>Albums</button>
                  <div className="min-w-0 text-right"><p className="truncate text-body-sm font-semibold text-on-surface">{activeAlbum.name}</p><button type="button" onClick={() => setSelectedIds((current) => new Set([...current, ...selectableAlbumMedia.map((item) => item.id)]))} className="text-label-md font-semibold text-primary">Select all available</button></div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {loading ? <Empty icon="progress_activity" title="Loading choices" body="Fetching media you can access." />
                  : tab === "albums" && !activeAlbum
                    ? visibleAlbums.length > 0
                      ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visibleAlbums.map((album) => <AlbumCard key={album.id} album={album} onOpen={() => void openAlbum(album)} />)}</div>
                      : <Empty icon="photo_album" title="No albums found" body="Try another search or use the Media tab." />
                    : visibleMedia.length > 0
                      ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{visibleMedia.map((item, index) => <MediaCard key={item.id} media={item} index={index} selected={selectedIds.has(item.id)} onToggle={() => toggle(item.id)} />)}</div>
                      : <Empty icon="perm_media" title="No media found" body="Everything may already be attached, or no filter matches." />}
              </div>

              {pageCount > 1 ? <Pagination page={page} pageCount={pageCount} onChange={setPage} /> : null}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-container px-4 py-3 sm:px-5">
          <p className="text-label-md text-on-surface-variant">{tab === "upload" ? "Uploads attach automatically" : `${selectedIds.size} selected`}</p>
          <div className="flex gap-2">
            <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant hover:text-on-surface disabled:opacity-50">Cancel</button>
            {tab !== "upload" ? <button type="button" disabled={selectedIds.size === 0 || submitting} onClick={() => void attachSelected()} className={primaryButtonClass()}>{submitting ? "Adding..." : "Add selected"}</button> : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-label-md font-medium ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}><span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>{label}</button>;
}

function MediaCard({ media, index, selected, onToggle }: { media: MediaDto; index: number; selected: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={selected} className={`group overflow-hidden rounded-xl border text-left transition ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-outline-variant bg-surface-container-low hover:border-primary/50"}`}><div className="relative aspect-video overflow-hidden border-b border-outline-variant"><MediaThumbnail media={media} index={index} icon={mediaIcon(media.kind)} /><span className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-low text-on-surface-variant"}`}><span className="material-symbols-outlined text-[18px]">{selected ? "check" : "add"}</span></span></div><div className="p-3"><h3 className="truncate text-body-sm font-bold text-on-surface" title={media.filename}>{media.filename}</h3><p className="mt-1 text-label-sm text-on-surface-variant">{media.status}</p></div></button>;
}

function AlbumCard({ album, onOpen }: { album: AlbumDto; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"><span className="material-symbols-outlined text-[30px] text-primary">{album.materialSymbol || "photo_album"}</span><h3 className="mt-3 truncate text-body-md font-bold text-on-surface">{album.name}</h3><p className="mt-1 text-label-md text-on-surface-variant">{album.mediaCount ?? 0} items</p></button>;
}

function UploadTab({ rows, submitting, onFiles }: { rows: UploadRow[]; submitting: boolean; onFiles: (files: File[]) => void }) {
  const onDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); onFiles(Array.from(event.dataTransfer.files)); };
  return <div className="h-full overflow-y-auto px-4 py-4 sm:px-5"><label onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center hover:border-primary/50"><span className="material-symbols-outlined text-[36px] text-primary">upload_file</span><span className="mt-3 text-body-md font-medium text-on-surface">Select or drop files</span><span className="mt-1 text-label-md text-on-surface-variant">Video, image, and audio files attach after upload.</span><input type="file" multiple accept="video/*,image/*,audio/*" disabled={submitting} className="sr-only" onChange={(event) => { if (event.currentTarget.files) onFiles(Array.from(event.currentTarget.files)); event.currentTarget.value = ""; }} /></label><div className="mt-4 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3"><span className="material-symbols-outlined text-[20px] text-on-surface-variant">{row.status === "attached" ? "check_circle" : row.status === "failed" ? "error" : "progress_activity"}</span><div className="min-w-0"><p className="truncate text-body-sm font-medium text-on-surface">{row.name}</p><p className="text-label-sm text-on-surface-variant">{row.error ?? (row.status === "attached" ? "Attached to project" : "Uploading and attaching")}</p></div></div>)}</div></div>;
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-center gap-3 border-t border-outline-variant px-4 py-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg px-3 py-1.5 text-label-md text-primary disabled:opacity-40">Previous</button><span className="text-label-md text-on-surface-variant">{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="rounded-lg px-3 py-1.5 text-label-md text-primary disabled:opacity-40">Next</button></div>;
}

function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant text-center"><span className="material-symbols-outlined text-[34px] text-on-surface-variant">{icon}</span><p className="mt-2 text-body-md font-medium text-on-surface">{title}</p><p className="mt-1 text-body-sm text-on-surface-variant">{body}</p></div>;
}

function filterAndSort(items: MediaDto[], query: string, kindFilter: KindFilter, sort: SortMode): MediaDto[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => (kindFilter === "all" || item.kind === kindForFilter(kindFilter)) && (!normalized || item.filename.toLowerCase().includes(normalized))).sort((left, right) => sort === "name" ? left.filename.localeCompare(right.filename) : sort === "type" ? left.kind - right.kind || left.filename.localeCompare(right.filename) : Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function kindForFilter(filter: Exclude<KindFilter, "all">): number {
  return filter === "video" ? MediaKind.Video : filter === "image" ? MediaKind.Image : MediaKind.Audio;
}

function mediaKindForFile(file: File): number | null {
  if (file.type.startsWith("video/")) return MediaKind.Video;
  if (file.type.startsWith("image/")) return MediaKind.Image;
  if (file.type.startsWith("audio/")) return MediaKind.Audio;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && ["mp4", "mov", "webm", "mkv"].includes(extension)) return MediaKind.Video;
  if (extension && ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) return MediaKind.Image;
  if (extension && ["mp3", "wav", "m4a", "aac", "ogg"].includes(extension)) return MediaKind.Audio;
  return null;
}

function mediaIcon(kind: number): string {
  return kind === MediaKind.Audio ? "audio_file" : kind === MediaKind.Image ? "image" : "video_file";
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
