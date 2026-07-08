import { Link, NavLink } from "react-router";
import { useState, useEffect } from "react";
import type { SessionUser } from "~/lib/session.server";
import { cn } from "~/lib/utils";

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
    <div className="relative group/dd h-full flex items-center">
      {/* Trigger */}
      <button className="px-2 xl:px-4 py-2 text-sm font-medium text-white/70 group-hover/dd:text-white transition-colors duration-300 flex items-center gap-0.5 whitespace-nowrap">
        {label}
        <span className="material-symbols-outlined text-[15px] transition-transform duration-300 ease-out group-hover/dd:rotate-180">
          expand_more
        </span>
      </button>

      {/* Invisible bridge — keeps hover zone continuous */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 h-4 w-[calc(100%+2rem)]" />

      {/* Dropdown panel */}
      <div
        className="
          absolute top-[calc(100%+0.25rem)] left-1/2 -translate-x-1/2
          p-3
          bg-[#1a1612]/95 backdrop-blur-xl
          border border-white/10
          rounded-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
          opacity-0 invisible scale-[0.97] -translate-y-1
          group-hover/dd:opacity-100 group-hover/dd:visible group-hover/dd:scale-100 group-hover/dd:translate-y-0
          transition-all duration-300 ease-out
          z-50 origin-top
          flex gap-6 whitespace-nowrap
        "
      >
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col">
            {group.title && (
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {group.title}
              </div>
            )}
            {group.items.map((item, i) => (
              <Link
                key={item.label + i}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200 group/item"
              >
                <span className="material-symbols-outlined text-[18px] text-white/50 group-hover/item:text-white transition-colors duration-200">
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
        className="w-full flex items-center justify-between text-base font-medium py-3 px-4 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200"
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
        <div className="ml-4 mt-1 mb-2 flex flex-col gap-0.5 border-l border-white/20 pl-2">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className={gIdx > 0 ? "mt-2" : ""}>
              {group.title && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {group.title}
                </div>
              )}
              {group.items.map((item, i) => (
                <Link
                  key={item.label + i}
                  to={item.to}
                  onClick={onNavigate}
                  className="flex items-center gap-3 text-sm font-medium py-2.5 px-3 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200"
                >
                  <span className="material-symbols-outlined text-[18px] text-white/40">
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

function getInitials(user: SessionUser | null): string {
  const source = user?.displayName?.trim() || user?.email?.trim() || "";
  if (!source) return "U";
  const words = source.includes("@")
    ? [source.slice(0, 1)]
    : source.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "U";
}

/* ── Header ──────────────────────────────────────────────────────────────── */
export function SiteHeader({ user = null }: { user?: SessionUser | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signedIn = Boolean(user);
  const initials = getInitials(user);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 max-w-[calc(100vw-2rem)]",
          scrolled ? "top-4" : "top-6"
        )}
      >
        <div 
          className="flex items-center gap-2 px-4 sm:px-6 h-14"
          style={{
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            background: "rgba(12, 10, 8, 0.58)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "999px",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
          }}
        >
          {/* Logo */}
          <Link to="/" className="px-3 py-1 flex items-center gap-2 shrink-0">
            <img src="/logo.svg" alt="Kuvox" className="h-5 sm:h-6" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-2 xl:px-4 py-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${isActive
                    ? "text-white"
                    : "text-white/70 hover:text-white"
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
                  `px-2 xl:px-4 py-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${isActive
                    ? "text-white"
                    : "text-white/70 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right: Auth + Mobile Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {signedIn ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="ml-2 px-5 h-9 sm:h-10 flex items-center justify-center bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors duration-200 whitespace-nowrap leading-none shrink-0"
                >
                  Go to dashboard
                </Link>
                <Link
                  to="/dashboard"
                  aria-label="Go to dashboard"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3530] text-sm font-bold text-white transition-colors hover:bg-[#4a4540] border border-white/10"
                  title={user?.displayName ?? user?.email ?? "Account"}
                >
                  {initials}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  to="/login"
                  className="hidden sm:flex px-3 xl:px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200 whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="ml-1 px-5 h-9 sm:h-10 flex items-center justify-center bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors duration-200 whitespace-nowrap leading-none shrink-0"
                >
                  Get Started
                </Link>
              </div>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white/70 hover:text-white rounded-full hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full mt-3 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm flex flex-col gap-1 p-4 shadow-2xl"
            style={{
              backdropFilter: "blur(30px)",
              WebkitBackdropFilter: "blur(30px)",
              background: "rgba(20, 18, 16, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
            }}
          >
            <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `text-base font-medium py-3 px-4 rounded-lg transition-colors duration-200 ${isActive
                      ? "text-white bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <MobileDropdown
                label="Help Center"
                groups={HELP_GROUPS}
                onNavigate={() => setMobileMenuOpen(false)}
              />
              <MobileDropdown
                label="Community"
                groups={COMMUNITY_GROUPS}
                onNavigate={() => setMobileMenuOpen(false)}
              />

              {NAV_TRAILING.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `text-base font-medium py-3 px-4 rounded-lg transition-colors duration-200 ${isActive
                      ? "text-white bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <hr className="border-white/10 my-3 mx-2" />

              {signedIn ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Go to dashboard"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3a3530] text-sm font-bold text-white transition-colors hover:bg-[#4a4540] border border-white/10"
                    title={user?.displayName ?? user?.email ?? "Account"}
                  >
                    {initials}
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 rounded-lg bg-white px-4 py-3 text-center text-base font-medium text-black transition-colors duration-300 hover:bg-white/90"
                  >
                    Go to dashboard
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base text-center font-medium py-3 px-4 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-white text-black py-3 px-4 rounded-lg text-base font-medium text-center hover:bg-white/90 transition-colors duration-300"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
      {/* Spacer style for non-absolute context usage in marketing-layout */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}</style>
    </>
  );
}
