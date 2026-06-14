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
import type { SessionUser } from "./session.server";

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

/** Low-level JSON POST to the API. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  return (await response.json()) as T;
}

/**
 * Low-level POST for endpoints that return no body (e.g. `204 No Content`).
 * Never calls `response.json()`, so an empty body can't throw a `SyntaxError`.
 */
async function postVoid(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthTokens> {
  return postJson<AuthTokens>("/api/auth/login", { email, password });
}

export async function registerRequest(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  await postJson<ApiUserDto>("/api/auth/register", {
    email,
    password,
    displayName,
  });
}

export async function refreshRequest(refreshToken: string): Promise<AuthTokens> {
  // The API's /refresh action binds a raw JSON string body.
  return postJson<AuthTokens>("/api/auth/refresh", refreshToken);
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  try {
    await postJson("/api/auth/logout", refreshToken);
  } catch {
    // Best-effort: a failed server-side revoke shouldn't block clearing the cookie.
  }
}

export async function fetchMe(accessToken: string): Promise<SessionUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  return toSessionUser((await response.json()) as ApiUserDto);
}

// ── Email verification & password reset ─────────────────────────────────────

export async function verifyEmailRequest(
  token: string,
): Promise<{ tokens: AuthTokens; isNewlyVerified: boolean }> {
  return postJson<{ tokens: AuthTokens; isNewlyVerified: boolean }>(
    "/api/auth/verify-email",
    { token },
  );
}

/**
 * Public resend: unverified users have no session/token, so this posts the email
 * directly. The backend responds neutrally (no user enumeration).
 */
export async function resendVerificationRequest(email: string): Promise<void> {
  await postVoid("/api/auth/resend-verification", { email });
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  await postVoid("/api/auth/forgot-password", { email });
}

export async function resetPasswordRequest(
  token: string,
  newPassword: string,
): Promise<void> {
  await postVoid("/api/auth/reset-password", { token, newPassword });
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
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
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
): Promise<T> {
  const response = await apiFetch(accessToken, path, init);
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
  return (await response.json()) as T;
}

async function apiVoid(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<void> {
  const response = await apiFetch(accessToken, path, init);
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
}

/** Studios the caller belongs to (for the workspace switcher). */
export function listMyStudios(accessToken: string): Promise<StudioDto[]> {
  return apiJson<StudioDto[]>(accessToken, "/api/auth/me/studios");
}

export function listProjects(
  accessToken: string,
  ws: Workspace,
): Promise<PagedResult<ProjectDto>> {
  return apiJson(accessToken, `/api/projects${workspaceQuery(ws, { pageSize: 100 })}`);
}

export function listMedia(
  accessToken: string,
  ws: Workspace,
): Promise<PagedResult<MediaDto>> {
  return apiJson(accessToken, `/api/media${workspaceQuery(ws, { pageSize: 100 })}`);
}

export function listSharedProjects(
  accessToken: string,
): Promise<PagedResult<ProjectDto>> {
  return apiJson(accessToken, "/api/projects/shared?pageSize=100");
}

export function listSharedMedia(
  accessToken: string,
): Promise<PagedResult<MediaDto>> {
  return apiJson(accessToken, "/api/media/shared?pageSize=100");
}

export function listProjectTrash(
  accessToken: string,
  ws: Workspace,
): Promise<PagedResult<ProjectTrashItem>> {
  return apiJson(accessToken, `/api/projects/trash${workspaceQuery(ws, { pageSize: 100 })}`);
}

export function listMediaTrash(
  accessToken: string,
  ws: Workspace,
): Promise<PagedResult<MediaTrashItem>> {
  return apiJson(accessToken, `/api/media/trash${workspaceQuery(ws, { pageSize: 100 })}`);
}

export function createProject(
  accessToken: string,
  ws: Workspace,
  input: { kind: number; name: string; description?: string | null },
): Promise<ProjectDto> {
  return apiJson(accessToken, `/api/projects${workspaceQuery(ws)}`, {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      name: input.name,
      description: input.description || null,
    }),
  });
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
): Promise<MediaDto> {
  return apiJson(accessToken, `/api/media${workspaceQuery(ws)}`, {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      projectId: input.projectId ?? null,
      filename: input.filename,
      storageKey: input.storageKey,
      sizeBytes: input.sizeBytes,
    }),
  });
}

export function softDelete(
  accessToken: string,
  resource: ResourceKind,
  id: string,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}`, { method: "DELETE" });
}

export function restore(
  accessToken: string,
  resource: ResourceKind,
  id: string,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}/restore`, { method: "POST" });
}

export function permanentDelete(
  accessToken: string,
  resource: ResourceKind,
  id: string,
): Promise<void> {
  return apiVoid(accessToken, `/api/${resource}/${id}/permanent`, { method: "DELETE" });
}

// ── Studios (teams) ──────────────────────────────────────────────────────────

export function listStudioMembers(
  accessToken: string,
  studioId: string,
): Promise<StudioMemberDto[]> {
  return apiJson(accessToken, `/api/auth/studios/${studioId}/members`);
}

export function addStudioMember(
  accessToken: string,
  studioId: string,
  input: { email: string; role: number },
): Promise<StudioMemberDto> {
  return apiJson(accessToken, `/api/auth/studios/${studioId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: input.email, role: input.role }),
  });
}

export function updateStudioMember(
  accessToken: string,
  studioId: string,
  userId: string,
  role: number,
): Promise<StudioMemberDto> {
  return apiJson(accessToken, `/api/auth/studios/${studioId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeStudioMember(
  accessToken: string,
  studioId: string,
  userId: string,
): Promise<void> {
  return apiVoid(accessToken, `/api/auth/studios/${studioId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function createStudio(
  accessToken: string,
  name: string,
): Promise<StudioDto> {
  return apiJson(accessToken, "/api/auth/studios", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
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
