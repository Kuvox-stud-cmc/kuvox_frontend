import {
  NotificationsPreview,
  getInitials as getHeaderInitials,
  type HeaderActionUser,
  type HeaderNotifications,
} from "~/routes/dashboard/header-bar";
import { useState } from "react";
import { Form, Link } from "react-router";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  editorModeChanged,
  modalOpened,
  searchQueryChanged,
  selectCanRedo,
  selectCanUndo,
  selectChromeState,
  selectEditorSyncChromeState,
  timelineToggled,
  type EditorSyncStatus,
  type EditorMode,
  videoRedoRequested,
  videoUndoRequested,
} from "~/store/slices/editor-slice";

import type { EditorProjectMock } from "./mock-editor-data";
import { EditorIcon, EditorIconButton } from "./editor-ui";

interface EditorTopBarProps {
  project: EditorProjectMock;
  user?: HeaderActionUser;
  notifications?: HeaderNotifications;
}

const modes: Array<{ value: EditorMode; label: string; icon?: string }> = [
  { value: "manual", label: "Manual", icon: "edit" },
  { value: "ai", label: "AI Agent", icon: "auto_awesome" },
];

const DEFAULT_EDITOR_USER: HeaderActionUser = {
  displayName: "Kuvox User",
  plan: "Free",
};

const DEFAULT_EDITOR_NOTIFICATIONS: HeaderNotifications = {
  unreadCount: 0,
  items: [],
  error: null,
};

const editorActionButton =
  "flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-high hover:text-on-surface motion-reduce:transition-none";

export function EditorTopBar({ project, user = DEFAULT_EDITOR_USER, notifications }: EditorTopBarProps) {
  const dispatch = useAppDispatch();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { editorMode, searchQuery } = useAppSelector(selectChromeState);
  const { syncStatus, pendingSyncCount } = useAppSelector(selectEditorSyncChromeState);
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const syncCopy = syncStatusCopy(syncStatus, pendingSyncCount);
  const headerNotifications = notifications ?? DEFAULT_EDITOR_NOTIFICATIONS;
  const unreadCount = Math.max(0, Number(headerNotifications.unreadCount) || 0);
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const initials = getHeaderInitials(user);

  return (
    <header className="z-50 grid h-toolbar-height shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-outline-variant bg-surface px-2 lg:gap-3 lg:px-3 2xl:px-4">
      <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
        <Link
          to="/dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-high hover:text-on-surface motion-reduce:transition-none"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <EditorIcon className="text-[20px]">arrow_back</EditorIcon>
        </Link>
        <div className="hidden h-6 w-px bg-outline-variant sm:block" />
        <div className="min-w-0 flex gap-1.5">
          <span className="block truncate text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Project
          </span>
          <span className="block truncate text-body-sm font-semibold uppercase text-on-surface">{project.name}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-center gap-2 2xl:gap-3">
        <div className="flex items-center rounded-[6px] border border-outline-variant bg-surface-container-low p-1">
          {modes.map((mode) => {
            const active = editorMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                aria-label={`${mode.label} editing mode`}
                aria-pressed={active}
                onClick={() => dispatch(editorModeChanged(mode.value))}
                title={`${mode.label} editing mode`}
                className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-[4px] px-2 text-label-md font-semibold transition-colors duration-150 motion-reduce:transition-none xl:px-3 2xl:px-4 ${
                  active
                    ? "bg-surface-container-highest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <EditorIcon className="text-[16px]">{mode.icon ?? "edit"}</EditorIcon>
                <span className="hidden whitespace-nowrap xl:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <label className="relative hidden 2xl:block">
          <EditorIcon className="absolute left-3 top-1/2 text-[18px] text-on-surface-variant -translate-y-1/2">
            search
          </EditorIcon>
          <input
            className="h-8 w-60 rounded-[4px] border border-outline-variant bg-surface-container-low py-1 pl-9 pr-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary motion-reduce:transition-none"
            placeholder="Search tools or media..."
            aria-label="Search tools or media"
            data-editor-shortcuts="ignore"
            type="search"
            value={searchQuery}
            onChange={(event) => dispatch(searchQueryChanged(event.target.value))}
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`hidden h-8 items-center rounded-[4px] border px-2 text-label-sm font-semibold lg:flex ${syncCopy.className}`}
        >
          {syncCopy.label}
        </span>
        <EditorIconButton
          icon="undo"
          label="Undo"
          className="h-8 w-8"
          disabled={!canUndo}
          onClick={() => dispatch(videoUndoRequested())}
        />
        <EditorIconButton
          icon="redo"
          label="Redo"
          className="h-8 w-8"
          disabled={!canRedo}
          onClick={() => dispatch(videoRedoRequested())}
        />
        <EditorIconButton
          icon="view_timeline"
          label="Toggle timeline"
          className="h-8 w-8"
          onClick={() => dispatch(timelineToggled())}
        />
        <EditorIconButton
          icon="ios_share"
          label="Export video"
          className="h-8 w-8"
          onClick={() => dispatch(modalOpened("export"))}
        />
        <div
          className="relative hidden h-8 w-8 items-center justify-center sm:flex"
          onMouseEnter={() => setNotificationsOpen(true)}
          onMouseLeave={() => setNotificationsOpen(false)}
          onFocus={() => setNotificationsOpen(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
              setNotificationsOpen(false);
            }
          }}
        >
          <Link
            to="/notifications"
            className={`relative ${editorActionButton}`}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
          >
            <EditorIcon className="text-[20px]">notifications</EditorIcon>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary">
                {badgeLabel}
              </span>
            ) : null}
          </Link>
          {notificationsOpen ? (
            <NotificationsPreview notifications={headerNotifications} unreadCount={unreadCount} />
          ) : null}
        </div>
        <Link
          to="/settings"
          className={`${editorActionButton} hidden sm:flex`}
          aria-label="Settings"
        >
          <EditorIcon className="text-[20px]">settings</EditorIcon>
        </Link>
        <div className="relative">
          <button
            type="button"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-primary transition-colors hover:border-primary/50 hover:bg-surface-container-highest motion-reduce:transition-none 2xl:ml-2"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Profile menu"
            onClick={() => setProfileOpen((value) => !value)}
          >
            <span className="text-label-md font-bold">{initials}</span>
          </button>

          {profileOpen ? (
            <>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close profile menu"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-xl"
              >
                <div className="border-b border-outline-variant px-4 py-3">
                  <p className="text-body-sm font-medium text-on-surface">{user.displayName}</p>
                  <p className="text-label-md text-on-surface-variant">{user.plan ?? "Free"} plan</p>
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
          ) : null}
        </div>
      </div>
    </header>
  );
}

function syncStatusCopy(status: EditorSyncStatus, pendingSyncCount: number) {
  if (status === "syncing") {
    return {
      label: "Syncing",
      className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
    };
  }

  if (status === "synced" || status === "clean") {
    return {
      label: "Synced",
      className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
    };
  }

  if (status === "saved-local") {
    return {
      label: pendingSyncCount > 0 ? `Saved locally (${pendingSyncCount})` : "Saved locally",
      className: "border-tertiary/40 bg-tertiary-container text-on-tertiary-container",
    };
  }

  if (status === "server-changed") {
    return {
      label: "Server changed",
      className: "border-error/40 bg-error-container text-on-error-container",
    };
  }

  if (status === "failed" || status === "sync-failed") {
    return {
      label: "Sync failed",
      className: "border-error/40 bg-error-container text-on-error-container",
    };
  }

  return {
    label: "Saved locally",
    className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
  };
}
