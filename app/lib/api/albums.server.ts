import { BaseApiModule } from "./base.server";
import { workspaceQuery, type Workspace, type AlbumDto, type CreateAlbumDto } from "../api";
import type { RequestLogger } from "../logger.server";

export class AlbumsApiModule extends BaseApiModule {
  /**
   * Creates a new album.
   */
  async createAlbum(token: string, ws: Workspace, dto: CreateAlbumDto, log?: RequestLogger): Promise<AlbumDto> {
    return this.create<CreateAlbumDto, AlbumDto>(token, "/api/albums", ws, dto, log);
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
    return this.get<AlbumDto[]>(token, `/api/albums${query}`, log);
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
    return this.deleteVoid(token, `/api/albums/${id}${ws ? workspaceQuery(ws) : ""}`, log);
  }

  /**
   * Sets the current user's favorite flag for an album.
   */
  async setFavorite(token: string, id: string, isFavorite: boolean, log?: RequestLogger): Promise<AlbumDto> {
    return this.put<{ isFavorite: boolean }, AlbumDto>(
      token,
      `/api/albums/${id}/favorite`,
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
    return this.postVoid(token, `/api/albums/${id}/media${ws ? workspaceQuery(ws) : ""}`, { mediaIds }, log);
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
      `/api/albums/audio-categories/${encodeURIComponent(category)}/media${ws ? workspaceQuery(ws) : ""}`,
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
    return this.client.requestVoid(`/api/albums/${id}/media${ws ? workspaceQuery(ws) : ""}`, { method: "DELETE", body: JSON.stringify({ mediaIds }) }, { auth: bearerAuth(token), log });
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
    return this.get<import("../api").PagedResult<import("../api").MediaDto>>(token, `/api/albums/${id}/media${query}`, log);
  }
}

import { apiClient, bearerAuth } from "./api-client.server";
export const albumsApi = new AlbumsApiModule(apiClient);

function isWorkspace(value: unknown): value is Workspace {
  return Boolean(value && typeof value === "object" && "kind" in value);
}
