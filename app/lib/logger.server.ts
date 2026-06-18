import { pino, type Logger } from "pino";

import { IS_PRODUCTION, LOG_LEVEL } from "./config";
import type { SessionUser } from "./session.server";

/**
 * Server-only structured logger for the BFF. The browser never calls the ASP.NET API
 * directly (BFF pattern), so this is where outbound API traffic is observed. Emits
 * single-line JSON in production and pretty-prints in development. Credentials and tokens
 * are redacted so login/refresh payloads can never leak into logs.
 */
export const logger: Logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: [
      "headers.authorization",
      "*.headers.authorization",
      "password",
      "newPassword",
      "refreshToken",
      "accessToken",
      "token",
    ],
    censor: "[redacted]",
  },
  ...(IS_PRODUCTION
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }),
});

/** A request-scoped child logger carrying correlation fields (`requestId`, `userId`, ...). */
export type RequestLogger = Logger;

/**
 * Builds a request-scoped child logger. Reuses an inbound `X-Request-Id` (e.g. set by an
 * upstream proxy) when present, otherwise mints one, so a single browser request can be
 * traced through every BFF→API call it triggers.
 */
export function createRequestLogger(
  request: Request,
  fields: Record<string, unknown> = {},
): RequestLogger {
  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  return logger.child({
    requestId,
    method: request.method,
    path: url.pathname,
    ...fields,
  });
}

/** Returns a child logger enriched with the signed-in user's id, once the session is known. */
export function withUser(log: RequestLogger, user: Pick<SessionUser, "id">): RequestLogger {
  return log.child({ userId: user.id });
}
