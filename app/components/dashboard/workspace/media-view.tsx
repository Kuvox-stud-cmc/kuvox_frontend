import { useState } from "react";
import { useNavigation, useRevalidator } from "react-router";

import {
  CardGridSkeleton,
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import { AssetCard } from "~/components/dashboard/shared/AssetCard";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaKind, type MediaDto } from "~/lib/api";
import { useLiveMedia } from "~/lib/media-realtime";

import type { WorkspaceActionData } from "./projects-view";

const KIND_FILTERS = [
  { label: "All", value: "all" as const },
  { label: "Video", value: MediaKind.Video },
  { label: "Image", value: MediaKind.Image },
  { label: "Audio", value: MediaKind.Audio },
];

const AUDIO_CATEGORY_OPTIONS = [
  { value: "music", label: "Music", description: "Songs and background tracks" },
  { value: "sfx", label: "Sound Effects", description: "SFX, foley, and stingers" },
  { value: "voiceovers", label: "Voiceovers", description: "Narration and spoken recordings" },
];

/** Media library grid + kind filter + upload dialog + soft-delete, shared by routes. */
export function MediaView({
  media,
  loadError,
  actionData,
  subtitle,
  title = "Media",
  fixedKind,
  studioId,
  canWrite = true,
  canManageAccess = false,
  workspaceKind = studioId ? "studio" : "personal",
}: {
  media: MediaDto[];
  loadError: string | null;
  actionData?: WorkspaceActionData;
  subtitle?: string;
  title?: string;
  fixedKind?: number;
  studioId?: string | null;
  canWrite?: boolean;
  canManageAccess?: boolean;
  workspaceKind?: "personal" | "studio";
}) {
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = navigation.state === "loading";
  const live = useLiveMedia(media, fixedKind !== undefined ? { kind: fixedKind } : {});

  const [filter, setFilter] = useState<"all" | number>(fixedKind ?? "all");
  const [importOpen, setImportOpen] = useState(false);

  const visible = fixedKind !== undefined
    ? live.media.filter((item) => item.kind === fixedKind)
    : filter === "all" ? live.media : live.media.filter((item) => item.kind === filter);
  const emptyIcon = fixedKind === MediaKind.Image
    ? "photo_library"
    : fixedKind === MediaKind.Audio
      ? "music_note"
      : fixedKind === MediaKind.Video
        ? "videocam"
        : "perm_media";

  return (
    <section>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={canWrite ? (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={primaryButtonClass()}
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import media
          </button>
        ) : undefined}
      />

      {loadError && <ErrorBanner message={loadError} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {fixedKind === undefined && (
        <div className="mt-6 flex flex-wrap gap-2">
          {KIND_FILTERS.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-1 text-label-md transition-colors ${
                filter === option.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={live.media.length === 0 ? "No media yet" : "No media match this filter"}
          hint={live.media.length === 0 ? "Import a file to build the library." : undefined}
          action={
            live.media.length === 0 && canWrite ? (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className={primaryButtonClass()}
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Import media
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, index) => (
            <AssetCard
              key={item.id}
              media={item}
              index={index}
              workspaceKind={workspaceKind}
              pipeline={live.updatesById[item.id]?.pipeline}
              canMoveToRecycleBin={canWrite}
              canManageAccess={canManageAccess}
            />
          ))}
        </div>
      )}

      {canWrite ? (
      <MediaUploadModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        fixedKind={fixedKind}
        studioId={studioId}
        audioCategoryOptions={fixedKind === MediaKind.Audio ? AUDIO_CATEGORY_OPTIONS : undefined}
        onUploaded={async (uploaded, context) => {
          live.mergeMedia(uploaded);
          if (fixedKind !== MediaKind.Audio) return;
          if (!context.audioCategory) throw new Error("Choose an audio type.");

          const formData = new FormData();
          formData.append("intent", "assign-audio-category");
          formData.append("mediaId", uploaded.id);
          formData.append("category", context.audioCategory);
          const response = await fetch("", { method: "POST", body: formData });
          const body = await response.json().catch(() => null) as { error?: string } | null;
          if (!response.ok || body?.error) {
            throw new Error(body?.error || "Couldn't assign the audio type.");
          }
          revalidator.revalidate();
        }}
      />
      ) : null}
    </section>
  );
}
