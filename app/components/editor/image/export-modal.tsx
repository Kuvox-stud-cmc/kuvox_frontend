import { useEffect, useMemo, useRef, useState } from "react";

import { EditorIcon } from "../editor-ui";
import type { ImageCompositionDocument } from "~/lib/editor/image/document/types";
import { sanitizeImageExportFilename } from "~/lib/editor/image/export/filename";
import {
  imageCompositionCanExport,
  resolveImageExportDimensions,
  type ImageExportResult,
  type ImageExportSettings,
  type ImageExportSizeMode,
} from "~/lib/editor/image/export/types";

type ExportStatus = "idle" | "preparing" | "downloading" | "failed";

interface ImageExportModalProps {
  open: boolean;
  composition: ImageCompositionDocument;
  projectName: string;
  onClose: () => void;
}

const sizeModes: Array<{ mode: ImageExportSizeMode; label: string }> = [
  { mode: "1x", label: "1x" },
  { mode: "2x", label: "2x" },
  { mode: "3x", label: "3x" },
  { mode: "custom", label: "Custom" },
];

export function ImageExportModal({
  open,
  composition,
  projectName,
  onClose,
}: ImageExportModalProps) {
  const [settings, setSettings] = useState<ImageExportSettings>(() =>
    createDefaultExportSettings(composition, projectName),
  );
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageExportResult | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSettings(createDefaultExportSettings(composition, projectName));
      setStatus("idle");
      setError(null);
      setResult(null);
    }
    wasOpen.current = open;
  }, [composition, open, projectName]);

  const dimensions = useMemo(
    () => resolveImageExportDimensions(composition, settings),
    [composition, settings],
  );
  const canExport = imageCompositionCanExport(composition) && settings.filename.trim().length > 0;
  const busy = status === "preparing" || status === "downloading";

  if (!open) return null;

  const handleExport = async () => {
    if (!canExport || busy) return;
    setStatus("preparing");
    setError(null);
    setResult(null);

    try {
      const { exportImageCompositionDocument } = await import(
        "~/lib/editor/image/export/image-export.client"
      );
      const exportResult = await exportImageCompositionDocument(composition, settings);
      setStatus("downloading");
      setResult(exportResult);
      window.setTimeout(() => setStatus("idle"), 700);
    } catch (exportError) {
      setStatus("failed");
      setError(exportError instanceof Error ? exportError.message : "Image export failed.");
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
        className="relative z-10 w-full max-w-md rounded-[8px] border border-white/12 bg-[#171a1f] shadow-2xl"
      >
        <header className="flex h-12 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <EditorIcon className="text-[18px] text-[#8fd6c8]">ios_share</EditorIcon>
            <h2 id="image-export-title" className="text-body-sm font-semibold text-white">
              Export PNG
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close export dialog"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white/55 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/25"
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        </header>

        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-white/45">
              Filename
            </span>
            <input
              value={settings.filename}
              onChange={(event) =>
                setSettings((current) => ({ ...current, filename: event.target.value }))
              }
              className="h-9 w-full rounded-[4px] border border-white/10 bg-black/25 px-3 text-body-sm text-white outline-none focus:border-[#8fd6c8]/70"
            />
          </label>

          <div>
            <span className="mb-2 block text-label-sm font-semibold uppercase tracking-wide text-white/45">
              Size
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-[6px] border border-white/10 bg-black/20 p-1">
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
                      ? "bg-white/12 text-white"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {settings.sizeMode === "custom" ? (
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-white/45">
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
                  className="h-9 min-w-0 flex-1 rounded-[4px] border border-white/10 bg-black/25 px-3 text-body-sm text-white outline-none focus:border-[#8fd6c8]/70"
                />
                <span className="shrink-0 text-label-md text-white/50">
                  {dimensions.height}px high
                </span>
              </div>
            </label>
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-[6px] border border-white/10 bg-black/18 px-3 py-2">
            <span>
              <span className="block text-label-md font-semibold text-white">Transparent background</span>
              <span className="block text-label-sm text-white/45">
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
              className="h-4 w-4 accent-[#8fd6c8]"
            />
          </label>

          <div className="rounded-[6px] border border-white/10 bg-black/18 px-3 py-2 text-label-md text-white/55">
            PNG / {dimensions.width}px x {dimensions.height}px
          </div>

          {result?.warnings.length ? (
            <div className="rounded-[6px] border border-[#f8c471]/30 bg-[#f8c471]/10 px-3 py-2 text-label-md text-[#ffdca0]">
              {result.warnings.join(" ")}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[6px] border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 text-label-md text-[#ffb4b4]">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <span className="text-label-sm uppercase tracking-wide text-white/40">
            {statusLabel(status)}
          </span>
          <button
            type="button"
            disabled={!canExport || busy}
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-[#8fd6c8] px-3 text-label-md font-semibold text-[#062f2d] hover:bg-[#a8eadf] disabled:pointer-events-none disabled:bg-white/10 disabled:text-white/35"
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
    customWidth: Math.round(composition.canvas.width),
    transparentBackground: composition.background.type === "transparent",
  };
}

function statusLabel(status: ExportStatus) {
  if (status === "preparing") return "Preparing";
  if (status === "downloading") return "Downloading";
  if (status === "failed") return "Failed";
  return "Ready";
}
