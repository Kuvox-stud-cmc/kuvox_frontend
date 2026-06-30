import { MetricCard, PageHeader, ProgressRing } from "~/components/dashboard/layout/DashboardPageLayout";
import { ErrorBanner } from "~/components/dashboard/section";
import type { StudioUsageSummaryDto } from "~/lib/api";
import { ApiError, getUsageSummary } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/settings-storage";

function legacyMeta() {
  return [{ title: "Studio storage settings · Kuvox" }];
}

function LegacyTeamStorageSettings() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio storage settings - Kuvox" }];
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
    const message = error instanceof ApiError ? error.message : "Couldn't load storage settings.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio storage settings");
    return { usage: null as StudioUsageSummaryDto | null, error: message };
  }
}

export default function TeamStorageSettings({ loaderData }: Route.ComponentProps) {
  const { usage, error } = loaderData;
  const storagePercent = usage ? percent(usage.storageBytesUsed, usage.storageBytesQuota) : 0;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Storage"
        subtitle="Read-only storage and quota summary from the Studio backend."
      />
      {error && <ErrorBanner message={error} />}
      {usage && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              icon="storage"
              label="Storage used"
              value={formatBytes(usage.storageBytesUsed)}
              detail={`${formatBytes(usage.storageBytesQuota)} quota`}
            >
              <ProgressRing progress={storagePercent} />
            </MetricCard>
            <MetricCard icon="perm_media" label="Media items" value={usage.mediaCount.toLocaleString()} tone="secondary" />
            <MetricCard icon="folder" label="Projects" value={usage.projectCount.toLocaleString()} tone="tertiary" />
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-2 flex items-center justify-between text-label-md text-on-surface-variant">
              <span>Storage used</span>
              <span>{storagePercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary" style={{ width: `${storagePercent}%` }} />
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
