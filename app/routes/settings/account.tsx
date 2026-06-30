import { Form, redirect, useNavigation, useSearchParams } from "react-router";

import { fetchSettings, resendCurrentUserVerification, updateProfile, ApiError } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { commitSession, getSession } from "~/lib/session.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";

import {
  primarySettingsButton,
  secondarySettingsButton,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  SettingsTextField,
  StatTile,
} from "./settings-ui";
import type { Route } from "./+types/account";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Account profile - Kuvox" }];
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
    const message = error instanceof ApiError ? error.message : "Couldn't load account settings.";
    reqLog.error({ err: error }, "failed to load account settings");
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
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "update-profile") {
      const displayName = String(formData.get("displayName") ?? "").trim();
      const updatedUser = await updateProfile(accessToken, { displayName }, reqLog);
      session.set("user", updatedUser);
      return redirect("/settings/account?saved=profile", {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }

    if (intent === "resend-verification") {
      await resendCurrentUserVerification(accessToken, reqLog);
      return redirect("/settings/account?saved=verification");
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "account settings action failed");
    return { error: message };
  }
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const settings = loaderData.settings;
  const isSubmitting = navigation.state === "submitting";
  const saved = searchParams.get("saved");

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Account profile"
        subtitle="Manage the identity details attached to your Kuvox account."
      />

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}
      {actionData?.error ? <SettingsNotice tone="error">{actionData.error}</SettingsNotice> : null}
      {saved === "profile" ? <SettingsNotice tone="success">Profile updated.</SettingsNotice> : null}
      {saved === "verification" ? (
        <SettingsNotice tone="success">Verification email requested.</SettingsNotice>
      ) : null}

      {settings ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatTile icon="workspace_premium" label="Plan" value={settings.user.plan} />
            <StatTile
              icon={settings.user.emailVerified ? "verified" : "mark_email_unread"}
              label="Email"
              value={settings.user.emailVerified ? "Verified" : "Unverified"}
            />
            <StatTile
              icon="calendar_month"
              label="Joined"
              value={new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
                new Date(settings.user.createdAt),
              )}
            />
          </div>

          <SettingsPanel
            title="Profile"
            description="Your display name is visible across the dashboard and shared workspaces."
          >
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update-profile" />
              <SettingsTextField
                name="displayName"
                label="Display name"
                defaultValue={settings.user.displayName}
                required
              />
              <SettingsTextField name="email" label="Email" defaultValue={settings.user.email} readOnly />
              <SettingsTextField name="accountId" label="Account ID" defaultValue={settings.user.id} readOnly />
              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className={primarySettingsButton}>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {isSubmitting ? "Saving..." : "Save profile"}
                </button>
              </div>
            </Form>
          </SettingsPanel>

          {!settings.user.emailVerified ? (
            <SettingsPanel title="Email verification" description="Verify your email to keep account recovery available.">
              <Form method="post">
                <input type="hidden" name="intent" value="resend-verification" />
                <button type="submit" disabled={isSubmitting} className={secondarySettingsButton}>
                  <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
                  Resend verification email
                </button>
              </Form>
            </SettingsPanel>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
