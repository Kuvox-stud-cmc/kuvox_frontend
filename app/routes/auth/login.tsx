import { useState } from "react";
import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import {
  ApiError,
  fetchMe,
  loginRequest,
} from "~/lib/api.server";
import { actionErrorMessage } from "~/lib/action-error.server";
import { redirectIfAuthenticated } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";
import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Log in · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request);
  const redirectTo = new URL(request.url).searchParams.get("redirectTo") ?? "/dashboard";
  return { redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");
  const replaceExistingSession = formData.get("replaceExistingSession") === "true";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const log = createRequestLogger(request);

  try {
    const tokens = await loginRequest(email, password, replaceExistingSession, log);
    const user = await fetchMe(tokens.accessToken, log);
    log.info({ userId: user.id }, "login succeeded");

    const session = await getSession(request);
    session.set("accessToken", tokens.accessToken);
    session.set("refreshToken", tokens.refreshToken);
    session.set("expiresAt", tokens.expiresAt);
    session.set("user", user);

    return redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "active_session_conflict") {
      log.warn("login requires explicit active-session takeover");
      return {
        error: "This account already has an active session.",
        activeSessionConflict: true,
        unverified: false,
        email,
      };
    }
    if (error instanceof ApiError && error.status === 401) {
      log.warn("login failed: invalid credentials");
      return {
        error: "Invalid email or password.",
        activeSessionConflict: replaceExistingSession,
        unverified: false,
        email,
      };
    }
    if (error instanceof ApiError && error.status === 403) {
      // Hard gate: the account exists but isn't verified yet.
      return {
        error: "Please verify your email before signing in.",
        unverified: true,
        email,
      };
    }
    return { error: actionErrorMessage(error, "Something went wrong. Please try again."), unverified: false, email };
  }
}

export default function Login({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const resetSuccess = searchParams.get("reset") === "success";
  const sessionReplaced = searchParams.get("reason") === "session-replaced";

  return (
    <section>
      <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Sign in</h1>
      <p className="mt-1.5 text-body-sm text-on-surface-variant/80">
        Sign in to continue to Kuvox.
      </p>

      {resetSuccess && (
        <p className="mt-4 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-body-sm text-primary animate-fade-in-section">
          Password reset successful. Sign in with your new password.
        </p>
      )}

      {sessionReplaced && (
        <p className="mt-4 rounded-xl border border-error/20 bg-error-container/10 px-4 py-3 text-body-sm text-error animate-fade-in-section">
          Your session ended because this account signed in elsewhere.
        </p>
      )}

      {actionData?.error && (
        <div className="mt-4 rounded-xl border border-error/20 bg-error-container/10 px-4 py-3 text-body-sm text-error animate-fade-in-section">
          <p>{actionData.error}</p>
          {actionData.unverified && (
            <Link
              to={`/verify-pending?email=${encodeURIComponent(actionData.email ?? "")}`}
              className="mt-1.5 inline-block font-medium underline underline-offset-2 hover:text-on-error-container transition-colors"
            >
              Resend verification email
            </Link>
          )}
          {actionData.activeSessionConflict && (
            <p className="mt-1.5 text-on-surface-variant">
              Continuing will sign out the previous browser or device.
            </p>
          )}
        </div>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <div>
          <label htmlFor="email" className="block text-label-md font-medium text-on-surface-variant/85 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-body-sm text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-primary/20 transition-all duration-200 outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-label-md font-medium text-on-surface-variant/85 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] pl-3.5 pr-11 text-body-sm text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-primary/20 transition-all duration-200 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/70 transition-colors hover:bg-white/10 hover:text-on-surface"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          name="replaceExistingSession"
          value={actionData?.activeSessionConflict ? "true" : "false"}
          disabled={isSubmitting}
          className="w-full h-11 mt-6 rounded-xl bg-primary text-label-md font-semibold text-on-primary shadow-[0_4px_20px_rgba(192,193,255,0.2)] hover:bg-primary-fixed-dim hover:shadow-[0_4px_24px_rgba(192,193,255,0.35)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting
            ? "Signing in…"
            : actionData?.activeSessionConflict
              ? "End existing session and sign in"
              : "Sign in"}
        </button>
      </Form>

      <div className="mt-6 flex justify-between text-label-md text-on-surface-variant/75">
        <Link to="/forgot-password" className="transition-colors hover:text-primary hover:underline underline-offset-4">
          Forgot password?
        </Link>
        <Link to="/signup" className="transition-colors hover:text-primary hover:underline underline-offset-4">
          Create account
        </Link>
      </div>
    </section>
  );
}
