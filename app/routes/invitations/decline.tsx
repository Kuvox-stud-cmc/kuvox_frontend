import { Link } from "react-router";

import { ApiError, declineStudioInvitation } from "~/lib/api.server";
import { createRequestLogger } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/decline";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Decline invitation - Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return { declined: false, error: "Missing invitation token." };
  }

  const log = createRequestLogger(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  try {
    await declineStudioInvitation(token, accessToken, log);
    return { declined: true, error: null };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Something went wrong. Please try again.";
    log.warn({ err: error, message }, "invitation decline failed");
    return { declined: false, error: message };
  }
}

export default function DeclineInvitation({ loaderData }: Route.ComponentProps) {
  const { declined, error } = loaderData;

  return (
    <section className="w-full max-w-xl text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high">
        <span
          className={`material-symbols-outlined text-[36px] ${
            declined ? "text-secondary" : "text-error"
          }`}
        >
          {declined ? "check_circle" : "error"}
        </span>
      </div>
      <h1 className="mt-5 text-headline-lg font-bold text-on-surface">
        {declined ? "Invitation declined" : "Invitation not declined"}
      </h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        {declined
          ? "The Studio invitation has been declined."
          : error ?? "The invitation link is invalid or has expired."}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
        >
          Back to Kuvox
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-lg border border-outline-variant px-4 py-2 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
