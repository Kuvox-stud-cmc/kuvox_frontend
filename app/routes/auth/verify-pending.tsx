import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { resendVerificationRequest } from "~/lib/api.server";

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

  try {
    await resendVerificationRequest(email);
  } catch {
    // Swallow — always show a neutral success message (no user enumeration).
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
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <span className="material-symbols-outlined text-[32px] text-primary">
          mail
        </span>
      </div>
      <h1 className="text-headline-lg text-on-surface">Check your email</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        We sent a verification link
        {email ? (
          <>
            {" "}to <span className="font-medium text-on-surface">{email}</span>
          </>
        ) : null}
        . Click it to activate your account, then sign in.
      </p>

      {actionData?.resent && (
        <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-body-sm text-primary">
          Verification email sent. Check your inbox.
        </p>
      )}

      <Form method="post" className="mt-6">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Resend verification email"}
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
