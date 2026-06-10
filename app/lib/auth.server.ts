import { redirect } from "react-router";

import { refreshRequest } from "./api.server";
import {
  commitSession,
  destroySession,
  getSession,
  type SessionUser,
} from "./session.server";

/** Returns the signed-in user, or `null` for anonymous requests. Never redirects. */
export async function getOptionalUser(
  request: Request,
): Promise<SessionUser | null> {
  const session = await getSession(request);
  return session.get("user") ?? null;
}

/**
 * SSR-safe guard for protected loaders. Returns the user when the session is valid,
 * transparently rotating an expired access token via the refresh token. Redirects to
 * `/login` (preserving the intended path) when there is no usable session.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const session = await getSession(request);
  const user = session.get("user");
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  const expiresAt = session.get("expiresAt");

  const loginRedirect = () => {
    const path = new URL(request.url).pathname;
    return redirect(`/login?redirectTo=${encodeURIComponent(path)}`);
  };

  if (!user || !accessToken) {
    throw loginRedirect();
  }

  // Still valid (with a small clock-skew buffer)?
  if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 5_000) {
    return user;
  }

  // Expired — try to rotate using the refresh token, then re-run the loader with the
  // refreshed cookie in place.
  if (refreshToken) {
    try {
      const tokens = await refreshRequest(refreshToken);
      session.set("accessToken", tokens.accessToken);
      session.set("refreshToken", tokens.refreshToken);
      session.set("expiresAt", tokens.expiresAt);
      throw redirect(request.url, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    } catch (error) {
      if (error instanceof Response) {
        throw error; // the redirect above
      }
      // fall through to a clean logout on refresh failure
    }
  }

  throw redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

/** Redirects already-authenticated users away from auth pages (login/signup). */
export async function redirectIfAuthenticated(
  request: Request,
  to = "/dashboard",
): Promise<void> {
  const user = await getOptionalUser(request);
  if (user) {
    throw redirect(to);
  }
}
