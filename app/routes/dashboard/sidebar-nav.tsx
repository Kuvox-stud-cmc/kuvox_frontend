import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";

/* ── Navigation data ────────────────────────────────────────────────────── */

interface NavChild {
  to: string;
  label: string;
}

interface NavItemConfig {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: number;
  children?: NavChild[];
}

const MAIN_NAV: NavItemConfig[] = [
  { to: "/dashboard", label: "Home", icon: "home", end: true },
  {
    to: "/dashboard/photos",
    label: "Photos",
    icon: "photo_library",
    children: [
      { to: "/dashboard/photos", label: "All Photos" },
      { to: "/dashboard/photos?view=albums", label: "Albums" },
      { to: "/dashboard/photos?view=favorites", label: "Favorites" },
    ],
  },
  {
    to: "/dashboard/videos",
    label: "Videos",
    icon: "videocam",
    children: [
      { to: "/dashboard/videos", label: "All Videos" },
      { to: "/dashboard/videos?view=projects", label: "Recent Projects" },
      { to: "/dashboard/videos?view=processing", label: "Processing" },
      { to: "/dashboard/videos?view=archived", label: "Archived" },
    ],
  },
  {
    to: "/dashboard/audio",
    label: "Audio",
    icon: "music_note",
    children: [
      { to: "/dashboard/audio", label: "All Audio" },
      { to: "/dashboard/audio?view=music", label: "Music" },
      { to: "/dashboard/audio?view=sfx", label: "SFX" },
      { to: "/dashboard/audio?view=voiceovers", label: "Voiceovers" },
    ],
  },
  {
    to: "/dashboard/templates",
    label: "Templates",
    icon: "view_quilt",
    children: [
      { to: "/dashboard/templates", label: "All Templates" },
      { to: "/dashboard/templates?view=favorites", label: "Favorites" },
      { to: "/dashboard/templates?view=categories", label: "Categories" },
    ],
  },
  {
    to: "/dashboard/ai-tools",
    label: "AI Tools",
    icon: "auto_awesome",
    children: [
      { to: "/dashboard/ai-tools", label: "All Tools" },
      { to: "/dashboard/ai-tools?view=video", label: "Video Tools" },
      { to: "/dashboard/ai-tools?view=photo", label: "Photo Tools" },
      { to: "/dashboard/ai-tools?view=audio", label: "Audio Tools" },
    ],
  },
  { to: "/dashboard/recycle-bin", label: "Recycle Bin", icon: "delete" },
];

const WORKSPACE_NAV: NavItemConfig[] = [
  { to: "/dashboard/projects", label: "Projects", icon: "folder" },
  { to: "/dashboard/team", label: "Team", icon: "group" },
  { to: "/dashboard/reviews", label: "Reviews", icon: "rate_review", badge: 5 },
  { to: "/dashboard/shared-assets", label: "Shared Assets", icon: "share" },
  { to: "/dashboard/brand-kits", label: "Brand Kits", icon: "palette" },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */

function isChildActive(childTo: string, pathname: string, search: string): boolean {
  const [path, query] = childTo.split("?");
  if (pathname !== path) return false;
  if (!query) return search === "" || search === "?";
  const expected = new URLSearchParams(query);
  const actual = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of expected) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

function isParentActive(item: NavItemConfig, pathname: string, search: string): boolean {
  if (item.children) {
    return item.children.some((child) => isChildActive(child.to, pathname, search));
  }
  return pathname === item.to;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

const baseItemClass =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm transition-colors";

function SimpleNavItem({ item }: { item: NavItemConfig }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `${baseItemClass} ${
          isActive
            ? "bg-surface-container-high text-on-surface"
            : "text-on-surface-variant hover:text-on-surface"
        }`
      }
    >
      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-label-sm text-primary">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function ExpandableNavItem({ item }: { item: NavItemConfig }) {
  const location = useLocation();
  const search = location.search;
  const isActive = isParentActive(item, location.pathname, search);
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  return (
    <div>
      {/* Row: link + chevron */}
      <div
        className={`flex items-center rounded-xl transition-colors ${
          isActive ? "bg-surface-container-high" : ""
        }`}
      >
        <Link
          to={item.to}
          className={`flex flex-1 items-center gap-3 px-3 py-2.5 text-body-sm transition-colors ${
            isActive
              ? "text-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
        >
          <span
            className="material-symbols-outlined text-[16px] transition-transform duration-200"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            chevron_right
          </span>
        </button>
      </div>

      {/* Collapsible children */}
      <AnimatePresence initial={false}>
        {expanded && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-9 flex flex-col gap-0.5 py-1">
              {item.children.map((child) => {
                const active = isChildActive(child.to, location.pathname, search);
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    className={`rounded-lg px-3 py-1.5 text-label-md transition-colors ${
                      active
                        ? "bg-surface-container-high font-medium text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    }`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Exported sidebar ───────────────────────────────────────────────────── */

export function SidebarNav() {
  return (
    <>
      {/* Main navigation */}
      <nav className="flex flex-col gap-0.5">
        {MAIN_NAV.map((item) =>
          item.children ? (
            <ExpandableNavItem key={item.to} item={item} />
          ) : (
            <SimpleNavItem key={item.to} item={item} />
          ),
        )}
      </nav>

      {/* Workspace section */}
      <div className="mt-8">
        <h3 className="mb-3 px-3 text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
          Workspace
        </h3>
        <nav className="flex flex-col gap-0.5">
          {WORKSPACE_NAV.map((item) => (
            <SimpleNavItem key={item.to} item={item} />
          ))}
        </nav>
      </div>
    </>
  );
}
