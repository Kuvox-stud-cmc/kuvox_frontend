import { useState } from "react";
import { Form, Link } from "react-router";

import { SearchDropdown } from "~/components/dashboard/search-dropdown";

interface HeaderBarProps {
  user: {
    email?: string;
    displayName: string;
    plan: string;
  };
  /** When provided, renders a hamburger menu button (mobile). */
  onMenuToggle?: () => void;
}

export function HeaderBar({ user, onMenuToggle }: HeaderBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = getInitials(user);

  return (
    <header className="flex h-14 sm:h-16 flex-shrink-0 items-center justify-between border-b border-outline-variant/50 px-4 sm:px-6 md:px-10">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Hamburger (mobile only) */}
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface md:hidden"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        )}

        {/* ── Search Dropdown ─────────────────────────────────────────────── */}
        <SearchDropdown />
      </div>

      {/* ── Action icons + profile ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 sm:gap-5 ml-3">
        {/* Notifications */}
        <Link
          to="/notifications"
          className="relative text-on-surface-variant transition-colors hover:text-on-surface"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
            3
          </span>
        </Link>

        {/* Help — hidden on small mobile */}
        <Link
          to="/help"
          className="hidden sm:block text-on-surface-variant transition-colors hover:text-on-surface"
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </Link>

        {/* Settings — hidden on small mobile */}
        <Link
          to="/settings"
          className="hidden sm:block text-on-surface-variant transition-colors hover:text-on-surface"
          aria-label="Settings"
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
        </Link>

        {/* Profile avatar + dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-body-sm font-bold text-on-primary-container transition-colors hover:bg-primary-container/80"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Profile menu"
          >
            {initials}
          </button>

          {profileOpen && (
            <>
              {/* Backdrop */}
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close profile menu"
              />
              {/* Dropdown */}
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-xl"
              >
                <div className="border-b border-outline-variant px-4 py-3">
                  <p className="text-body-sm font-medium text-on-surface">
                    {user.displayName}
                  </p>
                  <p className="text-label-md text-on-surface-variant">{user.plan} plan</p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  Settings
                </Link>
                <Form method="post" action="/logout">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Log out
                  </button>
                </Form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function getInitials(user: { displayName?: string; email?: string }): string {
  const source = user.displayName?.trim() || user.email?.trim() || "";
  if (!source) return "U";
  const words = source.includes("@")
    ? [source.slice(0, 1)]
    : source.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "U";
}
