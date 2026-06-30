import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";

/* ── Types ──────────────────────────────────────────────────────────────── */

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

/* ── Data ───────────────────────────────────────────────────────────────── */

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
const MAX_RECENT = 5;
const MAX_DROPDOWN_RESULTS = 6;

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

/* ── Component ─────────────────────────────────────────────────────────── */

export function SearchDropdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    ContentCategory | "all"
  >("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
    setQuery("");
    setActiveCategory("all");
    setHighlightIndex(-1);
  }, [location.pathname]);

  // ⌘K shortcut to focus/open & Escape to close
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    // Use a timeout so the current click event doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [isOpen]);

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

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.blur();
  }, []);

  const handleResultClick = useCallback(
    (link: string) => {
      commitSearch(query);
      closeDropdown();
      navigate(link);
    },
    [query, commitSearch, closeDropdown, navigate],
  );

  const clearHistory = useCallback(() => {
    setRecentSearches([]);
    saveRecent([]);
  }, []);

  const applyRecentSearch = useCallback((term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

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

  const displayedResults = results.slice(0, MAX_DROPDOWN_RESULTS);
  const hasMore = results.length > MAX_DROPDOWN_RESULTS;
  const hasQuery = query.trim().length > 0;
  const showResults = hasQuery || activeCategory !== "all";

  // Keyboard navigation within dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      closeDropdown();
      return;
    }
    if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < displayedResults.length) {
        handleResultClick(displayedResults[highlightIndex].link);
      } else {
        commitSearch(query);
        // Navigate to full search page with the query
        closeDropdown();
        navigate(`/search`);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < displayedResults.length - 1 ? prev + 1 : 0,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : displayedResults.length - 1,
      );
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[480px] lg:max-w-[560px] min-w-0">
      {/* ── Search Input ─────────────────────────────────────────────── */}
      <div className={`relative group ${isOpen ? "z-50" : ""}`}>
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] sm:text-[18px] text-on-surface-variant transition-colors group-focus-within:text-primary">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search..."
          autoComplete="off"
          aria-label="Search content"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="w-full cursor-text rounded-lg border border-outline-variant bg-surface-container-low py-1.5 sm:py-2 pl-9 sm:pl-10 pr-4 sm:pr-16 text-[13px] sm:text-body-sm text-on-surface placeholder-on-surface-variant/60 transition-colors hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHighlightIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 sm:right-11 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[14px] sm:text-[16px]">
              close
            </span>
          </button>
        )}
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-block rounded border border-outline-variant px-1.5 py-0.5 text-[11px] text-on-surface-variant">
          ⌘K
        </kbd>
      </div>

      {/* ── Dropdown Panel ───────────────────────────────────────────── */}
      {isOpen && (
        <>
        {/* Mobile backdrop */}
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden" onClick={closeDropdown} />
        <div className="fixed inset-x-3 top-14 z-50 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-2xl">
          {/* Category filter pills */}
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto border-b border-outline-variant/50 px-2.5 sm:px-3 py-2 sm:py-2.5 scrollbar-none">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setActiveCategory(filter.value);
                  setHighlightIndex(-1);
                  inputRef.current?.focus();
                }}
                className={`shrink-0 rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-[12px] font-medium transition-all ${
                  activeCategory === filter.value
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="max-h-[50vh] sm:max-h-[420px] overflow-y-auto overscroll-contain">
            {/* ── Recent Searches ──────────────────────────────────────── */}
            {recentSearches.length > 0 && !hasQuery && activeCategory === "all" && (
              <div className="border-b border-outline-variant/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">
                      history
                    </span>
                    Recent
                  </span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[10px] sm:text-[11px] text-on-surface-variant transition-colors hover:text-primary"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => applyRecentSearch(term)}
                      className="flex items-center gap-2 sm:gap-2.5 rounded-lg px-2 py-1 sm:py-1.5 text-[12px] sm:text-[13px] text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface text-left"
                    >
                      <span className="material-symbols-outlined text-[14px] opacity-50">
                        history
                      </span>
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Trending ─────────────────────────────────────────────── */}
            {!hasQuery && activeCategory === "all" && (
              <div className="border-b border-outline-variant/50 px-2.5 sm:px-3 py-2 sm:py-2.5">
                <span className="mb-2 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-[13px] text-tertiary-container"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    local_fire_department
                  </span>
                  Trending
                </span>
                <div className="mt-1 flex flex-col gap-0.5">
                  {TRENDING_ITEMS.map((item) => (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={() => closeDropdown()}
                      className="group flex items-center gap-2 sm:gap-2.5 rounded-lg px-2 py-1 sm:py-1.5 transition-colors hover:bg-surface-container"
                    >
                      <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-on-surface-variant transition-colors group-hover:text-primary">
                        <span className="material-symbols-outlined text-[13px] sm:text-[15px]">
                          {item.icon}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] sm:text-[13px] text-on-surface group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-on-surface-variant">
                          {item.label}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── Search Results ────────────────────────────────────────── */}
            {showResults && (
              <div className="px-2.5 sm:px-3 py-2 sm:py-2.5">
                {displayedResults.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-5 text-center">
                    <span className="material-symbols-outlined text-[24px] text-on-surface-variant/30">
                      search_off
                    </span>
                    <p className="text-[12px] sm:text-[13px] text-on-surface-variant">
                      No results for "{query.trim()}"
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-on-surface-variant/60">
                      Try a different keyword or clear filters
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="mb-1 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Results
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-primary">
                        {results.length}
                      </span>
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {displayedResults.map((item, i) => {
                        const cat = CATEGORY_CONFIG[item.category];
                        const isHighlighted = i === highlightIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleResultClick(item.link)}
                            onMouseEnter={() => setHighlightIndex(i)}
                            className={`flex items-center gap-2.5 sm:gap-3 rounded-lg px-2 py-1.5 sm:py-2 text-left transition-colors ${
                              isHighlighted
                                ? "bg-surface-container text-on-surface"
                                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                            }`}
                          >
                            {/* Icon */}
                            <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest">
                              <span className="material-symbols-outlined text-[15px] sm:text-[17px]">
                                {item.icon}
                              </span>
                            </span>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] sm:text-[13px] font-medium text-on-surface">
                                {item.title}
                              </p>
                              <p className="truncate text-[10px] sm:text-[11px] text-on-surface-variant">
                                {item.subtitle}
                                {item.meta && ` · ${item.meta}`}
                              </p>
                            </div>

                            {/* Category badge */}
                            <span
                              className={`shrink-0 hidden sm:inline-flex rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${cat.bg} ${cat.color}`}
                            >
                              {cat.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Footer: View all results ───────────────────────────────── */}
          <div className="border-t border-outline-variant/50">
            <Link
              to="/search"
              onClick={() => {
                commitSearch(query);
                closeDropdown();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 text-[11px] sm:text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
            >
              {hasMore
                ? `View all ${results.length} results`
                : "Open full search"}
              <span className="material-symbols-outlined text-[14px]">
                arrow_forward
              </span>
            </Link>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
