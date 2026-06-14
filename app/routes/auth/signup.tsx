import { Form, Link, redirect, useNavigation } from "react-router";

import { ApiError, registerRequest } from "~/lib/api.server";
import { redirectIfAuthenticated } from "~/lib/auth.server";

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

  try {
    await registerRequest(email, password, displayName);

    // Hard gate: no auto-login. Send the user to the verification-pending page;
    // they must verify their email before they can sign in.
    return redirect(`/verify-pending?email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Something went wrong. Please try again." };
  }
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Create your account</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">Start editing with Kuvox.</p>

      {actionData?.error && (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-label-md text-on-surface-variant">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </Form>

      <p className="mt-4 text-body-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link to="/login" className="transition-colors hover:text-primary">
          Sign in
        </Link>
      </p>
    </section>
  );
}
