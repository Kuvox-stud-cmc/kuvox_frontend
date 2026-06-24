import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router";

import { WorkspaceSwitcher } from "~/components/dashboard/workspace-switcher";
import { HeaderBar } from "~/routes/dashboard/header-bar";
import { SidebarNav } from "~/routes/dashboard/sidebar-nav";
import type { StudioDto } from "~/lib/api";
import { listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/layout";

/* ── Sidebar resize constants ───────────────────────────────────────────── */

const SIDEBAR_WIDTH_KEY = "kuvox_sidebar_width";
const DEFAULT_WIDTH = 256; // 16rem  (w-64)
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const COLLAPSED_WIDTH = 72;
const COLLAPSE_SNAP = 120; // drag below this → snap to collapsed
const MOBILE_BREAKPOINT = 768; // px — below this, sidebar is overlay

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);

  // The studios list is kept for future workspace-switcher integration.
  let studios: StudioDto[] = [];
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (accessToken) {
    try {
      studios = await listMyStudios(accessToken, reqLog);
    } catch (error) {
      reqLog.warn({ err: error }, "failed to load studios for switcher");
      studios = [];
    }
  }

  return { user, studios };
}

/** Authenticated app shell with a premium sidebar, top header bar, and scrollable main area. */
export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { user, studios } = loaderData;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const collapsed = !isMobile && sidebarWidth <= COLLAPSED_WIDTH;

  // Detect mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setMobileOpen(false);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Restore width from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (saved) {
        const w = parseInt(saved, 10);
        if (!isNaN(w)) setSidebarWidth(w);
      }
    } catch {
      /* noop */
    }
  }, []);

  // Persist width to localStorage
  const persistWidth = useCallback((w: number) => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
    } catch {
      /* noop */
    }
  }, []);

  // ── Drag handlers (desktop only) ────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) return;
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = startWidth + delta;

        if (newWidth < COLLAPSE_SNAP) {
          setSidebarWidth(COLLAPSED_WIDTH);
        } else {
          setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
        }
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        setSidebarWidth((current) => {
          persistWidth(current);
          return current;
        });
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth, persistWidth, isMobile],
  );

  const handleDoubleClick = useCallback(() => {
    if (isMobile) return;
    const next = collapsed ? DEFAULT_WIDTH : COLLAPSED_WIDTH;
    setSidebarWidth(next);
    persistWidth(next);
  }, [collapsed, persistWidth, isMobile]);

  const toggleCollapsed = useCallback(() => {
    if (isMobile) {
      setMobileOpen(false);
      return;
    }
    const next = collapsed ? DEFAULT_WIDTH : COLLAPSED_WIDTH;
    setSidebarWidth(next);
    persistWidth(next);
  }, [collapsed, persistWidth, isMobile]);

  const toggleMobile = useCallback(() => {
    setMobileOpen((v) => !v);
  }, []);

  /* ── Sidebar content (shared between mobile overlay and desktop) ─────── */
  const sidebarContent = (
    <>
      {/* Scrollable nav content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
        {/* Logo + collapse toggle */}
        <div
          className={`mb-5 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}
        >
          <Link to="/" className="flex shrink-0">
            {collapsed ? (
              <img
                src="/logo.svg"
                alt="Kuvox"
                className="h-7 w-7 object-contain"
              />
            ) : (
              <img src="/logo.svg" alt="Kuvox" className="h-7" />
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={isMobile ? toggleMobile : toggleCollapsed}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              aria-label={isMobile ? "Close menu" : "Collapse sidebar"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isMobile ? "close" : "left_panel_close"}
              </span>
            </button>
          )}
        </div>

        {/* Workspace switcher */}
        {!collapsed && (
          <WorkspaceSwitcher
            studios={studios}
            active={{ kind: "personal" }}
            direction="down"
          />
        )}

        {/* New Project CTA */}
        <Link
          to="/dashboard/projects?create=1"
          onClick={() => isMobile && setMobileOpen(false)}
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

        {/* Navigation (main + workspace) */}
        <SidebarNav collapsed={collapsed} />
      </div>

      {/* ── Storage section (pinned to bottom) ────────────────────────── */}
      <div className="border-t border-outline-variant/50 p-5">
        {collapsed ? (
          <Link
            to="/pricing"
            className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            title="Storage · 128 GB of 1 TB"
          >
            <span className="material-symbols-outlined text-[20px]">
              cloud
            </span>
          </Link>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 text-label-md font-medium text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                cloud
              </span>
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
              <span className="material-symbols-outlined text-[14px]">
                arrow_upward
              </span>
              Upgrade Plan
            </Link>
          </>
        )}
      </div>

      {/* ── Expand button (only when collapsed on desktop) ─────────────── */}
      {collapsed && !isMobile && (
        <div className="border-t border-outline-variant/50 p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            aria-label="Expand sidebar"
          >
            <span className="material-symbols-outlined text-[18px]">
              left_panel_open
            </span>
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      {!isMobile && (
        <aside
          ref={sidebarRef}
          className={`relative hidden md:flex flex-shrink-0 flex-col bg-surface-container-lowest ${
            isDragging ? "" : "transition-[width] duration-300 ease-in-out"
          }`}
          style={{ width: sidebarWidth }}
        >
          {sidebarContent}

          {/* Drag handle (right edge) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none transition-colors hover:bg-primary/40 active:bg-primary/60 ${
              isDragging ? "bg-primary/60" : "bg-transparent"
            }`}
          />
        </aside>
      )}

      {/* ── Mobile Sidebar Overlay ──────────────────────────────────────── */}
      {isMobile && mobileOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm cursor-default"
            aria-label="Close navigation"
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface-container-lowest shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* ── Main area (header + content) ──────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar
          user={user}
          onMenuToggle={isMobile ? toggleMobile : undefined}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6 md:px-10 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Overlay to prevent iframe/selection interference while dragging */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  );
}
