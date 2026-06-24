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

/**
 * Build the main navigation array scoped to a specific studio.
 * Every `to` is an absolute path under `/teams/:studioId/…`.
 */
const buildMainNav = (studioId: string): NavItemConfig[] => [
  {
    to: `/teams/${studioId}`,
    label: "Overview",
    icon: "dashboard",
    end: true,
    children: [
      { to: `/teams/${studioId}?section=recent-projects`, label: "Recent Projects" },
      { to: `/teams/${studioId}?section=recent-activity`, label: "Recent Activity" },
      { to: `/teams/${studioId}?section=assigned`, label: "Assigned to Me" },
      { to: `/teams/${studioId}?section=pending-review`, label: "Pending Review" },
      { to: `/teams/${studioId}?section=storage`, label: "Storage" },
      { to: `/teams/${studioId}?section=online`, label: "Team Members Online" },
    ],
  },
  {
    to: `/teams/${studioId}/projects`,
    label: "Projects",
    icon: "folder",
    children: [
      { to: `/teams/${studioId}/projects?view=active`, label: "Active" },
      { to: `/teams/${studioId}/projects?view=draft`, label: "Draft" },
      { to: `/teams/${studioId}/projects?view=archived`, label: "Archived" },
    ],
  },
  {
    to: `/teams/${studioId}/assets`,
    label: "Assets",
    icon: "perm_media",
    children: [
      { to: `/teams/${studioId}/assets?view=photos`, label: "Photos" },
      { to: `/teams/${studioId}/assets?view=videos`, label: "Videos" },
      { to: `/teams/${studioId}/assets?view=audio`, label: "Audio" },
      { to: `/teams/${studioId}/assets?view=templates`, label: "Templates" },
    ],
  },
  {
    to: `/teams/${studioId}/collaborate`,
    label: "Collaborate",
    icon: "group",
    children: [
      { to: `/teams/${studioId}/collaborate?view=team`, label: "Team Members" },
      { to: `/teams/${studioId}/collaborate?view=shared`, label: "Shared Assets" },
      { to: `/teams/${studioId}/collaborate?view=comments`, label: "Comments" },
      { to: `/teams/${studioId}/collaborate?view=mentions`, label: "Mentions" },
    ],
  },
  {
    to: `/teams/${studioId}/review`,
    label: "Review",
    icon: "rate_review",
    badge: 3,
    children: [
      { to: `/teams/${studioId}/review?view=pending`, label: "Pending Review" },
      { to: `/teams/${studioId}/review?view=approved`, label: "Approved" },
      { to: `/teams/${studioId}/review?view=rejected`, label: "Rejected" },
    ],
  },
  {
    to: `/teams/${studioId}/production`,
    label: "Production",
    icon: "movie",
    children: [
      { to: `/teams/${studioId}/production?view=tasks`, label: "Tasks" },
      { to: `/teams/${studioId}/production?view=timeline`, label: "Timeline" },
      { to: `/teams/${studioId}/production?view=versions`, label: "Versions" },
    ],
  },
  {
    to: `/teams/${studioId}/ai-tools`,
    label: "AI Tools",
    icon: "auto_awesome",
    children: [
      { to: `/teams/${studioId}/ai-tools?view=video`, label: "Video" },
      { to: `/teams/${studioId}/ai-tools?view=photo`, label: "Photo" },
      { to: `/teams/${studioId}/ai-tools?view=audio`, label: "Audio" },
      { to: `/teams/${studioId}/ai-tools?view=generate`, label: "Generate Assets" },
      { to: `/teams/${studioId}/ai-tools?view=bg-removal`, label: "Background Removal" },
      { to: `/teams/${studioId}/ai-tools?view=subtitle`, label: "Auto Subtitle" },
      { to: `/teams/${studioId}/ai-tools?view=voice-clone`, label: "Voice Clone" },
    ],
  },
  {
    to: `/teams/${studioId}/brand-kits`,
    label: "Brand Kits",
    icon: "palette",
    children: [
      { to: `/teams/${studioId}/brand-kits?view=logos`, label: "Logos" },
      { to: `/teams/${studioId}/brand-kits?view=fonts`, label: "Fonts" },
      { to: `/teams/${studioId}/brand-kits?view=colors`, label: "Colors" },
      { to: `/teams/${studioId}/brand-kits?view=intro-outro`, label: "Intro/Outro" },
      { to: `/teams/${studioId}/brand-kits?view=social`, label: "Social Templates" },
    ],
  },
  { to: `/teams/${studioId}/settings`, label: "Settings", icon: "settings" },
  { to: `/teams/${studioId}/recycle-bin`, label: "Recycle Bin", icon: "delete" },
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

const collapsedItemClass =
  "flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-colors";

function SimpleNavItem({
  item,
  collapsed,
}: {
  item: NavItemConfig;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <NavLink
        to={item.to}
        end={item.end}
        title={item.label}
        className={({ isActive }) =>
          `${collapsedItemClass} ${
            isActive
              ? "bg-surface-container-high text-on-surface"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`
        }
      >
        <span className="relative">
          <span className="material-symbols-outlined text-[20px]">
            {item.icon}
          </span>
          {item.badge != null && (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-on-primary">
              {item.badge}
            </span>
          )}
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `${baseItemClass} ${isActive
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

function ExpandableNavItem({
  item,
  collapsed,
}: {
  item: NavItemConfig;
  collapsed: boolean;
}) {
  const location = useLocation();
  const search = location.search;
  const isActive = isParentActive(item, location.pathname, search);
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  // When collapsed, render as a simple icon link (no children visible)
  if (collapsed) {
    return (
      <NavLink
        to={item.to}
        title={item.label}
        className={`${collapsedItemClass} ${
          isActive
            ? "bg-surface-container-high text-on-surface"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
        }`}
      >
        <span className="relative">
          <span className="material-symbols-outlined text-[20px]">
            {item.icon}
          </span>
          {item.badge != null && (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-on-primary">
              {item.badge}
            </span>
          )}
        </span>
      </NavLink>
    );
  }

  return (
    <div>
      {/* Row: link + chevron */}
      <div
        className={`flex items-center rounded-xl transition-colors ${isActive ? "bg-surface-container-high" : ""
          }`}
      >
        <Link
          to={item.to}
          className={`flex flex-1 items-center gap-3 px-3 py-2.5 text-body-sm transition-colors ${isActive
              ? "text-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
            }`}
        >
          <span className="relative">
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.badge != null && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-on-primary">
                {item.badge}
              </span>
            )}
          </span>
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
                    className={`rounded-lg px-3 py-1.5 text-label-md transition-colors ${active
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

export function TeamSidebarNav({
  studioId,
  collapsed = false,
}: {
  studioId: string;
  collapsed?: boolean;
}) {
  const navItems = buildMainNav(studioId);

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map((item) =>
        item.children ? (
          <ExpandableNavItem
            key={item.to}
            item={item}
            collapsed={collapsed}
          />
        ) : (
          <SimpleNavItem
            key={item.to}
            item={item}
            collapsed={collapsed}
          />
        ),
      )}
    </nav>
  );
}
