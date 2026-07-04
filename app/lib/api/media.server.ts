import { API_ROUTES } from "~/const/api-routes";
import { workspaceQuery, type Workspace, type MediaDto, type MediaStorageUsageDto, type MediaTrashItem, type PagedResult } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class MediaApi extends BaseApiModule {
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

  getStorageUsage(token: string, log?: RequestLogger): Promise<MediaStorageUsageDto> {
    return this.get<MediaStorageUsageDto>(token, `${API_ROUTES.MEDIA}/storage-usage`, log);
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
}

export const mediaApi = new MediaApi(apiClient);

export const listMedia = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMedia(t, w, l);
export const listAllMedia = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listAllMedia(t, w, l);
export const listSharedMedia = (t: string, l?: RequestLogger) => mediaApi.listSharedMedia(t, l);
export const getStorageUsage = (t: string, l?: RequestLogger) => mediaApi.getStorageUsage(t, l);
export const listMediaTrash = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMediaTrash(t, w, l);
export const setMediaFavorite = (t: string, id: string, v: boolean, l?: RequestLogger) => mediaApi.setFavorite(t, id, v, l);
