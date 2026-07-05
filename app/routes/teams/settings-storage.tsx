import type { MediaStorageUsageDto, StudioUsageSummaryDto } from "~/lib/api";
import { ApiError, getStorageUsage, getUsageSummary } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAdminAccess } from "./access.server";
import {
  formatBytes,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  StatTile,
} from "../settings/settings-ui";
import type { Route } from "./+types/settings-storage";

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
      storageUsage: null as MediaStorageUsageDto | null,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    await requireStudioAdminAccess(accessToken, params.studioId, reqLog);
    const [usage, storageUsage] = await Promise.all([
      getUsageSummary(accessToken, params.studioId, reqLog),
      getStorageUsage(accessToken, reqLog, { kind: "studio", studioId: params.studioId }),
    ]);

    return { usage, storageUsage, error: null as string | null };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = error instanceof ApiError ? error.message : "Couldn't load storage settings.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio storage settings");
    return {
      usage: null as StudioUsageSummaryDto | null,
      storageUsage: null as MediaStorageUsageDto | null,
      error: message,
    };
  }
}

export default function TeamStorageSettings({ loaderData }: Route.ComponentProps) {
  const { usage, storageUsage, error } = loaderData;
  const storagePercent = storageUsage ? Math.min(100, Math.max(0, Number(storageUsage.storagePercent))) : 0;
  const nearingLimit = storagePercent >= 80;
  const overLimit = storagePercent >= 100;

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Storage"
        subtitle="Review Studio media storage across active files, trash, optimized objects, proxies, and thumbnails."
      />

      {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}

      {usage && storageUsage ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatTile
              icon="cloud"
              label="Storage used"
              value={formatBytes(storageUsage.storageBytesUsed)}
              detail={`${formatBytes(storageUsage.storageBytesQuota)} quota`}
            />
            <StatTile icon="perm_media" label="Media items" value={storageUsage.mediaCount.toLocaleString()} />
            <StatTile icon="folder" label="Projects" value={usage.projectCount.toLocaleString()} />
            <StatTile icon="group" label="Members" value={usage.memberCount.toLocaleString()} />
          </div>

          <SettingsPanel
            title="Studio storage"
            description={`${storageUsage.plan} workspace storage across raw files, optimized media, proxies, and thumbnails.`}
          >
            <div className="space-y-5">
              {overLimit ? (
                <SettingsNotice tone="error">Storage quota exceeded. Delete media or empty trash before uploading more.</SettingsNotice>
              ) : nearingLimit ? (
                <SettingsNotice tone="warning">This Studio is nearing its storage quota. Trash still counts until media is permanently deleted.</SettingsNotice>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between text-label-md text-on-surface-variant">
                  <span>
                    {formatBytes(storageUsage.storageBytesUsed)} of {formatBytes(storageUsage.storageBytesQuota)} used
                  </span>
                  <span>{storagePercent.toFixed(storagePercent % 1 === 0 ? 0 : 1)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className={`h-full rounded-full transition-all ${overLimit ? "bg-error" : nearingLimit ? "bg-tertiary" : "bg-primary"}`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile icon="inventory_2" label="Active" value={formatBytes(storageUsage.activeBytesUsed)} />
                <StatTile icon="delete" label="Trash" value={formatBytes(storageUsage.trashBytesUsed)} />
                <StatTile icon="perm_media" label="Media items" value={storageUsage.mediaCount.toLocaleString()} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Breakdown label="Raw" value={storageUsage.objectBreakdown.rawBytes} />
                <Breakdown label="Canonical" value={storageUsage.objectBreakdown.canonicalBytes} />
                <Breakdown label="Proxy" value={storageUsage.objectBreakdown.proxyBytes} />
                <Breakdown label="Thumbnails" value={storageUsage.objectBreakdown.thumbnailBytes} />
              </div>
            </div>
          </SettingsPanel>
        </>
      ) : null}
    </section>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container p-3">
      <p className="text-label-md font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{label}</p>
      <p className="mt-1 text-body-md font-bold text-on-surface">{formatBytes(value)}</p>
    </div>
  );
}
