import { fetchSettings, ApiError } from "~/lib/api.server";
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
    return { settings: null, error: "Your session expired. Please sign in again." };
  }

  try {
    return { settings: await fetchSettings(accessToken, reqLog), error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load quota settings.";
    reqLog.error({ err: error }, "failed to load quota settings");
    return { settings: null, error: message };
  }
}

export default function Quota({ loaderData }: Route.ComponentProps) {
  const settings = loaderData.settings;

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Usage & quotas"
        subtitle="Review the plan limits currently available to your account."
      />

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}

      {settings ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatTile
              icon="cloud"
              label="Storage"
              value={formatBytes(settings.planLimits.storageBytes)}
              detail="Plan limit"
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
            title="Usage tracking"
            description="The Auth module provides plan limits. Usage totals are not exposed by a backend module yet."
          >
            <SettingsNotice>
              Real usage counters will appear here when storage and project usage APIs are available. No mock usage
              numbers are shown.
            </SettingsNotice>
          </SettingsPanel>
        </>
      ) : null}
    </section>
  );
}
