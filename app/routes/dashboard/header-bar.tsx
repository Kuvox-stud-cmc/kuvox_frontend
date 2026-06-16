import { useEffect, useState } from "react";
import { Form, Link, useNavigate } from "react-router";

interface HeaderBarProps {
  user: {
    displayName: string;
    plan: string;
  };
}

export function HeaderBar({ user }: HeaderBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("/search");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-outline-variant/50 px-10">
      {/* ── Search ──────────────────────────────────────────────────────── */}
      <Link
        to="/search"
        className="relative block w-96"
        aria-label="Search projects, media, and templates"
      >
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
          search
        </span>
        <span
          role="presentation"
          className="block w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-16 text-body-sm text-on-surface-variant/60 transition-colors hover:border-primary/40"
        >
          Search projects, media, templates...
        </span>
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-outline-variant px-1.5 py-0.5 text-label-sm text-on-surface-variant">
          ⌘K
        </kbd>
      </Link>

      {/* ── Action icons + profile ──────────────────────────────────────── */}
      <div className="flex items-center gap-5">
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

        {/* Help */}
        <Link
          to="/help"
          className="text-on-surface-variant transition-colors hover:text-on-surface"
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </Link>

        {/* Settings */}
        <Link
          to="/settings"
          className="text-on-surface-variant transition-colors hover:text-on-surface"
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
            {user.displayName.charAt(0).toUpperCase()}
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
