import { Link } from "react-router";

import { ApiError, verifyEmailRequest } from "~/lib/api.server";

import type { Route } from "./+types/verify-email";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Verify email · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { success: false, error: "Missing verification token." };
  }

  try {
    await verifyEmailRequest(token);
    return { success: true, error: null };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Something went wrong. Please try again.";
    return { success: false, error: message };
  }
}

export default function VerifyEmail({ loaderData }: Route.ComponentProps) {
  const { success, error } = loaderData;

  if (success) {
    return (
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <span className="material-symbols-outlined text-[32px] text-primary">
            verified
          </span>
        </div>
        <h1 className="text-headline-lg text-on-surface">Email verified!</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Your email has been confirmed. You&apos;re all set.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
        >
          Go to Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
        <span className="material-symbols-outlined text-[32px] text-error">
          error
        </span>
      </div>
      <h1 className="text-headline-lg text-on-surface">Verification failed</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {error ?? "The link is invalid or has expired."}
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
