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
  async listAlbums(token: string, log?: RequestLogger, options?: { includeSystem?: boolean }): Promise<AlbumDto[]> {
    const query = options?.includeSystem ? "?includeSystem=true" : "";
    return this.get<AlbumDto[]>(token, `/api/albums${query}`, log);
  }

  /**
   * Deletes an album by ID.
   */
  async deleteAlbum(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `/api/albums/${id}`, log);
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
  async addMedia(token: string, id: string, mediaIds: string[], log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `/api/albums/${id}/media`, { mediaIds }, log);
  }

  /**
   * Assigns audio files to a reserved system category album.
   */
  async assignAudioCategory(token: string, category: string, mediaIds: string[], log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `/api/albums/audio-categories/${encodeURIComponent(category)}/media`, { mediaIds }, log);
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
  async listAlbumMedia(
    token: string,
    id: string,
    log?: RequestLogger,
    options?: { includeSystem?: boolean },
  ): Promise<import("../api").PagedResult<import("../api").MediaDto>> {
    const query = options?.includeSystem ? "?includeSystem=true" : "";
    return this.get<import("../api").PagedResult<import("../api").MediaDto>>(token, `/api/albums/${id}/media${query}`, log);
  }
}

import { apiClient, bearerAuth } from "./api-client.server";
export const albumsApi = new AlbumsApiModule(apiClient);
