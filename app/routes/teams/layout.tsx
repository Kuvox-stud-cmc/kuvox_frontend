import { useCallback, useState } from "react";
import { Link, NavLink, Outlet, redirect } from "react-router";

import { WorkspaceSwitcher } from "~/components/dashboard/workspace-switcher";
import { ErrorBanner } from "~/components/dashboard/section";
import { HeaderBar } from "~/routes/dashboard/header-bar";
import { studioRoleLabel, type StudioDto } from "~/lib/api";
import { getStudioClaims, listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/layout";

const DEFAULT_SIDEBAR_WIDTH = 256;
const COLLAPSED_SIDEBAR_WIDTH = 72;

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, { id: user.id });
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  if (!accessToken) {
    throw redirect("/login");
  }

  // Membership is the source of truth (DB-backed); non-members are bounced to Personal.
  const studios = await listMyStudios(accessToken, reqLog);
  const studio = studios.find((s) => s.id === studioId);
  if (!studio) {
    throw redirect("/dashboard");
  }

  // Studio-scoped project/media requests are authorized off the JWT studio claim — a team
  // joined since the token was minted needs a refresh before its content loads.
  const tokenHasClaim = getStudioClaims(accessToken).some((c) => c.studioId === studioId);

  return { user, studios, studio, role: studio.role, tokenStale: !tokenHasClaim };
}

interface StudioNavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface StudioNavSection {
  label?: string;
  items: StudioNavItem[];
}

const studioNavSections = (studioId: string): StudioNavSection[] => [
  {
    items: [
      { to: `/teams/${studioId}`, label: "Home", icon: "home", end: true },
      { to: `/teams/${studioId}/projects`, label: "Projects", icon: "folder" },
      { to: `/teams/${studioId}/tasks`, label: "Tasks", icon: "task_alt" },
    ],
  },
  {
    label: "Media Library",
    items: [
      { to: `/teams/${studioId}/media/videos`, label: "Videos", icon: "videocam" },
      { to: `/teams/${studioId}/media/photos`, label: "Photos", icon: "photo_library" },
      { to: `/teams/${studioId}/media/audio`, label: "Audio", icon: "music_note" },
      { to: `/teams/${studioId}/media/albums`, label: "Albums", icon: "collections" },
    ],
  },
  {
    items: [
      { to: `/teams/${studioId}/renders`, label: "Renders", icon: "blur_medium" },
      { to: `/teams/${studioId}/usage`, label: "Usage & Quotas", icon: "donut_large" },
    ],
  },
  {
    label: "Team & Access",
    items: [
      { to: `/teams/${studioId}/members`, label: "Members", icon: "group" },
      { to: `/teams/${studioId}/roles`, label: "Roles", icon: "admin_panel_settings" },
      { to: `/teams/${studioId}/permissions`, label: "Permissions", icon: "lock" },
      { to: `/teams/${studioId}/invitations`, label: "Invitations", icon: "mail" },
      { to: `/teams/${studioId}/audit-log`, label: "Audit Log", icon: "fact_check" },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: `/teams/${studioId}/settings/workspace`, label: "Workspace Settings", icon: "settings" },
      { to: `/teams/${studioId}/settings/profile`, label: "Profile Settings", icon: "badge" },
      { to: `/teams/${studioId}/settings/notifications`, label: "Notifications", icon: "notifications" },
      { to: `/teams/${studioId}/settings/storage`, label: "Storage", icon: "storage" },
    ],
  },
];

/** Team (Studio) workspace shell — mirrors the dashboard shell, scoped to one studio. */
export default function TeamLayout({ loaderData }: Route.ComponentProps) {
  const { user, studios, studio, role, tokenStale } = loaderData;
  const studioList: StudioDto[] = studios;
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside
        className="flex flex-shrink-0 flex-col bg-surface-container-lowest transition-[width] duration-300 ease-in-out"
        style={{ width: collapsed ? COLLAPSED_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH }}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
          <div className={`mb-5 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            <Link to="/" className="flex shrink-0">
              {collapsed ? (
                <img src="/logo.svg" alt="Kuvox" className="h-7 w-7 object-contain" />
              ) : (
                <img src="/logo.svg" alt="Kuvox" className="h-7" />
              )}
            </Link>
            {!collapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                aria-label="Collapse sidebar"
              >
                <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
              </button>
            )}
          </div>

          {!collapsed && (
            <WorkspaceSwitcher
              studios={studioList}
              active={{ kind: "studio", studioId: studio.id }}
            />
          )}

          <Link
            to={`/teams/${studio.id}/projects?create=1`}
            className={`mt-4 flex items-center justify-center rounded-xl bg-primary font-medium text-on-primary transition-colors hover:bg-primary-fixed ${
              collapsed
                ? "mb-4 h-10 w-10 mx-auto p-0"
                : "mb-6 w-full gap-2 px-4 py-2.5 text-body-sm"
            }`}
            title={collapsed ? "New Project" : undefined}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {!collapsed && "New Project"}
          </Link>

          <nav className="flex flex-col gap-5 text-body-sm">
            {studioNavSections(studio.id).map((section, sectionIndex) => (
              <div key={section.label ?? sectionIndex}>
                {section.label && !collapsed && (
                  <h3 className="mb-3 px-3 text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
                    {section.label}
                  </h3>
                )}
                {section.label && collapsed && (
                  <div className="mx-auto mb-3 h-px w-6 bg-outline-variant/50" />
                )}
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `${
                          collapsed
                            ? "mx-auto flex h-10 w-10 items-center justify-center rounded-xl"
                            : "flex items-center gap-3 rounded-xl px-3 py-2.5"
                        } transition-colors ${
                          isActive
                            ? "bg-surface-container-high text-on-surface"
                            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                        }`
                      }
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-outline-variant/50 p-5">
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              aria-label="Expand sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">left_panel_open</span>
            </button>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 text-label-md font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]">cloud</span>
                Studio Storage
              </div>
              <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full w-[12.8%] rounded-full bg-primary transition-all" />
              </div>
              <div className="mb-3 flex justify-between text-label-sm text-on-surface-variant">
                <span>128 GB of 1 TB used</span>
                <span>12.8%</span>
              </div>
            </>
          )}
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar user={user} />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6 md:px-10 md:pb-10 md:pt-8">
          {tokenStale && (
            <ErrorBanner message="You were recently added to this team. Log out and back in to load its projects and media." />
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
