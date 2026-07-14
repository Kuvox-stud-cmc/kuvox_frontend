import {
  NotificationsPreview,
  getInitials as getHeaderInitials,
  type HeaderActionUser,
  type HeaderNotifications,
} from "~/routes/dashboard/header-bar";
import { useState } from "react";
import { Form, Link } from "react-router";
import type { ProjectDto } from "~/lib/api";
import { setProjectSettingsOperation } from "~/lib/editor/video-operations";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  editorModeChanged,
  modalOpened,
  selectCanRedo,
  selectCanUndo,
  selectChromeState,
  selectEditorSyncChromeState,
  selectVideoDocument,
  timelineToggled,
  type EditorSyncStatus,
  type EditorMode,
  videoOperationApplied,
  videoRedoRequested,
  videoUndoRequested,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton } from "./editor-ui";

interface EditorTopBarProps {
  project: ProjectDto;
  user?: HeaderActionUser;
  notifications?: HeaderNotifications;
  onSync?: () => unknown | Promise<unknown>;
  conflict?: boolean;
  onKeepLocal?: () => void | Promise<void>;
  onReloadServer?: () => void | Promise<void>;
}

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
};

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

export function EditorTopBar({
  project,
  user = DEFAULT_EDITOR_USER,
  notifications,
  onSync,
  conflict = false,
  onKeepLocal,
  onReloadServer,
}: EditorTopBarProps) {
  const dispatch = useAppDispatch();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aspectRatioOpen, setAspectRatioOpen] = useState(false);
  const { editorMode } = useAppSelector(selectChromeState);
  const document = useAppSelector(selectVideoDocument);
  const { syncStatus, pendingSyncCount, localSaveStatus } = useAppSelector(selectEditorSyncChromeState);
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const syncCopy = localSaveStatus === "failed"
    ? { label: "Local save failed", className: "border-error/40 bg-error-container text-on-error-container" }
    : localSaveStatus === "saving"
      ? { label: "Saving locally", className: "border-tertiary/40 bg-tertiary-container text-on-tertiary-container" }
      : syncStatusCopy(syncStatus, pendingSyncCount);
  const syncDisabled = !onSync || syncStatus === "syncing" || syncStatus === "server-changed";
  const headerNotifications = notifications ?? DEFAULT_EDITOR_NOTIFICATIONS;
  const unreadCount = Math.max(0, Number(headerNotifications.unreadCount) || 0);
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const initials = getHeaderInitials(user);
  const selectedRatio = document?.settings.aspectRatio ?? "16:9";

  return (
    <header className="z-50 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border-b border-outline-variant bg-surface px-1 min-[760px]:h-16 min-[760px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[760px]:gap-2 min-[760px]:px-3 lg:gap-3 2xl:px-5">
      <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
        <Link
          to="/dashboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-high hover:text-on-surface motion-reduce:transition-none min-[760px]:h-8 min-[760px]:w-8"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <EditorIcon className="text-[20px]">arrow_back</EditorIcon>
        </Link>
        <Link to="/dashboard" className="hidden items-center min-[520px]:flex">
          <img
            src="/logo.svg"
            alt="Kuvox"
            className="h-7 w-auto object-contain"
          />
        </Link>
        <div className="hidden h-7 w-px bg-outline-variant min-[760px]:block" />
        <div className="min-w-0 max-w-28 min-[760px]:max-w-52">
          <span className="block truncate text-body-sm font-semibold text-on-surface">{project.name}</span>
          <span className="hidden items-center truncate text-label-sm text-on-surface-variant min-[760px]:flex mt-0.5">
            {getSyncStatusIcon(syncStatus)}
            <span className="truncate">{syncCopy.label}</span>
          </span>
        </div>
        {conflict ? (
          <EditorConflictBanner
            onKeepLocal={onKeepLocal}
            onReloadServer={onReloadServer}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 items-center justify-center gap-2 2xl:gap-3">
        <div
          data-tour="editor-mode"
          className="flex items-center rounded-[6px] border border-outline-variant bg-surface-container-low p-1"
        >
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
                className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-[4px] px-2 text-label-md font-semibold transition-colors duration-150 motion-reduce:transition-none min-[760px]:h-8 min-[760px]:min-w-8 xl:px-3 2xl:px-4 ${
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

      </div>

      <div className="flex items-center justify-end gap-1.5">
        <EditorIconButton
          icon="save"
          label="Sync"
          className="hidden h-8 w-8 lg:flex"
          disabled={syncDisabled}
          onClick={() => void onSync?.()}
        />
        <EditorIconButton
          icon="undo"
          label="Undo"
          className="h-10 w-10 min-[760px]:h-8 min-[760px]:w-8"
          disabled={!canUndo}
          onClick={() => dispatch(videoUndoRequested())}
        />
        <EditorIconButton
          icon="redo"
          label="Redo"
          className="h-10 w-10 min-[760px]:h-8 min-[760px]:w-8"
          disabled={!canRedo}
          onClick={() => dispatch(videoRedoRequested())}
        />
        <EditorIconButton
          icon="view_timeline"
          label="Toggle timeline"
          className="hidden h-8 w-8 min-[760px]:flex"
          onClick={() => dispatch(timelineToggled())}
        />
        <div className="relative hidden lg:block">
          <button
            type="button"
            aria-label="Project aspect ratio"
            onClick={() => setAspectRatioOpen(!aspectRatioOpen)}
            className="flex h-9 items-center gap-1 rounded-[6px] border border-outline-variant bg-surface-container-low px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
          >
            {selectedRatio}
            <EditorIcon className="text-[15px]">expand_more</EditorIcon>
          </button>
          {aspectRatioOpen && (
            <>
              <button
                type="button"
                onClick={() => setAspectRatioOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
                aria-label="Close aspect ratio menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-40 w-36 rounded-[6px] border border-outline-variant bg-surface-container-high p-1 shadow-lg flex flex-col gap-0.5">
                {[
                  { value: "16:9", label: "16:9 Landscape" },
                  { value: "9:16", label: "9:16 Vertical" },
                  { value: "1:1", label: "1:1 Square" },
                  { value: "4:3", label: "4:3 Standard" },
                  { value: "21:9", label: "21:9 Cinematic" },
                ].map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => {
                      setAspectRatioOpen(false);
                      const dimensions = ASPECT_RATIO_DIMENSIONS[ratio.value] ?? ASPECT_RATIO_DIMENSIONS["16:9"];
                      dispatch(videoOperationApplied(setProjectSettingsOperation(
                        { aspectRatio: ratio.value, ...dimensions },
                        `Change aspect ratio to ${ratio.label}`,
                      )));
                    }}
                    className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-1.5 text-left text-label-sm transition-colors ${
                      selectedRatio === ratio.value
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                    }`}
                  >
                    <span>{ratio.label}</span>
                    {selectedRatio === ratio.value && (
                      <EditorIcon className="text-[14px]">check</EditorIcon>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="Export video"
          data-tour="export-video"
          onClick={() => dispatch(modalOpened("export"))}
          className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-[7px] bg-primary px-2 text-label-md font-bold text-on-primary shadow-[0_0_20px_rgba(139,124,255,0.24)] hover:brightness-110 min-[760px]:h-9 min-[760px]:px-4"
        >
          <EditorIcon className="text-[18px] min-[760px]:hidden">ios_share</EditorIcon>
          <span className="hidden min-[760px]:inline">Export</span>
        </button>
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
        <div className="relative hidden min-[520px]:block">
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

function EditorConflictBanner({
  onKeepLocal,
  onReloadServer,
}: {
  onKeepLocal?: () => void | Promise<void>;
  onReloadServer?: () => void | Promise<void>;
}) {
  return (
    <div
      role="alert"
      className="ml-1 hidden min-w-0 max-w-64 flex-1 flex-col gap-1 min-[1180px]:flex 2xl:max-w-80"
    >
      <p className="truncate text-[10px] font-semibold leading-none text-error">
        Server changed while local edits are saved
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onKeepLocal?.()}
          className="h-5 rounded-[3px] border border-error/40 px-1.5 text-[9px] font-semibold leading-none text-error hover:bg-error-container"
        >
          Keep local edits
        </button>
        <button
          type="button"
          onClick={() => void onReloadServer?.()}
          className="h-5 rounded-[3px] bg-error px-1.5 text-[9px] font-semibold leading-none text-on-error hover:opacity-90"
        >
          Reload server copy
        </button>
      </div>
    </div>
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

  if (status === "dirty") {
    return {
      label: "Saved locally",
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

function getSyncStatusIcon(status: EditorSyncStatus) {
  if (status === "syncing") {
    return <EditorIcon className="text-[13px] animate-spin text-primary mr-1 shrink-0">sync</EditorIcon>;
  }
  if (status === "synced" || status === "clean") {
    return <EditorIcon className="text-[13px] text-primary mr-1 shrink-0">cloud_done</EditorIcon>;
  }
  if (status === "saved-local" || status === "dirty") {
    return <EditorIcon className="text-[13px] text-amber-500 mr-1 shrink-0">cloud_upload</EditorIcon>;
  }
  if (status === "failed" || status === "sync-failed" || status === "server-changed") {
    return <EditorIcon className="text-[13px] text-error mr-1 shrink-0">cloud_off</EditorIcon>;
  }
  return <EditorIcon className="text-[13px] text-on-surface-variant mr-1 shrink-0">cloud</EditorIcon>;
}
