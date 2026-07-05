import { Link, redirect } from "react-router";

import {
  acceptStudioInvitation,
  fetchMe,
  refreshRequest,
} from "~/lib/api.server";
import { actionErrorMessage } from "~/lib/action-error.server";
import { createRequestLogger } from "~/lib/logger.server";
import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/accept";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Accept invitation - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return { accepted: false, error: "Missing invitation token.", signedIn: false };
  }

  const log = createRequestLogger(request);
  const session = await getSession(request);
  let accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  const expiresAt = session.get("expiresAt");
  const signedIn = Boolean(session.get("user") && accessToken);

  if (accessToken && refreshToken && tokenIsExpired(expiresAt)) {
    try {
      const tokens = await refreshRequest(refreshToken, log);
      accessToken = tokens.accessToken;
      session.set("accessToken", tokens.accessToken);
      session.set("refreshToken", tokens.refreshToken);
      session.set("expiresAt", tokens.expiresAt);
    } catch (error) {
      log.warn({ err: error }, "invitation accept: pre-accept refresh failed");
      accessToken = undefined;
    }
  }

  try {
    await acceptStudioInvitation(token, accessToken, log);

    if (refreshToken) {
      try {
        const tokens = await refreshRequest(refreshToken, log);
        const user = await fetchMe(tokens.accessToken, log);
        session.set("accessToken", tokens.accessToken);
        session.set("refreshToken", tokens.refreshToken);
        session.set("expiresAt", tokens.expiresAt);
        session.set("user", user);

        return redirect("/dashboard/team", {
          headers: { "Set-Cookie": await commitSession(session) },
        });
      } catch (error) {
        log.warn({ err: error }, "invitation accept: post-accept refresh failed");
      }
    }

    return { accepted: true, error: null, signedIn };
  } catch (error) {
    const message = actionErrorMessage(error, "Something went wrong. Please try again.");
    log.warn({ err: error, message }, "invitation accept failed");
    return { accepted: false, error: message, signedIn };
  }
}

export default function AcceptInvitation({ loaderData }: Route.ComponentProps) {
  const { accepted, error, signedIn } = loaderData;

  if (accepted) {
    return (
      <InvitationResult
        icon="check_circle"
        tone="text-secondary"
        title="Invitation accepted"
        body="Your Studio access is ready. Sign in to continue if this browser is not already signed in."
        primaryTo="/login"
        primaryLabel="Sign in"
        secondaryTo="/dashboard"
        secondaryLabel="Go to dashboard"
      />
    );
  }

  const needsAccount = error?.toLowerCase().includes("create and verify");

  return (
    <InvitationResult
      icon="error"
      tone="text-error"
      title="Invitation not accepted"
      body={error ?? "The invitation link is invalid or has expired."}
      primaryTo={needsAccount ? "/signup" : signedIn ? "/dashboard" : "/login"}
      primaryLabel={needsAccount ? "Create account" : signedIn ? "Go to dashboard" : "Sign in"}
      secondaryTo="/"
      secondaryLabel="Back to Kuvox"
    />
  );
}

function InvitationResult({
  icon,
  tone,
  title,
  body,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
}: {
  icon: string;
  tone: string;
  title: string;
  body: string;
  primaryTo: string;
  primaryLabel: string;
  secondaryTo: string;
  secondaryLabel: string;
}) {
  return (
    <section className="w-full max-w-xl text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high">
        <span className={`material-symbols-outlined text-[36px] ${tone}`}>{icon}</span>
      </div>
      <h1 className="mt-5 text-headline-lg font-bold text-on-surface">{title}</h1>
      <p className="mt-2 text-body-md text-on-surface-variant">{body}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to={primaryTo}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
        >
          {primaryLabel}
        </Link>
        <Link
          to={secondaryTo}
          className="inline-flex items-center justify-center rounded-lg border border-outline-variant px-4 py-2 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high"
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

function tokenIsExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now() + 5_000;
}
