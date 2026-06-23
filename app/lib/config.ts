/**
 * Runtime configuration. `API_URL` is the base URL of the ASP.NET backend that the
 * server-side loaders/actions call (BFF pattern — the browser never calls it directly).
 */
export const API_URL =
  (typeof process !== "undefined" && process.env.VITE_API_URL) ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5280";

/** Secret used to sign the session cookie. Override via `SESSION_SECRET` in production. */
export const SESSION_SECRET =
  (typeof process !== "undefined" && process.env.SESSION_SECRET) ||
  "dev-only-session-secret-change-me";

export const IS_PRODUCTION =
  (typeof process !== "undefined" && process.env.NODE_ENV === "production") ||
  import.meta.env.PROD;

/** Pino log level for the BFF server logger. Defaults to `debug` in dev, `info` in prod. */
export const LOG_LEVEL =
  (typeof process !== "undefined" && process.env.LOG_LEVEL) ||
  (IS_PRODUCTION ? "info" : "debug");
