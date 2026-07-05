import { OwnerKind, type AlbumDto } from "~/lib/api";

export function isAlbumInStudioScope(album: AlbumDto, studioId: string): boolean {
  const ownerId = (album as Partial<AlbumDto>).ownerId;
  const ownerKind = (album as Partial<AlbumDto>).ownerKind;

  if (ownerId && ownerKind != null) {
    return ownerKind === OwnerKind.Studio && ownerId === studioId;
  }

  return true;
}
