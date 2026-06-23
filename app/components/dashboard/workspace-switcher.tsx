import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";
import type { ActiveWorkspace, StudioDto } from "~/lib/api";

/**
 * Personal ↔ Team switcher shared by the dashboard and team shells. `active` marks the current
 * workspace; selecting Personal navigates to `/dashboard`, a studio to `/teams/:id`.
 */
export function WorkspaceSwitcher({
  studios,
  active,
  direction = "up",
}: {
  studios: StudioDto[];
  active: ActiveWorkspace;
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const fetcher = useFetcher<any>();
  
  // Close the create modal when the fetcher finishes successfully
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.error) {
      setCreateOpen(false);
    }
  }, [fetcher.state, fetcher.data]);

  const activeStudio =
    active.kind === "studio" ? studios.find((s) => s.id === active.studioId) : undefined;
  const activeLabel = active.kind === "studio" ? activeStudio?.name ?? "Team" : "Personal";
  const activeIcon = active.kind === "studio" ? "groups" : "person";

  return (
    <div className="relative">
      <div className="px-3 text-label-sm uppercase tracking-wide text-on-surface-variant">
        Workspace
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-2 text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="material-symbols-outlined text-[20px] text-primary">{activeIcon}</span>
          <span className="truncate">{activeLabel}</span>
        </span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
          unfold_more
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close workspace menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className={`absolute left-0 z-20 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high shadow-lg ${
              direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-body-sm transition-colors ${
                active.kind === "personal"
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-primary">person</span>
              Personal
            </Link>
            {studios.length > 0 && (
              <div className="border-t border-outline-variant px-3 pb-1 pt-2 text-label-sm uppercase tracking-wide text-on-surface-variant">
                Teams
              </div>
            )}
            {studios.map((studio) => {
              const isActive = active.kind === "studio" && active.studioId === studio.id;
              return (
                <Link
                  key={studio.id}
                  to={`/teams/${studio.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-body-sm transition-colors ${
                    isActive
                      ? "bg-surface-container-highest text-on-surface"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                  <span className="truncate">{studio.name}</span>
                </Link>
              );
            })}
            
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              New team
            </button>
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New team">
        <fetcher.Form action="/create-studio" method="post" className="space-y-4">
          {fetcher.data?.error && (
            <div className="rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
              {fetcher.data.error}
            </div>
          )}
          <div>
            <label htmlFor="team-name" className="block text-label-md text-on-surface-variant">
              Team Name
            </label>
            <input
              id="team-name"
              name="name"
              type="text"
              required
              placeholder="My awesome team"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fetcher.state === "submitting"}
              className={primaryButtonClass()}
            >
              {fetcher.state === "submitting" ? "Creating…" : "Create"}
            </button>
          </div>
        </fetcher.Form>
      </Modal>
    </div>
  );
}
