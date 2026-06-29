import { useEffect, useRef, useState } from "react";
import { useSearchParams, Form, useNavigation, useActionData, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { MediaKind, AlbumKind, PERSONAL, type MediaDto, type AlbumDto } from "~/lib/api";
import { ApiError, createMedia, listMedia, softDelete, albumsApi } from "~/lib/api.server";
import { createRequestLogger } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";
import { TextField } from "~/components/dashboard/shared/form";

import {
  CARD_GRADIENTS,
  MetricCard,
  PageHeader,
  SectionHeader,
  SortDropdown,
} from "~/components/dashboard/layout/DashboardPageLayout";
import {
  EmptyState,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Audio · Kuvox" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { media: [] as MediaDto[], albums: [] as AlbumDto[], albumMedia: {} as Record<string, MediaDto[]>, error: "Your session expired. Please sign in again." };
  }

  const reqLog = createRequestLogger(request).child({ component: "AudioLoader" });
  try {
    const page = await listMedia(accessToken, PERSONAL, reqLog);
    const audioMedia = page.items.filter(m => m.kind === MediaKind.Audio);
    
    const allAlbums = await albumsApi.listAlbums(accessToken, reqLog);
    const audioAlbums = allAlbums.filter(a => a.kind === AlbumKind.Audio && !a.isDeleteAble);

    const albumMedia: Record<string, MediaDto[]> = {};
    for (const album of audioAlbums) {
      const am = await albumsApi.listAlbumMedia(accessToken, album.id, reqLog);
      albumMedia[album.name] = am.items;
    }

    return { media: audioMedia, albums: audioAlbums, albumMedia, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load your audio.";
    reqLog.error({ err: error }, "failed to load audio");
    return { media: [] as MediaDto[], albums: [] as AlbumDto[], albumMedia: {} as Record<string, MediaDto[]>, error: message };
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
    if (intent === "create") {
      const filename = String(formData.get("filename") ?? "");
      const sizeBytes = 1024 * 1024 * 2; // fake size 2MB
      await createMedia(accessToken, PERSONAL, {
        kind: MediaKind.Audio,
        filename,
        storageKey: `audio/${crypto.randomUUID()}`,
        sizeBytes,
        projectId: null,
      }, reqLog);
      return { ok: true, intent };
    }

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

/** Waveform visualization for the Quick Preview player. */
function WaveformVisualizer({ playheadPercent }: { playheadPercent: number }) {
  return (
    <div className="relative my-4 flex h-16 items-end gap-[2px] px-2">
      {WAVEFORM_BARS.map((h, i) => {
        const position = (i / WAVEFORM_BARS.length) * 100;
        const isPlayed = position < playheadPercent;
        return (
          <div
            key={i}
            className={`w-[3px] rounded-sm transition-colors ${isPlayed ? "bg-primary" : "bg-primary/20"}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
      {/* Playhead */}
      <div
        className="absolute bottom-0 top-0 z-10 w-[2px] bg-primary"
        style={{ left: `${playheadPercent}%` }}
      >
        <div className="absolute -left-[3px] top-0 h-2 w-2 rounded-full bg-primary" />
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
}: {
  tracks: import("~/lib/api").MediaDto[];
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
  albumIcon: string;
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
          className="bento-card group cursor-pointer overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
        >
          {/* Cover placeholder */}
          <div
            className={`relative flex aspect-[2/1] items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`}
          >
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant/20">
              {albumIcon}
            </span>
            {/* Duration badge */}
            <span className="absolute bottom-2 right-2 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 font-mono text-label-sm font-bold text-on-surface backdrop-blur-md">
              {track.durationSeconds ? Math.floor(track.durationSeconds / 60) + ":" + String(Math.floor(track.durationSeconds % 60)).padStart(2, "0") : "0:00"}
            </span>
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-surface/40 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
                <span className="material-symbols-outlined text-[20px]">
                  play_arrow
                </span>
              </div>
            </div>
          </div>
          {/* Info */}
          <div className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <h4 className="truncate text-body-sm font-bold text-on-surface">
                {track.filename}
              </h4>
              <button
                type="button"
                className="shrink-0 text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">
                  more_horiz
                </span>
              </button>
            </div>
            <p className="mb-3 text-label-md text-on-surface-variant">
              {track.codec || "Audio"}
            </p>
            <div className="flex items-center justify-between">
              <FormatBadge format={track.codec ? track.codec.toUpperCase() : "MP3"} />
              <span className="text-label-sm text-on-surface-variant">
                {(track.sizeBytes / 1024 / 1024).toFixed(1)} MB
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
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const transition = useNavigation();

  const [sort, setSort] = useState<"latest" | "duration" | "size">("latest");
  const [importOpen, setImportOpen] = useState(false);

  // Refs for section scroll targets
  const sectionAllRef = useRef<HTMLElement>(null);
  const sectionMusicRef = useRef<HTMLElement>(null);
  const sectionSfxRef = useRef<HTMLElement>(null);
  const sectionVoiceoversRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (actionData?.ok) setImportOpen(false);
  }, [actionData]);

  // Scroll to the section matching the `?view` param
  useEffect(() => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      music: sectionMusicRef,
      sfx: sectionSfxRef,
      voiceovers: sectionVoiceoversRef,
    };
    const target = view ? refMap[view] : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const allTracks = loaderData?.media || [];
  const musicTracks = loaderData?.albumMedia?.["Music"] || [];
  const sfxTracks = loaderData?.albumMedia?.["Sound Effects"] || [];
  const voiceoverTracks = loaderData?.albumMedia?.["Voiceovers"] || [];

  const totalDuration = allTracks.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  const durationHours = (totalDuration / 3600).toFixed(1);
  const storageUsed = allTracks.reduce((acc, curr) => acc + curr.sizeBytes, 0);
  const storageUsedGb = (storageUsed / (1024 * 1024 * 1024)).toFixed(2);
  const albumCount = loaderData?.albums?.length || 0;
  
  const FEATURED_TRACK = allTracks.length > 0 ? allTracks[0] : null;

  return (
    <section className="space-y-10">
      <PageHeader title="Audio" subtitle="Manage, preview and enhance your audio collection.">
        <SortDropdown
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
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

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Cover art */}
          <div className="group relative h-40 w-40 shrink-0 overflow-hidden rounded-xl">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-surface-container to-tertiary/20">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/25">
                album
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-surface/40 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl">
                <span className="material-symbols-outlined text-[24px]">
                  play_arrow
                </span>
              </div>
            </div>
          </div>

          {/* Track info + waveform + controls */}
          <div className="flex flex-1 flex-col justify-between">
            {FEATURED_TRACK ? (
              <>
                {/* Track info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-headline-md font-bold text-on-surface">
                        {FEATURED_TRACK.filename}
                      </h3>
                      <FormatBadge format={FEATURED_TRACK.codec ? FEATURED_TRACK.codec.toUpperCase() : "MP3"} />
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      Audio • {FEATURED_TRACK.durationSeconds ? Math.floor(FEATURED_TRACK.durationSeconds / 60) + ":" + String(Math.floor(FEATURED_TRACK.durationSeconds % 60)).padStart(2, "0") : "0:00"} •{" "}
                      {(FEATURED_TRACK.sizeBytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      more_horiz
                    </span>
                  </button>
                </div>

                {/* Waveform */}
                <WaveformVisualizer playheadPercent={40} />

                {/* Time display */}
                <div className="mb-4 flex justify-between font-mono text-label-sm text-on-surface-variant">
                  <span>01:24</span>
                  <span>{FEATURED_TRACK.durationSeconds ? Math.floor(FEATURED_TRACK.durationSeconds / 60) + ":" + String(Math.floor(FEATURED_TRACK.durationSeconds % 60)).padStart(2, "0") : "0:00"}</span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-on-surface-variant">
                No audio tracks uploaded yet.
              </div>
            )}

            {/* Transport controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    skip_previous
                  </span>
                </button>
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    fast_rewind
                  </span>
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    play_arrow
                  </span>
                </button>
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    fast_forward
                  </span>
                </button>
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    skip_next
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    repeat
                  </span>
                </button>
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    volume_up
                  </span>
                </button>
                <button
                  type="button"
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    open_in_full
                  </span>
                </button>
              </div>
            </div>
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
                <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {allTracks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">
                    No audio tracks available.
                  </td>
                </tr>
              ) : allTracks.map((track) => (
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
                    {track.durationSeconds ? Math.floor(track.durationSeconds / 60) + ":" + String(Math.floor(track.durationSeconds % 60)).padStart(2, "0") : "0:00"}
                  </td>
                  <td className="px-4 py-3 text-center text-on-surface-variant">
                    {(track.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </td>
                  <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">
                    {new Date(track.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          play_circle
                        </span>
                      </button>
                      <Form method="post" className="inline" onSubmit={(e) => { if(!confirm("Delete this audio?")) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={track.id} />
                        <button
                          type="submit"
                          className="rounded-lg p-1.5 text-error transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <p className="text-label-sm text-on-surface-variant">
              Showing 1 to {allTracks.length} of {allTracks.length} results
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded bg-primary text-label-sm font-bold text-on-primary"
              >
                1
              </button>
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  {n}
                </button>
              ))}
              <span className="px-1 text-label-sm text-on-surface-variant">
                ...
              </span>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                208
              </button>
              <button
                type="button"
                className="rounded p-1 text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
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
        />
      </section>

      {/* ── Import Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import audio"
      >
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Registers an audio record now; real file upload to storage lands in a
          later phase.
        </p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />
          
          <TextField
            name="filename"
            label="Filename"
            placeholder="midnight-drive.wav"
            required
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transition.state === "submitting"}
              className={primaryButtonClass()}
            >
              <span className="material-symbols-outlined text-[18px]">
                {transition.state === "submitting" ? "hourglass_empty" : "upload"}
              </span>
              {transition.state === "submitting" ? "Importing..." : "Import"}
            </button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

