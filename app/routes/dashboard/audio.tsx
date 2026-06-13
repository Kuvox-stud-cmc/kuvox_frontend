import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import {
  EmptyState,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Audio · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

interface MockAudioTrack {
  id: string;
  title: string;
  category: "music" | "sfx" | "voiceover";
  genre: string;
  format: "WAV" | "MP3" | "M4A" | "FLAC";
  duration: string;
  size: string;
  dateAdded: string;
  sampleRate?: string;
}

const MOCK_TRACKS: MockAudioTrack[] = [
  {
    id: "a1",
    title: "Midnight Drive",
    category: "music",
    genre: "Synthwave",
    format: "WAV",
    duration: "03:42",
    size: "35.6 MB",
    dateAdded: "May 12, 2024",
    sampleRate: "44.1 kHz",
  },
  {
    id: "a2",
    title: "Neon City Lights",
    category: "music",
    genre: "Electronic",
    format: "FLAC",
    duration: "04:18",
    size: "42.1 MB",
    dateAdded: "May 11, 2024",
    sampleRate: "48 kHz",
  },
  {
    id: "a3",
    title: "Acoustic Morning",
    category: "music",
    genre: "Folk",
    format: "MP3",
    duration: "03:05",
    size: "7.2 MB",
    dateAdded: "May 10, 2024",
    sampleRate: "44.1 kHz",
  },
  {
    id: "a4",
    title: "Rock Guitar Riff",
    category: "music",
    genre: "Rock",
    format: "WAV",
    duration: "01:32",
    size: "15.8 MB",
    dateAdded: "May 9, 2024",
    sampleRate: "44.1 kHz",
  },
  {
    id: "a5",
    title: "Lo-Fi Study Beat",
    category: "music",
    genre: "Lo-Fi",
    format: "MP3",
    duration: "02:48",
    size: "6.4 MB",
    dateAdded: "May 8, 2024",
    sampleRate: "44.1 kHz",
  },
  {
    id: "a6",
    title: "City Ambience",
    category: "sfx",
    genre: "Ambient",
    format: "MP3",
    duration: "05:18",
    size: "12.4 MB",
    dateAdded: "May 12, 2024",
  },
  {
    id: "a7",
    title: "Ocean Waves",
    category: "sfx",
    genre: "Nature",
    format: "WAV",
    duration: "10:01",
    size: "89.3 MB",
    dateAdded: "May 10, 2024",
  },
  {
    id: "a8",
    title: "Explosion Impact",
    category: "sfx",
    genre: "Action",
    format: "WAV",
    duration: "00:04",
    size: "1.8 MB",
    dateAdded: "May 9, 2024",
  },
  {
    id: "a9",
    title: "UI Click",
    category: "sfx",
    genre: "Interface",
    format: "MP3",
    duration: "00:01",
    size: "0.1 MB",
    dateAdded: "May 8, 2024",
  },
  {
    id: "a10",
    title: "Rain on Rooftop",
    category: "sfx",
    genre: "Nature",
    format: "FLAC",
    duration: "15:30",
    size: "112.0 MB",
    dateAdded: "May 7, 2024",
  },
  {
    id: "a11",
    title: "Whoosh Transition",
    category: "sfx",
    genre: "Transition",
    format: "WAV",
    duration: "00:02",
    size: "0.9 MB",
    dateAdded: "May 6, 2024",
  },
  {
    id: "a12",
    title: "Podcast Intro",
    category: "voiceover",
    genre: "Voice Recording",
    format: "M4A",
    duration: "00:28",
    size: "1.2 MB",
    dateAdded: "May 11, 2024",
  },
  {
    id: "a13",
    title: "Product Narration",
    category: "voiceover",
    genre: "Commercial",
    format: "WAV",
    duration: "02:15",
    size: "22.4 MB",
    dateAdded: "May 10, 2024",
    sampleRate: "48 kHz",
  },
  {
    id: "a14",
    title: "Tutorial Voiceover",
    category: "voiceover",
    genre: "Educational",
    format: "M4A",
    duration: "08:42",
    size: "18.6 MB",
    dateAdded: "May 9, 2024",
  },
  {
    id: "a15",
    title: "Character Dialogue",
    category: "voiceover",
    genre: "Animation",
    format: "WAV",
    duration: "00:45",
    size: "7.5 MB",
    dateAdded: "May 8, 2024",
    sampleRate: "48 kHz",
  },
  {
    id: "a16",
    title: "Audiobook Chapter 1",
    category: "voiceover",
    genre: "Audiobook",
    format: "MP3",
    duration: "12:30",
    size: "28.8 MB",
    dateAdded: "May 7, 2024",
  },
];

const MOCK_METRICS = {
  totalAudio: 1248,
  totalDuration: "86.4",
  storageUsedGb: 128,
  storagePercent: 12.8,
  editsApplied: 382,
};

/** The featured track shown in the Quick Preview player. */
const FEATURED_TRACK = MOCK_TRACKS[0];

/** Random-ish waveform heights for visualization. */
const WAVEFORM_BARS = [
  40, 60, 30, 80, 50, 70, 40, 90, 55, 35, 45, 75, 65, 50, 40, 85, 60, 30, 70,
  95, 50, 40, 80, 60, 30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40, 80, 60,
  30, 75, 55, 45, 85, 40, 65, 35, 90, 50, 70, 40,
];

const CATEGORY_ICONS: Record<MockAudioTrack["category"], string> = {
  music: "music_note",
  sfx: "graphic_eq",
  voiceover: "mic",
};

const CATEGORY_LABELS: Record<MockAudioTrack["category"], string> = {
  music: "Music",
  sfx: "Sound Effect",
  voiceover: "Voice Recording",
};

const FORMAT_TONES: Record<string, string> = {
  WAV: "bg-primary/10 text-primary",
  MP3: "bg-secondary/10 text-secondary",
  M4A: "bg-tertiary/10 text-tertiary",
  FLAC: "bg-primary/10 text-primary",
};

const CARD_GRADIENTS = [
  "from-primary/20 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
  "from-secondary/15 via-surface-container to-primary/15",
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function MetricCard({
  icon,
  label,
  value,
  suffix,
  tone = "primary",
  children,
}: {
  icon: string;
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "primary" | "secondary" | "tertiary";
  children?: React.ReactNode;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        {children && <div>{children}</div>}
      </div>
      <p className="mb-1 text-label-sm text-on-surface-variant">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-headline-md font-bold text-on-surface">
          {value}
        </span>
        {suffix && (
          <span className="text-label-sm text-on-surface-variant">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ProgressRing({
  progress,
  size = 36,
  strokeWidth = 3,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "stroke-dashoffset 0.35s ease",
          }}
        />
      </svg>
      <span className="absolute text-[8px] font-bold text-on-surface">
        {progress}%
      </span>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-label-sm font-bold text-secondary">
      <span className="material-symbols-outlined text-[12px]">
        trending_up
      </span>
      {value}%{" "}
      <span className="font-normal text-on-surface-variant">vs last month</span>
    </span>
  );
}

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
}: {
  tracks: MockAudioTrack[];
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
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
              {CATEGORY_ICONS[track.category]}
            </span>
            {/* Duration badge */}
            <span className="absolute bottom-2 right-2 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 font-mono text-label-sm font-bold text-on-surface backdrop-blur-md">
              {track.duration}
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
                {track.title}
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
              {track.genre} • {CATEGORY_LABELS[track.category]}
            </p>
            <div className="flex items-center justify-between">
              <FormatBadge format={track.format} />
              <span className="text-label-sm text-on-surface-variant">
                {track.size}
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

  const [sort, setSort] = useState<"latest" | "duration" | "size">("latest");
  const [importOpen, setImportOpen] = useState(false);

  // Refs for section scroll targets
  const sectionAllRef = useRef<HTMLElement>(null);
  const sectionMusicRef = useRef<HTMLElement>(null);
  const sectionSfxRef = useRef<HTMLElement>(null);
  const sectionVoiceoversRef = useRef<HTMLElement>(null);

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

  const musicTracks = MOCK_TRACKS.filter((t) => t.category === "music");
  const sfxTracks = MOCK_TRACKS.filter((t) => t.category === "sfx");
  const voiceoverTracks = MOCK_TRACKS.filter(
    (t) => t.category === "voiceover",
  );

  return (
    <section className="space-y-10">
      {/* ── Page Header + Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">Audio</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Manage, preview and enhance your audio collection.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Sort */}
          <label className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Sort by
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none transition-colors hover:border-primary/40 focus:border-primary"
            >
              <option value="latest">Latest Added</option>
              <option value="duration">Duration</option>
              <option value="size">Size</option>
            </select>
          </label>

          {/* Import CTA */}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={primaryButtonClass()}
          >
            <span className="material-symbols-outlined text-[18px]">
              upload
            </span>
            Import Audio
          </button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="music_note"
          label="Total Audio"
          value={MOCK_METRICS.totalAudio.toLocaleString()}
          tone="primary"
        >
          <TrendBadge value={15} />
        </MetricCard>

        <MetricCard
          icon="schedule"
          label="Total Duration"
          value={MOCK_METRICS.totalDuration}
          suffix="h"
          tone="tertiary"
        >
          <TrendBadge value={12} />
        </MetricCard>

        <MetricCard
          icon="cloud"
          label="Storage Used"
          value={MOCK_METRICS.storageUsedGb}
          suffix="GB"
          tone="primary"
        >
          <ProgressRing progress={MOCK_METRICS.storagePercent} />
        </MetricCard>

        <MetricCard
          icon="auto_fix_high"
          label="Edits Applied"
          value={MOCK_METRICS.editsApplied}
          tone="secondary"
        >
          <TrendBadge value={18} />
        </MetricCard>
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
            {/* Track info */}
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-headline-md font-bold text-on-surface">
                    {FEATURED_TRACK.title}
                  </h3>
                  <FormatBadge format={FEATURED_TRACK.format} />
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  {FEATURED_TRACK.genre} • {FEATURED_TRACK.duration} •{" "}
                  {FEATURED_TRACK.sampleRate}
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
              <span>{FEATURED_TRACK.duration}</span>
            </div>

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            All Audio
          </h2>
          <span className="text-label-md text-on-surface-variant">
            {MOCK_TRACKS.length} files
          </span>
        </div>

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
              {MOCK_TRACKS.map((track) => (
                <tr
                  key={track.id}
                  className="group transition-colors hover:bg-surface-container"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          track.category === "music"
                            ? "bg-primary/10 text-primary"
                            : track.category === "sfx"
                              ? "bg-tertiary/10 text-tertiary"
                              : "bg-secondary/10 text-secondary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {CATEGORY_ICONS[track.category]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">
                          {track.title}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          {track.genre} • {CATEGORY_LABELS[track.category]}
                        </p>
                      </div>
                      <MiniWaveform />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <FormatBadge format={track.format} />
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-on-surface-variant">
                    {track.duration}
                  </td>
                  <td className="px-4 py-3 text-center text-on-surface-variant">
                    {track.size}
                  </td>
                  <td className="hidden px-4 py-3 text-on-surface-variant lg:table-cell">
                    {track.dateAdded}
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
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          more_horiz
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <p className="text-label-sm text-on-surface-variant">
              Showing 1 to {MOCK_TRACKS.length} of{" "}
              {MOCK_METRICS.totalAudio.toLocaleString()} results
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[18px] text-primary">
                music_note
              </span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Music
            </h2>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-label-sm font-bold text-primary">
              {musicTracks.length}
            </span>
          </div>
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
        <AudioCardGrid
          tracks={musicTracks}
          emptyIcon="music_note"
          emptyTitle="No music tracks"
          emptyHint="Import music files to build your collection."
        />
      </section>

      {/* ── SFX Section ────────────────────────────────────────────────────── */}
      <section
        id="section-sfx"
        ref={sectionSfxRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary/10">
              <span className="material-symbols-outlined text-[18px] text-tertiary">
                graphic_eq
              </span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Sound Effects
            </h2>
            <span className="rounded-full bg-tertiary/20 px-2 py-0.5 text-label-sm font-bold text-tertiary">
              {sfxTracks.length}
            </span>
          </div>
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
        <AudioCardGrid
          tracks={sfxTracks}
          emptyIcon="graphic_eq"
          emptyTitle="No sound effects"
          emptyHint="Add sound effects to your library."
        />
      </section>

      {/* ── Voiceovers Section ─────────────────────────────────────────────── */}
      <section
        id="section-voiceovers"
        ref={sectionVoiceoversRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <span className="material-symbols-outlined text-[18px] text-secondary">
                mic
              </span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Voiceovers
            </h2>
            <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-label-sm font-bold text-secondary">
              {voiceoverTracks.length}
            </span>
          </div>
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
        <AudioCardGrid
          tracks={voiceoverTracks}
          emptyIcon="mic"
          emptyTitle="No voiceovers"
          emptyHint="Record or import voiceovers to get started."
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
        <div className="space-y-4">
          <div>
            <label
              htmlFor="audio-filename"
              className="block text-label-md text-on-surface-variant"
            >
              Filename
            </label>
            <input
              id="audio-filename"
              type="text"
              placeholder="midnight-drive.wav"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="audio-category"
              className="block text-label-md text-on-surface-variant"
            >
              Category
            </label>
            <select
              id="audio-category"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="music">Music</option>
              <option value="sfx">Sound Effect</option>
              <option value="voiceover">Voiceover</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className={primaryButtonClass()}
            >
              Import
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
