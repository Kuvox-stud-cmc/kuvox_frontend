import { API_ROUTES } from "~/const/api-routes";
import type {
  PagedResult,
  StudioAuditLogEntryDto,
  StudioDto,
  StudioInvitationDto,
  StudioMemberDto,
  StudioNotificationSettingsDto,
  StudioPermissionDto,
  StudioRoleDto,
  StudioUsageSummaryDto,
  StudioWorkspaceSettingsDto,
} from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient, bearerAuth, noAuth } from "./api-client.server";

export class StudiosApi extends BaseApiModule {
  listMyStudios(token: string, log?: RequestLogger): Promise<StudioDto[]> {
    return this.get<StudioDto[]>(token, `${API_ROUTES.AUTH}/me/studios`, log);
  }

  listStudioMembers(token: string, studioId: string, log?: RequestLogger): Promise<StudioMemberDto[]> {
    return this.get<StudioMemberDto[]>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members`, log);
  }

  addStudioMember(token: string, studioId: string, input: { email: string; role: number }, log?: RequestLogger): Promise<StudioMemberDto> {
    return this.client.post<StudioMemberDto>(`${API_ROUTES.STUDIOS_AUTH}/${studioId}/members`, { email: input.email, role: input.role }, { auth: bearerAuth(token), log });
  }

  listStudioInvitations(token: string, studioId: string, log?: RequestLogger): Promise<StudioInvitationDto[]> {
    return this.get<StudioInvitationDto[]>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/invitations`, log);
  }

  createStudioInvitation(token: string, studioId: string, input: { email: string; role: number }, log?: RequestLogger): Promise<StudioInvitationDto> {
    return this.client.post<StudioInvitationDto>(`${API_ROUTES.STUDIOS_AUTH}/${studioId}/invitations`, input, { auth: bearerAuth(token), log });
  }

  resendStudioInvitation(token: string, studioId: string, invitationId: string, log?: RequestLogger): Promise<StudioInvitationDto> {
    return this.client.post<StudioInvitationDto>(`${API_ROUTES.STUDIOS_AUTH}/${studioId}/invitations/${invitationId}/resend`, {}, { auth: bearerAuth(token), log });
  }

  revokeStudioInvitation(token: string, studioId: string, invitationId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/invitations/${invitationId}`, log);
  }

  acceptInvitation(invitationToken: string, accessToken?: string, log?: RequestLogger): Promise<void> {
    return this.client.postVoid(
      `${API_ROUTES.AUTH}/invitations/accept`,
      { token: invitationToken },
      { auth: accessToken ? bearerAuth(accessToken) : noAuth(), log },
    );
  }

  declineInvitation(invitationToken: string, accessToken?: string, log?: RequestLogger): Promise<void> {
    return this.client.postVoid(
      `${API_ROUTES.AUTH}/invitations/decline`,
      { token: invitationToken },
      { auth: accessToken ? bearerAuth(accessToken) : noAuth(), log },
    );
  }

  listStudioRoles(token: string, studioId: string, log?: RequestLogger): Promise<StudioRoleDto[]> {
    return this.get<StudioRoleDto[]>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/roles`, log);
  }

  listStudioPermissions(token: string, studioId: string, log?: RequestLogger): Promise<StudioPermissionDto[]> {
    return this.get<StudioPermissionDto[]>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/permissions`, log);
  }

  getStudioAuditLog(token: string, studioId: string, params?: { page?: number; pageSize?: number; category?: string }, log?: RequestLogger): Promise<PagedResult<StudioAuditLogEntryDto>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.category) query.set("category", params.category);
    const suffix = query.toString() ? `?${query}` : "";
    return this.get<PagedResult<StudioAuditLogEntryDto>>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/audit-log${suffix}`, log);
  }

  getWorkspaceSettings(token: string, studioId: string, log?: RequestLogger): Promise<StudioWorkspaceSettingsDto> {
    return this.get<StudioWorkspaceSettingsDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/settings/workspace`, log);
  }

  updateWorkspaceSettings(token: string, studioId: string, input: { name: string; description?: string | null; avatarUrl?: string | null; publicSlug?: string | null }, log?: RequestLogger): Promise<StudioWorkspaceSettingsDto> {
    return this.patch<typeof input, StudioWorkspaceSettingsDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/settings/workspace`, input, log);
  }

  getNotificationSettings(token: string, studioId: string, log?: RequestLogger): Promise<StudioNotificationSettingsDto> {
    return this.get<StudioNotificationSettingsDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/settings/notifications`, log);
  }

  updateNotificationSettings(token: string, studioId: string, input: StudioNotificationSettingsDto, log?: RequestLogger): Promise<StudioNotificationSettingsDto> {
    return this.patch<StudioNotificationSettingsDto, StudioNotificationSettingsDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/settings/notifications`, input, log);
  }

  getUsageSummary(token: string, studioId: string, log?: RequestLogger): Promise<StudioUsageSummaryDto> {
    return this.get<StudioUsageSummaryDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/usage`, log);
  }

  updateStudioMember(token: string, studioId: string, userId: string, role: number, log?: RequestLogger): Promise<StudioMemberDto> {
    return this.patch<any, StudioMemberDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`, { role }, log);
  }

  removeStudioMember(token: string, studioId: string, userId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`, log);
  }

  createStudio(token: string, name: string, log?: RequestLogger): Promise<StudioDto> {
    return this.client.post<StudioDto>(`${API_ROUTES.STUDIOS_AUTH}`, { name }, { auth: bearerAuth(token), log });
  }

  renameStudio(token: string, studioId: string, name: string, log?: RequestLogger): Promise<StudioDto> {
    return this.patch<{ name: string }, StudioDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}`, { name }, log);
  }

  deleteStudio(token: string, studioId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}`, log);
  }

  getStudioClaims(accessToken: string): Array<{ studioId: string; role: string }> {
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
}

export const studiosApi = new StudiosApi(apiClient);

// Backward compatible exports
export const listMyStudios = (t: string, l?: RequestLogger) => studiosApi.listMyStudios(t, l);
export const listStudioMembers = (t: string, s: string, l?: RequestLogger) => studiosApi.listStudioMembers(t, s, l);
export const addStudioMember = (t: string, s: string, i: { email: string; role: number }, l?: RequestLogger) => studiosApi.addStudioMember(t, s, i, l);
export const listStudioInvitations = (t: string, s: string, l?: RequestLogger) => studiosApi.listStudioInvitations(t, s, l);
export const createStudioInvitation = (t: string, s: string, i: { email: string; role: number }, l?: RequestLogger) => studiosApi.createStudioInvitation(t, s, i, l);
export const resendStudioInvitation = (t: string, s: string, i: string, l?: RequestLogger) => studiosApi.resendStudioInvitation(t, s, i, l);
export const revokeStudioInvitation = (t: string, s: string, i: string, l?: RequestLogger) => studiosApi.revokeStudioInvitation(t, s, i, l);
export const acceptStudioInvitation = (i: string, t?: string, l?: RequestLogger) => studiosApi.acceptInvitation(i, t, l);
export const declineStudioInvitation = (i: string, t?: string, l?: RequestLogger) => studiosApi.declineInvitation(i, t, l);
export const listStudioRoles = (t: string, s: string, l?: RequestLogger) => studiosApi.listStudioRoles(t, s, l);
export const listStudioPermissions = (t: string, s: string, l?: RequestLogger) => studiosApi.listStudioPermissions(t, s, l);
export const getStudioAuditLog = (t: string, s: string, p?: { page?: number; pageSize?: number; category?: string }, l?: RequestLogger) => studiosApi.getStudioAuditLog(t, s, p, l);
export const getWorkspaceSettings = (t: string, s: string, l?: RequestLogger) => studiosApi.getWorkspaceSettings(t, s, l);
export const updateWorkspaceSettings = (t: string, s: string, i: { name: string; description?: string | null; avatarUrl?: string | null; publicSlug?: string | null }, l?: RequestLogger) => studiosApi.updateWorkspaceSettings(t, s, i, l);
export const getNotificationSettings = (t: string, s: string, l?: RequestLogger) => studiosApi.getNotificationSettings(t, s, l);
export const updateNotificationSettings = (t: string, s: string, i: StudioNotificationSettingsDto, l?: RequestLogger) => studiosApi.updateNotificationSettings(t, s, i, l);
export const getUsageSummary = (t: string, s: string, l?: RequestLogger) => studiosApi.getUsageSummary(t, s, l);
export const updateStudioMember = (t: string, s: string, u: string, r: number, l?: RequestLogger) => studiosApi.updateStudioMember(t, s, u, r, l);
export const removeStudioMember = (t: string, s: string, u: string, l?: RequestLogger) => studiosApi.removeStudioMember(t, s, u, l);
export const createStudio = (t: string, n: string, l?: RequestLogger) => studiosApi.createStudio(t, n, l);
export const renameStudio = (t: string, s: string, n: string, l?: RequestLogger) => studiosApi.renameStudio(t, s, n, l);
export const deleteStudio = (t: string, s: string, l?: RequestLogger) => studiosApi.deleteStudio(t, s, l);
export const getStudioClaims = (t: string) => studiosApi.getStudioClaims(t);
