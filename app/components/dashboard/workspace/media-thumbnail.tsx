import { useEffect, useState } from "react";

import { GradientThumbnail } from "~/components/dashboard/shared/GradientThumbnail";
import { MediaKind, type MediaDto } from "~/lib/api";

export type MediaObjectVariant = "thumbnail" | "canonical" | "proxy" | "raw";

interface MediaThumbnailProps {
  media: MediaDto;
  index?: number;
  icon?: string;
  className?: string;
  imageClassName?: string;
}

export function MediaThumbnail({
  media,
  index = 0,
  icon,
  className = "",
  imageClassName = "",
}: MediaThumbnailProps) {
  const candidate = mediaPreviewCandidate(media);
  const key = candidate?.cacheKey ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [media.id, key]);

  if (!candidate || failed) {
    if (media.kind === MediaKind.Audio) {
      return (
        <AudioWaveformFallback
          className={className}
          icon={icon ?? iconForKind(media.kind)}
        />
      );
    }

    return (
      <GradientThumbnail
        index={index}
        icon={icon ?? iconForKind(media.kind)}
        className={className}
      />
    );
  }

  const src = mediaObjectUrl(media.id, candidate.variant, candidate.cacheKey);

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`h-full w-full object-cover ${className} ${imageClassName}`}
      onError={() => {
        if (import.meta.env.DEV) {
          console.warn("[kuvox-media] thumbnail image failed", {
            mediaId: media.id,
            url: src,
          });
        }

        setFailed(true);
      }}
    />
  );
}

export function mediaPreviewCandidate(media: MediaDto): { variant: MediaObjectVariant; cacheKey: string } | null {
  if (media.kind === MediaKind.Image) {
    const cacheKey = media.thumbnailStorageKey || media.canonicalStorageKey;
    return cacheKey ? { variant: "thumbnail", cacheKey } : null;
  }

  if (media.kind === MediaKind.Video || media.kind === MediaKind.Audio) {
    return media.thumbnailStorageKey
      ? { variant: "thumbnail", cacheKey: media.thumbnailStorageKey }
      : null;
  }

  return null;
}

export function mediaObjectUrl(mediaId: string, variant: MediaObjectVariant, cacheKey?: string) {
  const query = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : "";
  return `/bff/media/${encodeURIComponent(mediaId)}/object/${variant}${query}`;
}

function AudioWaveformFallback({ className, icon }: { className: string; icon: string }) {
  const bars = [30, 55, 42, 78, 48, 64, 36, 88, 58, 46, 70, 52, 82, 38, 62, 44];

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-container ${className}`}
    >
      <div className="absolute inset-0 bg-surface-container-high/45" />
      <div className="relative flex h-2/3 w-4/5 items-center justify-center gap-1">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-primary/50"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-on-surface-variant/55">
        {icon}
      </span>
    </div>
  );
}

function iconForKind(kind: number) {
  if (kind === MediaKind.Video) return "play_circle";
  if (kind === MediaKind.Audio) return "music_note";
  return "image";
}
