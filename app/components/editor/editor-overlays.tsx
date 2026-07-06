import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  modalClosed,
  popoverClosed,
  selectOverlayState,
  toastCleared,
  toastShown,
} from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";

export function EditorToast() {
  const dispatch = useAppDispatch();
  const message = useAppSelector((state) => selectOverlayState(state).toastMessage);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      dispatch(toastCleared());
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [dispatch, message]);

  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[80] flex max-w-[min(360px,calc(100vw-32px))] items-center gap-2 rounded-[6px] border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm font-medium text-on-surface shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
      <EditorIcon className="text-[18px] text-primary" filled>
        check_circle
      </EditorIcon>
      <span className="truncate">{message}</span>
    </div>
  );
}

export function EditorPopoverLayer() {
  const dispatch = useAppDispatch();
  const activePopover = useAppSelector((state) => selectOverlayState(state).activePopover);

  if (!activePopover) {
    return null;
  }

  const isNotifications = activePopover === "notifications";

  return (
    <div className="fixed inset-0 z-[70]" onClick={() => dispatch(popoverClosed())}>
      <div
        className="absolute right-3 top-12 w-[min(320px,calc(100vw-24px))] rounded-[6px] border border-outline-variant bg-surface p-2 shadow-[0_18px_48px_rgba(0,0,0,0.36)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-2 py-2">
          <span className="text-label-md font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {isNotifications ? "Notifications" : "Profile"}
          </span>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Close popover"
            onClick={() => dispatch(popoverClosed())}
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        </div>

        {isNotifications ? (
          <div className="flex flex-col gap-2 p-2">
            {["Mock render preview is ready", "Two transcript captions need review", "Autosave completed"].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    dispatch(toastShown(item));
                    dispatch(popoverClosed());
                  }}
                  className="rounded-[4px] border border-outline-variant bg-surface-container-low p-2 text-left text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  {item}
                </button>
              ),
            )}
          </div>
        ) : (
          <div className="p-2">
            <div className="mb-2 flex items-center gap-3 rounded-[5px] bg-surface-container-low p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-primary">
                <span className="text-label-md font-bold">B</span>
              </div>
              <div>
                <p className="text-body-sm font-semibold text-on-surface">Bao Tran</p>
                <p className="text-label-sm text-on-surface-variant">Mock editor account</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                dispatch(toastShown("Mock account menu opened"));
                dispatch(popoverClosed());
              }}
              className="flex h-9 w-full items-center gap-2 rounded-[4px] px-2 text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <EditorIcon className="text-[18px]">manage_accounts</EditorIcon>
              Manage profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EditorModalLayer() {
  const dispatch = useAppDispatch();
  const activeModal = useAppSelector((state) => selectOverlayState(state).activeModal);

  if (!activeModal) {
    return null;
  }

  if (activeModal === "import-media" || activeModal === "fullscreen") {
    return null;
  }

  const modalCopy = {
    "import-media": {
      icon: "upload_file",
      title: "Import Media",
      body: "Mock import is ready. Drop zones, cloud import, and upload progress will connect here later.",
      action: "Add mock clip",
      toast: "Mock clip added to the library",
    },
    export: {
      icon: "ios_share",
      title: "Export Preview",
      body: "Mock export settings are staged for H.264 1080p with captions burned in.",
      action: "Start mock export",
      toast: "Mock export queued",
    },
    fullscreen: {
      icon: "fullscreen",
      title: "Fullscreen Preview",
      body: "This mock fullscreen dialog stands in for a browser fullscreen preview.",
      action: "Fit preview",
      toast: "Preview fitted to mock fullscreen",
    },
    settings: {
      icon: "settings",
      title: "Editor Settings",
      body: "Mock settings for autosave, timeline density, and preview quality are available here.",
      action: "Save settings",
      toast: "Mock settings saved",
    },
  }[activeModal];

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/48 p-4">
      <div className="w-[min(440px,100%)] overflow-hidden rounded-[8px] border border-outline-variant bg-surface shadow-[0_24px_72px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-primary/30 bg-surface-container-high text-primary">
            <EditorIcon className="text-[20px]" filled>
              {modalCopy.icon}
            </EditorIcon>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-body-md font-semibold text-on-surface">{modalCopy.title}</h2>
            <p className="text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
              Mock interaction
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(modalClosed())}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Close modal"
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-body-sm leading-6 text-on-surface-variant">{modalCopy.body}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3">
          <button
            type="button"
            onClick={() => dispatch(modalClosed())}
            className="h-9 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(toastShown(modalCopy.toast));
              dispatch(modalClosed());
            }}
            className="h-9 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90"
          >
            {modalCopy.action}
          </button>
        </div>
      </div>
    </div>
  );
}
