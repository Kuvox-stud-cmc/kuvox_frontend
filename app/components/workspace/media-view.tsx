import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";

import {
  CardGridSkeleton,
  Chip,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import { MediaKind, mediaKindLabel, type MediaDto } from "~/lib/api";

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

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Media library grid + kind filter + metadata-import dialog + soft-delete, shared by routes. */
export function MediaView({
  media,
  loadError,
  actionData,
  subtitle,
}: {
  media: MediaDto[];
  loadError: string | null;
  actionData?: WorkspaceActionData;
  subtitle?: string;
}) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const [filter, setFilter] = useState<"all" | number>("all");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create") {
      setImportOpen(false);
    }
  }, [actionData]);

  const visible = filter === "all" ? media : media.filter((item) => item.kind === filter);

  return (
    <section>
      <SectionHeader
        title="Media"
        subtitle={subtitle}
        action={
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className={primaryButtonClass()}
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Import media
          </button>
        }
      />

      {loadError && <ErrorBanner message={loadError} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

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

      {isLoading ? (
        <CardGridSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="perm_media"
          title={media.length === 0 ? "No media yet" : "No media match this filter"}
          hint={media.length === 0 ? "Import a file to build the library." : undefined}
          action={
            media.length === 0 ? (
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
          {visible.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="material-symbols-outlined text-primary">
                  {KIND_ICON[item.kind] ?? "perm_media"}
                </span>
                <Chip>{mediaKindLabel(item.kind)}</Chip>
              </div>
              <h3 className="mt-3 truncate text-body-lg text-on-surface" title={item.filename}>
                {item.filename}
              </h3>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-label-md text-on-surface-variant">
                  {item.status} · {formatSize(item.sizeBytes)}
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    aria-label={`Move ${item.filename} to Trash`}
                    className="rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-error group-hover:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import media">
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Registers a media record now; real file upload to storage lands in a later phase.
        </p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />
          <div>
            <label htmlFor="filename" className="block text-label-md text-on-surface-variant">
              Filename
            </label>
            <input
              id="filename"
              name="filename"
              type="text"
              required
              placeholder="clip.mp4"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="kind" className="block text-label-md text-on-surface-variant">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={MediaKind.Video}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value={MediaKind.Video}>Video</option>
              <option value={MediaKind.Image}>Image</option>
              <option value={MediaKind.Audio}>Audio</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className={primaryButtonClass()}
            >
              {navigation.state === "submitting" ? "Importing…" : "Import"}
            </button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}
