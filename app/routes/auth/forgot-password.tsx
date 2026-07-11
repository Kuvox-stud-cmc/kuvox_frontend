import { Form, Link, useNavigation } from "react-router";

import { forgotPasswordRequest } from "~/lib/api.server";
import { createRequestLogger } from "~/lib/logger.server";

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

  const log = createRequestLogger(request);

  try {
    await forgotPasswordRequest(email, log);
    log.info("forgot-password succeeded");
  } catch (error) {
    // Swallow — always show a neutral success message (no user enumeration).
    log.warn({ err: error }, "forgot-password failed or swallowed");
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
      <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Forgot password</h1>
      <p className="mt-1.5 text-body-sm text-on-surface-variant/80">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {actionData?.error && (
        <p className="mt-4 rounded-xl border border-error/20 bg-error-container/10 px-4 py-3 text-body-sm text-error animate-fade-in-section">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-label-md font-medium text-on-surface-variant/85 mb-1.5">
            Email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-body-sm text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-primary/20 transition-all duration-200 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 mt-6 rounded-xl bg-primary text-label-md font-semibold text-on-primary shadow-[0_4px_20px_rgba(192,193,255,0.2)] hover:bg-primary-fixed-dim hover:shadow-[0_4px_24px_rgba(192,193,255,0.35)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </Form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="text-label-md text-on-surface-variant/75 transition-colors hover:text-primary hover:underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
