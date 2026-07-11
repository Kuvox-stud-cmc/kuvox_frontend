import { redirect } from "react-router";

import { ApiError, fetchMe, refreshRequest } from "./api.server";
import { logger, type RequestLogger } from "./logger.server";
import {
  commitSession,
  destroySession,
  getSession,
  type SessionUser,
} from "./session.server";

/** Returns the signed-in user, or `null` for anonymous requests. Never redirects. */
export async function getOptionalUser(
  request: Request,
  log?: RequestLogger,
): Promise<SessionUser | null> {
  const session = await getSession(request);
  const user = session.get("user") ?? null;
  if (log) {
    if (user) {
      log.debug({ userId: user.id }, "getOptionalUser: user found");
    } else {
      log.debug("getOptionalUser: no user found");
    }
  }
  return user;
}

/**
 * SSR-safe guard for protected loaders. Returns the user when the session is valid,
 * transparently rotating an expired access token via the refresh token. Redirects to
 * `/login` (preserving the intended path) when there is no usable session.
 */
export async function requireUser(
  request: Request,
  log: RequestLogger = logger,
): Promise<SessionUser> {
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
    log.debug("auth guard: no session, redirecting to login");
    throw loginRedirect();
  }

  // Still valid (with a small clock-skew buffer)?
  if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 5_000) {
    try {
      const validatedUser = await fetchMe(accessToken, log);
      log.debug({ userId: validatedUser.id }, "auth guard: session valid");
      return validatedUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        log.warn({ userId: user.id }, "auth guard: active session was replaced");
        throw redirect("/login?reason=session-replaced", {
          headers: { "Set-Cookie": await destroySession(session) },
        });
      }

      log.warn({ userId: user.id, err: error }, "auth guard: session validation unavailable");
      return user;
    }
  }

  // Expired — try to rotate using the refresh token, then re-run the loader with the
  // refreshed cookie in place.
  if (refreshToken) {
    try {
      const tokens = await refreshRequest(refreshToken, log);
      session.set("accessToken", tokens.accessToken);
      session.set("refreshToken", tokens.refreshToken);
      session.set("expiresAt", tokens.expiresAt);
      log.info({ userId: user.id }, "auth guard: rotated access token");
      throw redirect(request.url, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    } catch (error) {
      if (error instanceof Response) {
        throw error; // the redirect above
      }
      if (error instanceof ApiError && error.code === "session_replaced") {
        throw redirect("/login?reason=session-replaced", {
          headers: { "Set-Cookie": await destroySession(session) },
        });
      }
      log.warn({ userId: user.id }, "auth guard: token refresh failed, logging out");
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
  log?: RequestLogger,
): Promise<void> {
  const session = await getSession(request);
  const user = session.get("user");
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  const expiresAt = session.get("expiresAt");

  if (!user || !accessToken) return;

  try {
    if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 5_000) {
      await fetchMe(accessToken, log);
      if (log) log.debug({ userId: user.id }, `redirectIfAuthenticated: redirecting to ${to}`);
      throw redirect(to);
    }

    if (refreshToken) {
      const tokens = await refreshRequest(refreshToken, log);
      await fetchMe(tokens.accessToken, log);
      session.set("accessToken", tokens.accessToken);
      session.set("refreshToken", tokens.refreshToken);
      session.set("expiresAt", tokens.expiresAt);
      throw redirect(to, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApiError && error.status === 401) {
      throw redirect(request.url, {
        headers: { "Set-Cookie": await destroySession(session) },
      });
    }

    if (log) log.warn({ userId: user.id, err: error }, "redirectIfAuthenticated: validation unavailable");
  }
}
