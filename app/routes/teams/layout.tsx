import { Form, Link, NavLink, Outlet, redirect } from "react-router";

import { WorkspaceSwitcher } from "~/components/dashboard/workspace-switcher";
import { ErrorBanner } from "~/components/dashboard/section";
import { studioRoleLabel, type StudioDto } from "~/lib/api";
import { getStudioClaims, listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/layout";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  if (!accessToken) {
    throw redirect("/login");
  }

  // Membership is the source of truth (DB-backed); non-members are bounced to Personal.
  const studios = await listMyStudios(accessToken);
  const studio = studios.find((s) => s.id === studioId);
  if (!studio) {
    throw redirect("/dashboard");
  }

  // Studio-scoped project/media requests are authorized off the JWT studio claim — a team
  // joined since the token was minted needs a refresh before its content loads.
  const tokenHasClaim = getStudioClaims(accessToken).some((c) => c.studioId === studioId);

  return { user, studios, studio, role: studio.role, tokenStale: !tokenHasClaim };
}

const teamNav = (studioId: string) => [
  { to: `/teams/${studioId}`, label: "Home", icon: "home", end: true },
  { to: `/teams/${studioId}/projects`, label: "Projects", icon: "movie" },
  { to: `/teams/${studioId}/media`, label: "Media", icon: "perm_media" },
  { to: `/teams/${studioId}/members`, label: "Members", icon: "group" },
  { to: `/teams/${studioId}/settings`, label: "Settings", icon: "settings" },
  { to: `/teams/${studioId}/trash`, label: "Trash", icon: "delete" },
];

/** Team (Studio) workspace shell — mirrors the dashboard shell, scoped to one studio. */
export default function TeamLayout({ loaderData }: Route.ComponentProps) {
  const { user, studios, studio, role, tokenStale } = loaderData;
  const studioList: StudioDto[] = studios;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="flex w-60 flex-col border-r border-outline-variant bg-surface-container-lowest p-4">
        <Link to="/" className="flex">
          <img src="/logo.svg" alt="Kuvox" className="h-7" />
        </Link>

        <div className="mt-6 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2">
          <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
          <div className="min-w-0">
            <div className="truncate text-body-sm font-medium text-on-surface">{studio.name}</div>
            <div className="text-label-sm uppercase tracking-wide text-on-surface-variant">
              {studioRoleLabel(role)}
            </div>
          </div>
        </div>

        <nav className="mt-4 flex flex-col gap-1 text-body-sm">
          {teamNav(studio.id).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? "bg-surface-container-high text-on-surface"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-outline-variant pt-4">
          <WorkspaceSwitcher studios={studioList} active={{ kind: "studio", studioId: studio.id }} />

          <div className="mt-3 px-3 text-body-sm font-medium text-on-surface">
            {user.displayName}
          </div>
          <div className="px-3 text-label-md text-on-surface-variant">{user.plan} plan</div>
          <Form method="post" action="/logout" className="mt-2">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              Log out
            </button>
          </Form>
        </div>
      </aside>
      <main className="flex-1 p-8">
        {tokenStale && (
          <ErrorBanner message="You were recently added to this team. Log out and back in to load its projects and media." />
        )}
        <Outlet />
      </main>
    </div>
  );
}
