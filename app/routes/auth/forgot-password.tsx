import { Form, Link, useNavigation } from "react-router";

import { forgotPasswordRequest } from "~/lib/api.server";

import type { Route } from "./+types/forgot-password";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Forgot password · Kuvox" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email is required.", sent: false };
  }

  try {
    await forgotPasswordRequest(email);
  } catch {
    // Swallow — always show a neutral success message (no user enumeration).
  }

  return { error: null, sent: true };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.sent) {
    return (
      <section>
        <h1 className="text-headline-lg text-on-surface">Check your email</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          If an account exists for that email, we&apos;ve sent a password reset
          link. It expires in 1 hour.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-body-sm text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Forgot password</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {actionData?.error && (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-label-md text-on-surface-variant">
            Email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </Form>

      <Link
        to="/login"
        className="mt-4 inline-block text-body-sm text-on-surface-variant transition-colors hover:text-primary"
      >
        Back to sign in
      </Link>
    </section>
  );
}
