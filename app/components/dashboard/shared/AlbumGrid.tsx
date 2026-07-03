import { GradientThumbnail } from "~/components/dashboard/shared/GradientThumbnail";
import { EmptyState, primaryButtonClass } from "~/components/dashboard/section";
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

  return (
    <div className={gridClass}>
      {albums.map((album, index) => {
        const count = counts[album.id] ?? 0;

        return (
          <div key={album.id} className="group cursor-pointer space-y-3">
            <div
              className={`${aspectClass} overflow-hidden rounded-xl border border-outline-variant transition-colors group-hover:border-primary/40`}
            >
              <GradientThumbnail
                index={index}
                icon={album.materialSymbol || icon}
                iconClassName="text-[34px] text-on-surface-variant/35"
              />
            </div>
            <div>
              <h4 className="truncate text-label-md font-bold text-on-surface" title={album.name}>
                {album.name}
              </h4>
              <p className="text-label-sm text-on-surface-variant">
                {count} {mediaLabel}
                {count === 1 ? "" : "s"}
              </p>
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
