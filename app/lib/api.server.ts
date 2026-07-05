// api.server.ts — backward-compatible barrel
export * from "./api/auth.server";
export * from "./api/projects.server";
export * from "./api/media.server";
export * from "./api/trash.server";
export * from "./api/studios.server";
export * from "./api/albums.server";
export * from "./api/notifications.server";
export * from "./api/tasks.server";
export { ApiError } from "./api/api-client.server";

// Keep AuthTokens and apiFetch explicitly exported if any legacy code imports them directly
export type { AuthTokens } from "./api/auth.server";

// We also need to export apiFetch for any files still using the old method directly.
import type { RequestLogger } from "./logger.server";
import { apiClient, bearerAuth } from "./api/api-client.server";

export function apiFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  log?: RequestLogger,
): Promise<Response> {
  const method = init.method ?? "GET";
  // To keep apiFetch backward compatible (returning the raw Response object):
  // Since our new ApiClient auto-parses, if a caller specifically needed the Response,
  // we can reconstruct or bypass. Wait, the old apiFetch returned a Promise<Response>.
  // We can just use fetch directly with our decorators.
  // The ApiClient instance doesn't publicly expose its pipeline.
  // I will just implement a raw fetch wrapper here to satisfy any remaining `apiFetch` callers.
  
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  
  const API_URL = apiClient.baseUrl;
  const requestId = log?.bindings().requestId as string | undefined;
  if (requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", requestId);
  }
  
  const start = performance.now();
  return fetch(`${API_URL}${path}`, { ...init, headers }).then((res) => {
    if (log) {
      const durationMs = Math.round(performance.now() - start);
      const fields = { apiMethod: method.toUpperCase(), apiPath: path, status: res.status, durationMs };
      if (res.ok) {
        log.info(fields, "api call");
      } else {
        log.warn(fields, "api call failed");
      }
    }
    return res;
  }).catch((err) => {
    if (log) {
      const durationMs = Math.round(performance.now() - start);
      log.error({ apiMethod: method.toUpperCase(), apiPath: path, durationMs, err }, "api call errored");
    }
    throw err;
  });
}
