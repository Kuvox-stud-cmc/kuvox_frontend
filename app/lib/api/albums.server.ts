import { BaseApiModule } from "./base.server";
import { workspaceQuery, type Workspace, type AlbumDto, type CreateAlbumDto, type ShareRequest, type ItemAccessMemberDto } from "../api";
import type { RequestLogger } from "../logger.server";
import { API_ROUTES } from "~/const/api-routes";

export class AlbumsApiModule extends BaseApiModule {
  /**
   * Creates a new album.
   */
  async createAlbum(token: string, ws: Workspace, dto: CreateAlbumDto, log?: RequestLogger): Promise<AlbumDto> {
    return this.create<CreateAlbumDto, AlbumDto>(token, API_ROUTES.ALBUMS, ws, dto, log);
  }

  /**
   * Lists all albums for the current user.
   */
  async listAlbums(
    token: string,
    wsOrLog?: Workspace | RequestLogger,
    logOrOptions?: RequestLogger | { includeSystem?: boolean },
    maybeOptions?: { includeSystem?: boolean },
  ): Promise<AlbumDto[]> {
    const hasWorkspace = isWorkspace(wsOrLog);
    const ws = hasWorkspace ? wsOrLog : undefined;
    const log = hasWorkspace ? logOrOptions as RequestLogger | undefined : wsOrLog as RequestLogger | undefined;
    const options = hasWorkspace ? maybeOptions : logOrOptions as { includeSystem?: boolean } | undefined;
    const query = ws
      ? workspaceQuery(ws, options?.includeSystem ? { includeSystem: "true" } : undefined)
      : options?.includeSystem ? "?includeSystem=true" : "";
    return this.get<AlbumDto[]>(token, `${API_ROUTES.ALBUMS}${query}`, log);
  }

  async listSharedAlbums(token: string, log?: RequestLogger): Promise<AlbumDto[]> {
    return this.get<AlbumDto[]>(token, `${API_ROUTES.ALBUMS}/shared`, log);
  }

  /**
   * Deletes an album by ID.
   */
  async deleteAlbum(
    token: string,
    id: string,
    wsOrLog?: Workspace | RequestLogger,
    maybeLog?: RequestLogger,
  ): Promise<void> {
    const ws = isWorkspace(wsOrLog) ? wsOrLog : undefined;
    const log = isWorkspace(wsOrLog) ? maybeLog : wsOrLog;
    return this.deleteVoid(token, `${API_ROUTES.ALBUMS}/${id}${ws ? workspaceQuery(ws) : ""}`, log);
  }

  /**
   * Sets the current user's favorite flag for an album.
   */
  async setFavorite(token: string, id: string, isFavorite: boolean, log?: RequestLogger): Promise<AlbumDto> {
    return this.put<{ isFavorite: boolean }, AlbumDto>(
      token,
      `${API_ROUTES.ALBUMS}/${id}/favorite`,
      { isFavorite },
      log,
    );
  }

  /**
   * Adds media items to an album.
   */
  async addMedia(
    token: string,
    id: string,
    mediaIds: string[],
    wsOrLog?: Workspace | RequestLogger,
    maybeLog?: RequestLogger,
  ): Promise<void> {
    const ws = isWorkspace(wsOrLog) ? wsOrLog : undefined;
    const log = isWorkspace(wsOrLog) ? maybeLog : wsOrLog;
    return this.postVoid(token, `${API_ROUTES.ALBUMS}/${id}/media${ws ? workspaceQuery(ws) : ""}`, { mediaIds }, log);
  }

  /**
   * Assigns audio files to a reserved system category album.
   */
  async assignAudioCategory(
    token: string,
    category: string,
    mediaIds: string[],
    wsOrLog?: Workspace | RequestLogger,
    maybeLog?: RequestLogger,
  ): Promise<void> {
    const ws = isWorkspace(wsOrLog) ? wsOrLog : undefined;
    const log = isWorkspace(wsOrLog) ? maybeLog : wsOrLog;
    return this.postVoid(
      token,
      `${API_ROUTES.ALBUMS}/audio-categories/${encodeURIComponent(category)}/media${ws ? workspaceQuery(ws) : ""}`,
      { mediaIds },
      log,
    );
  }

  /**
   * Removes media items from an album.
   */
  async removeMedia(
    token: string,
    id: string,
    mediaIds: string[],
    wsOrLog?: Workspace | RequestLogger,
    maybeLog?: RequestLogger,
  ): Promise<void> {
    const ws = isWorkspace(wsOrLog) ? wsOrLog : undefined;
    const log = isWorkspace(wsOrLog) ? maybeLog : wsOrLog;
    return this.client.requestVoid(`${API_ROUTES.ALBUMS}/${id}/media${ws ? workspaceQuery(ws) : ""}`, { method: "DELETE", body: JSON.stringify({ mediaIds }) }, { auth: bearerAuth(token), log });
  }

  /**
   * Lists media items for an album.
   */
  async listAlbumMedia(
    token: string,
    id: string,
    wsOrLog?: Workspace | RequestLogger,
    logOrOptions?: RequestLogger | { includeSystem?: boolean },
    maybeOptions?: { includeSystem?: boolean },
  ): Promise<import("../api").PagedResult<import("../api").MediaDto>> {
    const hasWorkspace = isWorkspace(wsOrLog);
    const ws = hasWorkspace ? wsOrLog : undefined;
    const log = hasWorkspace ? logOrOptions as RequestLogger | undefined : wsOrLog as RequestLogger | undefined;
    const options = hasWorkspace ? maybeOptions : logOrOptions as { includeSystem?: boolean } | undefined;
    const query = ws
      ? workspaceQuery(ws, options?.includeSystem ? { includeSystem: "true" } : undefined)
      : options?.includeSystem ? "?includeSystem=true" : "";
    return this.get<import("../api").PagedResult<import("../api").MediaDto>>(token, `${API_ROUTES.ALBUMS}/${id}/media${query}`, log);
  }

  async shareAlbum(token: string, id: string, input: ShareRequest, log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `${API_ROUTES.ALBUMS}/${id}/share`, input, log);
  }

  async unshareAlbum(token: string, id: string, userId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.ALBUMS}/${id}/share/${userId}`, log);
  }

  async listAccess(token: string, id: string, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.get<ItemAccessMemberDto[]>(token, `${API_ROUTES.ALBUMS}/${id}/access`, log);
  }

  async updateAccess(token: string, id: string, input: { userId: string; role?: number | null; isHidden: boolean }, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.put<typeof input, ItemAccessMemberDto[]>(token, `${API_ROUTES.ALBUMS}/${id}/access`, input, log);
  }
}

import { apiClient, bearerAuth } from "./api-client.server";
export const albumsApi = new AlbumsApiModule(apiClient);
export const listSharedAlbums = (t: string, l?: RequestLogger) => albumsApi.listSharedAlbums(t, l);
export const shareAlbum = (t: string, id: string, i: ShareRequest, l?: RequestLogger) => albumsApi.shareAlbum(t, id, i, l);
export const unshareAlbum = (t: string, id: string, u: string, l?: RequestLogger) => albumsApi.unshareAlbum(t, id, u, l);
export const listAlbumAccess = (t: string, id: string, l?: RequestLogger) => albumsApi.listAccess(t, id, l);
export const updateAlbumAccess = (t: string, id: string, i: { userId: string; role?: number | null; isHidden: boolean }, l?: RequestLogger) => albumsApi.updateAccess(t, id, i, l);

function isWorkspace(value: unknown): value is Workspace {
  return Boolean(value && typeof value === "object" && "kind" in value);
}
