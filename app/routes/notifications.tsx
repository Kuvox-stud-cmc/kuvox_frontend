import { Form, Link, useNavigation } from "react-router";

import { StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
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
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/notifications";

function legacyMeta(_: Route.MetaArgs) {
  return [{ title: "Notifications · Kuvox" }];
}

async function legacyLoader({ request }: Route.LoaderArgs) {
  void request;
  return null;
}

function LegacyNotifications() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <p className="mt-2 text-gray-600">Your recent notifications (stub).</p>
    </section>
  );
}

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
    if (intent === "delete") {
      await deleteNotification(accessToken, id, reqLog);
      return { ok: true, intent };
    }
    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "notification action failed");
    return { error: message };
  }
}

export default function Notifications({ loaderData, actionData }: Route.ComponentProps) {
  const { notifications, unreadCount, error } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Notifications"
        subtitle={`${unreadCount.toLocaleString()} unread notification${unreadCount === 1 ? "" : "s"}.`}
        action={
          notifications.items.length > 0 ? (
            <Form method="post">
              <input type="hidden" name="intent" value="read-all" />
              <button type="submit" disabled={busy || unreadCount === 0} className={primaryButtonClass()}>
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                Mark all read
              </button>
            </Form>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {notifications.items.length === 0 ? (
        <EmptyState icon="notifications" title="No notifications" />
      ) : (
        <div className="space-y-3">
          {notifications.items.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} busy={busy} />
          ))}
        </div>
      )}

      {notifications.totalPages > 1 && (
        <div className="flex justify-end gap-3">
          {notifications.page > 1 && (
            <Link className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-md" to={`?page=${notifications.page - 1}`}>
              Previous
            </Link>
          )}
          {notifications.page < notifications.totalPages && (
            <Link className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-md" to={`?page=${notifications.page + 1}`}>
              Next
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function NotificationRow({ notification, busy }: { notification: NotificationDto; busy: boolean }) {
  const unread = notification.status === NotificationStatus.Unread;
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[20px]">{notificationTypeIcon(notification.type)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-body-md font-bold text-on-surface">{notification.message}</h2>
          <StatusBadge label={notificationStatusLabel(notification.status)} tone={unread ? "primary" : "neutral"} />
        </div>
        <p className="mt-1 text-label-md text-on-surface-variant">{formatDateTime(notification.createdAt)}</p>
      </div>
    </>
  );

  return (
    <div className={`rounded-xl border p-4 ${unread ? "border-primary/40 bg-primary/5" : "border-outline-variant bg-surface-container-low"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {notification.linkUrl ? (
          <Link to={notification.linkUrl} className="flex min-w-0 flex-1 items-start gap-3">
            {content}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
        )}
        <div className="flex shrink-0 gap-2">
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
    </div>
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
}: {
  id: string;
  intent: string;
  icon: string;
  label: string;
  busy: boolean;
  danger?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
}) {
  const buttonClassName = `rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
    danger
      ? "text-error hover:bg-error-container hover:text-on-error-container"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
