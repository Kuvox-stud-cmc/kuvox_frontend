import { Provider } from "react-redux";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import { MediaKind, OwnerKind, ProjectKind, type MediaDto, type ProjectDto, type ProjectMediaDto } from "~/lib/api";
import { createMockVideoProjectDocument, type VideoProjectDocument } from "~/lib/editor/video-document";
import { makeStore, type AppStore } from "~/store";
import {
  documentLoaded,
  timelineItemsSelected,
} from "~/store/slices/editor-slice";

export function renderWithEditorStore(
  ui: ReactElement,
  options: RenderOptions & {
    document?: VideoProjectDocument;
    selectedItemIds?: string[];
    store?: AppStore;
  } = {},
) {
  const store = options.store ?? makeStore();
  const document = options.document ?? createMockVideoProjectDocument("video-test", "Video Test");
  store.dispatch(documentLoaded(document));
  if (options.selectedItemIds) {
    store.dispatch(timelineItemsSelected({
      itemIds: options.selectedItemIds,
      activeItemId: options.selectedItemIds[0],
    }));
  }

  const result = render(<Provider store={store}>{ui}</Provider>, options);
  return { ...result, store };
}

export function mediaFixture(overrides: Partial<MediaDto> = {}): MediaDto {
  const kind = overrides.kind ?? MediaKind.Video;
  const filename = overrides.filename ?? (kind === MediaKind.Audio ? "Ambience.wav" : kind === MediaKind.Image ? "Poster.png" : "Beach.mp4");
  return {
    id: overrides.id ?? "media-ready",
    ownerId: overrides.ownerId ?? "owner-1",
    ownerKind: overrides.ownerKind ?? OwnerKind.User,
    ownerEmail: overrides.ownerEmail ?? null,
    ownerDisplayName: overrides.ownerDisplayName ?? null,
    kind,
    filename,
    storageKey: overrides.storageKey ?? `${filename}-raw`,
    sizeBytes: overrides.sizeBytes ?? 1024,
    status: overrides.status ?? "Ready",
    canonicalStorageKey: overrides.canonicalStorageKey ?? `${filename}-canonical`,
    proxyStorageKey: overrides.proxyStorageKey ?? `${filename}-proxy`,
    thumbnailStorageKey: overrides.thumbnailStorageKey ?? `${filename}-thumb`,
    errorMessage: overrides.errorMessage ?? null,
    durationSeconds: overrides.durationSeconds ?? (kind === MediaKind.Image ? null : 12),
    width: overrides.width ?? (kind === MediaKind.Audio ? null : 1920),
    height: overrides.height ?? (kind === MediaKind.Audio ? null : 1080),
    codec: overrides.codec ?? (kind === MediaKind.Audio ? "pcm" : "h264"),
    frameRate: overrides.frameRate ?? (kind === MediaKind.Video ? 30 : null),
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    isFavorite: overrides.isFavorite ?? false,
    pipeline: overrides.pipeline ?? {
      stage: "ready",
      label: "Ready",
      detail: "Ready for editing.",
      step: 4,
      stepCount: 4,
      terminal: true,
    },
  };
}

export function projectFixture(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: overrides.id ?? "e2e-video-project",
    ownerId: overrides.ownerId ?? "user-e2e",
    ownerKind: overrides.ownerKind ?? OwnerKind.User,
    ownerEmail: overrides.ownerEmail ?? "e2e@kuvox.local",
    ownerDisplayName: overrides.ownerDisplayName ?? "E2E User",
    kind: overrides.kind ?? ProjectKind.Video,
    name: overrides.name ?? "E2E Video Project",
    description: overrides.description ?? null,
    durationSeconds: overrides.durationSeconds ?? 20,
    status: overrides.status ?? "Active",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
    mediaCount: overrides.mediaCount ?? 1,
    isStarred: overrides.isStarred ?? false,
  } satisfies ProjectDto;
}

export function projectMediaFixture(media: MediaDto): ProjectMediaDto {
  return {
    mediaId: media.id,
    kind: media.kind,
    availability: "available",
    filename: media.filename,
    ownerId: media.ownerId,
    ownerKind: media.ownerKind,
    status: media.status,
    storageKey: media.storageKey,
    sizeBytes: Number(media.sizeBytes),
    canonicalStorageKey: media.canonicalStorageKey,
    proxyStorageKey: media.proxyStorageKey,
    thumbnailStorageKey: media.thumbnailStorageKey,
    errorMessage: media.errorMessage,
    durationSeconds: Number(media.durationSeconds ?? 0),
    width: media.width === null ? null : Number(media.width),
    height: media.height === null ? null : Number(media.height),
    codec: media.codec,
    frameRate: media.frameRate === null ? null : Number(media.frameRate),
    shotCount: 2,
    createdAt: media.createdAt,
  };
}
