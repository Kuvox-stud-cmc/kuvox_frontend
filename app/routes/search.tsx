import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { EmptyState } from "~/components/dashboard/section";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/search";

/* ── Meta ───────────────────────────────────────────────────────────────── */

export function meta(_: Route.MetaArgs) {
  return [{ title: "Search · Kuvox" }];
}

/* ── Loader ─────────────────────────────────────────────────────────────── */

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  await requireUser(request, log);
  return null;
}

/* ── Mock searchable data ───────────────────────────────────────────────── */

type ContentCategory =
  | "project"
  | "video"
  | "photo"
  | "audio"
  | "template"
  | "shared";

interface SearchItem {
  id: string;
  title: string;
  category: ContentCategory;
  subtitle: string;
  icon: string;
  meta?: string;
  link: string;
}

const CATEGORY_CONFIG: Record<
  ContentCategory,
  { label: string; color: string; bg: string }
> = {
  project: { label: "Project", color: "text-primary", bg: "bg-primary/20" },
  video: { label: "Video", color: "text-primary", bg: "bg-primary/20" },
  photo: { label: "Photo", color: "text-secondary", bg: "bg-secondary/20" },
  audio: { label: "Audio", color: "text-tertiary", bg: "bg-tertiary/20" },
  template: {
    label: "Template",
    color: "text-primary",
    bg: "bg-primary-container/20",
  },
  shared: {
    label: "Shared",
    color: "text-secondary",
    bg: "bg-secondary/20",
  },
};

const MOCK_ITEMS: SearchItem[] = [
  // ── Projects ──
  {
    id: "p1",
    title: "Cinematic Travel Vlog",
    category: "project",
    subtitle: "Edited 2 hours ago",
    icon: "movie",
    meta: "4K · 24fps · 04:20",
    link: "/dashboard/projects",
  },
  {
    id: "p2",
    title: "Drone Footage - City Night",
    category: "project",
    subtitle: "Edited yesterday",
    icon: "movie",
    meta: "4K · 60fps · 12:05",
    link: "/dashboard/projects",
  },
  {
    id: "p3",
    title: "Music Video Teaser",
    category: "project",
    subtitle: "Edited 3 days ago",
    icon: "movie",
    meta: "4K · 24fps · 01:15",
    link: "/dashboard/projects",
  },
  {
    id: "p4",
    title: "Product Launch Campaign",
    category: "project",
    subtitle: "Edited last week",
    icon: "movie",
    meta: "1080p · 30fps · 02:30",
    link: "/dashboard/projects",
  },

  // ── Videos ──
  {
    id: "v1",
    title: "Ocean Waves - Slow Motion",
    category: "video",
    subtitle: "1080p · 00:45",
    icon: "videocam",
    meta: "60fps · RAW",
    link: "/dashboard/videos",
  },
  {
    id: "v2",
    title: "Sunset Timelapse - Golden Hour",
    category: "video",
    subtitle: "4K · 02:15",
    icon: "videocam",
    meta: "24fps · H.265",
    link: "/dashboard/videos",
  },
  {
    id: "v3",
    title: "Urban Street B-Roll",
    category: "video",
    subtitle: "4K · 01:30",
    icon: "videocam",
    meta: "60fps · ProRes",
    link: "/dashboard/videos",
  },

  // ── Photos ──
  {
    id: "ph1",
    title: "Mountain Landscape Collection",
    category: "photo",
    subtitle: "12 photos · 86 MB",
    icon: "photo_library",
    link: "/dashboard/photos",
  },
  {
    id: "ph2",
    title: "Studio Portrait Session",
    category: "photo",
    subtitle: "24 photos · 210 MB",
    icon: "photo_library",
    link: "/dashboard/photos",
  },
  {
    id: "ph3",
    title: "Product Photography - Tech",
    category: "photo",
    subtitle: "8 photos · 45 MB",
    icon: "photo_library",
    link: "/dashboard/photos",
  },

  // ── Audio ──
  {
    id: "a1",
    title: "Cinematic Impacts Vol. 2",
    category: "audio",
    subtitle: "SFX Pack · 32 files",
    icon: "music_note",
    meta: "WAV · 48kHz",
    link: "/dashboard/audio",
  },
  {
    id: "a2",
    title: "Ambient Background - Forest",
    category: "audio",
    subtitle: "Music · 03:45",
    icon: "music_note",
    meta: "320kbps · Stereo",
    link: "/dashboard/audio",
  },
  {
    id: "a3",
    title: "Voiceover - Brand Intro",
    category: "audio",
    subtitle: "Voiceover · 00:30",
    icon: "mic",
    meta: "WAV · 96kHz",
    link: "/dashboard/audio",
  },

  // ── Templates ──
  {
    id: "t1",
    title: "Cyberpunk Glitch Titles",
    category: "template",
    subtitle: "Title Template · Motion Graphics",
    icon: "view_quilt",
    meta: "4K · After Effects",
    link: "/dashboard/templates",
  },
  {
    id: "t2",
    title: "Minimal Lower Thirds Pack",
    category: "template",
    subtitle: "Lower Third · 12 Variations",
    icon: "view_quilt",
    meta: "1080p · Premiere Pro",
    link: "/dashboard/templates",
  },
  {
    id: "t3",
    title: "Social Media Story Kit",
    category: "template",
    subtitle: "Story Template · 20+ Layouts",
    icon: "view_quilt",
    meta: "1080×1920 · Vertical",
    link: "/dashboard/templates",
  },
  {
    id: "t4",
    title: "YouTube Thumbnail Designer",
    category: "template",
    subtitle: "Thumbnail · Drag & Drop",
    icon: "view_quilt",
    meta: "1280×720 · PSD",
    link: "/dashboard/templates",
  },

  // ── Shared Assets ──
  {
    id: "s1",
    title: "Brand Guidelines - Q4 2024",
    category: "shared",
    subtitle: "Shared by Sarah Chen · PDF",
    icon: "share",
    link: "/dashboard/shared-assets",
  },
  {
    id: "s2",
    title: "Client Review - Travel Vlog",
    category: "shared",
    subtitle: "Shared by John Smith · Video",
    icon: "share",
    link: "/dashboard/shared-assets",
  },
  {
    id: "s3",
    title: "Stock Footage Collection",
    category: "shared",
    subtitle: "Shared by Emma Davis · 45 clips",
    icon: "share",
    link: "/dashboard/shared-assets",
  },

  // ── Team Content ──
  {
    id: "tm1",
    title: "Marketing Campaign Assets",
    category: "shared",
    subtitle: "Creative Team · 18 files",
    icon: "group",
    meta: "Updated 2 days ago",
    link: "/dashboard/shared-assets",
  },
  {
    id: "tm2",
    title: "Logo Animation Files",
    category: "shared",
    subtitle: "Brand Team · 6 files",
    icon: "group",
    meta: "Updated last week",
    link: "/dashboard/shared-assets",
  },
  {
    id: "tm3",
    title: "Social Media Calendar",
    category: "shared",
    subtitle: "Marketing Team · Spreadsheet",
    icon: "group",
    meta: "Updated today",
    link: "/dashboard/shared-assets",
  },
];

const TRENDING_ITEMS = [
  {
    icon: "psychology",
    title: "AI Scene Detection",
    label: "Workflow Tool",
    to: "/dashboard/ai-tools",
  },
  {
    icon: "tune",
    title: "4K Export Settings",
    label: "Documentation",
    to: "/help/rendering-export",
  },
  {
    icon: "filter_b_and_w",
    title: "Green Screen Removal",
    label: "Video Tool",
    to: "/dashboard/ai-tools",
  },
  {
    icon: "auto_awesome",
    title: "Vibe-based Editing",
    label: "AI Feature",
    to: "/dashboard/ai-tools",
  },
];

const CATEGORY_FILTERS: { value: ContentCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "video", label: "Videos" },
  { value: "photo", label: "Photos" },
  { value: "audio", label: "Audio" },
  { value: "template", label: "Templates" },
  { value: "shared", label: "Shared" },
];

const RECENT_SEARCHES_KEY = "kuvox_recent_searches";
const MAX_RECENT = 8;

/* ── Helpers ────────────────────────────────────────────────────────────── */

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: string[]) {
  try {
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT)),
    );
  } catch {
    /* localStorage may be unavailable */
  }
}

/* ── Thumbnail gradients (reused from dashboard home) ──────────────────── */

const THUMBNAIL_GRADIENTS = [
  "from-primary/20 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
];

/* ── Component ─────────────────────────────────────────────────────────── */

export default function Search() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    ContentCategory | "all"
  >("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount (client only)
  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ⌘K shortcut to re-focus
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Commit a search term to recent history
  const commitSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const updated = [
        trimmed,
        ...recentSearches.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase(),
        ),
      ].slice(0, MAX_RECENT);
      setRecentSearches(updated);
      saveRecent(updated);
    },
    [recentSearches],
  );

  // Save to recent on Enter or blur (if non-empty)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitSearch(query);
    }
  };

  const handleBlur = () => {
    commitSearch(query);
  };

  const clearHistory = () => {
    setRecentSearches([]);
    saveRecent([]);
  };

  const applyRecentSearch = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  // Filtered results
  const results = useMemo(() => {
    let filtered = MOCK_ITEMS;

    if (activeCategory !== "all") {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [query, activeCategory]);

  const hasQuery = query.trim().length > 0;
  const showTrending = !hasQuery;
  const showResults = hasQuery || activeCategory !== "all";

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8">
      {/* ── Search Header ────────────────────────────────────────────────── */}
      <section>
        <h1 className="text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">Search</h1>
        <p className="mt-1 text-[13px] sm:text-body-sm text-on-surface-variant">
          Find projects, media, templates, and more across your workspace.
        </p>
      </section>

      {/* ── Search Input ─────────────────────────────────────────────────── */}
      <div className="relative group">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[18px] sm:text-[20px] text-on-surface-variant transition-colors group-focus-within:text-primary">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Search projects, media, templates..."
          autoComplete="off"
          aria-label="Search content"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-3 sm:py-3.5 pl-10 sm:pl-12 pr-12 sm:pr-20 text-[13px] sm:text-body-sm text-on-surface placeholder-on-surface-variant/50 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 sm:right-12 top-1/2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[18px]">
              close
            </span>
          </button>
        )}
        <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-block rounded border border-outline-variant px-1.5 py-0.5 text-label-sm text-on-surface-variant">
          ⌘K
        </kbd>
      </div>

      {/* ── Category Filter Pills ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveCategory(filter.value)}
            className={`rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[12px] sm:text-body-sm font-medium transition-all ${
              activeCategory === filter.value
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ── Recent Searches ──────────────────────────────────────────────── */}
      {recentSearches.length > 0 && !hasQuery && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[16px] sm:text-headline-md font-bold text-on-surface">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-on-surface-variant">
                history
              </span>
              Recent Searches
            </h2>
            <button
              type="button"
              onClick={clearHistory}
              className="text-[10px] sm:text-label-md font-medium uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary whitespace-nowrap"
            >
              Clear history
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => applyRecentSearch(term)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 sm:px-4 py-1 sm:py-1.5 text-[12px] sm:text-body-sm text-on-surface-variant transition-all hover:border-outline hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[14px]">
                  history
                </span>
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Trending Now ─────────────────────────────────────────────────── */}
      {showTrending && activeCategory === "all" && (
        <section>
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-[16px] sm:text-headline-md font-bold text-on-surface">
              <span
                className="material-symbols-outlined text-[20px] text-tertiary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_fire_department
              </span>
              Trending Now
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2">
            {TRENDING_ITEMS.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-outline-variant bg-surface-container-low p-3 sm:p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5"
              >
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-surface-container-highest text-on-surface-variant transition-colors group-hover:text-primary">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
                    {item.icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] sm:text-body-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                    {item.title}
                  </h3>
                  <p className="text-[10px] sm:text-label-sm text-on-surface-variant">
                    {item.label}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-on-surface-variant opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 -translate-x-2 hidden sm:inline">
                  arrow_forward
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Search Results ───────────────────────────────────────────────── */}
      {showResults && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] sm:text-headline-md font-bold text-on-surface">
              {hasQuery ? (
                <>
                  Results{" "}
                  <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-label-sm text-primary">
                    {results.length}
                  </span>
                </>
              ) : (
                <>
                  {
                    CATEGORY_FILTERS.find((f) => f.value === activeCategory)
                      ?.label
                  }{" "}
                  <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-label-sm text-primary">
                    {results.length}
                  </span>
                </>
              )}
            </h2>
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="No results found"
              hint={`No content matches "${query.trim()}"${activeCategory !== "all" ? ` in ${CATEGORY_FILTERS.find((f) => f.value === activeCategory)?.label}` : ""}. Try a different keyword or clear your filters.`}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((item, i) => {
                const cat = CATEGORY_CONFIG[item.category];
                return (
                  <Link
                    key={item.id}
                    to={item.link}
                    className="group overflow-hidden rounded-xl sm:rounded-2xl border border-outline-variant bg-surface-container-low transition-all hover:border-primary/30 hover:-translate-y-0.5"
                  >
                    {/* Gradient thumbnail */}
                    <div className="relative h-24 sm:h-32">
                      <div
                        className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${THUMBNAIL_GRADIENTS[i % THUMBNAIL_GRADIENTS.length]}`}
                      >
                        <span className="material-symbols-outlined text-[28px] sm:text-[36px] text-on-surface-variant/20 transition-transform group-hover:scale-110">
                          {item.icon}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

                      {/* Category badge */}
                      <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-label-sm font-bold backdrop-blur-md ${cat.bg} ${cat.color}`}
                        >
                          {cat.label}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 sm:p-4">
                      <h3 className="truncate text-[13px] sm:text-body-sm font-bold text-on-surface">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-label-md text-on-surface-variant">
                        {item.subtitle}
                      </p>
                      {item.meta && (
                        <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-label-sm text-on-surface-variant">
                          {item.meta.split(" · ").map((part, pi) => (
                            <span key={pi} className="flex items-center gap-1.5 sm:gap-2">
                              {pi > 0 && (
                                <span className="h-1 w-1 rounded-full bg-outline-variant" />
                              )}
                              {part}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Browse All (when no query and "All" category) ────────────────── */}
      {!showResults && (
        <section>
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-[16px] sm:text-headline-md font-bold text-on-surface">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                grid_view
              </span>
              Browse All
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {MOCK_ITEMS.map((item, i) => {
              const cat = CATEGORY_CONFIG[item.category];
              return (
                <Link
                  key={item.id}
                  to={item.link}
                  className="group overflow-hidden rounded-xl sm:rounded-2xl border border-outline-variant bg-surface-container-low transition-all hover:border-primary/30 hover:-translate-y-0.5"
                >
                  {/* Gradient thumbnail */}
                  <div className="relative h-24 sm:h-32">
                    <div
                      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${THUMBNAIL_GRADIENTS[i % THUMBNAIL_GRADIENTS.length]}`}
                    >
                      <span className="material-symbols-outlined text-[28px] sm:text-[36px] text-on-surface-variant/20 transition-transform group-hover:scale-110">
                        {item.icon}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />

                    {/* Category badge */}
                    <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-label-sm font-bold backdrop-blur-md ${cat.bg} ${cat.color}`}
                      >
                        {cat.label}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 sm:p-4">
                    <h3 className="truncate text-[13px] sm:text-body-sm font-bold text-on-surface">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-label-md text-on-surface-variant">
                      {item.subtitle}
                    </p>
                    {item.meta && (
                      <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-label-sm text-on-surface-variant">
                        {item.meta.split(" · ").map((part, pi) => (
                          <span key={pi} className="flex items-center gap-1.5 sm:gap-2">
                            {pi > 0 && (
                              <span className="h-1 w-1 rounded-full bg-outline-variant" />
                            )}
                            {part}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
