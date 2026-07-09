import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { MediaKind, AlbumKind, PERSONAL, type MediaDto, type AlbumDto } from "~/lib/api";
import { ApiError, listMedia, setMediaFavorite, softDelete, albumsApi } from "~/lib/api.server";
import { useLiveMedia } from "~/lib/media-realtime";
import type { MediaPipeline } from "~/lib/media-pipeline";
import { useAudioMetadataDurations } from "~/lib/audio-metadata-duration";
import {
  AUDIO_CATEGORY_OPTIONS,
  isAudioCategoryKey,
  type AudioCategoryKey,
} from "~/lib/audio-categories";
import { formatMediaDuration, resolvePlayableMediaDuration } from "~/lib/media-duration";
import { createRequestLogger } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { ShareDialog } from "~/components/dashboard/shared/resource-dialogs";
import { resolveMediaObjectSource } from "~/components/dashboard/shared/MediaPreviewOverlay";

import {
  CardOverflowMenu,
  FormActions,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";

const AUDIO_PAGE_SIZE = 10;

function normalizeAudioAlbumName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function audioCategoryKeyForAlbum(name: string): AudioCategoryKey | null {
  const normalized = normalizeAudioAlbumName(name);
  if (normalized === "music") return "music";
  if (normalized === "soundeffects" || normalized === "soundeffect" || normalized === "sfx") return "sfx";
  if (normalized === "voiceover" || normalized === "voiceovers") return "voiceovers";
  return null;
}

function clampPage(value: string | null, pageCount: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, pageCount);
}

function paginationPages(currentPage: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }

  return result;
}

export function meta() {
  return [{ title: "Audio - Kuvox" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return {
      media: [] as MediaDto[],
      albums: [] as AlbumDto[],
      albumMedia: {} as Record<AudioCategoryKey, MediaDto[]>,
      albumMediaCounts: {} as Record<string, number>,
      error: "Your session expired. Please sign in again.",
    };
  }

  const reqLog = createRequestLogger(request).child({ component: "AudioLoader" });
  try {
    const page = await listMedia(accessToken, PERSONAL, reqLog);
    const audioMedia = page.items.filter(m => m.kind === MediaKind.Audio);
    
    const allAlbums = await albumsApi.listAlbums(accessToken, reqLog, { includeSystem: true });
    const allAudioAlbums = allAlbums.filter((album) => album.kind === AlbumKind.Audio);
    const audioAlbums = allAudioAlbums.filter(
      (album) => album.isDeleteAble === true && audioCategoryKeyForAlbum(album.name) === null,
    );
    const systemCategoryAlbums = allAudioAlbums.filter(
      (album) => album.isDeleteAble !== true && audioCategoryKeyForAlbum(album.name) !== null,
    );

    const albumMedia: Record<AudioCategoryKey, MediaDto[]> = {
      music: [],
      sfx: [],
      voiceovers: [],
    };
    const categoryEntries = await Promise.all(
      systemCategoryAlbums.map(async (album) => {
        const am = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog, { includeSystem: true });
        const items = am.items.filter((item) => item.kind === MediaKind.Audio);
        const category = audioCategoryKeyForAlbum(album.name);
        return { album, category, items };
      }),
    );
    const albumMediaEntries = await Promise.all(
      audioAlbums.map(async (album) => {
        const am = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
        return [album.id, am.items.filter((item) => item.kind === MediaKind.Audio).length] as const;
      }),
    );
    const albumMediaCounts: Record<string, number> = {};
    for (const [albumId, count] of albumMediaEntries) {
      albumMediaCounts[albumId] = count;
    }
    for (const entry of categoryEntries) {
      if (entry.category) {
        albumMedia[entry.category].push(...entry.items);
      }
    }

    return { media: audioMedia, albums: audioAlbums, albumMedia, albumMediaCounts, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your audio.";
    reqLog.error({ err: error }, "failed to load audio");
    return {
      media: [] as MediaDto[],
      albums: [] as AlbumDto[],
      albumMedia: {} as Record<AudioCategoryKey, MediaDto[]>,
      albumMediaCounts: {} as Record<string, number>,
      error: message,
    };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) return { error: "Not signed in" };

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const reqLog = createRequestLogger(request).child({ component: "AudioAction" });

  try {
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (id) {
        await setMediaFavorite(accessToken, id, isFavorite, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-album-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (id) {
        await albumsApi.setFavorite(accessToken, id, isFavorite, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "assign-audio-category") {
      const mediaId = String(formData.get("mediaId") ?? "");
      const category = String(formData.get("category") ?? "");

      if (!mediaId) {
        return { error: "Missing uploaded audio file." };
      }
      if (!isAudioCategoryKey(category)) {
        return { error: "Choose an audio type." };
      }

      await albumsApi.assignAudioCategory(accessToken, category, [mediaId], reqLog);
      return { ok: true, intent };
    }

    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? "album").trim();

      if (!name) {
        return { error: "Enter a name for the album." };
      }

      await albumsApi.createAlbum(accessToken, PERSONAL, {
        name,
        description,
        kind: AlbumKind.Audio,
        materialSymbol,
      }, reqLog);

      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    return { error: message };
  }
}

// Sub-components



const WAVEFORM_BARS = [
  40, 60, 30, 80, 50, 70, 40, 90, 55, 35, 45, 75, 65, 50, 40, 85, 60, 30, 70,
  95, 50, 40, 80, 60, 30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40, 80, 60,
  30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40,
];

const FORMAT_TONES: Record<string, string> = {
  WAV: "bg-primary/10 text-primary",
  MP3: "bg-secondary/10 text-secondary",
  M4A: "bg-tertiary/10 text-tertiary",
  FLAC: "bg-primary/10 text-primary",
};

type PendingAudioSeek = {
  ratio: number;
  time: number | null;
};

function FormatBadge({ format }: { format: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 font-mono text-label-sm font-bold ${FORMAT_TONES[format] ?? "bg-primary/10 text-primary"}`}
    >
      {format}
    </span>
  );
}

function MiniWaveform() {
  return (
    <div className="flex items-end gap-[2px] opacity-40 transition-opacity group-hover:opacity-100">
      {[100, 50, 75, 33].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm bg-primary"
          style={{ height: `${h}%`, maxHeight: 16 }}
        />
      ))}
    </div>
  );
}

function formatTrackDuration(value: MediaDto["durationSeconds"]): string {
  return formatMediaDuration(value);
}

function formatTrackSize(value: MediaDto["sizeBytes"]): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Pending";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clampAudioTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(value, 0), duration);
}

/** Waveform visualization for the Quick Preview player. */
function WaveformVisualizer({
  playheadPercent,
  currentTime,
  duration,
  isPlaying,
  disabled,
  onTogglePlayback,
  onSeekRatio,
  onSeekingChange,
}: {
  playheadPercent: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  disabled: boolean;
  onTogglePlayback: () => void;
  onSeekRatio: (ratio: number) => void;
  onSeekingChange?: (isSeeking: boolean) => void;
}) {
  const seekRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const seekFromClientX = (clientX: number) => {
    if (disabled) return;
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    onSeekRatio(ratio);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    onSeekingChange?.(true);
    seekFromClientX(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    seekFromClientX(event.clientX);
  };

  const finishPointerSeek = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    onSeekingChange?.(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onTogglePlayback();
      return;
    }

    if (duration <= 0) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSeekRatio(clampAudioTime(currentTime - 5, duration) / duration);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onSeekRatio(clampAudioTime(currentTime + 5, duration) / duration);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeekRatio(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSeekRatio(1);
    }
  };

  return (
    <div
      className={`relative my-5 overflow-hidden rounded-xl border border-primary/15 bg-surface-container-low px-5 py-5 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/70 ${disabled ? "opacity-70" : ""}`}
      tabIndex={disabled ? -1 : 0}
      role="group"
      aria-label="Waveform preview"
      onKeyDown={handleKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 bg-primary/5" />
      <div className="relative mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
          </div>
          <p className="text-label-md font-medium text-on-surface-variant">Waveform preview</p>
        </div>
        <span className="font-mono text-label-sm text-primary">
          {Math.round(playheadPercent)}%
        </span>
      </div>
      <div
        ref={seekRef}
        className={`relative flex h-28 items-end gap-[3px] ${disabled ? "cursor-not-allowed" : "cursor-pointer touch-none"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerSeek}
        onPointerCancel={finishPointerSeek}
        aria-disabled={disabled}
      >
        {WAVEFORM_BARS.map((h, i) => {
          const position = (i / WAVEFORM_BARS.length) * 100;
          const isPlayed = position < playheadPercent;
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors ${isPlayed ? "bg-primary" : "bg-primary/20"}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-[2px] -translate-x-1/2 bg-primary shadow-[0_0_12px_rgba(0,0,0,0.2)]"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -left-[3px] top-0 h-2 w-2 rounded-full bg-primary" />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePlayback();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
        >
          <span className="material-symbols-outlined text-[30px]">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>
      </div>
    </div>
  );
}

function AudioTable({
  tracks,
  pipelinesById,
  onPlay,
  currentPage,
  onPageChange,
  emptyMessage,
}: {
  tracks: MediaDto[];
  pipelinesById?: Record<string, MediaPipeline | null | undefined>;
  onPlay: (track: MediaDto) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  emptyMessage: string;
}) {
  const pageCount = Math.max(1, Math.ceil(tracks.length / AUDIO_PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), pageCount);
  const pageStartIndex = (safePage - 1) * AUDIO_PAGE_SIZE;
  const pagedTracks = tracks.slice(pageStartIndex, pageStartIndex + AUDIO_PAGE_SIZE);
  const rowDurations = useAudioMetadataDurations(
    pagedTracks.map((track) => ({
      id: track.id,
      metadataDuration: track.durationSeconds,
      src: resolveMediaObjectSource(track, ["canonical"])?.src,
    })),
  );
  const showingStart = tracks.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = Math.min(pageStartIndex + AUDIO_PAGE_SIZE, tracks.length);
  const pageItems = paginationPages(safePage, pageCount);

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container">
            <th className="px-4 py-3 text-label-md font-medium text-on-surface-variant">
              Name
            </th>
            <th className="px-4 py-3 text-label-md font-medium text-on-surface-variant">
              Type
            </th>
            <th className="px-4 py-3 text-center text-label-md font-medium text-on-surface-variant">
              Duration
            </th>
            <th className="px-4 py-3 text-center text-label-md font-medium text-on-surface-variant">
              Size
            </th>
            <th className="hidden px-4 py-3 text-label-md font-medium text-on-surface-variant lg:table-cell">
              Date Added
            </th>
            <th className="px-4 py-3 text-label-md font-medium text-on-surface-variant">
              Status
            </th>
            <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/50">
          {tracks.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                {emptyMessage}
              </td>
            </tr>
          ) : pagedTracks.map((track) => (
            <tr
              key={track.id}
              className="group transition-colors hover:bg-surface-container"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">
                      audio_file
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-on-surface">
                      {track.filename}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      Audio
                    </p>
                  </div>
                  <MiniWaveform />
                </div>
              </td>
              <td className="px-4 py-3">
                <FormatBadge format={track.codec ? track.codec.toUpperCase() : "MP3"} />
              </td>
              <td className="px-4 py-3 text-center font-mono text-on-surface-variant">
                {formatTrackDuration(rowDurations[track.id])}
              </td>
              <td className="px-4 py-3 text-center text-on-surface-variant">
                {formatTrackSize(track.sizeBytes)}
              </td>
              <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">
                {new Date(track.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <MediaPipelineStatus
                  media={track}
                  pipeline={pipelinesById?.[track.id]}
                  compact
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onPlay(track)}
                    className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                    aria-label={`Preview ${track.filename}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      play_circle
                    </span>
                  </button>
                  <IconToggleButton
                    id={track.id}
                    active={track.isFavorite}
                    intent="toggle-favorite"
                    activeIcon="favorite"
                    inactiveIcon="favorite_border"
                    activeClassName="text-error"
                    label={`${track.isFavorite ? "Remove from" : "Add to"} favorites`}
                  />
                  <ShareDialog resourceType="media" resourceId={track.id} resourceName={track.filename} />
                  <CardOverflowMenu id={track.id} itemLabel={track.filename} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
        <p className="text-label-sm text-on-surface-variant">
          Showing {showingStart} to {showingEnd} of {tracks.length} results
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <span className="material-symbols-outlined text-[18px]">
              chevron_left
            </span>
          </button>
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-label-sm text-on-surface-variant">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={
                  item === safePage
                    ? "flex h-7 w-7 items-center justify-center rounded bg-primary text-label-sm font-bold text-on-primary"
                    : "flex h-7 w-7 items-center justify-center rounded text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
                }
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => onPageChange(safePage + 1)}
            className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <span className="material-symbols-outlined text-[18px]">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component

export default function Audio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();

  const [sort, setSort] = useState<"latest" | "duration" | "size">("latest");
  const [importOpen, setImportOpen] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<PendingAudioSeek | null>(null);
  const [pendingSeek, setPendingSeek] = useState<PendingAudioSeek | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [pendingAutoplayTrackId, setPendingAutoplayTrackId] = useState<string | null>(null);
  const initialAudio = useMemo(() => loaderData?.media || [], [loaderData?.media]);
  const live = useLiveMedia(initialAudio, { kind: MediaKind.Audio });

  // Refs for section scroll targets
  const sectionAllRef = useRef<HTMLElement>(null);
  const sectionAlbumsRef = useRef<HTMLElement>(null);
  const sectionMusicRef = useRef<HTMLElement>(null);
  const sectionSfxRef = useRef<HTMLElement>(null);
  const sectionVoiceoversRef = useRef<HTMLElement>(null);

  // Scroll to the section matching the `?view` param
  useEffect(() => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      all: sectionAllRef,
      albums: sectionAlbumsRef,
      music: sectionMusicRef,
      sfx: sectionSfxRef,
      voiceovers: sectionVoiceoversRef,
    };
    const target = view ? refMap[view] : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create-album") {
      setAlbumModalOpen(false);
    }
  }, [actionData]);

  const allTracks = useMemo(() => {
    return [...live.media].sort((a, b) => {
      if (sort === "duration") return Number(b.durationSeconds || 0) - Number(a.durationSeconds || 0);
      if (sort === "size") return Number(b.sizeBytes) - Number(a.sizeBytes);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [live.media, sort]);
  const pipelinesById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(live.updatesById).map(([id, update]) => [id, update.pipeline ?? null]),
      ) as Record<string, MediaPipeline | null>,
    [live.updatesById],
  );
  const pageFor = (param: string, tracks: MediaDto[]) =>
    clampPage(searchParams.get(param), Math.max(1, Math.ceil(tracks.length / AUDIO_PAGE_SIZE)));

  const setAudioPage = (param: string, page: number, tracks: MediaDto[]) => {
    const pageCount = Math.max(1, Math.ceil(tracks.length / AUDIO_PAGE_SIZE));
    const targetPage = Math.min(Math.max(page, 1), pageCount);
    const next = new URLSearchParams(searchParams);
    if (targetPage === 1) {
      next.delete(param);
    } else {
      next.set(param, String(targetPage));
    }
    setSearchParams(next);
  };

  const musicTrackIds = useMemo(
    () => new Set((loaderData?.albumMedia?.music || []).map((track) => track.id)),
    [loaderData?.albumMedia?.music],
  );
  const sfxTrackIds = useMemo(
    () => new Set((loaderData?.albumMedia?.sfx || []).map((track) => track.id)),
    [loaderData?.albumMedia?.sfx],
  );
  const voiceoverTrackIds = useMemo(
    () => new Set((loaderData?.albumMedia?.voiceovers || []).map((track) => track.id)),
    [loaderData?.albumMedia?.voiceovers],
  );
  const musicTracks = allTracks.filter((track) => musicTrackIds.has(track.id));
  const sfxTracks = allTracks.filter((track) => sfxTrackIds.has(track.id));
  const voiceoverTracks = allTracks.filter((track) => voiceoverTrackIds.has(track.id));

  const totalDuration = allTracks.reduce((acc, curr) => acc + Number(curr.durationSeconds || 0), 0);
  const durationHours = (totalDuration / 3600).toFixed(1);
  const storageUsed = allTracks.reduce((acc, curr) => acc + Number(curr.sizeBytes), 0);
  const storageUsedGb = (storageUsed / (1024 * 1024 * 1024)).toFixed(2);
  const albumCount = loaderData?.albums?.length || 0;

  const handleUploadedAudio = async (
    media: MediaDto,
    context: { audioCategory?: string },
  ) => {
    live.mergeMedia(media);

    if (!context.audioCategory) {
      throw new Error("Choose an audio type.");
    }

    const formData = new FormData();
    formData.append("intent", "assign-audio-category");
    formData.append("mediaId", media.id);
    formData.append("category", context.audioCategory);

    const response = await fetch("", {
      method: "POST",
      body: formData,
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok || body?.error) {
      throw new Error(body?.error || "Couldn't assign the audio type.");
    }

    revalidator.revalidate();
  };
  
  const activeTrack = activeTrackId
    ? allTracks.find((track) => track.id === activeTrackId) ?? null
    : allTracks[0] ?? null;
  const activeAudioSource = useMemo(
    () => (activeTrack ? resolveMediaObjectSource(activeTrack, ["canonical"]) : null),
    [
      activeTrack?.id,
      activeTrack?.canonicalStorageKey,
    ],
  );
  const activeAudioDuration = resolvePlayableMediaDuration(activeTrack?.durationSeconds, audioDuration);
  const displayedAudioCurrentTime = pendingSeek?.time ?? audioCurrentTime;
  const audioProgress =
    pendingSeek
      ? pendingSeek.ratio * 100
      : activeAudioDuration > 0
        ? Math.min(100, (audioCurrentTime / activeAudioDuration) * 100)
        : 0;

  const setPendingSeekTarget = (target: PendingAudioSeek | null) => {
    pendingSeekRef.current = target;
    setPendingSeek(target);
  };

  const clearPendingSeek = () => {
    setPendingSeekTarget(null);
  };

  const pendingSeekTargetTime = (target: PendingAudioSeek, duration: number): number | null => {
    if (Number.isFinite(duration) && duration > 0) {
      return clampAudioTime(target.ratio * duration, duration);
    }

    return target.time;
  };

  const audioSeekDuration = (audio: HTMLAudioElement): number => {
    return Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : activeAudioDuration;
  };

  const isNearPendingSeek = (currentTime: number, target: PendingAudioSeek, duration: number): boolean => {
    const targetTime = pendingSeekTargetTime(target, duration);
    return targetTime != null && Math.abs(currentTime - targetTime) < 0.5;
  };

  const playActiveAudio = () => {
    const audio = audioRef.current;
    if (!audio || !activeAudioSource) return;

    if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        setIsPlaying(false);
        setPendingAutoplayTrackId(null);
      });
    }
  };

  const pauseActiveAudio = () => {
    audioRef.current?.pause();
    setPendingAutoplayTrackId(null);
  };

  const tryApplyPendingSeek = (audio: HTMLAudioElement) => {
    const target = pendingSeekRef.current;
    if (!target || audio.readyState === HTMLMediaElement.HAVE_NOTHING) return;

    const duration = audioSeekDuration(audio);
    const targetTime = pendingSeekTargetTime(target, duration);
    if (targetTime == null) return;

    try {
      if (typeof audio.fastSeek === "function") {
        audio.fastSeek(targetTime);
      } else {
        audio.currentTime = targetTime;
      }
      setAudioCurrentTime(targetTime);

      if (isNearPendingSeek(audio.currentTime, target, duration)) {
        clearPendingSeek();
      }
    } catch {
      setPendingSeekTarget({ ...target, time: targetTime });
    }
  };

  const seekToRatio = (ratio: number) => {
    const targetRatio = Math.min(Math.max(ratio, 0), 1);
    const targetTime = activeAudioDuration > 0 ? targetRatio * activeAudioDuration : null;
    const target = { ratio: targetRatio, time: targetTime };

    setPendingSeekTarget(target);
    if (targetTime != null) {
      setAudioCurrentTime(targetTime);
    }

    const audio = audioRef.current;
    if (audio) {
      tryApplyPendingSeek(audio);
    }
  };

  const seekBySeconds = (seconds: number) => {
    if (activeAudioDuration <= 0) return;
    const baseTime = pendingSeek?.time ?? audioCurrentTime;
    seekToRatio(clampAudioTime(baseTime + seconds, activeAudioDuration) / activeAudioDuration);
  };

  const toggleActivePlayback = () => {
    if (!activeAudioSource) return;
    if (isPlaying) {
      pauseActiveAudio();
    } else {
      playActiveAudio();
    }
  };

  const playTrack = (track: MediaDto) => {
    setActiveTrackId(track.id);
    if (resolveMediaObjectSource(track, ["canonical"])) {
      setPendingAutoplayTrackId(track.id);
    } else {
      setPendingAutoplayTrackId(null);
    }
  };

  useEffect(() => {
    if (allTracks.length === 0) {
      setActiveTrackId(null);
      setPendingAutoplayTrackId(null);
      clearPendingSeek();
      return;
    }

    if (!activeTrackId || !allTracks.some((track) => track.id === activeTrackId)) {
      setActiveTrackId(allTracks[0].id);
    }
  }, [activeTrackId, allTracks]);

  useEffect(() => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
    }
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setIsPlaying(false);
    setIsSeeking(false);
    clearPendingSeek();
    audio?.load();
  }, [activeTrack?.id, activeAudioSource?.src]);

  useEffect(() => {
    if (!pendingAutoplayTrackId || pendingAutoplayTrackId !== activeTrack?.id || !activeAudioSource) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
      audio.load();
    }

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => setPendingAutoplayTrackId(null))
        .catch(() => {
          setIsPlaying(false);
          setPendingAutoplayTrackId(null);
        });
    }
  }, [activeTrack?.id, activeAudioSource?.src, pendingAutoplayTrackId]);

  return (
    <section className="space-y-10">
      <PageHeader title="Audio" subtitle="Manage, preview and enhance your audio collection.">
        <SortDropdown
          value={sort}
          onChange={(v) => {
            setSort(v as typeof sort);
            const next = new URLSearchParams(searchParams);
            next.delete("page");
            next.delete("musicPage");
            next.delete("sfxPage");
            next.delete("voiceoversPage");
            setSearchParams(next);
          }}
          options={[
            { label: "Latest Added", value: "latest" },
            { label: "Duration", value: "duration" },
            { label: "Size", value: "size" },
          ]}
        />
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className={primaryButtonClass()}
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Import Audio
        </button>
      </PageHeader>

      {loaderData.error && <ErrorBanner message={loaderData.error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="music_note"
          label="Total Audio"
          value={allTracks.length.toLocaleString()}
        />
        <MetricCard
          icon="schedule"
          label="Total Duration"
          value={durationHours}
          suffix="h"
          tone="tertiary"
        />
        <MetricCard
          icon="cloud"
          label="Loaded Audio Storage"
          value={storageUsedGb}
          suffix="GB"
          detail="Current page summary"
        />
        <MetricCard
          icon="album"
          label="Albums"
          value={albumCount.toLocaleString()}
          tone="secondary"
          detail={`${musicTracks.length} music / ${sfxTracks.length} SFX / ${voiceoverTracks.length} voiceovers`}
        />
      </div>

      {/* Quick Preview (Featured Player) */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Quick Preview
          </h2>
          <Link
            to="/dashboard/audio?view=all"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </Link>
        </div>

        <div className="space-y-5">
          {/* Track info + waveform + controls */}
          <div className="flex flex-col">
            {activeTrack ? (
              <>
                {/* Track info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-headline-md font-bold text-on-surface">
                        {activeTrack.filename}
                      </h3>
                      <FormatBadge format={activeTrack.codec ? activeTrack.codec.toUpperCase() : "MP3"} />
                      <MediaPipelineStatus
                        media={activeTrack}
                        pipeline={pipelinesById[activeTrack.id]}
                        compact
                      />
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      Audio / {formatTrackDuration(activeAudioDuration)} /{" "}
                      {formatTrackSize(activeTrack.sizeBytes)}
                    </p>
                    <div className="mt-3 max-w-xl">
                      <MediaPipelineStatus
                        media={activeTrack}
                        pipeline={pipelinesById[activeTrack.id]}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShareDialog resourceType="media" resourceId={activeTrack.id} resourceName={activeTrack.filename} />
                    <CardOverflowMenu id={activeTrack.id} itemLabel={activeTrack.filename} />
                  </div>
                </div>

                {/* Waveform */}
                <WaveformVisualizer
                  playheadPercent={audioProgress}
                  currentTime={displayedAudioCurrentTime}
                  duration={activeAudioDuration}
                  isPlaying={isPlaying}
                  disabled={!activeAudioSource}
                  onTogglePlayback={toggleActivePlayback}
                  onSeekRatio={seekToRatio}
                  onSeekingChange={setIsSeeking}
                />

                {/* Time display */}
                <div className="mb-4 flex justify-between font-mono text-label-sm text-on-surface-variant">
                  <button
                    type="button"
                    disabled={!activeAudioSource || activeAudioDuration <= 0}
                    onClick={() => seekBySeconds(-10)}
                    className="rounded px-1 font-mono text-label-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    aria-label="Skip back 10 seconds"
                  >
                    {formatTrackDuration(displayedAudioCurrentTime)}
                  </button>
                  <button
                    type="button"
                    disabled={!activeAudioSource || activeAudioDuration <= 0}
                    onClick={() => seekBySeconds(10)}
                    className="rounded px-1 font-mono text-label-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    aria-label="Skip forward 10 seconds"
                  >
                    {formatTrackDuration(activeAudioDuration)}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-on-surface-variant">
                No audio tracks uploaded yet.
              </div>
            )}

            {activeTrack && activeAudioSource ? (
              <audio
                key={activeAudioSource.src}
                ref={audioRef}
                src={activeAudioSource.src}
                preload="metadata"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onTimeUpdate={(event) => {
                  const activePendingSeek = pendingSeekRef.current;
                  const audio = event.currentTarget;
                  const currentTime = event.currentTarget.currentTime;
                  if (activePendingSeek) {
                    if (isNearPendingSeek(currentTime, activePendingSeek, audioSeekDuration(audio))) {
                      clearPendingSeek();
                      setAudioCurrentTime(currentTime);
                    }
                    return;
                  }

                  if (!isSeeking) {
                    setAudioCurrentTime(currentTime);
                  }
                }}
                onLoadedMetadata={(event) => {
                  setAudioDuration(event.currentTarget.duration || 0);
                  tryApplyPendingSeek(event.currentTarget);
                }}
                onDurationChange={(event) => {
                  setAudioDuration(event.currentTarget.duration || 0);
                  tryApplyPendingSeek(event.currentTarget);
                }}
                onLoadedData={(event) => {
                  tryApplyPendingSeek(event.currentTarget);
                }}
                onProgress={(event) => {
                  tryApplyPendingSeek(event.currentTarget);
                }}
                onCanPlay={(event) => tryApplyPendingSeek(event.currentTarget)}
                onSeeked={(event) => {
                  const activePendingSeek = pendingSeekRef.current;
                  const audio = event.currentTarget;
                  if (activePendingSeek) {
                    if (isNearPendingSeek(audio.currentTime, activePendingSeek, audioSeekDuration(audio))) {
                      clearPendingSeek();
                      setAudioCurrentTime(audio.currentTime);
                    } else {
                      tryApplyPendingSeek(audio);
                    }
                    return;
                  }

                  setAudioCurrentTime(audio.currentTime);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={(event) => {
                  setIsPlaying(false);
                  clearPendingSeek();
                  setAudioCurrentTime(event.currentTarget.duration || 0);
                }}
                onError={() => {
                  setIsPlaying(false);
                  setPendingAutoplayTrackId(null);
                  clearPendingSeek();
                }}
              />
            ) : activeTrack ? (
              <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-body-sm text-on-surface-variant">
                This audio file is still processing or has no playable canonical object yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* All Audio (Table) */}
      <section
        id="section-all"
        ref={sectionAllRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="All Audio" count={`${allTracks.length} files`} />
        <AudioTable
          tracks={allTracks}
          pipelinesById={pipelinesById}
          onPlay={playTrack}
          currentPage={pageFor("page", allTracks)}
          onPageChange={(page) => setAudioPage("page", page, allTracks)}
          emptyMessage="No audio tracks available."
        />
      </section>

      <section
        id="section-albums"
        ref={sectionAlbumsRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader
          title="Albums"
          count={albumCount}
          actionTo="/dashboard/albums?view=audio"
        />
        <AlbumGrid
          albums={loaderData?.albums || []}
          counts={loaderData?.albumMediaCounts || {}}
          mediaLabel="track"
          icon="album"
          emptyTitle="No audio albums yet"
          emptyHint="Create an album to start organizing your audio tracks."
          columns="wide"
          onCreate={() => setAlbumModalOpen(true)}
          limit={5}
          getAlbumTo={(album) => `/dashboard/albums/${album.id}`}
        />
      </section>

      {/* Music Section */}
      <section
        id="section-music"
        ref={sectionMusicRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Music" count={musicTracks.length} />
        <AudioTable
          tracks={musicTracks}
          pipelinesById={pipelinesById}
          onPlay={playTrack}
          currentPage={pageFor("musicPage", musicTracks)}
          onPageChange={(page) => setAudioPage("musicPage", page, musicTracks)}
          emptyMessage="No music tracks available."
        />
      </section>

      {/* SFX Section */}
      <section
        id="section-sfx"
        ref={sectionSfxRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Sound Effects" count={sfxTracks.length} />
        <AudioTable
          tracks={sfxTracks}
          pipelinesById={pipelinesById}
          onPlay={playTrack}
          currentPage={pageFor("sfxPage", sfxTracks)}
          onPageChange={(page) => setAudioPage("sfxPage", page, sfxTracks)}
          emptyMessage="No sound effects available."
        />
      </section>

      {/* Voiceovers Section */}
      <section
        id="section-voiceovers"
        ref={sectionVoiceoversRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Voiceovers" count={voiceoverTracks.length} />
        <AudioTable
          tracks={voiceoverTracks}
          pipelinesById={pipelinesById}
          onPlay={playTrack}
          currentPage={pageFor("voiceoversPage", voiceoverTracks)}
          onPageChange={(page) => setAudioPage("voiceoversPage", page, voiceoverTracks)}
          emptyMessage="No voiceovers available."
        />
      </section>

      {/* Import Modal */}
      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import audio"
        fixedKind={MediaKind.Audio}
        audioCategoryOptions={AUDIO_CATEGORY_OPTIONS}
        onUploaded={handleUploadedAudio}
      />
      <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title="Create Audio Album">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create-album" />

          <TextField
            name="name"
            label="Album Name"
            placeholder="Podcast edits"
            required
          />

          <TextArea
            name="description"
            label="Description (Optional)"
            placeholder="Audio tracks and mixes for this collection"
            rows={3}
          />

          <IconPicker
            name="materialSymbol"
            label="Album Icon"
          />

          <FormActions
            onCancel={() => setAlbumModalOpen(false)}
            submitLabel={navigation.state === "submitting" ? "Creating..." : "Create Album"}
            isSubmitting={navigation.state === "submitting"}
          />
        </Form>
      </Modal>
    </section>
  );
}
