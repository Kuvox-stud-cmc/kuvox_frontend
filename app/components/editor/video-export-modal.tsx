import { useEffect, useMemo, useRef, useState } from "react";

import type { MediaDto, ProjectMediaDto } from "~/lib/api";
import {
  createDefaultVideoExportSettings,
  getVideoRenderJob,
  isRenderBackendUnavailable,
  normalizeVideoRenderJob,
  requestVideoRenderJob,
  resolveVideoExportDimensions,
  validateVideoExport,
  type VideoExportFormat,
  type VideoExportPreset,
  type VideoExportQuality,
  type VideoExportResolution,
  type VideoExportSettings,
  type VideoExportValidationResult,
  type VideoRenderJob,
  type VideoRenderJobStatus,
} from "~/lib/editor/video-export";
import type { VideoProjectDocument } from "~/lib/editor/video-document";
import { getRealtimeConnection } from "~/lib/realtime-connection.client";

import { EditorIcon } from "./editor-ui";
import type { VideoExportFlushResult } from "./use-video-autosave";

interface VideoExportModalProps {
  open: boolean;
  document: VideoProjectDocument | null;
  media: MediaDto[];
  projectMedia: ProjectMediaDto[];
  projectName: string;
  onClose: () => void;
  flushForExport: () => Promise<VideoExportFlushResult>;
}

const presets: Array<{ value: VideoExportPreset; label: string }> = [
  { value: "h264-720p", label: "H.264 720p" },
  { value: "h264-1080p", label: "H.264 1080p" },
  { value: "h264-4k", label: "H.264 4K" },
  { value: "prores-master", label: "ProRes master" },
];

const formats: Array<{ value: VideoExportFormat; label: string }> = [
  { value: "mp4", label: "MP4" },
  { value: "mov", label: "MOV" },
];

const resolutions: Array<{ value: VideoExportResolution; label: string }> = [
  { value: "1280x720", label: "1280 x 720" },
  { value: "1920x1080", label: "1920 x 1080" },
  { value: "3840x2160", label: "3840 x 2160" },
  { value: "current", label: "Current document" },
];

const frameRates = [24, 25, 30, 60];

const qualities: Array<{ value: VideoExportQuality; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
];

export function VideoExportModal({
  open,
  document,
  media,
  projectMedia,
  projectName,
  onClose,
  flushForExport,
}: VideoExportModalProps) {
  const [settings, setSettings] = useState<VideoExportSettings>(() =>
    createDefaultVideoExportSettings(document, projectName),
  );
  const [status, setStatus] = useState<VideoRenderJobStatus>("idle");
  const [validation, setValidation] = useState<VideoExportValidationResult | null>(null);
  const [job, setJob] = useState<VideoRenderJob | null>(null);
  const [renderRequest, setRenderRequest] = useState<{ timelineId: string; revisionNumber: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const actionInFlight = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSettings(createDefaultVideoExportSettings(document, projectName));
      setStatus("idle");
      setValidation(null);
      setJob(null);
      setRenderRequest(null);
      setMessage(null);
    }
    wasOpen.current = open;
  }, [document, open, projectName]);

  useEffect(() => {
    if (!open || !job || job.status === "completed" || job.status === "failed") return;

    const activeJobId = job.id;
    let disposed = false;
    let reconciling = false;
    const applyJob = (next: VideoRenderJob) => {
      if (disposed || next.id !== activeJobId) return;
      setJob(next);
      setStatus(next.status);
      setMessage(next.message);
    };
    const reconcile = async () => {
      if (reconciling) return;
      reconciling = true;
      try {
        applyJob(await getVideoRenderJob(activeJobId));
      } catch {
        // The socket remains authoritative during transient reconciliation failures.
      } finally {
        reconciling = false;
      }
    };

    const realtime = getRealtimeConnection();
    const unsubscribeJob = realtime.subscribe("renderJobUpdated", (payload) => {
      const next = normalizeVideoRenderJob(payload);
      if (next.id === activeJobId) applyJob(next);
    });
    const unsubscribeLifecycle = realtime.subscribeLifecycle((connection) => {
      if (connection.state === "connected" && connection.reconnected) void reconcile();
    });
    const handleVisibility = () => {
      if (window.document.visibilityState === "visible") void reconcile();
    };
    window.document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      unsubscribeJob();
      unsubscribeLifecycle();
      window.document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [job?.id, job?.status, open]);

  const liveValidation = useMemo(
    () => validateVideoExport(document, media, settings, projectMedia),
    [document, media, projectMedia, settings],
  );
  const shownValidation = validation ?? liveValidation;
  const busy = status === "validating" || status === "syncing";
  const canRetryRenderJob = Boolean(
    renderRequest &&
    (status === "failed" || status === "backend-unavailable"),
  );

  if (!open) return null;

  const updateSettings = (next: Partial<VideoExportSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
    setValidation(null);
    setMessage(null);
  };

  const updateResolution = (resolution: VideoExportResolution) => {
    const dimensions = resolveVideoExportDimensions(document, resolution);
    updateSettings({ resolution, width: dimensions.width, height: dimensions.height });
  };

  const handleStart = async (reuseSyncedRevision = false) => {
    if (busy || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      setStatus("validating");
      if (!reuseSyncedRevision) {
        setJob(null);
        setRenderRequest(null);
      }
      setMessage(null);

      const nextValidation = validateVideoExport(document, media, settings, projectMedia);
      setValidation(nextValidation);
      if (!nextValidation.ok) {
        setStatus("idle");
        setMessage("Resolve the export blockers before creating a render job.");
        return;
      }

      let sync: { timelineId: string; revisionNumber: number };
      if (reuseSyncedRevision && renderRequest) {
        sync = renderRequest;
      } else {
        setStatus("syncing");
        const synced = await flushForExport();
        if (synced.status !== "success") {
          setStatus("failed");
          setMessage(synced.message);
          return;
        }
        sync = { timelineId: synced.timelineId, revisionNumber: synced.revisionNumber };
        setRenderRequest(sync);
      }

      try {
        const renderJob = await requestVideoRenderJob({
          timelineId: sync.timelineId,
          revisionNumber: sync.revisionNumber,
          settings,
        });
        setJob(renderJob);
        setStatus(renderJob.status);
        setMessage(renderJob.message);
      } catch (error) {
        if (isRenderBackendUnavailable(error)) {
          setStatus("backend-unavailable");
          setMessage("Render job creation is not available from the backend yet.");
          return;
        }

        setStatus("failed");
        setMessage(error instanceof Error ? error.message : "Render job creation failed.");
      }
    } finally {
      actionInFlight.current = false;
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
        aria-labelledby="video-export-title"
        className="relative z-10 flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-2xl flex-col overflow-hidden rounded-[8px] border border-outline-variant bg-surface shadow-[0_24px_72px_rgba(0,0,0,0.45)]"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant px-4">
          <div className="flex items-center gap-2">
            <EditorIcon className="text-[18px] text-primary">ios_share</EditorIcon>
            <h2 id="video-export-title" className="text-body-sm font-semibold text-on-surface">
              Export Video
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close export dialog"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:pointer-events-none disabled:opacity-40"
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Preset"
              value={settings.preset}
              options={presets}
              onChange={(value) => {
                const nextPreset = value as VideoExportPreset;
                const nextFormat = nextPreset === "prores-master" ? "mov" : settings.format;
                updateSettings({ preset: nextPreset, format: nextFormat });
              }}
            />
            <SelectField
              label="Format"
              value={settings.format}
              options={formats}
              onChange={(value) => updateSettings({ format: value as VideoExportFormat })}
            />
            <SelectField
              label="Resolution"
              value={settings.resolution}
              options={resolutions}
              onChange={(value) => updateResolution(value as VideoExportResolution)}
            />
            <SelectField
              label="Frame rate"
              value={String(settings.frameRate)}
              options={frameRates.map((value) => ({ value: String(value), label: `${value} fps` }))}
              onChange={(value) => updateSettings({ frameRate: Number(value) })}
            />
            <SelectField
              label="Quality"
              value={settings.quality}
              options={qualities}
              onChange={(value) => updateSettings({ quality: value as VideoExportQuality })}
            />
            <label className="block">
              <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
                Destination
              </span>
              <input
                value={settings.destinationLabel}
                onChange={(event) => updateSettings({ destinationLabel: event.target.value })}
                data-editor-shortcuts="ignore"
                className="h-9 w-full rounded-[4px] border border-outline-variant bg-surface-container-low px-3 text-body-sm text-on-surface outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="mt-4 rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant">
            {settings.format.toUpperCase()} / {settings.width}px x {settings.height}px / {settings.frameRate} fps
          </div>

          {shownValidation.errors.length > 0 ? (
            <IssueList tone="error" title="Export blockers" messages={shownValidation.errors.map((issue) => issue.message)} />
          ) : null}

          {shownValidation.warnings.length > 0 ? (
            <IssueList tone="warning" title="Warnings" messages={shownValidation.warnings.map((issue) => issue.message)} />
          ) : null}

          {message ? (
            <div className={`mt-4 rounded-[6px] border px-3 py-2 text-label-md ${
              status === "backend-unavailable"
                ? "border-tertiary/40 bg-tertiary-container text-on-tertiary-container"
                : status === "failed"
                  ? "border-error/35 bg-error-container text-on-error-container"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant"
            }`}>
              {message}
            </div>
          ) : null}

          {job?.status === "completed" ? (
            <div className="mt-4 rounded-[6px] border border-primary/30 bg-primary-container px-3 py-2 text-label-md text-on-primary-container">
              {job.outputUrl ? (
                <a className="font-semibold underline" href={job.outputUrl}>
                  Open exported video
                </a>
              ) : (
                "Export completed. Output access will appear here when the API returns an authenticated link."
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
          <span className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            {statusLabel(status)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-9 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40"
            >
              Close
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStart(canRetryRenderJob)}
              className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
            >
              <EditorIcon className="text-[16px]">
                {busy ? "progress_activity" : "cloud_upload"}
              </EditorIcon>
              {canRetryRenderJob ? "Retry render job" : "Create render job"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-editor-shortcuts="ignore"
        className="h-9 w-full rounded-[4px] border border-outline-variant bg-surface-container-low px-3 text-body-sm text-on-surface outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IssueList({
  tone,
  title,
  messages,
}: {
  tone: "error" | "warning";
  title: string;
  messages: string[];
}) {
  const className = tone === "error"
    ? "border-error/35 bg-error-container text-on-error-container"
    : "border-tertiary/35 bg-tertiary-container text-on-tertiary-container";

  return (
    <div className={`mt-4 rounded-[6px] border px-3 py-2 ${className}`}>
      <p className="text-label-md font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-label-md">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(status: VideoRenderJobStatus): string {
  if (status === "validating") return "Validating";
  if (status === "syncing") return "Syncing latest revision";
  if (status === "queued") return "Queued";
  if (status === "rendering") return "Rendering";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "backend-unavailable") return "Backend unavailable";
  return "Ready";
}
