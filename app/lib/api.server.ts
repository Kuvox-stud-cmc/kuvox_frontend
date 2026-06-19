import {
  workspaceQuery,
  type MediaDto,
  type MediaTrashItem,
  type PagedResult,
  type ProjectDto,
  type ProjectTrashItem,
  type ResourceKind,
  type StudioDto,
  type StudioMemberDto,
  type Workspace,
} from "./api";
import { API_URL } from "./config";
import { logger, type RequestLogger } from "./logger.server";
import type { SessionUser } from "./session.server";
import { API_ROUTES } from "~/const/api-routes";

/** Mirrors the API's `AuthTokenDto`. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/** Mirrors the API's `UserDto`. */
interface ApiUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  emailVerified: boolean;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.title || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function toSessionUser(dto: ApiUserDto): SessionUser {
  return {
    id: dto.id,
    email: dto.email,
    displayName: dto.displayName,
    plan: dto.plan,
    emailVerified: dto.emailVerified,
  };
}

/**
 * Single choke point for every BFF→API request: times the call and logs method, path,
 * status and duration on the request-scoped logger (falling back to the base logger).
 * Forwards the correlation id as `X-Request-Id` so the backend can join its logs to ours.
 */
async function loggedFetch(
  path: string,
  init: RequestInit,
  log: RequestLogger = logger,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const requestId = log.bindings().requestId as string | undefined;
  if (requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", requestId);
  }

  const start = performance.now();
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const durationMs = Math.round(performance.now() - start);
    const fields = { apiMethod: method, apiPath: path, status: response.status, durationMs };
    if (response.ok) {
      log.info(fields, "api call");
    } else {
      log.warn(fields, "api call failed");
    }
    return response;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    log.error({ apiMethod: method, apiPath: path, durationMs, err: error }, "api call errored");
    throw error;
  }
}

/** Low-level JSON POST to the API. */
async function postJson<T>(path: string, body: unknown, log?: RequestLogger): Promise<T> {
  const response = await loggedFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    log,
  );

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  return (await response.json()) as T;
}

/**
 * Low-level POST for endpoints that return no body (e.g. `204 No Content`).
 * Never calls `response.json()`, so an empty body can't throw a `SyntaxError`.
 */
async function postVoid(path: string, body: unknown, log?: RequestLogger): Promise<void> {
  const response = await loggedFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    log,
  );

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
}

export async function loginRequest(
  email: string,
  password: string,
  log?: RequestLogger,
): Promise<AuthTokens> {
  return postJson<AuthTokens>(`${API_ROUTES.AUTH}/login`, { email, password }, log);
}

export async function registerRequest(
  email: string,
  password: string,
  displayName: string,
  log?: RequestLogger,
): Promise<void> {
  await postJson<ApiUserDto>(
    `${API_ROUTES.AUTH}/register`,
    {
      email,
      password,
      displayName,
    },
    log,
  );
}

export async function refreshRequest(
  refreshToken: string,
  log?: RequestLogger,
): Promise<AuthTokens> {
  // The API's /refresh action binds a raw JSON string body.
  return postJson<AuthTokens>(`${API_ROUTES.AUTH}/refresh`, refreshToken, log);
}

export async function logoutRequest(refreshToken: string, log?: RequestLogger): Promise<void> {
  try {
    await postJson(`${API_ROUTES.AUTH}/logout`, refreshToken, log);
  } catch {
    // Best-effort: a failed server-side revoke shouldn't block clearing the cookie.
  }
}

export async function fetchMe(accessToken: string, log?: RequestLogger): Promise<SessionUser> {
  const response = await apiFetch(accessToken, `${API_ROUTES.AUTH}/me`, {}, log);

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  return toSessionUser((await response.json()) as ApiUserDto);
}

// ── Email verification & password reset ─────────────────────────────────────

export async function verifyEmailRequest(
  token: string,
  log?: RequestLogger,
): Promise<{ tokens: AuthTokens; isNewlyVerified: boolean }> {
  return postJson<{ tokens: AuthTokens; isNewlyVerified: boolean }>(
    `${API_ROUTES.AUTH}/verify-email`,
    { token },
    log,
  );
}

/**
 * Public resend: unverified users have no session/token, so this posts the email
 * directly. The backend responds neutrally (no user enumeration).
 */
export async function resendVerificationRequest(email: string, log?: RequestLogger): Promise<void> {
  await postVoid(`${API_ROUTES.AUTH}/resend-verification`, { email }, log);
}

export async function forgotPasswordRequest(email: string, log?: RequestLogger): Promise<void> {
  await postVoid(`${API_ROUTES.AUTH}/forgot-password`, { email }, log);
}

export async function resetPasswordRequest(
  token: string,
  newPassword: string,
  log?: RequestLogger,
): Promise<void> {
  await postVoid(`${API_ROUTES.AUTH}/reset-password`, { token, newPassword }, log);
}

/**
 * Authenticated server-side fetch to the API: attaches `Authorization: Bearer`.
 * Returns the raw `Response` so callers can inspect status (e.g. a 401 triggers a
 * refresh-and-retry handled by the auth guards).
 */
export function apiFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  log?: RequestLogger,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return loggedFetch(path, { ...init, headers }, log);
}

// ── Workspaces, projects, media & trash (Phase 2 backend) ────────────────────
//
// The active workspace is expressed in the request, not persisted: Personal sends no
// `studioId`; a Team sends `?studioId=...` and the API authorizes it off the JWT studio
// claim. Pure types/enums/helpers live in `./api` so route components can import them;
// only the authenticated request functions live here (server-only).

async function apiJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
  log?: RequestLogger,
): Promise<T> {
  const response = await apiFetch(accessToken, path, init, log);
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
  return (await response.json()) as T;
}

async function apiVoid(
  accessToken: string,
  path: string,
  init?: RequestInit,
  log?: RequestLogger,
): Promise<void> {
  const response = await apiFetch(accessToken, path, init, log);
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
}

/** Studios the caller belongs to (for the workspace switcher). */
export function listMyStudios(accessToken: string, log?: RequestLogger): Promise<StudioDto[]> {
  return apiJson<StudioDto[]>(accessToken, `${API_ROUTES.AUTH}/me/studios`, undefined, log);
}

export function listProjects(
  accessToken: string,
  ws: Workspace,
  log?: RequestLogger,
): Promise<PagedResult<ProjectDto>> {
  return apiJson(accessToken, `${API_ROUTES.PROJECTS}${workspaceQuery(ws, { pageSize: 100 })}`, undefined, log);
}

export function listMedia(
  accessToken: string,
  ws: Workspace,
  log?: RequestLogger,
): Promise<PagedResult<MediaDto>> {
  return apiJson(accessToken, `${API_ROUTES.MEDIA}${workspaceQuery(ws, { pageSize: 100 })}`, undefined, log);
}

export function listSharedProjects(
  accessToken: string,
  log?: RequestLogger,
): Promise<PagedResult<ProjectDto>> {
  return apiJson(accessToken, `${API_ROUTES.PROJECTS}/shared?pageSize=100`, undefined, log);
}

export function listSharedMedia(
  accessToken: string,
  log?: RequestLogger,
): Promise<PagedResult<MediaDto>> {
  return apiJson(accessToken, `${API_ROUTES.MEDIA}/shared?pageSize=100`, undefined, log);
}

export function listProjectTrash(
  accessToken: string,
  ws: Workspace,
  log?: RequestLogger,
): Promise<PagedResult<ProjectTrashItem>> {
  return apiJson(accessToken, `${API_ROUTES.PROJECTS}/trash${workspaceQuery(ws, { pageSize: 100 })}`, undefined, log);
}

export function listMediaTrash(
  accessToken: string,
  ws: Workspace,
  log?: RequestLogger,
): Promise<PagedResult<MediaTrashItem>> {
  return apiJson(accessToken, `${API_ROUTES.MEDIA}/trash${workspaceQuery(ws, { pageSize: 100 })}`, undefined, log);
}

export function createProject(
  accessToken: string,
  ws: Workspace,
  input: { kind: number; name: string; description?: string | null },
  log?: RequestLogger,
): Promise<ProjectDto> {
  return apiJson(
    accessToken,
    `${API_ROUTES.PROJECTS}${workspaceQuery(ws)}`,
    {
      method: "POST",
      body: JSON.stringify({
        kind: input.kind,
        name: input.name,
        description: input.description || null,
      }),
    },
    log,
  );
}

export function createMedia(
  accessToken: string,
  ws: Workspace,
  input: {
    kind: number;
    filename: string;
    storageKey: string;
    sizeBytes: number;
    projectId?: string | null;
  },
  log?: RequestLogger,
): Promise<MediaDto> {
  return apiJson(
    accessToken,
    `${API_ROUTES.MEDIA}${workspaceQuery(ws)}`,
    {
      method: "POST",
      body: JSON.stringify({
        kind: input.kind,
        projectId: input.projectId ?? null,
        filename: input.filename,
        storageKey: input.storageKey,
        sizeBytes: input.sizeBytes,
      }),
    },
    log,
  );
}

export function softDelete(
  accessToken: string,
  resource: ResourceKind,
  id: string,
  log?: RequestLogger,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}`, { method: "DELETE" }, log);
}

export function restore(
  accessToken: string,
  resource: ResourceKind,
  id: string,
  log?: RequestLogger,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}/restore`, { method: "POST" }, log);
}

export function permanentDelete(
  accessToken: string,
  resource: ResourceKind,
  id: string,
  log?: RequestLogger,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}/permanent`, { method: "DELETE" }, log);
}

// ── Studios (teams) ──────────────────────────────────────────────────────────

export function listStudioMembers(
  accessToken: string,
  studioId: string,
  log?: RequestLogger,
): Promise<StudioMemberDto[]> {
  return apiJson(accessToken, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members`, undefined, log);
}

export function addStudioMember(
  accessToken: string,
  studioId: string,
  input: { email: string; role: number },
  log?: RequestLogger,
): Promise<StudioMemberDto> {
  return apiJson(
    accessToken,
    `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ email: input.email, role: input.role }),
    },
    log,
  );
}

export function updateStudioMember(
  accessToken: string,
  studioId: string,
  userId: string,
  role: number,
  log?: RequestLogger,
): Promise<StudioMemberDto> {
  return apiJson(
    accessToken,
    `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
    log,
  );
}

export function removeStudioMember(
  accessToken: string,
  studioId: string,
  userId: string,
  log?: RequestLogger,
): Promise<void> {
  return apiVoid(
    accessToken,
    `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`,
    {
      method: "DELETE",
    },
    log,
  );
}

export function createStudio(
  accessToken: string,
  name: string,
  log?: RequestLogger,
): Promise<StudioDto> {
  return apiJson(
    accessToken,
    `${API_ROUTES.STUDIOS_AUTH}`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    log,
  );
}

/**
 * Decodes (without verifying — the token came from our own session) the `studio` claims in the
 * access JWT: `[{ studioId, role }]`. The backend authorizes studio-scoped project/media
 * requests off exactly these claims, so this tells us whether the current token can reach a
 * team's content (a freshly-joined team needs a token refresh first).
 */
export function getStudioClaims(
  accessToken: string,
): Array<{ studioId: string; role: string }> {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return [];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      studio?: string | string[];
    };
    const raw = json.studio;
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    return values.flatMap((value) => {
      const sep = value.indexOf(":");
      if (sep <= 0) return [];
      return [{ studioId: value.slice(0, sep), role: value.slice(sep + 1) }];
    });
  } catch {
    return [];
  }
}
