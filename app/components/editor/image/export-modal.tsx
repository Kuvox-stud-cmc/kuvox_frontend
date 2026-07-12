import { useState } from "react";
import { EditorIcon } from "../editor-ui";
import { exportImageCompositionDocument } from "~/lib/editor/image/export/image-export.client";
import { sanitizeImageExportFilename } from "~/lib/editor/image/export/filename";
import {
  imageCompositionCanExport,
  resolveImageExportDimensions,
  type ImageExportResult,
  type ImageExportSettings,
} from "~/lib/editor/image/export/types";
import type { ImageCompositionDocument } from "~/lib/editor/image/document/types";

interface ImageExportModalProps {
  open: boolean;
  composition: ImageCompositionDocument;
  projectName?: string | null;
  onClose: () => void;
}

const sizeModes = [
  { mode: "1x", label: "1x" },
  { mode: "2x", label: "2x" },
  { mode: "3x", label: "3x" },
  { mode: "custom", label: "Custom" },
] as const;

export function ImageExportModal({
  open,
  composition,
  projectName = "",
  onClose,
}: ImageExportModalProps) {
  const [settings, setSettings] = useState<ImageExportSettings>(() =>
    createDefaultExportSettings(composition, projectName || ""),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImageExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canExport = settings.filename.trim().length > 0;
  const status = busy ? "exporting" : result ? "done" : "idle";
  const dimensions = resolveImageExportDimensions(composition, settings);

  const handleExport = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      // Renders the Konva stage to Canvas, creates a Blob, and downloads it.
      const exportResult = await exportImageCompositionDocument(composition, settings);
      setResult(exportResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render image canvas.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close export dialog"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-export-title"
        className="relative z-10 w-full max-w-md rounded-[8px] border border-outline-variant bg-surface-container shadow-2xl"
      >
        <header className="flex h-12 items-center justify-between border-b border-outline-variant/30 px-4">
          <div className="flex items-center gap-2">
            <EditorIcon className="text-[18px] text-primary">ios_share</EditorIcon>
            <h2 id="image-export-title" className="text-body-sm font-semibold text-on-surface">
              Export PNG
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close export dialog"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-hover hover:text-on-surface disabled:pointer-events-none disabled:text-on-surface-variant/25"
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        </header>

        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant/45">
              Filename
            </span>
            <input
              value={settings.filename}
              onChange={(event) =>
                setSettings((current) => ({ ...current, filename: event.target.value }))
              }
              className="h-9 w-full rounded-[4px] border border-outline-variant/40 bg-black/25 px-3 text-body-sm text-on-surface outline-none focus:border-primary/70"
            />
          </label>

          <div>
            <span className="mb-2 block text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant/45">
              Size
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-[6px] border border-outline-variant/35 bg-black/20 p-1">
              {sizeModes.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      sizeMode: item.mode,
                      customWidth:
                        item.mode === "custom"
                          ? current.customWidth ?? Math.round(composition.canvas.width)
                          : current.customWidth,
                    }))
                  }
                  className={`h-8 rounded-[4px] text-label-md font-semibold transition-colors ${
                    settings.sizeMode === item.mode
                      ? "bg-hover text-on-surface"
                      : "text-on-surface/55 hover:text-on-surface"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {settings.sizeMode === "custom" ? (
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant/45">
                Width
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.customWidth ?? composition.canvas.width}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      customWidth: Math.max(1, Math.round(Number(event.target.value) || 1)),
                    }))
                  }
                  className="h-9 min-w-0 flex-1 rounded-[4px] border border-outline-variant/40 bg-black/25 px-3 text-body-sm text-on-surface outline-none focus:border-primary/70"
                />
                <span className="shrink-0 text-label-md text-on-surface-variant/50">
                  {dimensions.height}px high
                </span>
              </div>
            </label>
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-[6px] border border-outline-variant/35 bg-black/18 px-3 py-2">
            <span>
              <span className="block text-label-md font-semibold text-on-surface">Transparent background</span>
              <span className="block text-label-sm text-on-surface-variant/45">
                Export alpha instead of the document background.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.transparentBackground}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  transparentBackground: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>

          <div className="rounded-[6px] border border-outline-variant/30 bg-black/18 px-3 py-2 text-label-md text-on-surface-variant/75">
            PNG / {dimensions.width}px x {dimensions.height}px
          </div>

          {result?.warnings.length ? (
            <div className="rounded-[6px] border border-warning/30 bg-warning/10 px-3 py-2 text-label-md text-warning">
              {result.warnings.join(" ")}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[6px] border border-danger/30 bg-danger/10 px-3 py-2 text-label-md text-danger">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-outline-variant/30 px-4 py-3">
          <span className="text-label-sm uppercase tracking-wide text-on-surface-variant/40">
            {statusLabel(status)}
          </span>
          <button
            type="button"
            disabled={!canExport || busy}
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:bg-primary-fixed disabled:pointer-events-none disabled:bg-surface-container/20 disabled:text-on-surface-variant/25"
          >
            <EditorIcon className="text-[16px]">
              {busy ? "progress_activity" : "download"}
            </EditorIcon>
            Export
          </button>
        </footer>
      </div>
    </div>
  );
}

function createDefaultExportSettings(
  composition: ImageCompositionDocument,
  projectName: string,
): ImageExportSettings {
  return {
    format: "png",
    filename: sanitizeImageExportFilename(projectName || "image-export"),
    sizeMode: "1x",
    customWidth: null,
    transparentBackground: false,
  };
}

function statusLabel(status: "idle" | "exporting" | "done") {
  if (status === "exporting") return "Rendering...";
  if (status === "done") return "Exported";
  return "Ready";
}
