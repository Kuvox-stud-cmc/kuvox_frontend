import { Link, NavLink } from "react-router";
import { useState } from "react";

/* ── Plain nav items ─────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { to: "/#features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/enterprise", label: "Enterprise" },
];

const NAV_TRAILING = [{ to: "/about", label: "About" }];

/* ── Dropdown definitions ────────────────────────────────────────────────── */
const HELP_GROUPS = [
  {
    title: "Documentation",
    items: [
      { to: "/help/getting-started", label: "Getting Started", icon: "rocket_launch" },
      { to: "/help/upload-processing", label: "Upload & Processing", icon: "cloud_upload" },
      { to: "/help/editing-guide", label: "Editing Guide", icon: "movie_edit" },
      { to: "/help/rendering-export", label: "Rendering & Export", icon: "movie_filter" },
    ],
  },
  {
    title: "AI Features",
    items: [
      { to: "/help/ai-agent-guide", label: "AI Agent Guide", icon: "smart_toy" },
    ],
  },
  {
    title: "Support",
    items: [
      { to: "/help/faq", label: "FAQ", icon: "help" },
      { to: "/help/contact-support", label: "Contact Support", icon: "support_agent" },
      { to: "/help/report-issue", label: "Report Issue", icon: "bug_report" },
    ],
  },
];

const COMMUNITY_GROUPS = [
  {
    title: "Discussions",
    items: [
      { to: "/community/forums#discussion-forum", label: "Discussion Forum", icon: "forum" },
      { to: "/community/forums#popular-discussions", label: "Popular Discussions", icon: "chat_bubble" },
    ],
  },
  {
    title: "Showcase",
    items: [
      { to: "/community/showcase", label: "Showcase & Inspiration", icon: "palette" },
      { to: "/community/showcase?filter=featured", label: "Featured Projects", icon: "photo_library" },
    ],
  },
  {
    title: "Learning",
    items: [
      { to: "/community/learn", label: "Learning & Tutorials", icon: "school" },
    ],
  },
  {
    title: "Updates",
    items: [
      { to: "/community/news", label: "News & Announcements", icon: "newspaper" },
    ],
  },
];

/* ── Desktop Hover Dropdown ──────────────────────────────────────────────── */
function NavDropdown({
  label,
  groups,
}: {
  label: string;
  groups: { title?: string; items: { to: string; label: string; icon: string }[] }[];
}) {
  return (
    <div className="relative group/dd">
      {/* Trigger */}
      <button className="text-label-md font-medium text-on-surface-variant group-hover/dd:text-primary transition-colors duration-300 flex items-center gap-0.5 py-4">
        {label}
        <span className="material-symbols-outlined text-[15px] transition-transform duration-300 ease-out group-hover/dd:rotate-180">
          expand_more
        </span>
      </button>

      {/* Invisible bridge — keeps hover zone continuous */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 h-3 w-[calc(100%+2rem)]" />

      {/* Dropdown panel */}
      <div
        className="
          absolute top-[calc(100%+0.25rem)] left-1/2 -translate-x-1/2
          min-w-[240px] py-1.5
          bg-surface-container/90 backdrop-blur-xl
          border border-outline-variant/60
          rounded-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_1px_rgba(192,193,255,0.1)]
          opacity-0 invisible scale-[0.97] -translate-y-1
          group-hover/dd:opacity-100 group-hover/dd:visible group-hover/dd:scale-100 group-hover/dd:translate-y-0
          transition-all duration-300 ease-out
          z-50 origin-top
        "
      >
        {groups.map((group, gIdx) => (
          <div key={gIdx} className={gIdx > 0 ? "border-t border-outline-variant/40 mt-1.5 pt-1.5" : ""}>
            {group.title && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                {group.title}
              </div>
            )}
            {group.items.map((item, i) => (
              <Link
                key={item.label + i}
                to={item.to}
                className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/80 transition-all duration-200 group/item"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60 group-hover/item:text-primary transition-colors duration-200">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mobile Expandable Section ───────────────────────────────────────────── */
function MobileDropdown({
  label,
  groups,
  onNavigate,
}: {
  label: string;
  groups: { title?: string; items: { to: string; label: string; icon: string }[] }[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
  const totalTitles = groups.filter((g) => g.title).length;
  const contentHeight = totalItems * 48 + totalTitles * 32 + 32;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-body-lg font-medium py-3 px-4 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200"
      >
        {label}
        <span
          className={`material-symbols-outlined text-[20px] transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? `${contentHeight}px` : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="ml-4 mt-1 mb-2 flex flex-col gap-0.5 border-l border-outline-variant/40 pl-2">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className={gIdx > 0 ? "mt-2" : ""}>
              {group.title && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                  {group.title}
                </div>
              )}
              {group.items.map((item, i) => (
                <Link
                  key={item.label + i}
                  to={item.to}
                  onClick={onNavigate}
                  className="flex items-center gap-3 text-body-sm font-medium py-2.5 px-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

/** Top navigation shared across the public marketing pages. */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="bg-surface/80 backdrop-blur-lg border-b border-outline-variant/60 flex justify-between items-center h-14 sm:h-16 px-4 sm:px-6 lg:px-container-padding max-w-full w-full z-50 fixed top-0 left-0 right-0">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            to="/"
            className="text-headline-md font-bold tracking-tight text-on-surface shrink-0"
          >
            <img src="/logo.svg" alt="Kuvox" className="h-6 sm:h-7" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex gap-3 lg:gap-5 items-center">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-label-md font-medium transition-colors duration-300 ${isActive
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <NavDropdown label="Help Center" groups={HELP_GROUPS} />
            <NavDropdown label="Community" groups={COMMUNITY_GROUPS} />

            {NAV_TRAILING.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-label-md font-medium transition-colors duration-300 ${isActive
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Right: Auth + Mobile Toggle */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/login"
            className="text-on-surface-variant font-medium hover:text-primary transition-colors duration-300 text-label-md hidden lg:block"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="bg-primary text-on-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-sm font-medium text-label-md hover:bg-primary-fixed transition-colors duration-300 hidden sm:inline-flex"
          >
            Get Started
          </Link>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container-high transition-colors duration-200"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-on-surface text-[22px]">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu Overlay ──────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 top-14 z-40 bg-surface/95 backdrop-blur-xl lg:hidden overflow-y-auto transition-all duration-300 ease-out ${mobileOpen
            ? "opacity-100 visible"
            : "opacity-0 invisible pointer-events-none"
          }`}
      >
        <div className="flex flex-col px-6 py-6 gap-1">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `text-body-lg font-medium py-3 px-4 rounded-lg transition-colors duration-200 ${isActive
                  ? "text-primary bg-surface-container-high"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <MobileDropdown
            label="Help Center"
            groups={HELP_GROUPS}
            onNavigate={() => setMobileOpen(false)}
          />
          <MobileDropdown
            label="Community"
            groups={COMMUNITY_GROUPS}
            onNavigate={() => setMobileOpen(false)}
          />

          {NAV_TRAILING.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `text-body-lg font-medium py-3 px-4 rounded-lg transition-colors duration-200 ${isActive
                  ? "text-primary bg-surface-container-high"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <hr className="border-outline-variant/40 my-3" />

          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="text-body-lg font-medium py-3 px-4 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-200"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            onClick={() => setMobileOpen(false)}
            className="bg-primary text-on-primary py-3 px-4 rounded-lg text-body-lg font-medium text-center hover:bg-primary-fixed transition-colors duration-300 mt-1"
          >
            Get Started
          </Link>
        </div>
      </div>
    </>
  );
}
