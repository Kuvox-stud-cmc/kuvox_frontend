import { createCookieSessionStorage } from "react-router";

import { IS_PRODUCTION, SESSION_SECRET } from "./config";

/** Minimal user projection mirrored from the API's `UserDto`. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  plan: string;
  emailVerified: boolean;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry as an ISO string. */
  expiresAt: string;
  user: SessionUser;
}

type SessionFlashData = {
  error: string;
};

/**
 * httpOnly cookie session set on the **frontend origin** (BFF pattern). Holds the JWT pair
 * and a minimal user. The browser can't read it; loaders/actions forward the access token
 * as `Authorization: Bearer` to the API.
 */
export const sessionStorage = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "__kuvox_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: IS_PRODUCTION,
    maxAge: 60 * 60 * 24 * 30, // 30 days — matches the refresh-token lifetime.
  },
});

export function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export const { commitSession, destroySession } = sessionStorage;
