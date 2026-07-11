import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";

import type { VideoSyncResult } from "./use-video-autosave";

interface EditorExitGuardProps {
  hasUnsyncedChanges: boolean;
  flushLocalDraft: () => Promise<void>;
  syncNow: () => Promise<VideoSyncResult>;
}

export function EditorExitGuard({
  hasUnsyncedChanges,
  flushLocalDraft,
  syncNow,
}: EditorExitGuardProps) {
  const blocker = useBlocker(hasUnsyncedChanges);
  const [busyAction, setBusyAction] = useState<"sync" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!hasUnsyncedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsyncedChanges]);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      setBusyAction(null);
      setError(null);
      return;
    }

    cancelButtonRef.current?.focus();
  }, [blocker.state]);

  const cancel = useCallback(() => {
    if (busyAction || blocker.state !== "blocked") return;
    blocker.reset();
  }, [blocker, busyAction]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blocker.state, cancel]);

  if (blocker.state !== "blocked") return null;

  const syncAndLeave = async () => {
    if (busyAction) return;
    setBusyAction("sync");
    setError(null);
    const result = await syncNow();
    if (result.status === "success") {
      blocker.proceed();
      return;
    }
    setError(result.message);
    setBusyAction(null);
  };

  const leaveWithoutSyncing = async () => {
    if (busyAction) return;
    setBusyAction("local");
    setError(null);
    try {
      await flushLocalDraft();
      blocker.proceed();
    } catch (flushError) {
      setError(flushError instanceof Error ? flushError.message : "Local timeline draft could not be saved.");
      setBusyAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-exit-title"
        aria-describedby="editor-exit-description"
        className="relative z-10 w-full max-w-md rounded-[8px] border border-outline-variant bg-surface p-5 shadow-[0_24px_72px_rgba(0,0,0,0.48)]"
      >
        <h2 id="editor-exit-title" className="text-title-lg font-semibold text-on-surface">
          Leave the editor?
        </h2>
        <p id="editor-exit-description" className="mt-2 text-body-sm leading-6 text-on-surface-variant">
          This timeline has changes that have not been synchronized to the server.
        </p>
        {error ? (
          <div role="alert" className="mt-4 rounded-[6px] border border-error/35 bg-error-container px-3 py-2 text-label-md text-on-error-container">
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busyAction !== null}
            onClick={cancel}
            className="h-9 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void leaveWithoutSyncing()}
            className="h-9 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-45"
          >
            {busyAction === "local" ? "Saving locally" : "Leave without syncing"}
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void syncAndLeave()}
            className="h-9 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
          >
            {busyAction === "sync" ? "Syncing" : "Sync and leave"}
          </button>
        </div>
      </div>
    </div>
  );
}
