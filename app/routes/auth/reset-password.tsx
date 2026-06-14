import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

import { ApiError, resetPasswordRequest } from "~/lib/api.server";

import type { Route } from "./+types/reset-password";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Reset password · Kuvox" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Missing reset token. Please use the link from your email." };
  }

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    await resetPasswordRequest(token, newPassword);
    return redirect("/login?reset=success");
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Something went wrong. Please try again." };
  }
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return (
      <section>
        <h1 className="text-headline-lg text-on-surface">Invalid link</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          This reset link is missing a token. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block text-body-sm text-primary hover:underline"
        >
          Request new reset link
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Reset your password</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Enter a new password for your account.
      </p>

      {actionData?.error && (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />

        <div>
          <label htmlFor="newPassword" className="block text-label-md text-on-surface-variant">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-label-md text-on-surface-variant">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
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
          {isSubmitting ? "Resetting…" : "Reset password"}
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
