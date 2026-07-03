import { API_ROUTES } from "~/const/api-routes";
import type { Workspace, MediaDto, MediaTrashItem, PagedResult } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class MediaApi extends BaseApiModule {
  listMedia(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<MediaDto>> {
    return this.list<MediaDto>(token, API_ROUTES.MEDIA, ws, log);
  }

  listSharedMedia(token: string, log?: RequestLogger): Promise<PagedResult<MediaDto>> {
    return this.get<PagedResult<MediaDto>>(token, `${API_ROUTES.MEDIA}/shared?pageSize=100`, log);
  }

  listMediaTrash(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<MediaTrashItem>> {
    return this.list<MediaTrashItem>(token, `${API_ROUTES.MEDIA}/trash`, ws, log);
  }
}

export const mediaApi = new MediaApi(apiClient);

export const listMedia = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMedia(t, w, l);
export const listSharedMedia = (t: string, l?: RequestLogger) => mediaApi.listSharedMedia(t, l);
export const listMediaTrash = (t: string, w: Workspace, l?: RequestLogger) => mediaApi.listMediaTrash(t, w, l);
