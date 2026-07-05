import { useCallback, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  return { user };
}

const NAV = [
  { to: "/settings/account", label: "Account", icon: "person" },
  { to: "/settings/billing", label: "Billing", icon: "payments" },
  { to: "/settings/quota", label: "Usage & quotas", icon: "query_stats" },
  { to: "/settings/preferences", label: "Preferences", icon: "tune" },
  { to: "/settings/security", label: "Security", icon: "shield_lock" },
  { to: "/settings/integrations", label: "Integrations", icon: "extension" },
];

/** Settings section shell with a side nav. */
export default function SettingsLayout({ loaderData }: Route.ComponentProps) {
  const user = loaderData.user;
  const navigate = useNavigate();
  const settingsEntryIndex = useRef(getHistoryIndex());
  const handleBack = useCallback(() => {
    const entryIndex = settingsEntryIndex.current;
    const currentIndex = getHistoryIndex();

    if (entryIndex !== null && currentIndex !== null && entryIndex > 0) {
      const delta = entryIndex - 1 - currentIndex;
      if (delta < 0) {
        navigate(delta);
        return;
      }
    }

    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="text-label-md font-semibold uppercase tracking-[0.12em] text-primary">
                Account settings
              </p>
              <p className="truncate text-body-sm text-on-surface-variant">
                Manage profile, preferences, security, and account access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 text-label-md font-semibold text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8 lg:py-8">
        <aside className="lg:sticky lg:top-8 lg:h-fit lg:w-72 lg:shrink-0">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
            <div className="mb-4 border-b border-outline-variant pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <span className="text-body-sm font-bold">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-body-sm font-bold text-on-surface">{user.displayName}</h1>
                  <p className="truncate text-label-md text-on-surface-variant">{user.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-1 text-label-sm font-semibold text-primary">
                  {user.plan}
                </span>
                <span className="rounded-full bg-surface-container-high px-2 py-1 text-label-sm font-semibold text-on-surface-variant">
                  {user.emailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm font-medium transition-colors ${
                      isActive
                        ? "bg-surface-container-high text-on-surface shadow-[inset_3px_0_0_0_var(--color-primary)]"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[19px] text-primary/85">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getHistoryIndex() {
  if (typeof window === "undefined") return null;
  const index = window.history.state?.idx;
  return typeof index === "number" ? index : null;
}
