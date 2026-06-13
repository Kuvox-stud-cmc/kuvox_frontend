import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { primaryButtonClass } from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Templates · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

interface MockTemplate {
  id: string;
  title: string;
  category: string;
  type: string;
  scenes: number;
  duration: string;
  downloads: string;
  isFeatured: boolean;
  isNew: boolean;
  isFavorite: boolean;
}

const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: "t1",
    title: "Cinematic Travel Vlog",
    category: "Cinematic",
    type: "Video",
    scenes: 12,
    duration: "01:32",
    downloads: "24.8K",
    isFeatured: true,
    isNew: true,
    isFavorite: true,
  },
  {
    id: "t2",
    title: "Urban Night Opener",
    category: "Cinematic",
    type: "Video",
    scenes: 8,
    duration: "00:28",
    downloads: "18.7K",
    isFeatured: true,
    isNew: false,
    isFavorite: false,
  },
  {
    id: "t3",
    title: "Product Promo",
    category: "Business",
    type: "Video",
    scenes: 10,
    duration: "00:45",
    downloads: "15.2K",
    isFeatured: true,
    isNew: false,
    isFavorite: true,
  },
  {
    id: "t4",
    title: "Minimal Titles Pack",
    category: "Minimal",
    type: "Video",
    scenes: 6,
    duration: "00:15",
    downloads: "9.1K",
    isFeatured: true,
    isNew: false,
    isFavorite: false,
  },
  {
    id: "t5",
    title: "YouTube Intro Pack",
    category: "YouTube",
    type: "Video",
    scenes: 5,
    duration: "00:18",
    downloads: "12.4K",
    isFeatured: false,
    isNew: false,
    isFavorite: true,
  },
  {
    id: "t6",
    title: "Instagram Reels Kit",
    category: "Social Media",
    type: "Video",
    scenes: 7,
    duration: "00:30",
    downloads: "8.7K",
    isFeatured: false,
    isNew: true,
    isFavorite: false,
  },
  {
    id: "t7",
    title: "Corporate Presentation",
    category: "Business",
    type: "Video",
    scenes: 15,
    duration: "02:10",
    downloads: "6.3K",
    isFeatured: false,
    isNew: false,
    isFavorite: false,
  },
  {
    id: "t8",
    title: "Dynamic Slideshow",
    category: "Cinematic",
    type: "Video",
    scenes: 9,
    duration: "01:05",
    downloads: "9.1K",
    isFeatured: false,
    isNew: false,
    isFavorite: true,
  },
  {
    id: "t9",
    title: "Travel Montage",
    category: "Travel",
    type: "Video",
    scenes: 11,
    duration: "01:48",
    downloads: "7.5K",
    isFeatured: false,
    isNew: true,
    isFavorite: false,
  },
  {
    id: "t10",
    title: "TikTok Promo Pack",
    category: "Social Media",
    type: "Video",
    scenes: 4,
    duration: "00:15",
    downloads: "11.2K",
    isFeatured: false,
    isNew: false,
    isFavorite: true,
  },
  {
    id: "t11",
    title: "Wedding Highlights",
    category: "Cinematic",
    type: "Video",
    scenes: 14,
    duration: "02:30",
    downloads: "5.8K",
    isFeatured: false,
    isNew: false,
    isFavorite: false,
  },
  {
    id: "t12",
    title: "Podcast Visual Kit",
    category: "YouTube",
    type: "Video",
    scenes: 6,
    duration: "00:22",
    downloads: "4.1K",
    isFeatured: false,
    isNew: false,
    isFavorite: false,
  },
];

const CATEGORIES = [
  { name: "All Templates", icon: "view_quilt", count: 1248 },
  { name: "Cinematic", icon: "movie", count: 342 },
  { name: "Social Media", icon: "group", count: 425 },
  { name: "YouTube", icon: "smart_display", count: 186 },
  { name: "Business", icon: "business_center", count: 128 },
  { name: "Travel", icon: "flight_takeoff", count: 98 },
  { name: "Minimal", icon: "crop_square", count: 76 },
];

const MOCK_METRICS = {
  total: 1248,
  newThisMonth: 86,
  favorites: 128,
  used: 382,
  downloads: "2.4K",
};

const CARD_GRADIENTS = [
  "from-primary/25 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
  "from-secondary/15 via-surface-container to-primary/15",
  "from-tertiary/15 via-surface-container-high to-secondary/15",
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
  trend,
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: "primary" | "secondary" | "tertiary";
  trend?: number;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <p className="mb-1 text-label-sm text-on-surface-variant">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-headline-md font-bold text-on-surface">
          {value}
        </span>
        {trend != null && (
          <span className="inline-flex items-center gap-1 text-label-sm font-bold text-secondary">
            <span className="material-symbols-outlined text-[12px]">
              trending_up
            </span>
            {trend}%
          </span>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  index,
  compact = false,
}: {
  template: MockTemplate;
  index: number;
  compact?: boolean;
}) {
  const gradientIdx = index % CARD_GRADIENTS.length;

  if (compact) {
    return (
      <div className="bento-card group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
        <div className="relative h-32 overflow-hidden">
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[gradientIdx]}`}
          >
            <h4 className="px-4 text-center text-body-sm font-black uppercase leading-tight tracking-tight text-on-surface/30">
              {template.title}
            </h4>
          </div>
        </div>
        <div className="p-3">
          <p className="mb-1 truncate text-label-md font-medium text-on-surface">
            {template.title}
          </p>
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span>
              {template.type} • {template.scenes} Scenes
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">
                download
              </span>
              {template.downloads}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
      {/* Thumbnail */}
      <div className="relative h-40 overflow-hidden">
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[gradientIdx]}`}
        >
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/15">
            movie
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute bottom-3 left-3">
          {template.isNew && (
            <span className="mb-1 inline-block rounded bg-primary px-1.5 py-0.5 text-label-sm font-bold uppercase text-on-primary">
              New
            </span>
          )}
          <h3 className="text-body-sm font-bold uppercase leading-tight text-on-surface">
            {template.title}
          </h3>
        </div>

        {/* Duration */}
        <span className="absolute bottom-3 right-3 rounded bg-surface-container-lowest/60 px-1.5 py-0.5 font-mono text-label-sm font-bold text-on-surface backdrop-blur-md">
          {template.duration}
        </span>

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-surface/30 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
            <span className="material-symbols-outlined text-[20px]">
              play_arrow
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="truncate text-label-md font-medium text-on-surface">
            {template.title}
          </p>
          <button
            type="button"
            className="shrink-0 text-on-surface-variant transition-colors hover:text-primary"
            aria-label="Bookmark template"
          >
            <span className="material-symbols-outlined text-[18px]">
              {template.isFavorite ? "bookmark" : "bookmark_border"}
            </span>
          </button>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          {template.type} • {template.scenes} Scenes
        </p>
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  index,
}: {
  category: { name: string; icon: string; count: number };
  index: number;
}) {
  return (
    <div className="bento-card group cursor-pointer rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center transition-colors">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]}`}
      >
        <span className="material-symbols-outlined text-[24px] text-on-surface-variant/60">
          {category.icon}
        </span>
      </div>
      <h4 className="text-body-sm font-bold text-on-surface">
        {category.name}
      </h4>
      <p className="mt-1 text-label-sm text-on-surface-variant">
        {category.count} templates
      </p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Templates() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");

  const [activeCategory, setActiveCategory] = useState("All Templates");

  const sectionFavoritesRef = useRef<HTMLElement>(null);
  const sectionCategoriesRef = useRef<HTMLElement>(null);

  // Scroll to section matching `?view` param
  useEffect(() => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      favorites: sectionFavoritesRef,
      categories: sectionCategoriesRef,
    };
    const target = view ? refMap[view] : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const featuredTemplates = MOCK_TEMPLATES.filter((t) => t.isFeatured);
  const popularTemplates = MOCK_TEMPLATES.filter((t) => !t.isFeatured).slice(
    0,
    4,
  );
  const favoriteTemplates = MOCK_TEMPLATES.filter((t) => t.isFavorite);

  return (
    <section className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            Templates
          </h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Ready-to-use templates for faster and more professional edits.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Sort by
            </span>
            <select className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none transition-colors hover:border-primary/40 focus:border-primary">
              <option>Latest Added</option>
              <option>Most Popular</option>
              <option>Name</option>
            </select>
          </label>
          <button type="button" className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Template
          </button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon="view_quilt"
          label="Total Templates"
          value={MOCK_METRICS.total.toLocaleString()}
          trend={18}
        />
        <MetricCard
          icon="add_circle"
          label="New This Month"
          value={MOCK_METRICS.newThisMonth}
          trend={24}
        />
        <MetricCard
          icon="favorite"
          label="Favorites"
          value={MOCK_METRICS.favorites}
          tone="tertiary"
        />
        <MetricCard
          icon="schedule"
          label="Used"
          value={MOCK_METRICS.used}
          tone="secondary"
          trend={16}
        />
        <MetricCard
          icon="download"
          label="Downloads"
          value={MOCK_METRICS.downloads}
          trend={20}
        />
      </div>

      {/* ── Category Filter Pills ──────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Browse by Category
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
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(cat.name)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium transition-colors ${
                activeCategory === cat.name
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {cat.icon}
              </span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Featured Templates ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">
            Featured Templates
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featuredTemplates.map((tmpl, i) => (
            <TemplateCard key={tmpl.id} template={tmpl} index={i} />
          ))}
        </div>
      </section>

      {/* ── Popular Templates ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">
            Popular Templates
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {popularTemplates.map((tmpl, i) => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              index={i + featuredTemplates.length}
              compact
            />
          ))}
        </div>
      </section>

      {/* ── Favorites Section ──────────────────────────────────────────────── */}
      <section
        id="section-favorites"
        ref={sectionFavoritesRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary/10">
              <span className="material-symbols-outlined text-[18px] text-tertiary">
                favorite
              </span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Favorites
            </h2>
            <span className="rounded-full bg-tertiary/20 px-2 py-0.5 text-label-sm font-bold text-tertiary">
              {favoriteTemplates.length}
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
        {favoriteTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">
              favorite_border
            </span>
            <p className="mt-3 text-body-sm text-on-surface">
              No favorites yet
            </p>
            <p className="mt-1 text-label-md text-on-surface-variant">
              Bookmark templates you love to find them quickly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favoriteTemplates.map((tmpl, i) => (
              <TemplateCard key={tmpl.id} template={tmpl} index={i + 10} />
            ))}
          </div>
        )}
      </section>

      {/* ── Categories Section ─────────────────────────────────────────────── */}
      <section
        id="section-categories"
        ref={sectionCategoriesRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[18px] text-primary">
                category
              </span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              Browse by Category
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {CATEGORIES.filter((c) => c.name !== "All Templates").map(
            (cat, i) => (
              <CategoryCard key={cat.name} category={cat} index={i} />
            ),
          )}
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[24px]">add</span>
            <span className="mt-2 text-label-md font-medium">
              Request Category
            </span>
          </button>
        </div>
      </section>
    </section>
  );
}
