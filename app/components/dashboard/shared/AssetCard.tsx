import { type KeyboardEvent, type ReactNode } from "react";

import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";
import { AssetCardContextMenu } from "~/components/dashboard/shared/AssetCardContextMenu";
import { MediaKind, type MediaDto } from "~/lib/api";
import { resolveMediaPipeline, type MediaPipeline } from "~/lib/media-pipeline";
import { formatMediaDuration } from "~/lib/media-duration";

interface AssetCardProps {
  media: MediaDto;
  index?: number;
  workspaceKind: "personal" | "studio";
  listView?: boolean;
  pipeline?: MediaPipeline | null;
  canMoveToRecycleBin?: boolean;
  canManageAccess?: boolean;
  defaultDetailsOpen?: boolean;
  onPreview?: (media: MediaDto) => void;
  showFavoriteToggle?: boolean;
  favoriteIntent?: string;
  className?: string;
  badge?: ReactNode;
  secondaryAction?: ReactNode;
}

export function AssetCard({
  media,
  index = 0,
  workspaceKind,
  listView = false,
  pipeline,
  canMoveToRecycleBin = true,
  canManageAccess = false,
  defaultDetailsOpen = false,
  onPreview,
  showFavoriteToggle = true,
  favoriteIntent = "toggle-favorite",
  className = "",
  badge,
  secondaryAction,
}: AssetCardProps) {
  const pipelineState = resolveMediaPipeline(media, pipeline);
  const isRecent = isRecentlyAdded(media.createdAt);
  const icon = mediaKindIcon(media.kind);
  const detail = mediaDetail(media);
  const date = formatDate(media.createdAt);
  const previewLabel = media.kind === MediaKind.Audio ? `Open ${media.filename}` : `Preview ${media.filename}`;

  if (listView) {
    return (
      <div className={`group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-primary/40 ${className}`}>
        <PreviewSurface
          media={media}
          index={index}
          icon={icon}
          label={previewLabel}
          onPreview={onPreview}
          className="h-20 w-28 shrink-0 rounded-lg border border-outline-variant"
        />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 truncate text-body-md font-bold text-on-surface" title={media.filename}>
            <span className="truncate">{media.filename}</span>
            {isRecent ? <RecentBadge /> : null}
            {badge}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
            {detail ? <span>{detail}</span> : null}
            {detail ? <span className="h-1 w-1 rounded-full bg-outline-variant" /> : null}
            <span>{date}</span>
          </div>
          <div className="mt-2">
            <MediaPipelineStatus media={media} pipeline={pipeline} compact />
          </div>
        </div>
        <span className="hidden text-label-sm text-on-surface-variant sm:block">{date}</span>
        {showFavoriteToggle ? <FavoriteButton media={media} intent={favoriteIntent} /> : null}
        {secondaryAction}
        <AssetCardContextMenu
          media={media}
          workspaceKind={workspaceKind}
          canMoveToRecycleBin={canMoveToRecycleBin}
          canManageAccess={canManageAccess}
          placement="top"
          defaultDetailsOpen={defaultDetailsOpen}
        />
      </div>
    );
  }

  return (
    <article className={`group relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/30 ${className}`}>
      <div className="absolute right-3 top-3 z-10">
        <AssetCardContextMenu
          media={media}
          workspaceKind={workspaceKind}
          canMoveToRecycleBin={canMoveToRecycleBin}
          canManageAccess={canManageAccess}
          defaultDetailsOpen={defaultDetailsOpen}
        />
      </div>
      <PreviewSurface
        media={media}
        index={index}
        icon={icon}
        label={previewLabel}
        onPreview={onPreview}
        className={media.kind === MediaKind.Image ? "aspect-[4/3] w-full" : "aspect-video w-full"}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 to-transparent" />
        <div className="absolute left-3 top-3 max-w-[calc(100%-5rem)]">
          <MediaPipelineStatus media={media} pipeline={pipeline} compact />
        </div>
        {pipelineState.stage !== "ready" && pipelineState.stage !== "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/40 px-4 text-center">
            <span className="text-label-md font-bold text-on-surface">{pipelineState.label}</span>
            <span className="mt-1 max-w-56 text-label-sm text-on-surface-variant">{pipelineState.detail}</span>
          </div>
        ) : null}
        {media.kind === MediaKind.Video && media.durationSeconds != null ? (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-surface-container-lowest/60 px-1.5 py-0.5 text-label-sm font-bold text-on-surface backdrop-blur-md">
            <span className="material-symbols-outlined text-[12px]">play_arrow</span>
            {formatMediaDuration(media.durationSeconds)}
          </span>
        ) : null}
      </PreviewSurface>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="flex min-w-0 flex-1 items-center gap-2 truncate text-body-sm font-bold text-on-surface" title={media.filename}>
            <span className="truncate">{media.filename}</span>
            {isRecent ? <RecentBadge /> : null}
            {badge}
          </h3>
        </div>
        <p className="mb-3 truncate text-label-md text-on-surface-variant">{detail || date}</p>
        <div className="flex items-end justify-between gap-3">
          <span className="text-label-sm text-on-surface-variant">{date}</span>
          <div className="flex items-center gap-1">
            {showFavoriteToggle ? <FavoriteButton media={media} intent={favoriteIntent} /> : null}
            {secondaryAction}
          </div>
        </div>
      </div>
    </article>
  );
}

function PreviewSurface({
  media,
  index,
  icon,
  label,
  className,
  onPreview,
  children,
}: {
  media: MediaDto;
  index: number;
  icon: string;
  label: string;
  className: string;
  onPreview?: (media: MediaDto) => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      <MediaThumbnail media={media} index={index} icon={icon} />
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
      {children}
    </>
  );

  if (!onPreview) {
    return <div className={`relative overflow-hidden ${className}`}>{content}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPreview(media)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPreview(media);
        }
      }}
      className={`relative cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low ${className}`}
      aria-label={label}
    >
      {content}
    </div>
  );
}

function FavoriteButton({ media, intent }: { media: MediaDto; intent: string }) {
  return (
    <IconToggleButton
      id={media.id}
      active={media.isFavorite}
      intent={intent}
      activeIcon="favorite"
      inactiveIcon="favorite_border"
      activeClassName="text-error"
      label={`${media.isFavorite ? "Remove from" : "Add to"} favorites`}
    />
  );
}

function RecentBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
      Recent
    </span>
  );
}

function mediaKindIcon(kind: number) {
  if (kind === MediaKind.Image) return "image";
  if (kind === MediaKind.Audio) return "music_note";
  return "play_circle";
}

function mediaDetail(media: MediaDto): string {
  const size = formatSize(media.sizeBytes);
  const dimensions = media.width && media.height ? `${media.width} x ${media.height}` : null;

  if (media.kind === MediaKind.Audio) {
    return [formatMediaDuration(media.durationSeconds), size].filter(Boolean).join(" / ");
  }

  if (media.kind === MediaKind.Video) {
    return [formatMediaDuration(media.durationSeconds), dimensions, size].filter(Boolean).join(" / ");
  }

  return [dimensions, size].filter(Boolean).join(" / ") || size;
}

function formatSize(value: MediaDto["sizeBytes"]): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Pending";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 * 1024 ? 0 : 1)} GB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function isRecentlyAdded(value: string): boolean {
  const createdAt = new Date(value).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
}
