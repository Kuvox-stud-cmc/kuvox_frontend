import { Link, useParams } from "react-router";

import { StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import type { StudioAuditLogEntryDto } from "~/lib/api";
import { ApiError, getStudioAuditLog } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAdminAccess } from "./access.server";
import type { Route } from "./+types/audit-log";

function legacyMeta() {
  return [{ title: "Studio audit log · Kuvox" }];
}

function LegacyTeamAuditLog() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio audit log - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const category = url.searchParams.get("category") || undefined;

  if (!accessToken) {
    return {
      audit: { items: [] as StudioAuditLogEntryDto[], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
      category,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    await requireStudioAdminAccess(accessToken, params.studioId, reqLog);
    const audit = await getStudioAuditLog(accessToken, params.studioId, { page, pageSize: 20, category }, reqLog);
    return { audit, category, error: null as string | null };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = error instanceof ApiError ? error.message : "Couldn't load audit log.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio audit log");
    return {
      audit: { items: [] as StudioAuditLogEntryDto[], page, pageSize: 20, totalCount: 0, totalPages: 0 },
      category,
      error: message,
    };
  }
}

export default function TeamAuditLog({ loaderData }: Route.ComponentProps) {
  const { audit, category, error } = loaderData;
  const { studioId } = useParams();
  const base = `/teams/${studioId}/audit-log`;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Audit Log"
        subtitle="Backend-recorded Studio access, invitation, and settings events."
      />
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2">
        {["", "Workspace", "Members", "Invitations", "Settings"].map((item) => {
          const selected = (category ?? "") === item;
          const href = item ? `${base}?category=${item}` : base;
          return (
            <Link
              key={item || "all"}
              to={href}
              className={`rounded-lg px-3 py-1.5 text-label-md transition-colors ${
                selected
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {item || "All"}
            </Link>
          );
        })}
      </div>

      {audit.items.length === 0 ? (
        <EmptyState icon="fact_check" title="No audit entries" />
      ) : (
        <div className="space-y-3">
          {audit.items.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-body-md font-bold text-on-surface">{entry.summary}</h2>
                    <StatusBadge label={entry.category} tone="neutral" />
                  </div>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {entry.action} on {entry.targetKind}
                  </p>
                </div>
                <time className="shrink-0 text-label-md text-on-surface-variant">
                  {formatDateTime(entry.createdAt)}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}

      {audit.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          {audit.page > 1 && (
            <Link className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-md" to={pageHref(base, audit.page - 1, category)}>
              Previous
            </Link>
          )}
          <span className="text-label-md text-on-surface-variant">
            Page {audit.page} of {audit.totalPages}
          </span>
          {audit.page < audit.totalPages && (
            <Link className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-md" to={pageHref(base, audit.page + 1, category)}>
              Next
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function pageHref(base: string, page: number, category?: string) {
  const query = new URLSearchParams();
  query.set("page", String(page));
  if (category) query.set("category", category);
  return `${base}?${query}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
