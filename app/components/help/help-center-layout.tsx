import { Outlet, useLocation, Link, NavLink } from "react-router";

const SIDEBAR_LINKS = [
  { to: "/help/getting-started", label: "Getting Started", icon: "rocket_launch" },
  { to: "/help/upload-processing", label: "Upload & Processing", icon: "cloud_upload" },
  { to: "/help/editing-guide", label: "Editing Guide", icon: "movie_edit" },
  { to: "/help/ai-agent-guide", label: "AI Agent Guide", icon: "psychology" },
  { to: "/help/rendering-export", label: "Rendering & Export", icon: "export_notes" },
  { to: "/help/faq", label: "FAQ", icon: "help" },
  { to: "/help/report-issue", label: "Report Issue", icon: "bug_report" },
] as const;

/** Pages that bypass the sidebar layout and render their own full-width layout. */
const BYPASS_PATHS = ["/help", "/help/", "/help/report-issue", "/help/contact-support"];

export default function HelpCenterLayout() {
  const location = useLocation();
  const shouldBypass = BYPASS_PATHS.some(
    (p) => location.pathname === p || location.pathname === p + "/"
  );

  if (shouldBypass) {
    return <Outlet />;
  }

  const activeLink = SIDEBAR_LINKS.find(link => location.pathname.startsWith(link.to)) || SIDEBAR_LINKS[0];

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-body-sm text-on-surface-variant animate-fade-in-up">
        <Link to="/help" className="hover:text-primary transition-colors">Help Center</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-on-surface font-medium">{activeLink.label}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="lg:w-64 shrink-0 animate-fade-in-up">
          <nav className="lg:sticky lg:top-24 space-y-1">
            {SIDEBAR_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={false}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm transition-colors duration-200 ${
                    isActive
                      ? "bg-primary-container/20 text-primary font-medium"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`
                }
              >
                <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ── Main content (Article + Right rail) ──────────────────────── */}
        <Outlet />
      </div>
    </div>
  );
}
