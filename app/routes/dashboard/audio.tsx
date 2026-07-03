import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useSearchParams, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { MediaKind, AlbumKind, PERSONAL, type MediaDto, type AlbumDto } from "~/lib/api";
import { ApiError, listMedia, softDelete, albumsApi } from "~/lib/api.server";
import { useLiveMedia } from "~/lib/media-realtime";
import type { MediaPipeline } from "~/lib/media-pipeline";
import { createRequestLogger } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { resolveMediaObjectSource } from "~/components/dashboard/shared/MediaPreviewOverlay";

import {
  CardOverflowMenu,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
} from "~/components/dashboard/section";

const AUDIO_PAGE_SIZE = 10;
type AudioCategoryKey = "music" | "sfx" | "voiceovers";

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
  return [{ title: "Audio · Kuvox" }];
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
    
    const allAlbums = await albumsApi.listAlbums(accessToken, reqLog);
    const audioAlbums = allAlbums.filter(a => a.kind === AlbumKind.Audio && a.isDeleteAble);

    const albumMedia: Record<AudioCategoryKey, MediaDto[]> = {
      music: [],
      sfx: [],
      voiceovers: [],
    };
    const albumEntries = await Promise.all(
      audioAlbums.map(async (album) => {
        const am = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
        const items = am.items.filter((item) => item.kind === MediaKind.Audio);
        const category = audioCategoryKeyForAlbum(album.name);
        return { album, category, items };
      }),
    );
    const albumMediaCounts: Record<string, number> = {};
    for (const entry of albumEntries) {
      albumMediaCounts[entry.album.id] = entry.items.length;
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
  const intent = formData.get("intent");
  const reqLog = createRequestLogger(request).child({ component: "AudioAction" });

  try {
    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    return { error: message };
  }
}

/* ── Sub-components ─────────────────────────────────────────────────────── */



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
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
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

function AudioCardGrid({
  tracks,
  emptyIcon,
  emptyTitle,
  emptyHint,
  albumIcon,
  pipelinesById,
  onPreview,
  onPlay,
}: {
  tracks: MediaDto[];
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
  albumIcon: string;
  pipelinesById?: Record<string, MediaPipeline | null | undefined>;
  onPreview: (track: MediaDto) => void;
  onPlay: (track: MediaDto) => void;
}) {
  if (tracks.length === 0) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tracks.map((track, i) => (
        <div
          key={track.id}
          onClick={() => onPreview(track)}
          className="bento-card group cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
        >
          {/* Cover placeholder */}
          <div className="relative aspect-[2/1]">
            <MediaThumbnail media={track} index={i} icon={albumIcon} />
            {/* Duration badge */}
            <span className="absolute bottom-2 right-2 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 font-mono text-label-sm font-bold text-on-surface backdrop-blur-md">
              {formatTrackDuration(track.durationSeconds)}
            </span>
            <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)]">
              <MediaPipelineStatus
                media={track}
                pipeline={pipelinesById?.[track.id]}
                compact
              />
            </div>
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-surface/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPlay(track);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg"
                aria-label={`Preview ${track.filename}`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  play_arrow
                </span>
              </button>
            </div>
          </div>
          {/* Info */}
          <div className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <h4 className="truncate text-body-sm font-bold text-on-surface">
                {track.filename}
              </h4>
              <CardOverflowMenu id={track.id} itemLabel={track.filename} />
            </div>
            <p className="mb-3 text-label-md text-on-surface-variant">
              {track.codec || "Audio"}
            </p>
            <div className="mb-3">
              <MediaPipelineStatus
                media={track}
                pipeline={pipelinesById?.[track.id]}
                showDetail={false}
              />
            </div>
            <div className="flex items-center justify-between">
              <FormatBadge format={track.codec ? track.codec.toUpperCase() : "MP3"} />
              <span className="text-label-sm text-on-surface-variant">
                {formatTrackSize(track.sizeBytes)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Audio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const loaderData = useLoaderData<typeof loader>();

  const [sort, setSort] = useState<"latest" | "duration" | "size">("latest");
  const [importOpen, setImportOpen] = useState(false);
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

  const allTracks = useMemo(() => {
    return [...live.media].sort((a, b) => {
      if (sort === "duration") return Number(b.durationSeconds || 0) - Number(a.durationSeconds || 0);
      if (sort === "size") return Number(b.sizeBytes) - Number(a.sizeBytes);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [live.media, sort]);
  const pageCount = Math.max(1, Math.ceil(allTracks.length / AUDIO_PAGE_SIZE));
  const currentPage = clampPage(searchParams.get("page"), pageCount);
  const pageStartIndex = (currentPage - 1) * AUDIO_PAGE_SIZE;
  const pagedTracks = allTracks.slice(pageStartIndex, pageStartIndex + AUDIO_PAGE_SIZE);
  const showingStart = allTracks.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = Math.min(pageStartIndex + AUDIO_PAGE_SIZE, allTracks.length);
  const pageItems = paginationPages(currentPage, pageCount);
  const latestTracksById = useMemo(
    () => new Map(allTracks.map((track) => [track.id, track])),
    [allTracks],
  );
  const pipelinesById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(live.updatesById).map(([id, update]) => [id, update.pipeline ?? null]),
      ) as Record<string, MediaPipeline | null>,
    [live.updatesById],
  );
  useEffect(() => {
    const pageParam = searchParams.get("page");
    if (pageParam && pageParam !== String(currentPage)) {
      const next = new URLSearchParams(searchParams);
      if (currentPage === 1) {
        next.delete("page");
      } else {
        next.set("page", String(currentPage));
      }
      setSearchParams(next, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams]);

  const setAudioPage = (page: number) => {
    const targetPage = Math.min(Math.max(page, 1), pageCount);
    const next = new URLSearchParams(searchParams);
    if (targetPage === 1) {
      next.delete("page");
    } else {
      next.set("page", String(targetPage));
    }
    setSearchParams(next);
  };

  const musicTracks = (loaderData?.albumMedia?.music || []).map(
    (track) => latestTracksById.get(track.id) ?? track,
  );
  const sfxTracks = (loaderData?.albumMedia?.sfx || []).map(
    (track) => latestTracksById.get(track.id) ?? track,
  );
  const voiceoverTracks = (loaderData?.albumMedia?.voiceovers || []).map(
    (track) => latestTracksById.get(track.id) ?? track,
  );

  const totalDuration = allTracks.reduce((acc, curr) => acc + Number(curr.durationSeconds || 0), 0);
  const durationHours = (totalDuration / 3600).toFixed(1);
  const storageUsed = allTracks.reduce((acc, curr) => acc + Number(curr.sizeBytes), 0);
  const storageUsedGb = (storageUsed / (1024 * 1024 * 1024)).toFixed(2);
  const albumCount = loaderData?.albums?.length || 0;
  
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
  const activeAudioDuration = audioDuration || Number(activeTrack?.durationSeconds || 0);
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

  const previewTrack = (track: MediaDto) => {
    setPendingAutoplayTrackId(null);
    clearPendingSeek();
    setActiveTrackId(track.id);
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
            setAudioPage(1);
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

      {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
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
          label="Storage Used"
          value={storageUsedGb}
          suffix="GB"
        />
        <MetricCard
          icon="album"
          label="Albums"
          value={albumCount.toLocaleString()}
          tone="secondary"
          detail={`${musicTracks.length} music / ${sfxTracks.length} SFX / ${voiceoverTracks.length} voiceovers`}
        />
      </div>

      {/* ── Quick Preview (Featured Player) ─────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Quick Preview
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View All
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
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
                      Audio / {formatTrackDuration(activeTrack.durationSeconds)} /{" "}
                      {formatTrackSize(activeTrack.sizeBytes)}
                    </p>
                    <div className="mt-3 max-w-xl">
                      <MediaPipelineStatus
                        media={activeTrack}
                        pipeline={pipelinesById[activeTrack.id]}
                      />
                    </div>
                  </div>
                  <CardOverflowMenu id={activeTrack.id} itemLabel={activeTrack.filename} />
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

      {/* ── All Audio (Table) ──────────────────────────────────────────────── */}
      <section
        id="section-all"
        ref={sectionAllRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="All Audio" count={`${allTracks.length} files`} />

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
              {allTracks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">
                    No audio tracks available.
                  </td>
                </tr>
              ) : pagedTracks.map((track) => (
                <tr
                  key={track.id}
                  className="group transition-colors hover:bg-surface-container"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      >
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
                    {formatTrackDuration(track.durationSeconds)}
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
                      pipeline={pipelinesById[track.id]}
                      compact
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                        aria-label={`Preview ${track.filename}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          play_circle
                        </span>
                      </button>
                      <CardOverflowMenu id={track.id} itemLabel={track.filename} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <p className="text-label-sm text-on-surface-variant">
              Showing {showingStart} to {showingEnd} of {allTracks.length} results
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setAudioPage(currentPage - 1)}
                className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
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
                    onClick={() => setAudioPage(item)}
                    className={
                      item === currentPage
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
                disabled={currentPage >= pageCount}
                onClick={() => setAudioPage(currentPage + 1)}
                className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="section-albums"
        ref={sectionAlbumsRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Albums" count={albumCount} />
        <AlbumGrid
          albums={loaderData?.albums || []}
          counts={loaderData?.albumMediaCounts || {}}
          mediaLabel="track"
          icon="album"
          emptyTitle="No audio albums yet"
          emptyHint="Create audio albums from the Albums page to organize tracks."
          columns="wide"
        />
      </section>

      {/* ── Music Section ──────────────────────────────────────────────────── */}
      <section
        id="section-music"
        ref={sectionMusicRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Music" count={musicTracks.length} actionOnClick={() => {}} />
        <AudioCardGrid
          tracks={musicTracks}
          emptyIcon="music_note"
          emptyTitle="No music tracks"
          emptyHint="Import music files to build your collection."
          albumIcon="music_note"
          pipelinesById={pipelinesById}
          onPreview={previewTrack}
          onPlay={playTrack}
        />
      </section>

      {/* ── SFX Section ────────────────────────────────────────────────────── */}
      <section
        id="section-sfx"
        ref={sectionSfxRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Sound Effects" count={sfxTracks.length} actionOnClick={() => {}} />
        <AudioCardGrid
          tracks={sfxTracks}
          emptyIcon="graphic_eq"
          emptyTitle="No sound effects"
          emptyHint="Add sound effects to your library."
          albumIcon="graphic_eq"
          pipelinesById={pipelinesById}
          onPreview={previewTrack}
          onPlay={playTrack}
        />
      </section>

      {/* ── Voiceovers Section ─────────────────────────────────────────────── */}
      <section
        id="section-voiceovers"
        ref={sectionVoiceoversRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <SectionHeader title="Voiceovers" count={voiceoverTracks.length} actionOnClick={() => {}} />
        <AudioCardGrid
          tracks={voiceoverTracks}
          emptyIcon="mic"
          emptyTitle="No voiceovers"
          emptyHint="Record or import voiceovers to get started."
          albumIcon="mic"
          pipelinesById={pipelinesById}
          onPreview={previewTrack}
          onPlay={playTrack}
        />
      </section>

      {/* ── Import Modal ───────────────────────────────────────────────────── */}
      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import audio"
        fixedKind={MediaKind.Audio}
        onUploaded={live.mergeMedia}
      />
    </section>
  );
}

