import { actionErrorMessage } from "~/lib/action-error.server";
import { Form, Link, useNavigation } from "react-router";

import { StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import { ConfirmSubmitButton } from "~/components/dashboard/section";
import {
  NotificationStatus,
  notificationStatusLabel,
  notificationTypeIcon,
  type NotificationDto,
  type PagedResult,
} from "~/lib/api";
import {
  ApiError,
  archiveNotification,
  acceptStudioInvitation,
  deleteNotification,
  declineStudioInvitation,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import {
  primarySettingsButton,
  secondarySettingsButton,
  SettingsNotice,
  SettingsPanel,
  StatTile,
} from "./settings/settings-ui";

import type { Route } from "./+types/notifications";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notifications - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

  if (!accessToken) {
    return {
      notifications: emptyPage(page),
      unreadCount: 0,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const [notifications, unread] = await Promise.all([
      listNotifications(accessToken, { page, pageSize: 20 }, reqLog),
      getUnreadNotificationCount(accessToken, reqLog),
    ]);
    return { notifications, unreadCount: unread.count, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load notifications.";
    reqLog.error({ err: error }, "failed to load notifications");
    return { notifications: emptyPage(page), unreadCount: 0, error: message };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("id") ?? "");

  try {
    if (intent === "read-all") {
      await markAllNotificationsRead(accessToken, reqLog);
      return { ok: true, intent };
    }
    if (!id) return { error: "Missing notification id." };
    if (intent === "read") {
      await markNotificationRead(accessToken, id, reqLog);
      return { ok: true, intent };
    }
    if (intent === "archive") {
      await archiveNotification(accessToken, id, reqLog);
      return { ok: true, intent };
    }
    if (intent === "accept-invitation" || intent === "decline-invitation") {
      const token = String(formData.get("token") ?? "");
      if (!token) return { error: "Missing invitation token." };
      if (intent === "accept-invitation") {
        await acceptStudioInvitation(token, accessToken, reqLog);
      } else {
        await declineStudioInvitation(token, accessToken, reqLog);
      }
      await archiveNotification(accessToken, id, reqLog);
      return { ok: true, intent };
    }
    if (intent === "delete") {
      await deleteNotification(accessToken, id, reqLog);
      return { ok: true, intent };
    }
    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent }, "notification action failed");
    return { error: message };
  }
}

export default function Notifications({ loaderData, actionData }: Route.ComponentProps) {
  const { notifications, unreadCount, error } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const totalCount = Number(notifications.totalCount) || 0;
  const page = Number(notifications.page) || 1;
  const totalPages = Number(notifications.totalPages) || 0;
  const hasNotifications = notifications.items.length > 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = totalPages > 0 && page < totalPages;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
              <span className="material-symbols-outlined text-[14px]">notifications</span>
              Notifications
            </p>
            <h1 className="mt-2 text-headline-lg font-bold text-on-surface">Personal notifications</h1>
            <p className="mt-2 max-w-2xl text-body-sm text-on-surface-variant">
              Review account, workspace, and media updates sent to your Kuvox account.
            </p>
          </div>
          <Link to="/dashboard" className={secondarySettingsButton}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
        {actionData?.error ? <SettingsNotice tone="error">{actionData.error}</SettingsNotice> : null}
        {actionData?.ok ? <ActionSuccessNotice intent={actionData.intent} /> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            icon="mark_email_unread"
            label="Unread"
            value={unreadCount.toLocaleString()}
            detail={
              unreadCount === 0
                ? "All caught up"
                : unreadCount === 1
                  ? "Needs attention"
                  : "Need attention"
            }
          />
          <StatTile
            icon="inventory_2"
            label="Total"
            value={totalCount.toLocaleString()}
            detail="Current notification history"
          />
        </div>

        <SettingsPanel
          title="Recent notifications"
          description="Newest notifications are shown first. Actions only affect your account."
          action={
            hasNotifications ? (
              <Form method="post">
                <input type="hidden" name="intent" value="read-all" />
                <button type="submit" disabled={busy || unreadCount === 0} className={primarySettingsButton}>
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  {busy ? "Updating..." : "Mark all read"}
                </button>
              </Form>
            ) : undefined
          }
        >
          {hasNotifications ? (
            <div className="space-y-3">
              {notifications.items.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} busy={busy} />
              ))}
            </div>
          ) : (
            <EmptyNotifications />
          )}
        </SettingsPanel>

        {totalPages > 1 ? (
          <nav className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-label-md text-on-surface-variant">
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <PaginationLink
                to={`?page=${page - 1}`}
                disabled={!hasPreviousPage}
                icon="chevron_left"
                label="Previous"
              />
              <PaginationLink
                to={`?page=${page + 1}`}
                disabled={!hasNextPage}
                icon="chevron_right"
                label="Next"
                iconPosition="end"
              />
            </div>
          </nav>
        ) : null}
      </main>
    </div>
  );
}

function NotificationRow({ notification, busy }: { notification: NotificationDto; busy: boolean }) {
  const unread = notification.status === NotificationStatus.Unread;
  const invitationToken = notification.type === 5 ? tokenFromInvitationLink(notification.linkUrl) : null;
  const content = (
    <>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          unread ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        <span className="material-symbols-outlined text-[21px]">{notificationTypeIcon(notification.type)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="min-w-0 flex-1 break-words text-body-sm font-semibold text-on-surface">
            {notification.message}
          </h2>
          <StatusBadge
            label={notificationStatusLabel(notification.status)}
            tone={unread ? "primary" : "neutral"}
          />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
        </p>
      </div>
    </>
  );

  return (
    <article
      className={`rounded-xl border p-4 transition-colors ${
        unread
          ? "border-primary/35 bg-primary/5 hover:border-primary/50"
          : "border-outline-variant bg-surface-container hover:border-primary/25"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {notification.linkUrl ? (
          <Link
            to={notification.linkUrl}
            className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {content}
            <span className="material-symbols-outlined mt-2 hidden text-[18px] text-on-surface-variant transition-colors group-hover:text-primary sm:block">
              arrow_forward
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
        )}
        <div className="flex shrink-0 justify-end gap-2 md:pt-1">
          {invitationToken ? (
            <>
              <NotificationAction id={notification.id} intent="accept-invitation" icon="check" label="Accept" busy={busy} token={invitationToken} />
              <NotificationAction id={notification.id} intent="decline-invitation" icon="close" label="Decline" busy={busy} token={invitationToken} danger />
            </>
          ) : null}
          {unread && <NotificationAction id={notification.id} intent="read" icon="done" label="Read" busy={busy} />}
          <NotificationAction
            id={notification.id}
            intent="archive"
            icon="archive"
            label="Archive"
            busy={busy}
            confirmTitle="Archive notification?"
            confirmMessage="Archive this notification?"
          />
          <NotificationAction
            id={notification.id}
            intent="delete"
            icon="delete"
            label="Delete"
            busy={busy}
            danger
            confirmTitle="Delete notification?"
            confirmMessage="Delete this notification?"
          />
        </div>
      </div>
    </article>
  );
}

function NotificationAction({
  id,
  intent,
  icon,
  label,
  busy,
  danger = false,
  confirmTitle,
  confirmMessage,
  token,
}: {
  id: string;
  intent: string;
  icon: string;
  label: string;
  busy: boolean;
  danger?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  token?: string;
}) {
  const buttonClassName = `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors disabled:opacity-50 ${
    danger
      ? "text-error hover:border-error/35 hover:bg-error/10"
      : "text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface"
  }`;

  if (confirmTitle && confirmMessage) {
    return (
      <ConfirmSubmitButton
        fields={{ intent, id }}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={label}
        disabled={busy}
        ariaLabel={label}
        buttonClassName={buttonClassName}
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </ConfirmSubmitButton>
    );
  }

  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <button
        type="submit"
        disabled={busy}
        aria-label={label}
        className={buttonClassName}
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </button>
    </Form>
  );
}

function emptyPage(page: number): PagedResult<NotificationDto> {
  return { items: [], page, pageSize: 20, totalCount: 0, totalPages: 0 };
}

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[26px]">notifications</span>
      </div>
      <h2 className="mt-4 text-body-lg font-semibold text-on-surface">No notifications</h2>
      <p className="mt-1 max-w-md text-body-sm text-on-surface-variant">
        Account, workspace, and media updates will appear here when there is something to review.
      </p>
      <Link to="/dashboard" className={`mt-5 ${secondarySettingsButton}`}>
        <span className="material-symbols-outlined text-[18px]">dashboard</span>
        Back to dashboard
      </Link>
    </div>
  );
}

function PaginationLink({
  to,
  disabled,
  icon,
  label,
  iconPosition = "start",
}: {
  to: string;
  disabled: boolean;
  icon: string;
  label: string;
  iconPosition?: "start" | "end";
}) {
  const content = (
    <>
      {iconPosition === "start" ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {label}
      {iconPosition === "end" ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <span className={`${secondarySettingsButton} pointer-events-none opacity-45`}>
        {content}
      </span>
    );
  }

  return (
    <Link to={to} className={secondarySettingsButton}>
      {content}
    </Link>
  );
}

function ActionSuccessNotice({ intent }: { intent?: string }) {
  const message =
    intent === "read-all"
      ? "All notifications marked read."
      : intent === "read"
        ? "Notification marked read."
        : intent === "archive"
          ? "Notification archived."
          : intent === "delete"
            ? "Notification deleted."
            : intent === "accept-invitation"
              ? "Invitation accepted."
              : intent === "decline-invitation"
                ? "Invitation declined."
            : "Notification updated.";

  return <SettingsNotice tone="success">{message}</SettingsNotice>;
}

function tokenFromInvitationLink(linkUrl?: string | null): string | null {
  if (!linkUrl) return null;
  try {
    const url = new URL(linkUrl, "https://kuvox.local");
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
