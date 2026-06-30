import { MetricCard, ProgressRing } from "~/components/dashboard/layout/DashboardPageLayout";
import { ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import type { StudioUsageSummaryDto } from "~/lib/api";
import { ApiError, getUsageSummary } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/usage";

function legacyMeta() {
  return [{ title: "Studio usage · Kuvox" }];
}

function LegacyTeamUsage() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio usage - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      usage: null as StudioUsageSummaryDto | null,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const usage = await getUsageSummary(accessToken, params.studioId, reqLog);
    return { usage, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load usage.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio usage");
    return { usage: null as StudioUsageSummaryDto | null, error: message };
  }
}

export default function TeamUsage({ loaderData }: Route.ComponentProps) {
  const { usage, error } = loaderData;
  const storagePercent = usage ? percent(usage.storageBytesUsed, usage.storageBytesQuota) : 0;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Usage & Quotas"
        subtitle="Read-only Studio usage summary from the backend."
      />
      {error && <ErrorBanner message={error} />}
      {usage && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard icon="group" label="Members" value={usage.memberCount.toLocaleString()} />
            <MetricCard icon="folder" label="Projects" value={usage.projectCount.toLocaleString()} tone="secondary" />
            <MetricCard icon="perm_media" label="Media" value={usage.mediaCount.toLocaleString()} tone="tertiary" />
            <MetricCard icon="storage" label="Storage" value={formatBytes(usage.storageBytesUsed)} detail={`${formatBytes(usage.storageBytesQuota)} quota`} />
          </div>
          <div className="flex items-center gap-6 rounded-xl border border-outline-variant bg-surface-container-low p-6">
            <ProgressRing progress={storagePercent} />
            <div>
              <h2 className="text-body-lg font-bold text-on-surface">Storage used</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {formatBytes(usage.storageBytesUsed)} of {formatBytes(usage.storageBytesQuota)} used.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function percent(used: number, quota: number) {
  if (quota <= 0) return 0;
  return Math.min(100, Math.round((used / quota) * 100));
}

function formatBytes(value: number) {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
