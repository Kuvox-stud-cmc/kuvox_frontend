import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Form, Link, useFetcher, useNavigation, useSearchParams } from "react-router";

import {
  CardOverflowMenu,
  FormActions,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
  ViewToggle,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { AlbumGrid } from "~/components/dashboard/shared/AlbumGrid";
import { IconPicker } from "~/components/dashboard/shared/IconPicker";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { AccessDialog } from "~/components/dashboard/shared/resource-dialogs";
import { MediaPreviewOverlay, resolveMediaObjectSource } from "~/components/dashboard/shared/MediaPreviewOverlay";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaKind, type AlbumDto, type MediaDto } from "~/lib/api";
import { AUDIO_CATEGORY_OPTIONS } from "~/lib/audio-categories";
import { useAudioMetadataDurations } from "~/lib/audio-metadata-duration";
import { formatMediaDuration, resolvePlayableMediaDuration } from "~/lib/media-duration";
import { useLiveMedia } from "~/lib/media-realtime";
import { resolveMediaPipeline, type MediaPipeline } from "~/lib/media-pipeline";

type AudioCategoryKey = "music" | "sfx" | "voiceovers";
type SortMode = "latest" | "name" | "size";
type PendingAudioSeek = {
  ratio: number;
  time: number | null;
};

interface TeamMediaKindViewProps {
  media: MediaDto[];
  albums: AlbumDto[];
  albumMediaCounts: Record<string, number>;
  albumMedia?: Record<AudioCategoryKey, MediaDto[]>;
  error: string | null;
  actionData?: { ok?: boolean; intent?: string; error?: string };
  kind: number;
  title: string;
  subtitle: string;
  studioId: string;
  canWrite: boolean;
  canManageAccess: boolean;
}

const WAVEFORM_BARS = [
  40, 60, 30, 80, 50, 70, 40, 90, 55, 35, 45, 75, 65, 50, 40, 85, 60, 30, 70,
  95, 50, 40, 80, 60, 30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40, 80, 60,
  30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40,
];

export function TeamMediaKindView({
  media,
  albums,
  albumMediaCounts,
  albumMedia,
  error,
  actionData,
  kind,
  title,
  subtitle,
  studioId,
  canWrite,
  canManageAccess,
}: TeamMediaKindViewProps) {
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortMode>("latest");
  const [importOpen, setImportOpen] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const albumsRef = useRef<HTMLElement>(null);
  const live = useLiveMedia(media, { kind });
  const config = configForKind(kind);

  useEffect(() => {
    if (searchParams.get("view") === "albums") {
      albumsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create-album") setAlbumModalOpen(false);
  }, [actionData]);

  const items = useMemo(() => {
    return [...live.media].sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "size") return Number(b.sizeBytes) - Number(a.sizeBytes);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [live.media, sort]);
  const previewMedia = previewMediaId ? items.find((item) => item.id === previewMediaId) ?? null : null;
  const favoriteItems = items.filter((item) => item.isFavorite);
  const storageBytes = items.reduce((total, item) => total + Number(item.sizeBytes || 0), 0);
  const readyCount = items.filter((item) => resolveMediaPipeline(item).stage === "ready").length;
  const failedCount = items.filter((item) => resolveMediaPipeline(item).stage === "failed").length;
  const showAllRecent = searchParams.get("view") === "recent";
  const visibleItems = showAllRecent ? items : items.slice(0, 8);

  const handleUploaded = (uploaded: MediaDto, context: { audioCategory?: string }) => {
    live.mergeMedia(uploaded);
    if (kind === MediaKind.Audio && context.audioCategory) {
      fetcher.submit(
        { intent: "assign-audio-category", mediaId: uploaded.id, category: context.audioCategory },
        { method: "post" },
      );
    }
  };

  return (
    <section className="space-y-10">
      <PageHeader title={`Studio ${title}`} subtitle={subtitle}>
        {kind !== MediaKind.Audio ? <ViewToggle mode={view} onChange={setView} /> : null}
        <SortDropdown
          value={sort}
          onChange={(value) => setSort(value as SortMode)}
          options={[
            { label: "Latest Added", value: "latest" },
            { label: "Name", value: "name" },
            { label: "File Size", value: "size" },
          ]}
        />
        {canWrite ? (
          <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import {config.singular}
          </button>
        ) : null}
      </PageHeader>

      {error ? <ErrorBanner message={error} /> : null}
      {actionData?.error ? <ErrorBanner message={actionData.error} /> : null}

      {canWrite && kind === MediaKind.Video ? (
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-10 text-center transition-colors hover:border-primary/40 hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[42px] text-primary">upload_file</span>
          <span className="mt-3 text-headline-md font-bold text-on-surface">New Studio video</span>
          <span className="mt-1 text-body-sm text-on-surface-variant">Upload footage for this Studio workspace.</span>
        </button>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={config.icon} label={`Total ${config.plural}`} value={items.length} />
        <MetricCard icon="favorite" label="Favorites" value={favoriteItems.length} tone="tertiary" />
        <MetricCard icon="folder" label="Albums" value={albums.length} tone="secondary" />
        <MetricCard icon="check_circle" label="Ready" value={readyCount} tone="secondary" />
        <MetricCard
          icon={failedCount > 0 ? "error" : "cloud"}
          label={failedCount > 0 ? "Failed" : "Loaded Storage"}
          value={failedCount > 0 ? failedCount : formatSize(storageBytes)}
          detail="Current page summary"
          tone={failedCount > 0 ? "error" : "primary"}
        />
      </div>

      {kind === MediaKind.Audio ? (
        <AudioSections
          tracks={items}
          categoryMedia={albumMedia}
          pipelinesById={live.updatesById}
          canWrite={canWrite}
          canManageAccess={canManageAccess}
          studioId={studioId}
          autoplayTrackId={searchParams.get("play")}
        />
      ) : (
        <section>
          <SectionHeader title={`Recent ${config.plural}`} count={items.length} actionTo={`/teams/${studioId}/media/${config.path}?view=recent`} />
          {items.length === 0 ? (
            <EmptyState
              icon={config.icon}
              title={`No Studio ${config.plural.toLowerCase()} yet`}
              hint={`Import ${config.plural.toLowerCase()} to build this Studio library.`}
              action={
                canWrite ? (
                  <button type="button" onClick={() => setImportOpen(true)} className={primaryButtonClass()}>
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    Import {config.singular}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className={view === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" : "space-y-3"}>
              {visibleItems.map((item, index) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  index={index}
                  listView={view === "list"}
                  pipeline={live.updatesById[item.id]?.pipeline}
                  canWrite={canWrite}
                  canManageAccess={canManageAccess}
                  onPreview={() => setPreviewMediaId(item.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section ref={albumsRef} style={{ scrollMarginTop: "6rem" }}>
        <SectionHeader title="Albums" count={albums.length} actionTo={`/teams/${studioId}/media/albums?view=${config.albumView}`} />
        <AlbumGrid
          albums={albums}
          counts={albumMediaCounts}
          mediaLabel={config.singular.toLowerCase()}
          icon={config.albumIcon}
          emptyTitle={`No Studio ${config.singular.toLowerCase()} albums yet`}
          emptyHint={`Create an album to organize this Studio's ${config.plural.toLowerCase()}.`}
          columns="wide"
          onCreate={canWrite ? () => setAlbumModalOpen(true) : undefined}
          limit={5}
          getAlbumTo={(album) => `/teams/${studioId}/media/albums/${album.id}`}
          showFavoriteToggle={false}
          workspaceKind="studio"
          canManageAccess={canManageAccess}
        />
      </section>

      {kind === MediaKind.Image ? (
        <section>
          <SectionHeader title="Favorites" count={favoriteItems.length} />
          {favoriteItems.length === 0 ? (
            <EmptyState icon="favorite_border" title="No favorite Studio photos yet" hint="Mark photos as favorites to find them quickly." />
          ) : (
            <div className={view === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" : "space-y-3"}>
              {favoriteItems.map((item, index) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  index={index}
                  listView={view === "list"}
                  pipeline={live.updatesById[item.id]?.pipeline}
                  canWrite={canWrite}
                  canManageAccess={canManageAccess}
                  onPreview={() => setPreviewMediaId(item.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Import ${config.singular.toLowerCase()}`}
        fixedKind={kind}
        studioId={studioId}
        audioCategoryOptions={kind === MediaKind.Audio ? AUDIO_CATEGORY_OPTIONS : undefined}
        onUploaded={handleUploaded}
      />
      <MediaPreviewOverlay
        media={previewMedia && kind !== MediaKind.Audio ? previewMedia : null}
        pipeline={previewMedia ? live.updatesById[previewMedia.id]?.pipeline : null}
        onClose={() => setPreviewMediaId(null)}
      />
      {canWrite ? (
        <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title={`Create ${config.singular} Album`}>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-album" />
            <TextField name="name" label="Album name" placeholder={config.albumPlaceholder} required />
            <TextArea name="description" label="Description" placeholder="Collection notes for this Studio album" rows={3} />
            <IconPicker name="materialSymbol" label="Album icon" />
            <FormActions
              onCancel={() => setAlbumModalOpen(false)}
              submitLabel={navigation.state === "submitting" ? "Creating..." : "Create album"}
              isSubmitting={navigation.state === "submitting"}
            />
          </Form>
        </Modal>
      ) : null}
    </section>
  );
}

function MediaCard({
  media,
  index,
  listView,
  pipeline,
  canWrite,
  canManageAccess,
  onPreview,
}: {
  media: MediaDto;
  index: number;
  listView: boolean;
  pipeline?: MediaPipeline | null;
  canWrite: boolean;
  canManageAccess: boolean;
  onPreview: () => void;
}) {
  const config = configForKind(media.kind);
  const pipelineState = resolveMediaPipeline(media, pipeline);

  if (listView) {
    return (
      <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40">
        <button type="button" onClick={onPreview} className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-outline-variant" aria-label={`Preview ${media.filename}`}>
          <MediaThumbnail media={media} index={index} icon={config.icon} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-md font-bold text-on-surface" title={media.filename}>{media.filename}</h3>
          <p className="mt-1 text-label-md text-on-surface-variant">{mediaDetail(media)}</p>
          <div className="mt-2"><MediaPipelineStatus media={media} pipeline={pipeline} compact /></div>
        </div>
        <span className="hidden text-label-sm text-on-surface-variant sm:block">{formatDate(media.createdAt)}</span>
        <IconToggleButton id={media.id} active={media.isFavorite} intent="toggle-favorite" activeIcon="favorite" inactiveIcon="favorite_border" activeClassName="text-error" label={`${media.isFavorite ? "Remove from" : "Add to"} favorites`} />
        <AccessDialog resourceType="media" resourceId={media.id} resourceName={media.filename} canManageAccess={canManageAccess} />
        {canWrite ? <CardOverflowMenu id={media.id} itemLabel={media.filename} placement="top" /> : null}
      </div>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      <button type="button" onClick={onPreview} className={`relative block w-full overflow-hidden text-left ${media.kind === MediaKind.Image ? "aspect-[4/3]" : "aspect-video"}`} aria-label={`Preview ${media.filename}`}>
        <MediaThumbnail media={media} index={index} icon={config.icon} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
        <div className="absolute left-3 top-3"><MediaPipelineStatus media={media} pipeline={pipeline} compact /></div>
        {pipelineState.stage !== "ready" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/30 px-4 text-center">
            <span className="text-label-md font-bold text-on-surface">{pipelineState.label}</span>
          </div>
        ) : null}
      </button>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-body-sm font-bold text-on-surface" title={media.filename}>{media.filename}</h3>
          <div className="flex items-center gap-1">
            <AccessDialog resourceType="media" resourceId={media.id} resourceName={media.filename} canManageAccess={canManageAccess} />
            {canWrite ? <CardOverflowMenu id={media.id} itemLabel={media.filename} /> : null}
          </div>
        </div>
        <p className="mb-3 text-label-md text-on-surface-variant">{mediaDetail(media)}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-label-sm text-on-surface-variant">{formatDate(media.createdAt)}</span>
          <IconToggleButton id={media.id} active={media.isFavorite} intent="toggle-favorite" activeIcon="favorite" inactiveIcon="favorite_border" activeClassName="text-error" label={`${media.isFavorite ? "Remove from" : "Add to"} favorites`} />
        </div>
      </div>
    </article>
  );
}

function AudioSections({
  tracks,
  categoryMedia,
  pipelinesById,
  canWrite,
  canManageAccess,
  studioId,
  autoplayTrackId,
}: {
  tracks: MediaDto[];
  categoryMedia?: Record<AudioCategoryKey, MediaDto[]>;
  pipelinesById: Record<string, { pipeline?: MediaPipeline | null } | undefined>;
  canWrite: boolean;
  canManageAccess: boolean;
  studioId: string;
  autoplayTrackId?: string | null;
}) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<PendingAudioSeek | null>(null);
  const handledAutoplayTrackIdRef = useRef<string | null>(null);
  const [pendingSeek, setPendingSeek] = useState<PendingAudioSeek | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [pendingAutoplayTrackId, setPendingAutoplayTrackId] = useState<string | null>(null);
  const categories = [
    { key: "music" as const, title: "Music", items: categoryMedia?.music ?? [] },
    { key: "sfx" as const, title: "Sound Effects", items: categoryMedia?.sfx ?? [] },
    { key: "voiceovers" as const, title: "Voiceovers", items: categoryMedia?.voiceovers ?? [] },
  ];
  const pipelineFor = (track: MediaDto) => pipelinesById[track.id]?.pipeline ?? null;
  const activeTrack = activeTrackId
    ? tracks.find((track) => track.id === activeTrackId) ?? null
    : tracks[0] ?? null;
  const activeAudioSource = useMemo(
    () => (activeTrack ? resolveMediaObjectSource(activeTrack, ["canonical"]) : null),
    [activeTrack?.id, activeTrack?.canonicalStorageKey],
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
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeAudioDuration;
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
    if (!autoplayTrackId || handledAutoplayTrackIdRef.current === autoplayTrackId) return;
    const track = tracks.find((item) => item.id === autoplayTrackId);
    if (!track) return;

    handledAutoplayTrackIdRef.current = autoplayTrackId;
    playTrack(track);
  }, [autoplayTrackId, tracks]);

  useEffect(() => {
    if (tracks.length === 0) {
      setActiveTrackId(null);
      setPendingAutoplayTrackId(null);
      clearPendingSeek();
      return;
    }

    if (autoplayTrackId && tracks.some((track) => track.id === autoplayTrackId)) {
      return;
    }

    if (!activeTrackId || !tracks.some((track) => track.id === activeTrackId)) {
      setActiveTrackId(tracks[0].id);
    }
  }, [activeTrackId, autoplayTrackId, tracks]);

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
    <>
      <section
        id="quick-preview"
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6"
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">Quick Preview</h2>
          <Link to={`/teams/${studioId}/media/audio?view=all`} className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed">
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        <div className="space-y-5">
          <div className="flex flex-col">
            {activeTrack ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate text-headline-md font-bold text-on-surface" title={activeTrack.filename}>{activeTrack.filename}</h3>
                      <FormatBadge format={activeTrack.codec ? activeTrack.codec.toUpperCase() : "MP3"} />
                      <MediaPipelineStatus media={activeTrack} pipeline={pipelineFor(activeTrack)} compact />
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      Audio / {formatDuration(activeAudioDuration)} / {formatSize(Number(activeTrack.sizeBytes || 0))}
                    </p>
                    <div className="mt-3 max-w-xl">
                      <MediaPipelineStatus media={activeTrack} pipeline={pipelineFor(activeTrack)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <AccessDialog resourceType="media" resourceId={activeTrack.id} resourceName={activeTrack.filename} canManageAccess={canManageAccess} />
                    {canWrite ? <CardOverflowMenu id={activeTrack.id} itemLabel={activeTrack.filename} /> : null}
                  </div>
                </div>
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
                <div className="mb-4 flex justify-between font-mono text-label-sm text-on-surface-variant">
                  <button
                    type="button"
                    disabled={!activeAudioSource || activeAudioDuration <= 0}
                    onClick={() => seekBySeconds(-10)}
                    className="rounded px-1 font-mono text-label-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    aria-label="Skip back 10 seconds"
                  >
                    {formatDuration(displayedAudioCurrentTime)}
                  </button>
                  <button
                    type="button"
                    disabled={!activeAudioSource || activeAudioDuration <= 0}
                    onClick={() => seekBySeconds(10)}
                    className="rounded px-1 font-mono text-label-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                    aria-label="Skip forward 10 seconds"
                  >
                    {formatDuration(activeAudioDuration)}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-on-surface-variant">No audio tracks uploaded yet.</div>
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
      <section>
        <SectionHeader title="All Audio" count={tracks.length} />
        <AudioTable tracks={tracks} pipelinesById={pipelinesById} canWrite={canWrite} canManageAccess={canManageAccess} emptyMessage="No Studio audio tracks yet." onPlay={playTrack} />
      </section>
      {categories.map((category) => (
        <section key={category.key}>
          <SectionHeader title={category.title} count={category.items.length} />
          <AudioTable tracks={category.items} pipelinesById={pipelinesById} canWrite={canWrite} canManageAccess={canManageAccess} emptyMessage={`No ${category.title.toLowerCase()} tracks assigned yet.`} onPlay={playTrack} />
        </section>
      ))}
    </>
  );
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-label-sm font-bold text-primary">
      {format}
    </span>
  );
}

function clampAudioTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(value, 0), duration);
}

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
        <span className="font-mono text-label-sm text-primary">{Math.round(playheadPercent)}%</span>
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
            <div key={i} className={`flex-1 rounded-sm transition-colors ${isPlayed ? "bg-primary" : "bg-primary/20"}`} style={{ height: `${h}%` }} />
          );
        })}
        <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-[2px] -translate-x-1/2 bg-primary shadow-[0_0_12px_rgba(0,0,0,0.2)]" style={{ left: `${playheadPercent}%` }}>
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
          <span className="material-symbols-outlined text-[30px]">{isPlaying ? "pause" : "play_arrow"}</span>
        </button>
      </div>
    </div>
  );
}

function AudioTable({
  tracks,
  pipelinesById,
  canWrite,
  canManageAccess,
  emptyMessage,
  onPlay,
}: {
  tracks: MediaDto[];
  pipelinesById: Record<string, { pipeline?: MediaPipeline | null } | undefined>;
  canWrite: boolean;
  canManageAccess: boolean;
  emptyMessage: string;
  onPlay: (track: MediaDto) => void;
}) {
  const rowDurations = useAudioMetadataDurations(
    tracks.map((track) => ({
      id: track.id,
      metadataDuration: track.durationSeconds,
      src: resolveMediaObjectSource(track, ["canonical"])?.src,
    })),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
      <table className="w-full text-left text-body-sm">
        <thead className="bg-surface-container">
          <tr>
            <th className="px-4 py-3 text-label-md font-medium text-on-surface-variant">Name</th>
            <th className="hidden px-4 py-3 text-label-md font-medium text-on-surface-variant md:table-cell">Duration</th>
            <th className="hidden px-4 py-3 text-label-md font-medium text-on-surface-variant lg:table-cell">Size</th>
            <th className="px-4 py-3 text-label-md font-medium text-on-surface-variant">Status</th>
            <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/50">
          {tracks.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">{emptyMessage}</td></tr>
          ) : (
            tracks.map((track) => (
              <tr key={track.id} className="transition-colors hover:bg-surface-container">
                <td className="min-w-0 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onPlay(track)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-on-primary"
                      aria-label={`Preview ${track.filename}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                    </button>
                    <span className="truncate font-bold text-on-surface">{track.filename}</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-on-surface-variant md:table-cell">{formatDuration(rowDurations[track.id])}</td>
                <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">{formatSize(Number(track.sizeBytes || 0))}</td>
                <td className="px-4 py-3"><MediaPipelineStatus media={track} pipeline={pipelinesById[track.id]?.pipeline} compact /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconToggleButton id={track.id} active={track.isFavorite} intent="toggle-favorite" activeIcon="favorite" inactiveIcon="favorite_border" activeClassName="text-error" label={`${track.isFavorite ? "Remove from" : "Add to"} favorites`} />
                    <AccessDialog resourceType="media" resourceId={track.id} resourceName={track.filename} canManageAccess={canManageAccess} />
                    {canWrite ? <CardOverflowMenu id={track.id} itemLabel={track.filename} placement="top" /> : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function configForKind(kind: number) {
  if (kind === MediaKind.Image) {
    return { singular: "Photo", plural: "Photos", icon: "image", albumIcon: "folder_open", path: "photos", albumView: "photo", albumPlaceholder: "Campaign photos" };
  }
  if (kind === MediaKind.Audio) {
    return { singular: "Audio", plural: "Audio", icon: "music_note", albumIcon: "album", path: "audio", albumView: "audio", albumPlaceholder: "Podcast edits" };
  }
  return { singular: "Video", plural: "Videos", icon: "play_circle", albumIcon: "video_library", path: "videos", albumView: "video", albumPlaceholder: "Launch videos" };
}

function mediaDetail(media: MediaDto): string {
  const size = formatSize(Number(media.sizeBytes || 0));
  if (media.kind === MediaKind.Audio) return `${formatDuration(media.durationSeconds)} / ${size}`;
  const dimensions = media.width && media.height ? `${media.width} x ${media.height}` : null;
  if (media.kind === MediaKind.Video) return [formatDuration(media.durationSeconds), dimensions, size].filter(Boolean).join(" / ");
  return [dimensions, size].filter(Boolean).join(" / ") || size;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Pending";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 * 1024 ? 0 : 1)} GB`;
}

function formatDuration(value: MediaDto["durationSeconds"]): string {
  return formatMediaDuration(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
