import { API_ROUTES } from "~/const/api-routes";
import { workspaceQuery, type Workspace, type MediaDto, type MediaStorageUsageDto, type MediaTrashItem, type PagedResult, type ShareRequest, type ItemAccessMemberDto } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class MediaApi extends BaseApiModule {
  getMedia(token: string, id: string, log?: RequestLogger): Promise<MediaDto> {
    return this.get<MediaDto>(token, `${API_ROUTES.MEDIA}/${id}`, log);
  }

  listMedia(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<MediaDto>> {
    return this.listMediaPage(token, ws, { pageSize: 100 }, log);
  }

  listMediaPage(
    token: string,
    ws: Workspace,
    params: { page?: number; pageSize?: number } = {},
    log?: RequestLogger,
  ): Promise<PagedResult<MediaDto>> {
    const query = workspaceQuery(ws, {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100,
    });
    return this.get<PagedResult<MediaDto>>(token, `${API_ROUTES.MEDIA}${query}`, log);
  }

  async listAllMedia(token: string, ws: Workspace, log?: RequestLogger): Promise<MediaDto[]> {
    const pageSize = 100;
    const firstPage = await this.listMediaPage(token, ws, { page: 1, pageSize }, log);
    const items = [...firstPage.items];

    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const nextPage = await this.listMediaPage(token, ws, { page, pageSize }, log);
      items.push(...nextPage.items);
    }

    return items;
  }

  listSharedMedia(token: string, log?: RequestLogger): Promise<PagedResult<MediaDto>> {
    return this.get<PagedResult<MediaDto>>(token, `${API_ROUTES.MEDIA}/shared?pageSize=100`, log);
  }

  getStorageUsage(token: string, ws: Workspace = { kind: "personal" }, log?: RequestLogger): Promise<MediaStorageUsageDto> {
    return this.get<MediaStorageUsageDto>(token, `${API_ROUTES.MEDIA}/storage-usage${workspaceQuery(ws)}`, log);
  }

  listMediaTrash(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<MediaTrashItem>> {
    return this.list<MediaTrashItem>(token, `${API_ROUTES.MEDIA}/trash`, ws, log);
  }

  setFavorite(token: string, id: string, isFavorite: boolean, log?: RequestLogger): Promise<MediaDto> {
    return this.put<{ isFavorite: boolean }, MediaDto>(
      token,
      `${API_ROUTES.MEDIA}/${id}/favorite`,
      { isFavorite },
      log,
    );
  }

  shareMedia(token: string, id: string, input: ShareRequest, log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `${API_ROUTES.MEDIA}/${id}/share`, input, log);
  }

  unshareMedia(token: string, id: string, userId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.MEDIA}/${id}/share/${userId}`, log);
  }

  listAccess(token: string, id: string, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.get<ItemAccessMemberDto[]>(token, `${API_ROUTES.MEDIA}/${id}/access`, log);
  }

  updateAccess(token: string, id: string, input: { userId: string; role?: number | null; isHidden: boolean }, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.put<typeof input, ItemAccessMemberDto[]>(token, `${API_ROUTES.MEDIA}/${id}/access`, input, log);
  }

  renameMedia(token: string, id: string, filename: string, log?: RequestLogger): Promise<MediaDto> {
    return this.patch<{ filename: string }, MediaDto>(token, `${API_ROUTES.MEDIA}/${id}`, { filename }, log);
  }
}

export const mediaApi = new MediaApi(apiClient);

export const getMedia = (t: string, id: string, l?: RequestLogger) => mediaApi.getMedia(t, id, l);
export const listMedia = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMedia(t, w, l);
export const listAllMedia = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listAllMedia(t, w, l);
export const listSharedMedia = (t: string, l?: RequestLogger) => mediaApi.listSharedMedia(t, l);
export const getStorageUsage = (t: string, l?: RequestLogger, w?: Workspace) => mediaApi.getStorageUsage(t, w, l);
export const listMediaTrash = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMediaTrash(t, w, l);
export const setMediaFavorite = (t: string, id: string, v: boolean, l?: RequestLogger) => mediaApi.setFavorite(t, id, v, l);
export const shareMedia = (t: string, id: string, i: ShareRequest, l?: RequestLogger) => mediaApi.shareMedia(t, id, i, l);
export const unshareMedia = (t: string, id: string, u: string, l?: RequestLogger) => mediaApi.unshareMedia(t, id, u, l);
export const listMediaAccess = (t: string, id: string, l?: RequestLogger) => mediaApi.listAccess(t, id, l);
export const updateMediaAccess = (t: string, id: string, i: { userId: string; role?: number | null; isHidden: boolean }, l?: RequestLogger) => mediaApi.updateAccess(t, id, i, l);
export const renameMedia = (t: string, id: string, filename: string, l?: RequestLogger) => mediaApi.renameMedia(t, id, filename, l);
