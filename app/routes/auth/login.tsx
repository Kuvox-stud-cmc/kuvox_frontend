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

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const log = createRequestLogger(request);

  try {
    const tokens = await loginRequest(email, password, log);
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
    if (error instanceof ApiError && error.status === 401) {
      log.warn("login failed: invalid credentials");
      return { error: "Invalid email or password.", unverified: false, email };
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

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Log in</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Sign in to continue to Kuvox.
      </p>

      {resetSuccess && (
        <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-body-sm text-primary">
          Password reset successful. Sign in with your new password.
        </p>
      )}

      {actionData?.error && (
        <div className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          <p>{actionData.error}</p>
          {actionData.unverified && (
            <Link
              to={`/verify-pending?email=${encodeURIComponent(actionData.email ?? "")}`}
              className="mt-1 inline-block font-medium underline"
            >
              Resend verification email
            </Link>
          )}
        </div>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <div>
          <label htmlFor="email" className="block text-label-md text-on-surface-variant">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-label-md text-on-surface-variant">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-outline-variant bg-surface-container py-2 pl-3 pr-11 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
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
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </Form>

      <div className="mt-4 flex justify-between text-body-sm text-on-surface-variant">
        <Link to="/forgot-password" className="transition-colors hover:text-primary">
          Forgot password?
        </Link>
        <Link to="/signup" className="transition-colors hover:text-primary">
          Create account
        </Link>
      </div>
    </section>
  );
}
