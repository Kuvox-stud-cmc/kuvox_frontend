import { useState } from "react";
import { useNavigation, useRevalidator } from "react-router";

import {
  CardGridSkeleton,
  Chip,
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaPipelineStatus } from "~/components/dashboard/workspace/media-pipeline-status";
import { MediaKind, mediaKindLabel, type MediaDto } from "~/lib/api";
import { useLiveMedia } from "~/lib/media-realtime";
import { resolveMediaPipeline } from "~/lib/media-pipeline";

import type { WorkspaceActionData } from "./projects-view";

const KIND_FILTERS = [
  { label: "All", value: "all" as const },
  { label: "Video", value: MediaKind.Video },
  { label: "Image", value: MediaKind.Image },
  { label: "Audio", value: MediaKind.Audio },
];

const KIND_ICON: Record<number, string> = {
  [MediaKind.Video]: "movie",
  [MediaKind.Image]: "image",
  [MediaKind.Audio]: "music_note",
};

const AUDIO_CATEGORY_OPTIONS = [
  { value: "music", label: "Music", description: "Songs and background tracks" },
  { value: "sfx", label: "Sound Effects", description: "SFX, foley, and stingers" },
  { value: "voiceovers", label: "Voiceovers", description: "Narration and spoken recordings" },
];

function formatSize(value: number | string): string {
  const bytes = Number(value);
  if (bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
}: {
  media: MediaDto[];
  loadError: string | null;
  actionData?: WorkspaceActionData;
  subtitle?: string;
  title?: string;
  fixedKind?: number;
  studioId?: string | null;
  canWrite?: boolean;
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
          {visible.map((item) => {
            const pipeline = live.updatesById[item.id]?.pipeline;
            const pipelineState = resolveMediaPipeline(item, pipeline);
            const showDetail = !pipelineState.terminal || pipelineState.stage === "failed";

            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40"
              >
                <div className="aspect-video overflow-hidden bg-surface-container">
                  <MediaThumbnail media={item} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="material-symbols-outlined text-primary">
                      {KIND_ICON[item.kind] ?? "perm_media"}
                    </span>
                    <Chip>{mediaKindLabel(item.kind)}</Chip>
                  </div>
                  <h3 className="mt-3 truncate text-body-lg text-on-surface" title={item.filename}>
                    {item.filename}
                  </h3>
                  <div className="mt-4">
                    <MediaPipelineStatus
                      media={item}
                      pipeline={pipeline}
                      showDetail={showDetail}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-label-md text-on-surface-variant">
                      {formatSize(item.sizeBytes)}
                    </span>
                    {canWrite ? (
                    <ConfirmSubmitButton
                      fields={{ intent: "delete", id: item.id }}
                      title="Move media to trash?"
                      message={
                        <>
                          Move <span className="font-medium text-on-surface">{item.filename}</span> to trash?
                        </>
                      }
                      confirmLabel="Move to trash"
                      ariaLabel={`Move ${item.filename} to Trash`}
                      buttonClassName="rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-error group-hover:opacity-100 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </ConfirmSubmitButton>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
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
