import { Link, redirect } from "react-router";

import { ApiError, fetchMe, verifyEmailRequest } from "~/lib/api.server";
import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/verify-email";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Verify email · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { error: "Missing verification token." };
  }

  try {
    const { tokens, isNewlyVerified } = await verifyEmailRequest(token);
    const user = await fetchMe(tokens.accessToken);

    // Auto-login: establish a session in this browser, then continue into the app.
    const session = await getSession(request);
    session.set("accessToken", tokens.accessToken);
    session.set("refreshToken", tokens.refreshToken);
    session.set("expiresAt", tokens.expiresAt);
    session.set("user", user);

    return redirect(isNewlyVerified ? "/onboarding/welcome" : "/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Something went wrong. Please try again.";
    return { error: message };
  }
}

export default function VerifyEmail({ loaderData }: Route.ComponentProps) {
  const { error } = loaderData;

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
