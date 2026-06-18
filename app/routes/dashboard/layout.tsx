import { Link, Outlet } from "react-router";

import { WorkspaceSwitcher } from "~/components/dashboard/workspace-switcher";
import { HeaderBar } from "~/routes/dashboard/header-bar";
import { SidebarNav } from "~/routes/dashboard/sidebar-nav";
import type { StudioDto } from "~/lib/api";
import { listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // The studios list is kept for future workspace-switcher integration.
  let studios: StudioDto[] = [];
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (accessToken) {
    try {
      studios = await listMyStudios(accessToken);
    } catch {
      studios = [];
    }
  }

  return { user, studios };
}

/** Authenticated app shell with a premium sidebar, top header bar, and scrollable main area. */
export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { user, studios } = loaderData;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-outline-variant/50 bg-surface-container-lowest">
        {/* Scrollable nav content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Logo */}
          <Link to="/" className="mb-5 flex">
            <img src="/logo.svg" alt="Kuvox" className="h-7" />
          </Link>

          <WorkspaceSwitcher studios={studios} active={{ kind: "personal" }} direction="down" />

          {/* New Project CTA */}
          <Link
            to="/dashboard/projects?create=1"
            className="mb-6 mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-fixed"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Project
          </Link>

          {/* Navigation (main + workspace) */}
          <SidebarNav />
        </div>

        {/* ── Storage section (pinned to bottom) ──────────────────────────── */}
        <div className="border-t border-outline-variant/50 p-5">
          <div className="mb-2 flex items-center gap-2 text-label-md font-medium text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">cloud</span>
            Storage
          </div>
          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: "12.8%" }}
            />
          </div>
          <div className="mb-3 flex justify-between text-label-sm text-on-surface-variant">
            <span>128 GB of 1 TB used</span>
            <span>12.8%</span>
          </div>
          <Link
            to="/pricing"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            Upgrade Plan
          </Link>
        </div>
      </aside>

      {/* ── Main area (header + content) ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar user={user} />
        <main className="flex-1 overflow-y-auto px-10 pb-10 pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

