import { Form, redirect, useNavigation, useSearchParams } from "react-router";

import {
  ApiError,
  changePassword,
  fetchSettings,
  forgotPasswordRequest,
  resendCurrentUserVerification,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { destroySession, getSession } from "~/lib/session.server";

import {
  primarySettingsButton,
  secondarySettingsButton,
  SettingsHeader,
  SettingsNotice,
  SettingsPanel,
  SettingsTextField,
  StatTile,
} from "./settings-ui";
import type { Route } from "./+types/security";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Security - Kuvox" }];
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
    const message = error instanceof ApiError ? error.message : "Couldn't load security settings.";
    reqLog.error({ err: error }, "failed to load security settings");
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
    if (intent === "change-password") {
      const currentPassword = String(formData.get("currentPassword") ?? "");
      const newPassword = String(formData.get("newPassword") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");

      if (newPassword !== confirmPassword) {
        return { error: "New password and confirmation do not match." };
      }

      await changePassword(accessToken, { currentPassword, newPassword }, reqLog);
      return redirect("/login?reset=success", {
        headers: { "Set-Cookie": await destroySession(session) },
      });
    }

    if (intent === "send-reset-link") {
      await forgotPasswordRequest(user.email, reqLog);
      return redirect("/settings/security?saved=reset-link");
    }

    if (intent === "resend-verification") {
      await resendCurrentUserVerification(accessToken, reqLog);
      return redirect("/settings/security?saved=verification");
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent }, "security action failed");
    return { error: message };
  }
}

export default function Security({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const settings = loaderData.settings;
  const isSubmitting = navigation.state === "submitting";
  const saved = searchParams.get("saved");

  return (
    <section className="space-y-6">
      <SettingsHeader
        title="Security"
        subtitle="Manage password, verification, and active session controls."
      />

      {loaderData.error ? <SettingsNotice tone="error">{loaderData.error}</SettingsNotice> : null}
      {actionData?.error ? <SettingsNotice tone="error">{actionData.error}</SettingsNotice> : null}
      {saved === "reset-link" ? (
        <SettingsNotice tone="success">Password reset email requested.</SettingsNotice>
      ) : null}
      {saved === "verification" ? (
        <SettingsNotice tone="success">Verification email requested.</SettingsNotice>
      ) : null}

      {settings ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatTile
              icon={settings.user.emailVerified ? "verified_user" : "gpp_maybe"}
              label="Email verification"
              value={settings.user.emailVerified ? "Verified" : "Unverified"}
            />
            <StatTile icon="key" label="Password" value="Protected" detail="Managed by Auth" />
          </div>

          <SettingsPanel
            title="Change password"
            description="Changing your password revokes refresh tokens and signs this browser out."
          >
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="change-password" />
              <SettingsTextField name="currentPassword" label="Current password" type="password" required />
              <SettingsTextField name="newPassword" label="New password" type="password" required />
              <SettingsTextField name="confirmPassword" label="Confirm new password" type="password" required />
              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className={primarySettingsButton}>
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  {isSubmitting ? "Updating..." : "Update password"}
                </button>
              </div>
            </Form>
          </SettingsPanel>

          <SettingsPanel title="Recovery" description="Request account recovery and verification emails.">
            <div className="flex flex-wrap gap-3">
              <Form method="post">
                <input type="hidden" name="intent" value="send-reset-link" />
                <button type="submit" disabled={isSubmitting} className={secondarySettingsButton}>
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  Send password reset link
                </button>
              </Form>
              {!settings.user.emailVerified ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="resend-verification" />
                  <button type="submit" disabled={isSubmitting} className={secondarySettingsButton}>
                    <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
                    Resend verification
                  </button>
                </Form>
              ) : null}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Session" description="End this browser session and revoke the active refresh token.">
            <Form method="post" action="/logout">
              <button type="submit" className={secondarySettingsButton}>
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Log out
              </button>
            </Form>
          </SettingsPanel>
        </>
      ) : null}
    </section>
  );
}
