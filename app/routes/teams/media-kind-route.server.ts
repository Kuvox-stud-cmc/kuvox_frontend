import { actionErrorMessage } from "~/lib/action-error.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AlbumKind,
  MediaKind,
  canManageStudioAccess,
  canWriteStudioContent,
  type AlbumDto,
  type MediaDto,
  type Workspace,
} from "~/lib/api";
import {
  albumsApi,
  ApiError,
  listMedia,
  listMyStudios,
  setMediaFavorite,
  softDelete,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser, type RequestLogger } from "~/lib/logger.server";
import { handleResourceAction } from "~/lib/resource-actions.server";
import { getSession } from "~/lib/session.server";
import { isAlbumInStudioScope } from "./studio-albums";

const studioWs = (studioId: string): Workspace => ({ kind: "studio", studioId });

export function createTeamMediaKindLoader(kind: number) {
  return async function loader({ request, params }: LoaderFunctionArgs) {
    const log = createRequestLogger(request);
    const user = await requireUser(request, log);
    const reqLog = withUser(log, user);
    const session = await getSession(request);
    const accessToken = session.get("accessToken");
    const studioId = String(params.studioId ?? "");

    if (!accessToken) {
      return {
        media: [] as MediaDto[],
        albums: [] as AlbumDto[],
        albumMediaCounts: {} as Record<string, number>,
        albumMedia: emptyAudioCategoryMedia(),
        error: "Your session expired. Please sign in again.",
        canWrite: false,
        canManageAccess: false,
      };
    }

    try {
      const ws = studioWs(studioId);
      const includeSystem = kind === MediaKind.Audio;
      const [page, allAlbums, studios] = await Promise.all([
        listMedia(accessToken, studioWs(studioId), reqLog),
        albumsApi.listAlbums(accessToken, ws, reqLog, includeSystem ? { includeSystem: true } : undefined),
        listMyStudios(accessToken, reqLog),
      ]);
      const role = studios.find((studio) => studio.id === studioId)?.role;
      const albumKind = albumKindForMediaKind(kind);
      const studioAlbums = allAlbums.filter((album) => isAlbumInStudioScope(album, studioId));
      const relevantAlbums = studioAlbums.filter((album) => album.kind === albumKind);
      const albums = relevantAlbums.filter(
        (album) => album.isDeleteAble === true && !isReservedAudioCategoryAlbum(album),
      );
      const albumMediaCounts = Object.fromEntries(
        await Promise.all(
          albums.map(async (album) => {
            const albumMedia = await albumsApi.listAlbumMedia(accessToken, album.id, ws, reqLog);
            return [album.id, albumMedia.items.filter((item) => item.kind === kind).length] as const;
          }),
        ),
      );
      const albumMedia =
        kind === MediaKind.Audio
          ? await loadAudioCategoryMedia(accessToken, ws, relevantAlbums, reqLog)
          : emptyAudioCategoryMedia();

      return {
        media: page.items.filter((item) => item.kind === kind),
        albums,
        albumMediaCounts,
        albumMedia,
        error: null as string | null,
        canWrite: role != null ? canWriteStudioContent(role) : false,
        canManageAccess: role != null ? canManageStudioAccess(role) : false,
      };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't load Studio media.";
      reqLog.error({ err: error, studioId, kind }, "failed to load Studio media kind");
      return {
        media: [] as MediaDto[],
        albums: [] as AlbumDto[],
        albumMediaCounts: {},
        albumMedia: emptyAudioCategoryMedia(),
        error: message,
        canWrite: false,
        canManageAccess: false,
      };
    }
  };
}

export function createTeamMediaKindAction(kind: number) {
  return async function action(args: ActionFunctionArgs) {
    return teamMediaKindAction(args, kind);
  };
}

async function teamMediaKindAction(
  { request, params }: ActionFunctionArgs,
  kind: number,
) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = String(params.studioId ?? "");

  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    const resourceAction = await handleResourceAction(formData, accessToken, reqLog);
    if (resourceAction) return resourceAction;

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (id) {
        await softDelete(accessToken, "media", id, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "toggle-favorite") {
      const id = String(formData.get("id") ?? "");
      const isFavorite = String(formData.get("value") ?? "") === "true";
      if (id) {
        await setMediaFavorite(accessToken, id, isFavorite, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "create-album") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const materialSymbol = String(formData.get("materialSymbol") ?? defaultAlbumIcon(kind)).trim();
      if (!name) {
        return { error: "Enter a name for the album." };
      }

      await albumsApi.createAlbum(
        accessToken,
        studioWs(studioId),
        {
          name,
          description,
          kind: albumKindForMediaKind(kind),
          materialSymbol,
        },
        reqLog,
      );
      return { ok: true, intent };
    }

    if (intent === "assign-audio-category") {
      const mediaId = String(formData.get("mediaId") ?? "");
      const category = String(formData.get("category") ?? "");
      if (!mediaId) {
        return { error: "Missing uploaded audio file." };
      }
      if (!category) {
        return { error: "Choose an audio type." };
      }

      await albumsApi.assignAudioCategory(accessToken, category, [mediaId], studioWs(studioId), reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent, studioId }, "Studio media action failed");
    return { error: message };
  }
}

type AudioCategoryKey = "music" | "sfx" | "voiceovers";

function albumKindForMediaKind(kind: number): number {
  if (kind === MediaKind.Image) return AlbumKind.Photo;
  if (kind === MediaKind.Audio) return AlbumKind.Audio;
  return AlbumKind.Video;
}

function defaultAlbumIcon(kind: number): string {
  if (kind === MediaKind.Image) return "photo_library";
  if (kind === MediaKind.Audio) return "album";
  return "video_library";
}

function normalizeAudioAlbumName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function audioCategoryKeyForAlbum(name: string): AudioCategoryKey | null {
  const normalized = normalizeAudioAlbumName(name);
  if (normalized === "music") return "music";
  if (normalized === "soundeffects" || normalized === "soundeffect" || normalized === "sfx") return "sfx";
  if (normalized === "voiceover" || normalized === "voiceovers") return "voiceovers";
  return null;
}

function isReservedAudioCategoryAlbum(album: AlbumDto): boolean {
  return album.kind === AlbumKind.Audio && audioCategoryKeyForAlbum(album.name) !== null;
}

function emptyAudioCategoryMedia(): Record<AudioCategoryKey, MediaDto[]> {
  return { music: [], sfx: [], voiceovers: [] };
}

async function loadAudioCategoryMedia(
  accessToken: string,
  ws: Workspace,
  albums: AlbumDto[],
  reqLog: RequestLogger,
): Promise<Record<AudioCategoryKey, MediaDto[]>> {
  const albumMedia = emptyAudioCategoryMedia();
  await Promise.all(
    albums.map(async (album) => {
      const category = audioCategoryKeyForAlbum(album.name);
      if (!category) return;
      const page = await albumsApi.listAlbumMedia(accessToken, album.id, ws, reqLog, { includeSystem: true });
      albumMedia[category].push(...page.items.filter((item) => item.kind === MediaKind.Audio));
    }),
  );
  return albumMedia;
}
