import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { resendVerificationRequest } from "~/lib/api.server";
import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/verify-pending";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Verify your email · Kuvox" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email is required.", resent: false };
  }

  const log = createRequestLogger(request);

  try {
    await resendVerificationRequest(email, log);
    log.info("verify-pending resend succeeded");
  } catch (error) {
    // Swallow — always show a neutral success message (no user enumeration).
    log.warn({ err: error }, "verify-pending resend failed or swallowed");
  }

  return { error: null, resent: true };
}

export default function VerifyPending({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <section className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <span className="material-symbols-outlined text-[32px] text-primary">
          mail
        </span>
      </div>
      <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">Check your email</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant/80">
        We sent a verification link
        {email ? (
          <>
            {" "}to <span className="font-semibold text-on-surface">{email}</span>
          </>
        ) : null}
        . Click it to activate your account, then sign in.
      </p>

      {actionData?.resent && (
        <p className="mt-4 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-body-sm text-primary animate-fade-in-section">
          Verification email sent. Check your inbox.
        </p>
      )}

      <Form method="post" className="mt-6">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-primary text-label-md font-semibold text-on-primary shadow-[0_4px_20px_rgba(192,193,255,0.2)] hover:bg-primary-fixed-dim hover:shadow-[0_4px_24px_rgba(192,193,255,0.35)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? "Sending…" : "Resend verification email"}
        </button>
      </Form>

      <div className="mt-6">
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
