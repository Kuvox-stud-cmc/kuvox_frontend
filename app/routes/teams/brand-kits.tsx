import { Link } from "react-router";

import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/brand-kits";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Brand Kits · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const LOGOS = [
  { id: "1", name: "Primary Logo", variant: "Full Color", format: "SVG + PNG" },
  { id: "2", name: "Icon Logo", variant: "Monochrome", format: "SVG" },
  { id: "3", name: "Wordmark", variant: "Light / Dark", format: "SVG + PNG" },
];

const FONTS = [
  { id: "1", name: "Geist", usage: "Headings", weights: "400, 500, 600, 700" },
  { id: "2", name: "Inter", usage: "Body Text", weights: "400, 500, 600" },
  { id: "3", name: "JetBrains Mono", usage: "Code", weights: "400, 500" },
];

const COLORS = [
  { id: "1", name: "Primary", hex: "#c0c1ff", token: "primary" },
  { id: "2", name: "Secondary", hex: "#4edea3", token: "secondary" },
  { id: "3", name: "Tertiary", hex: "#ffb783", token: "tertiary" },
  { id: "4", name: "Surface", hex: "#131315", token: "surface" },
  { id: "5", name: "On Surface", hex: "#e5e1e4", token: "on-surface" },
  { id: "6", name: "Error", hex: "#ffb4ab", token: "error" },
];

const INTRO_OUTRO = [
  { id: "1", name: "Standard Intro", duration: "5s", format: "MP4" },
  { id: "2", name: "Short Intro", duration: "3s", format: "MP4" },
  { id: "3", name: "Standard Outro", duration: "8s", format: "MP4" },
];

const SOCIAL_TEMPLATES = [
  { id: "1", name: "Instagram Post", size: "1080×1080", category: "Square" },
  { id: "2", name: "Instagram Story", size: "1080×1920", category: "Vertical" },
  { id: "3", name: "YouTube Thumbnail", size: "1280×720", category: "Landscape" },
  { id: "4", name: "Facebook Cover", size: "1200×630", category: "Landscape" },
  { id: "5", name: "TikTok Video", size: "1080×1920", category: "Vertical" },
];

type BrandView = "logos" | "fonts" | "colors" | "intro-outro" | "social";

const VIEW_CONFIG: Record<BrandView, { label: string; icon: string }> = {
  logos: { label: "Logos", icon: "branding_watermark" },
  fonts: { label: "Fonts", icon: "text_fields" },
  colors: { label: "Colors", icon: "palette" },
  "intro-outro": { label: "Intro/Outro", icon: "movie" },
  social: { label: "Social Templates", icon: "share" },
};

export default function TeamBrandKits({ params }: Route.ComponentProps) {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get("view") as BrandView) ?? "logos";
  const studioId = params.studioId;

  return (
    <section>
      <SectionHeader title="Brand Kits" subtitle="Maintain consistent branding across all content." />

      {/* View tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(VIEW_CONFIG) as BrandView[]).map((key) => (
          <Link
            key={key}
            to={`/teams/${studioId}/brand-kits?view=${key}`}
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
        {view === "logos" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LOGOS.map((logo) => (
              <div
                key={logo.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30">
                    branding_watermark
                  </span>
                </div>
                <p className="text-body-sm font-medium text-on-surface">{logo.name}</p>
                <p className="mt-1 text-label-md text-on-surface-variant">
                  {logo.variant} · {logo.format}
                </p>
              </div>
            ))}
          </div>
        )}

        {view === "fonts" && (
          <div className="space-y-3">
            {FONTS.map((font) => (
              <div
                key={font.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-headline-md text-on-surface" style={{ fontFamily: font.name }}>
                      {font.name}
                    </p>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Used for: {font.usage}
                    </p>
                    <p className="text-label-md text-on-surface-variant">
                      Weights: {font.weights}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                    {font.usage}
                  </span>
                </div>
                <p className="mt-3 text-body-sm text-on-surface-variant" style={{ fontFamily: font.name }}>
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </div>
            ))}
          </div>
        )}

        {view === "colors" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COLORS.map((color) => (
              <div
                key={color.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div
                  className="mb-3 h-16 rounded-lg border border-outline-variant/30"
                  style={{ backgroundColor: color.hex }}
                />
                <p className="text-body-sm font-medium text-on-surface">{color.name}</p>
                <p className="font-mono text-label-md text-on-surface-variant">{color.hex}</p>
              </div>
            ))}
          </div>
        )}

        {view === "intro-outro" && (
          <div className="space-y-3">
            {INTRO_OUTRO.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[24px] text-on-surface-variant/40">play_circle</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-on-surface">{item.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {item.duration} · {item.format}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "social" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">view_quilt</span>
                </div>
                <p className="text-body-sm font-medium text-on-surface">{tmpl.name}</p>
                <div className="mt-1 flex items-center justify-between text-label-md text-on-surface-variant">
                  <span>{tmpl.size}</span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm">
                    {tmpl.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
