import { fetchSettings, getStorageUsage, ApiError } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import {
  formatBytes,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  StatTile,
} from "./settings-ui";
import type { Route } from "./+types/quota";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Usage & quotas - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { settings: null, storageUsage: null, error: "Your session expired. Please sign in again." };
  }

  try {
    const [settings, storageUsage] = await Promise.all([
      fetchSettings(accessToken, reqLog),
      getStorageUsage(accessToken, reqLog),
    ]);
    return { settings, storageUsage, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load quota settings.";
    reqLog.error({ err: error }, "failed to load quota settings");
    return { settings: null, storageUsage: null, error: message };
  }
}

export default function Quota({ loaderData }: Route.ComponentProps) {
  const settings = loaderData.settings;
  const usage = loaderData.storageUsage;
  const storagePercent = usage ? Math.min(100, Math.max(0, Number(usage.storagePercent))) : 0;
  const nearingLimit = storagePercent >= 80;
  const overLimit = storagePercent >= 100;

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Usage & quotas"
        subtitle="Review storage used by your personal media library and the plan limits on your account."
      />

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}

      {settings && usage ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatTile
              icon="cloud"
              label="Storage used"
              value={formatBytes(usage.storageBytesUsed)}
              detail={`${formatBytes(usage.storageBytesQuota)} quota`}
            />
            <StatTile icon="folder" label="Projects" value={settings.planLimits.projects} detail="Plan limit" />
            <StatTile icon="group" label="Team seats" value={settings.planLimits.teamSeats} detail="Plan limit" />
            <StatTile
              icon="support_agent"
              label="Support"
              value={settings.planLimits.prioritySupport ? "Priority" : "Standard"}
            />
          </div>

          <SettingsPanel
            title="Personal storage"
            description={`${usage.plan} plan storage across raw files, optimized media, proxies, and thumbnails.`}
          >
            <div className="space-y-5">
              {overLimit ? (
                <SettingsNotice tone="error">Storage quota exceeded. Delete media or empty trash before uploading more.</SettingsNotice>
              ) : nearingLimit ? (
                <SettingsNotice tone="warning">You are nearing your storage quota. Trash still counts until media is permanently deleted.</SettingsNotice>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between text-label-md text-on-surface-variant">
                  <span>{formatBytes(usage.storageBytesUsed)} of {formatBytes(usage.storageBytesQuota)} used</span>
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
                <StatTile icon="inventory_2" label="Active" value={formatBytes(usage.activeBytesUsed)} />
                <StatTile icon="delete" label="Trash" value={formatBytes(usage.trashBytesUsed)} />
                <StatTile icon="perm_media" label="Media items" value={usage.mediaCount} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Breakdown label="Raw" value={usage.objectBreakdown.rawBytes} />
                <Breakdown label="Canonical" value={usage.objectBreakdown.canonicalBytes} />
                <Breakdown label="Proxy" value={usage.objectBreakdown.proxyBytes} />
                <Breakdown label="Thumbnails" value={usage.objectBreakdown.thumbnailBytes} />
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
