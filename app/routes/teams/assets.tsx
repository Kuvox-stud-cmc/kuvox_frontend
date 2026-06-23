import { Link } from "react-router";

import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/assets";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Assets · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const PHOTOS = [
  { id: "1", name: "hero-banner.jpg", size: "4.2 MB", date: "22/06" },
  { id: "2", name: "product-shot-01.png", size: "3.1 MB", date: "21/06" },
  { id: "3", name: "team-photo.jpg", size: "2.8 MB", date: "20/06" },
  { id: "4", name: "social-cover.png", size: "1.5 MB", date: "19/06" },
];

const VIDEOS = [
  { id: "1", name: "intro-v3.mp4", size: "128 MB", duration: "0:32" },
  { id: "2", name: "product-demo.mov", size: "456 MB", duration: "2:15" },
  { id: "3", name: "testimonial-cut.mp4", size: "89 MB", duration: "1:04" },
];

const AUDIO = [
  { id: "1", name: "background-music.mp3", size: "8.2 MB", duration: "3:45" },
  { id: "2", name: "voiceover-final.wav", size: "24 MB", duration: "1:20" },
  { id: "3", name: "sfx-transition.mp3", size: "0.5 MB", duration: "0:03" },
];

const TEMPLATES = [
  { id: "1", name: "Instagram Story", category: "Social", uses: 24 },
  { id: "2", name: "YouTube Thumbnail", category: "Social", uses: 18 },
  { id: "3", name: "Product Ad", category: "Marketing", uses: 12 },
  { id: "4", name: "Email Banner", category: "Marketing", uses: 8 },
];

type AssetView = "photos" | "videos" | "audio" | "templates";

const VIEW_CONFIG: Record<AssetView, { label: string; icon: string }> = {
  photos: { label: "Photos", icon: "photo_library" },
  videos: { label: "Videos", icon: "videocam" },
  audio: { label: "Audio", icon: "music_note" },
  templates: { label: "Templates", icon: "view_quilt" },
};

export default function TeamAssets({ params }: Route.ComponentProps) {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get("view") as AssetView) ?? "photos";
  const studioId = params.studioId;

  return (
    <section>
      <SectionHeader title="Assets" subtitle="All team media and templates in one place." />

      {/* View tabs */}
      <div className="mt-4 flex gap-2">
        {(Object.keys(VIEW_CONFIG) as AssetView[]).map((key) => (
          <Link
            key={key}
            to={`/teams/${studioId}/assets?view=${key}`}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-body-sm transition-colors ${
              view === key
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{VIEW_CONFIG[key].icon}</span>
            {VIEW_CONFIG[key].label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {view === "photos" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PHOTOS.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">image</span>
                </div>
                <p className="truncate text-body-sm font-medium text-on-surface">{p.name}</p>
                <div className="mt-1 flex items-center justify-between text-label-md text-on-surface-variant">
                  <span>{p.size}</span>
                  <span>{p.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "videos" && (
          <div className="space-y-3">
            {VIDEOS.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[24px] text-on-surface-variant/40">play_circle</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-on-surface">{v.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {v.size} · {v.duration}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "audio" && (
          <div className="space-y-3">
            {AUDIO.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-[20px] text-primary">music_note</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-on-surface">{a.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {a.size} · {a.duration}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {view === "templates" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">view_quilt</span>
                </div>
                <p className="text-body-sm font-medium text-on-surface">{t.name}</p>
                <div className="mt-1 flex items-center justify-between text-label-md text-on-surface-variant">
                  <span>{t.category}</span>
                  <span>{t.uses} uses</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
