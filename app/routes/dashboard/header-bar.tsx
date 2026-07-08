import { useState } from "react";
import { Form, Link } from "react-router";

import { SearchDropdown } from "~/components/dashboard/search-dropdown";
import {
  NotificationStatus,
  notificationStatusLabel,
  notificationTypeIcon,
  type NotificationDto,
} from "~/lib/api";

export interface HeaderNotifications {
  unreadCount: number;
  items: NotificationDto[];
  error: string | null;
}

const DEFAULT_NOTIFICATIONS: HeaderNotifications = {
  unreadCount: 0,
  items: [],
  error: null,
};

const headerActionButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface";

export interface HeaderActionUser {
  email?: string;
  displayName: string;
  plan?: string;
}

interface HeaderBarProps {
  user: HeaderActionUser;
  notifications?: HeaderNotifications;
  /** When provided, renders a hamburger menu button (mobile). */
  onMenuToggle?: () => void;
}

export function HeaderBar({
  user,
  notifications = DEFAULT_NOTIFICATIONS,
  onMenuToggle,
}: HeaderBarProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-outline-variant/50 px-4 sm:h-16 sm:px-6 md:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Hamburger (mobile only) */}
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className={`${headerActionButton} md:hidden`}
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        )}

        {/* ── Search Dropdown ─────────────────────────────────────────────── */}
        <SearchDropdown />
      </div>

      {/* ── Action icons + profile ──────────────────────────────────────── */}
      <HeaderActions user={user} notifications={notifications} />
    </header>
  );
}

export function HeaderActions({
  user,
  notifications = DEFAULT_NOTIFICATIONS,
  showHelp = true,
}: {
  user: HeaderActionUser;
  notifications?: HeaderNotifications;
  showHelp?: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const initials = getInitials(user);
  const unreadCount = Math.max(0, Number(notifications.unreadCount) || 0);
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="ml-3 flex h-9 shrink-0 items-center gap-1 sm:gap-2">
      {/* Notifications */}
      <div
        className="relative flex h-9 w-9 items-center justify-center"
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
          className={`relative ${headerActionButton}`}
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          aria-haspopup="dialog"
          aria-expanded={notificationsOpen}
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary">
              {badgeLabel}
            </span>
          )}
        </Link>

        {notificationsOpen && (
          <NotificationsPreview notifications={notifications} unreadCount={unreadCount} />
        )}
      </div>

      {/* Help — hidden on small mobile */}
      {showHelp ? (
        <Link
          to="/help"
          className={`${headerActionButton} hidden sm:flex`}
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </Link>
      ) : null}

      {/* Settings — hidden on small mobile */}
      <Link
        to="/settings"
        className={`${headerActionButton} hidden sm:flex`}
        aria-label="Settings"
      >
        <span className="material-symbols-outlined text-[22px]">settings</span>
      </Link>

      {/* Profile avatar + dropdown */}
      <div className="relative flex h-9 w-9 items-center justify-center">
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-body-sm font-bold text-on-primary-container transition-colors hover:bg-primary-container/80"
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
        )}
      </div>
    </div>
  );
}

export function getInitials(user: { displayName?: string; email?: string }): string {
  const source = user.displayName?.trim() || user.email?.trim() || "";
  if (!source) return "U";
  const words = source.includes("@")
    ? [source.slice(0, 1)]
    : source.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "U";
}

export function NotificationsPreview({
  notifications,
  unreadCount,
}: {
  notifications: HeaderNotifications;
  unreadCount: number;
}) {
  const items = notifications.items.slice(0, 5);

  return (
    <div
      role="dialog"
      aria-label="Recent notifications"
      className="absolute right-0 top-full z-30 w-80 max-w-[calc(100vw-2rem)] pt-3"
    >
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
          <div>
            <p className="text-body-sm font-bold text-on-surface">Notifications</p>
            <p className="text-label-md text-on-surface-variant">
              {unreadCount.toLocaleString()} unread
            </p>
          </div>
          <Link
            to="/notifications"
            className="shrink-0 rounded-lg px-2 py-1 text-label-md font-bold text-primary transition-colors hover:bg-primary/10"
          >
            View all
          </Link>
        </div>

        {notifications.error && (
          <div className="m-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2 text-label-md text-on-error-container">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <p>{notifications.error}</p>
          </div>
        )}

        {items.length === 0 && !notifications.error ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </div>
            <p className="text-body-sm font-medium text-on-surface">No notifications</p>
            <p className="mt-1 text-label-md text-on-surface-variant">
              Recent updates will appear here.
            </p>
          </div>
        ) : items.length > 0 ? (
          <div className="max-h-96 overflow-y-auto py-2">
            {items.map((notification) => (
              <NotificationPreviewItem key={notification.id} notification={notification} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NotificationPreviewItem({ notification }: { notification: NotificationDto }) {
  const unread = notification.status === NotificationStatus.Unread;

  return (
    <div className={`mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 ${unread ? "bg-primary/5" : ""}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
        <span className="material-symbols-outlined text-[20px]">
          {notificationTypeIcon(notification.type)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words text-body-sm font-medium text-on-surface">
            {notification.message}
          </p>
          {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
          <span>{notificationStatusLabel(notification.status)}</span>
          <span aria-hidden="true">-</span>
          <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
        </div>
      </div>
    </div>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
