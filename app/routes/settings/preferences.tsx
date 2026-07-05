import { actionErrorMessage } from "~/lib/action-error.server";
import { Form, redirect, useNavigation, useSearchParams } from "react-router";

import { fetchSettings, updatePreferences, ApiError } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import {
  primarySettingsButton,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  ToggleRow,
} from "./settings-ui";
import type { Route } from "./+types/preferences";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Preferences - Kuvox" }];
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
    const message = error instanceof ApiError ? error.message : "Couldn't load preferences.";
    reqLog.error({ err: error }, "failed to load preferences");
    return { settings: null, error: message };
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

  try {
    await updatePreferences(
      accessToken,
      {
        emailNotificationsEnabled: String(formData.get("emailNotificationsEnabled")) === "true",
        productUpdatesEnabled: String(formData.get("productUpdatesEnabled")) === "true",
        weeklyDigestEnabled: String(formData.get("weeklyDigestEnabled")) === "true",
        defaultEditorMode: String(formData.get("defaultEditorMode") ?? "manual"),
      },
      reqLog,
    );
    return redirect("/settings/preferences?saved=1");
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error }, "preferences action failed");
    return { error: message };
  }
}

export default function Preferences({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const settings = loaderData.settings;
  const isSubmitting = navigation.state === "submitting";

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Preferences"
        subtitle="Choose how Kuvox communicates with you and which editor mode opens by default."
      />

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}
      {actionData?.error ? <SettingsNotice tone="error">{actionData.error}</SettingsNotice> : null}
      {searchParams.get("saved") ? <SettingsNotice tone="success">Preferences saved.</SettingsNotice> : null}

      {settings ? (
        <SettingsPanel title="App preferences" description="These values are persisted by the Auth module.">
          <Form method="post" className="space-y-4">
            <ToggleRow
              name="emailNotificationsEnabled"
              label="Email notifications"
              description="Receive operational account emails from Kuvox."
              defaultChecked={settings.preferences.emailNotificationsEnabled}
            />
            <ToggleRow
              name="productUpdatesEnabled"
              label="Product updates"
              description="Receive release notes and product update announcements."
              defaultChecked={settings.preferences.productUpdatesEnabled}
            />
            <ToggleRow
              name="weeklyDigestEnabled"
              label="Weekly digest"
              description="Receive a weekly summary when this notification type is available."
              defaultChecked={settings.preferences.weeklyDigestEnabled}
            />

            <label className="block rounded-lg border border-outline-variant bg-surface-container p-4">
              <span className="block text-body-sm font-semibold text-on-surface">Default editor mode</span>
              <span className="mt-1 block text-label-md text-on-surface-variant">
                Choose whether new editing sessions open in manual or AI mode.
              </span>
              <select
                name="defaultEditorMode"
                defaultValue={settings.preferences.defaultEditorMode}
                className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="manual">Manual editor</option>
                <option value="ai">AI editor</option>
              </select>
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting} className={primarySettingsButton}>
                <span className="material-symbols-outlined text-[18px]">save</span>
                {isSubmitting ? "Saving..." : "Save preferences"}
              </button>
            </div>
          </Form>
        </SettingsPanel>
      ) : null}
    </section>
  );
}
