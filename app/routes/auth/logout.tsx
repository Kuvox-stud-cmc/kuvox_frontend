import { redirect } from "react-router";

import { logoutRequest } from "~/lib/api.server";
import { destroySession, getSession } from "~/lib/session.server";

import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/logout";

/** Revokes the refresh token server-side, clears the session cookie, and returns home. */
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  const refreshToken = session.get("refreshToken");

  if (refreshToken) {
    const log = createRequestLogger(request);
    await logoutRequest(refreshToken, log);
    log.info("logout: token revoked");
  }

  return redirect("/", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

/** A direct GET to /logout shouldn't render anything — just go home. */
export async function loader() {
  return redirect("/");
}
