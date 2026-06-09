import { useRef, useState } from "react";
import { Link } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/import-media";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Import media · Kuvox" }];
}

const ACCEPTED = "video/*,image/*,audio/*";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportMedia(_: Route.ComponentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((current) => [...current, ...Array.from(incoming)]);
  };

  const removeFile = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index));

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Import your media</h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Bring in the footage you want to work with. You can always add more
        later.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/10"
            : "border-outline-variant bg-surface-container hover:border-primary/50"
        }`}
      >
        <span className="material-symbols-outlined text-4xl text-primary">
          cloud_upload
        </span>
        <p className="mt-2 text-label-lg text-on-surface">
          Drag &amp; drop files here
        </p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          or click to browse — video, image, and audio up to 2&nbsp;GB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">info</span>
        Uploads are coming soon — selections here are a preview and won't be
        sent yet.
      </p>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant">
                  movie
                </span>
                <span className="truncate text-body-sm text-on-surface">
                  {file.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body-sm text-on-surface-variant">
                  {formatSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="text-on-surface-variant transition-colors hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Link
          to="/onboarding/personalize"
          className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
        >
          Back
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/onboarding/first-project"
            className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            Skip
          </Link>
          <Link
            to="/onboarding/first-project"
            className="rounded-lg bg-primary px-5 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
          >
            Continue
          </Link>
        </div>
      </div>
    </section>
  );
}
