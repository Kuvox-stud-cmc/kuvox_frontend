import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import { ApiError, registerRequest } from "~/lib/api.server";
import { actionErrorMessage } from "~/lib/action-error.server";
import { redirectIfAuthenticated } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/signup";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign up · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!displayName || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const log = createRequestLogger(request);

  try {
    await registerRequest(email, password, displayName, log);
    log.info("signup succeeded");

    // Hard gate: no auto-login. Send the user to the verification-pending page;
    // they must verify their email before they can sign in.
    return redirect(`/verify-pending?email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      log.warn("signup failed: account already exists");
      return { error: "An account with this email already exists." };
    }
    log.error({ err: error }, "signup failed: unexpected error");
    return { error: actionErrorMessage(error, "Something went wrong. Please try again.") };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section>
      <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Create your account</h1>
      <p className="mt-1.5 text-body-sm text-on-surface-variant/80">Start editing with Kuvox.</p>

      {actionData?.error && (
        <p className="mt-4 rounded-xl border border-error/20 bg-error-container/10 px-4 py-3 text-body-sm text-error animate-fade-in-section">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-label-md font-medium text-on-surface-variant/85 mb-1.5">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-body-sm text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-primary/20 transition-all duration-200 outline-none"
          />
        </div>

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
              autoComplete="new-password"
              required
              minLength={8}
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
          disabled={isSubmitting}
          className="w-full h-11 mt-6 rounded-xl bg-primary text-label-md font-semibold text-on-primary shadow-[0_4px_20px_rgba(192,193,255,0.2)] hover:bg-primary-fixed-dim hover:shadow-[0_4px_24px_rgba(192,193,255,0.35)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </Form>

      <p className="mt-6 text-label-md text-on-surface-variant/75 text-center">
        Already have an account?{" "}
        <Link to="/login" className="transition-colors hover:text-primary hover:underline underline-offset-4 font-medium">
          Sign in
        </Link>
      </p>
    </section>
  );
}
