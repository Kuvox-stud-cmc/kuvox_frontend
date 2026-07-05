import { Link } from "react-router";

import { GradientThumbnail } from "~/components/dashboard/shared/GradientThumbnail";
import { EmptyState, primaryButtonClass } from "~/components/dashboard/section";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { AccessDialog, ShareDialog } from "~/components/dashboard/shared/resource-dialogs";
import type { AlbumDto } from "~/lib/api";

interface AlbumGridProps {
  albums: AlbumDto[];
  counts: Record<string, number>;
  mediaLabel: string;
  icon: string;
  emptyTitle: string;
  emptyHint: string;
  columns?: "square" | "wide";
  onCreate?: () => void;
  createLabel?: string;
  showFavoriteToggle?: boolean;
  favoriteIntent?: string;
  limit?: number;
  getAlbumTo?: (album: AlbumDto) => string;
  workspaceKind?: "personal" | "studio";
  canManageAccess?: boolean;
}

export function AlbumGrid({
  albums,
  counts,
  mediaLabel,
  icon,
  emptyTitle,
  emptyHint,
  columns = "square",
  onCreate,
  createLabel = "Create Album",
  showFavoriteToggle = true,
  favoriteIntent = "toggle-album-favorite",
  limit,
  getAlbumTo,
  workspaceKind = "personal",
  canManageAccess = false,
}: AlbumGridProps) {
  if (albums.length === 0) {
    return (
      <EmptyState
        icon={icon}
        title={emptyTitle}
        hint={emptyHint}
        action={
          onCreate ? (
            <button type="button" onClick={onCreate} className={primaryButtonClass()}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              {createLabel}
            </button>
          ) : undefined
        }
      />
    );
  }

  const gridClass =
    columns === "wide"
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
      : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6";
  const aspectClass = columns === "wide" ? "aspect-video" : "aspect-square";
  const visibleAlbums = typeof limit === "number" ? albums.slice(0, limit) : albums;

  return (
    <div className={gridClass}>
      {visibleAlbums.map((album, index) => {
        const count = counts[album.id] ?? 0;
        const albumTo = getAlbumTo?.(album);
        const thumbnail = (
          <div
            className={`${aspectClass} relative overflow-hidden rounded-xl border border-outline-variant transition-colors group-hover:border-primary/40`}
          >
            <GradientThumbnail
              index={index}
              icon={album.materialSymbol || icon}
              iconClassName="text-[34px] text-on-surface-variant/35"
            />
          </div>
        );
        const title = (
          <>
            <h4 className="truncate text-label-md font-bold text-on-surface" title={album.name}>
              {album.name}
            </h4>
            <p className="text-label-sm text-on-surface-variant">
              {count} {mediaLabel}
              {count === 1 ? "" : "s"}
            </p>
          </>
        );

        return (
          <div key={album.id} className="group space-y-3">
            <div className="relative">
              {albumTo ? (
                <Link to={albumTo} className="block">
                  {thumbnail}
                </Link>
              ) : (
                thumbnail
              )}
              <div className="absolute bottom-2 right-2">
                <div className="flex items-center gap-1">
                  {workspaceKind === "studio" ? (
                    <AccessDialog resourceType="album" resourceId={album.id} resourceName={album.name} canManageAccess={canManageAccess} />
                  ) : (
                    <ShareDialog resourceType="album" resourceId={album.id} resourceName={album.name} />
                  )}
                  {showFavoriteToggle ? (
                    <IconToggleButton
                      id={album.id}
                      active={album.isFavorite}
                      intent={favoriteIntent}
                      activeIcon="favorite"
                      inactiveIcon="favorite_border"
                      activeClassName="text-error"
                      label={`${album.isFavorite ? "Remove from" : "Add to"} favorites`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="min-w-0">
              {albumTo ? (
                <Link to={albumTo} className="block min-w-0">
                  {title}
                </Link>
              ) : (
                title
              )}
            </div>
          </div>
        );
      })}

      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className={`${aspectClass} flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface`}
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
          <span className="mt-2 text-label-md font-medium">{createLabel}</span>
        </button>
      )}
    </div>
  );
}
