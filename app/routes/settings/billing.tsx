import { Link } from "react-router";

import { fetchSettings, ApiError } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import {
  formatBytes,
  primarySettingsButton,
  secondarySettingsButton,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  StatTile,
} from "./settings-ui";
import type { Route } from "./+types/billing";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Billing & subscription - Kuvox" }];
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
    const message = error instanceof ApiError ? error.message : "Couldn't load billing settings.";
    reqLog.error({ err: error }, "failed to load billing settings");
    return { settings: null, error: message };
  }
}

export default function Billing({ loaderData }: Route.ComponentProps) {
  const settings = loaderData.settings;

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Billing & subscription"
        subtitle="View the plan attached to your authenticated Kuvox account."
      >
        <Link to="/pricing" className={primarySettingsButton}>
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          View plans
        </Link>
      </SettingsHeader>

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}

      {settings ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatTile icon="workspace_premium" label="Current plan" value={settings.planLimits.plan} />
            <StatTile
              icon="cloud"
              label="Storage limit"
              value={formatBytes(settings.planLimits.storageBytes)}
            />
            <StatTile icon="folder" label="Project limit" value={settings.planLimits.projects} />
          </div>

          <SettingsPanel
            title="Subscription"
            description="Billing changes are handled through the pricing flow. This page only shows real plan data from Auth."
          >
            <div className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-body-sm font-semibold text-on-surface">{settings.planLimits.plan} plan</p>
                <p className="mt-1 text-label-md text-on-surface-variant">
                  {settings.planLimits.prioritySupport
                    ? "Priority support is included."
                    : "Priority support is not included on this plan."}
                </p>
              </div>
              <Link to="/pricing" className={secondarySettingsButton}>
                Compare plans
              </Link>
            </div>
          </SettingsPanel>
        </>
      ) : null}
    </section>
  );
}
