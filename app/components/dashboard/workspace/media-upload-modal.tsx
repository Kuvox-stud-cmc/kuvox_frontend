import { useEffect, useState, type FormEvent } from "react";

import {
  ErrorBanner,
  Modal,
  primaryButtonClass,
} from "~/components/dashboard/section";
import { MediaKind, mediaKindLabel, type MediaDto } from "~/lib/api";
import { uploadMediaFile } from "~/lib/media-upload.client";

const ACCEPT_BY_KIND: Record<number, string> = {
  [MediaKind.Video]: "video/*",
  [MediaKind.Image]: "image/*",
  [MediaKind.Audio]: "audio/*",
};

export function MediaUploadModal({
  open,
  onClose,
  fixedKind,
  studioId,
  title = "Import media",
  audioCategoryOptions,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  fixedKind?: number;
  studioId?: string | null;
  title?: string;
  audioCategoryOptions?: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  onUploaded: (media: MediaDto, context: { audioCategory?: string }) => void | Promise<void>;
}) {
  const [kind, setKind] = useState(fixedKind ?? MediaKind.Video);
  const [audioCategory, setAudioCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressLabel = progress >= 100 ? "Finalizing import" : "Uploading";

  useEffect(() => {
    if (!open) {
      setFile(null);
      setFilename("");
      setProgress(0);
      setSubmitting(false);
      setError(null);
      setKind(fixedKind ?? MediaKind.Video);
      setAudioCategory("");
    }
  }, [fixedKind, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiresAudioCategory = kind === MediaKind.Audio && Boolean(audioCategoryOptions?.length);
    if (requiresAudioCategory && !audioCategory) {
      setError("Choose an audio type.");
      return;
    }

    if (!file) {
      setError("Choose a file to import.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgress(0);

    try {
      const uploaded = await uploadMediaFile({
        file,
        kind,
        filename,
        studioId,
        onProgress: setProgress,
      });
      await onUploaded(uploaded, { audioCategory: audioCategory || undefined });
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <ErrorBanner message={error} />}

        {fixedKind === undefined ? (
          <div>
            <label htmlFor="media-kind" className="block text-label-md text-on-surface-variant">
              Kind
            </label>
            <select
              id="media-kind"
              value={kind}
              onChange={(event) => {
                setKind(Number(event.currentTarget.value));
                setFile(null);
                setFilename("");
              }}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value={MediaKind.Video}>{mediaKindLabel(MediaKind.Video)}</option>
              <option value={MediaKind.Image}>{mediaKindLabel(MediaKind.Image)}</option>
              <option value={MediaKind.Audio}>{mediaKindLabel(MediaKind.Audio)}</option>
            </select>
          </div>
        ) : null}

        {kind === MediaKind.Audio && audioCategoryOptions?.length ? (
          <div>
            <label htmlFor="audio-category" className="block text-label-md text-on-surface-variant">
              Audio type
            </label>
            <select
              id="audio-category"
              value={audioCategory}
              onChange={(event) => setAudioCategory(event.currentTarget.value)}
              disabled={submitting}
              required
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">Choose audio type</option>
              {audioCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.description ? ` - ${option.description}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="media-file" className="block text-label-md text-on-surface-variant">
            File
          </label>
          <input
            id="media-file"
            type="file"
            accept={ACCEPT_BY_KIND[kind] ?? undefined}
            disabled={submitting}
            required
            onChange={(event) => {
              const selectedFile = event.currentTarget.files?.[0] ?? null;
              setFile(selectedFile);
              setFilename(selectedFile?.name ?? "");
            }}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label-md file:text-on-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="media-filename" className="block text-label-md text-on-surface-variant">
            Save as
          </label>
          <input
            id="media-filename"
            type="text"
            value={filename}
            onChange={(event) => setFilename(event.currentTarget.value)}
            disabled={submitting || !file}
            maxLength={512}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
          />
        </div>

        {submitting && (
          <div>
            <div className="mb-1 flex items-center justify-between text-label-sm text-on-surface-variant">
              <span>{progressLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={primaryButtonClass()}>
            {submitting ? "Importing..." : "Import"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
