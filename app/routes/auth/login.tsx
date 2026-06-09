import { Form, Link, redirect, useNavigation } from "react-router";

import {
  ApiError,
  fetchMe,
  loginRequest,
} from "~/lib/api.server";
import { redirectIfAuthenticated } from "~/lib/auth.server";
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

  try {
    const tokens = await loginRequest(email, password);
    const user = await fetchMe(tokens.accessToken);

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
      return { error: "Invalid email or password." };
    }
    return { error: "Something went wrong. Please try again." };
  }
}

export default function Login({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Log in</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Sign in to continue to Kuvox.
      </p>

      {actionData?.error && (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionData.error}
        </p>
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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
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
