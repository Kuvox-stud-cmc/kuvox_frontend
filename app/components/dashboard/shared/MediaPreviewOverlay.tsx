import { useEffect, useMemo, useState } from "react";

import { MediaKind, type MediaDto } from "~/lib/api";
import { resolveMediaPipeline, type MediaPipeline } from "~/lib/media-pipeline";
import {
  mediaObjectUrl,
  type MediaObjectVariant,
} from "~/components/dashboard/workspace/media-thumbnail";

type PreviewKind = "photo" | "video";

interface PreviewSource {
  src: string;
  variant: MediaObjectVariant;
}

interface MediaPreviewOverlayProps {
  media: MediaDto | null;
  pipeline?: MediaPipeline | null;
  onClose: () => void;
}

export function resolveMediaObjectSource(
  media: MediaDto,
  variants: MediaObjectVariant[],
): PreviewSource | null {
  for (const variant of variants) {
    const cacheKey = storageKeyForVariant(media, variant);
    if (cacheKey) {
      return {
        src: mediaObjectUrl(media.id, variant, cacheKey),
        variant,
      };
    }
  }

  return null;
}

export function MediaPreviewOverlay({
  media,
  pipeline,
  onClose,
}: MediaPreviewOverlayProps) {
  const [sourceFailed, setSourceFailed] = useState(false);
  const previewKind: PreviewKind | null =
    media?.kind === MediaKind.Video ? "video" : media?.kind === MediaKind.Image ? "photo" : null;
  const source = useMemo(() => {
    if (!media || !previewKind) return null;
    return previewKind === "video"
      ? resolveMediaObjectSource(media, ["proxy", "canonical"])
      : resolveMediaObjectSource(media, ["canonical", "thumbnail"]);
  }, [media, previewKind]);
  const poster = useMemo(() => {
    if (!media?.thumbnailStorageKey) return undefined;
    return mediaObjectUrl(media.id, "thumbnail", media.thumbnailStorageKey);
  }, [media]);
  const pipelineState = media ? resolveMediaPipeline(media, pipeline) : null;
  const unavailable = !media || !previewKind || !source || sourceFailed;

  useEffect(() => {
    setSourceFailed(false);
  }, [media?.id, source?.src]);

  useEffect(() => {
    if (!media) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [media, onClose]);

  if (!media) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/90 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${media.filename} preview`}
        className="relative z-10 flex h-full max-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-body-lg font-bold text-on-surface">
              {media.filename}
            </h2>
            {pipelineState && (
              <p className="mt-0.5 truncate text-label-md text-on-surface-variant">
                {source ? sourceLabel(source.variant, pipelineState.label) : pipelineState.detail}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
          {unavailable ? (
            <div className="flex max-w-md flex-col items-center px-6 text-center">
              <span className="material-symbols-outlined text-[44px] text-on-surface-variant">
                {pipelineState?.stage === "failed" ? "error" : "pending"}
              </span>
              <p className="mt-3 text-body-lg font-bold text-on-surface">
                Preview unavailable
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {pipelineState?.detail ||
                  "This media item does not have a playable preview object yet."}
              </p>
            </div>
          ) : previewKind === "video" ? (
            <video
              key={source.src}
              src={source.src}
              poster={poster}
              controls
              autoPlay
              className="max-h-full max-w-full"
              onError={() => setSourceFailed(true)}
            />
          ) : (
            <img
              key={source.src}
              src={source.src}
              alt={media.filename}
              className="max-h-full max-w-full object-contain"
              onError={() => setSourceFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function storageKeyForVariant(media: MediaDto, variant: MediaObjectVariant): string | null {
  if (variant === "thumbnail") return media.thumbnailStorageKey || null;
  if (variant === "canonical") return media.canonicalStorageKey || null;
  if (variant === "proxy") return media.proxyStorageKey || null;
  return media.storageKey || null;
}

function sourceLabel(variant: MediaObjectVariant, fallback: string): string {
  if (variant === "proxy") return "Proxy preview";
  if (variant === "canonical") return "Canonical preview";
  if (variant === "thumbnail") return "Thumbnail preview";
  return fallback;
}
