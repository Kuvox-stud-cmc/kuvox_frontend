import { API_ROUTES } from "~/const/api-routes";
import type { StudioDto, StudioMemberDto } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient, bearerAuth } from "./api-client.server";

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

  updateStudioMember(token: string, studioId: string, userId: string, role: number, log?: RequestLogger): Promise<StudioMemberDto> {
    return this.patch<any, StudioMemberDto>(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`, { role }, log);
  }

  removeStudioMember(token: string, studioId: string, userId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.STUDIOS_AUTH}/${studioId}/members/${userId}`, log);
  }

  createStudio(token: string, name: string, log?: RequestLogger): Promise<StudioDto> {
    return this.client.post<StudioDto>(`${API_ROUTES.STUDIOS_AUTH}`, { name }, { auth: bearerAuth(token), log });
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
export const updateStudioMember = (t: string, s: string, u: string, r: number, l?: RequestLogger) => studiosApi.updateStudioMember(t, s, u, r, l);
export const removeStudioMember = (t: string, s: string, u: string, l?: RequestLogger) => studiosApi.removeStudioMember(t, s, u, l);
export const createStudio = (t: string, n: string, l?: RequestLogger) => studiosApi.createStudio(t, n, l);
export const getStudioClaims = (t: string) => studiosApi.getStudioClaims(t);
