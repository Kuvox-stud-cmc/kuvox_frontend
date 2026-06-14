import { useState } from "react";
import { Form, Link, NavLink, Outlet, useFetcher } from "react-router";

import { WorkspaceSwitcher } from "~/components/dashboard/workspace-switcher";
import type { StudioDto } from "~/lib/api";
import { listMyStudios, resendVerificationRequest } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/layout";

const NAV = [
  { to: "/dashboard", label: "Home", icon: "home", end: true },
  { to: "/dashboard/projects", label: "Projects", icon: "movie" },
  { to: "/dashboard/media", label: "Media", icon: "perm_media" },
  { to: "/dashboard/shared", label: "Shared with me", icon: "group" },
  { to: "/dashboard/trash", label: "Trash", icon: "delete" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // The switcher is best-effort: a studios lookup failure must not break the dashboard.
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

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { resent: false, error: "Not authenticated." };
  }

  try {
    await resendVerificationRequest(accessToken);
    return { resent: true, error: null };
  } catch {
    return { resent: false, error: "Failed to resend. Try again later." };
  }
}

/** Authenticated app shell with a sidebar for the dashboard section. */
export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { user, studios } = loaderData;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const fetcher = useFetcher<typeof action>();

  const showBanner =
    !bannerDismissed && user.emailVerified === false;
  const resent = fetcher.data?.resent === true;

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="flex w-60 flex-col border-r border-outline-variant bg-surface-container-lowest p-4">
        <Link to="/" className="flex">
          <img src="/logo.svg" alt="Kuvox" className="h-7" />
        </Link>
        <nav className="mt-6 flex flex-col gap-1 text-body-sm">
          {NAV.map((item) => (
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

        {/* Workspace + display-name section */}
        <div className="mt-auto border-t border-outline-variant pt-4">
          <WorkspaceSwitcher studios={studios} active={{ kind: "personal" }} />

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
        {showBanner && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container px-4 py-3">
            <span className="material-symbols-outlined text-[20px] text-primary">mail</span>
            <p className="flex-1 text-body-sm text-on-surface-variant">
              Please verify your email address.{" "}
              {resent ? (
                <span className="font-medium text-primary">Verification email sent!</span>
              ) : (
                <fetcher.Form method="post" className="inline">
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting"}
                    className="font-medium text-primary hover:underline disabled:opacity-60"
                  >
                    {fetcher.state === "submitting"
                      ? "Sending…"
                      : "Resend verification email"}
                  </button>
                </fetcher.Form>
              )}
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

