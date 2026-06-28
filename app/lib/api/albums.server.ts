import { BaseApiModule } from "./base.server";
import type { Workspace, AlbumDto, CreateAlbumDto } from "../api";
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
  async listAlbums(token: string, log?: RequestLogger): Promise<AlbumDto[]> {
    return this.get<AlbumDto[]>(token, "/api/albums", log);
  }

  /**
   * Deletes an album by ID.
   */
  async deleteAlbum(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `/api/albums/${id}`, log);
  }

  /**
   * Adds media items to an album.
   */
  async addMedia(token: string, id: string, mediaIds: string[], log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `/api/albums/${id}/media`, { mediaIds }, log);
  }

  /**
   * Removes media items from an album.
   */
  async removeMedia(token: string, id: string, mediaIds: string[], log?: RequestLogger): Promise<void> {
    return this.client.requestVoid(`/api/albums/${id}/media`, { method: "DELETE", body: JSON.stringify({ mediaIds }) }, { auth: bearerAuth(token), log });
  }

  /**
   * Lists media items for an album.
   */
  async listAlbumMedia(token: string, id: string, log?: RequestLogger): Promise<import("../api").PagedResult<import("../api").MediaDto>> {
    return this.get<import("../api").PagedResult<import("../api").MediaDto>>(token, `/api/albums/${id}/media`, log);
  }
}

import { apiClient, bearerAuth } from "./api-client.server";
export const albumsApi = new AlbumsApiModule(apiClient);
