import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  editorModeChanged,
  libraryToggled,
  modalOpened,
  popoverToggled,
  searchQueryChanged,
  selectChromeState,
  selectEditorSyncChromeState,
  timelineToggled,
  type EditorSyncStatus,
  type EditorMode,
} from "~/store/slices/editor-slice";

import type { EditorProjectMock } from "./mock-editor-data";
import { EditorIcon, EditorIconButton } from "./editor-ui";

interface EditorTopBarProps {
  project: EditorProjectMock;
}

const modes: Array<{ value: EditorMode; label: string; icon?: string }> = [
  { value: "manual", label: "Manual" },
  { value: "ai", label: "AI Agent", icon: "auto_awesome" },
];

export function EditorTopBar({ project }: EditorTopBarProps) {
  const dispatch = useAppDispatch();
  const { editorMode, searchQuery } = useAppSelector(selectChromeState);
  const { syncStatus, pendingSyncCount } = useAppSelector(selectEditorSyncChromeState);
  const syncCopy = syncStatusCopy(syncStatus, pendingSyncCount);

  return (
    <header className="z-50 grid h-toolbar-width shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-outline-variant bg-surface px-3 2xl:px-4">
      <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
        <EditorIconButton
          icon="video_library"
          label="Toggle media library"
          className="h-8 w-8"
          onClick={() => dispatch(libraryToggled())}
        />
        <span className="text-headline-md font-bold tracking-tight text-primary">Kuvox</span>
        <div className="hidden h-6 w-px bg-outline-variant sm:block" />
        <div className="hidden min-w-0 sm:block">
          <span className="block truncate text-body-sm text-on-surface">{project.name}</span>
          <span className="block text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {project.label}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center rounded-[6px] border border-outline-variant bg-surface-container-low p-1">
          {modes.map((mode) => {
            const active = editorMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => dispatch(editorModeChanged(mode.value))}
                className={`flex h-8 items-center gap-1 rounded-[4px] px-2.5 text-label-md font-semibold transition-colors duration-150 sm:px-4 ${
                  active
                    ? "bg-surface-container-highest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {mode.icon ? (
                  <EditorIcon className="text-[16px]">{mode.icon}</EditorIcon>
                ) : null}
                {mode.label}
              </button>
            );
          })}
        </div>

        <label className="relative hidden 2xl:block">
          <EditorIcon className="absolute left-3 top-1/2 text-[18px] text-on-surface-variant -translate-y-1/2">
            search
          </EditorIcon>
          <input
            className="h-8 w-60 rounded-[4px] border border-outline-variant bg-surface-container-low py-1 pl-9 pr-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Search tools or media..."
            type="search"
            value={searchQuery}
            onChange={(event) => dispatch(searchQueryChanged(event.target.value))}
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`hidden h-8 items-center rounded-[4px] border px-2 text-label-sm font-semibold lg:flex ${syncCopy.className}`}
        >
          {syncCopy.label}
        </span>
        <EditorIconButton
          icon="view_timeline"
          label="Toggle timeline"
          className="h-8 w-8"
          onClick={() => dispatch(timelineToggled())}
        />
        <EditorIconButton
          icon="notifications"
          label="Notifications"
          className="hidden h-8 w-8 sm:flex"
          onClick={() => dispatch(popoverToggled("notifications"))}
        />
        <EditorIconButton
          icon="settings"
          label="Settings"
          className="hidden h-8 w-8 sm:flex"
          onClick={() => dispatch(modalOpened("settings"))}
        />
        <button
          type="button"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-primary transition-colors hover:border-primary/50 hover:bg-surface-container-highest 2xl:ml-2"
          aria-label="Open profile"
          onClick={() => dispatch(popoverToggled("profile"))}
        >
          <span className="text-label-md font-bold">B</span>
        </button>
      </div>
    </header>
  );
}

function syncStatusCopy(status: EditorSyncStatus, pendingSyncCount: number) {
  if (status === "syncing") {
    return {
      label: "Syncing",
      className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
    };
  }

  if (status === "synced" || status === "clean") {
    return {
      label: "Synced",
      className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
    };
  }

  if (status === "saved-local") {
    return {
      label: pendingSyncCount > 0 ? `Saved locally (${pendingSyncCount})` : "Saved locally",
      className: "border-tertiary/40 bg-tertiary-container text-on-tertiary-container",
    };
  }

  if (status === "server-changed") {
    return {
      label: "Server changed",
      className: "border-error/40 bg-error-container text-on-error-container",
    };
  }

  if (status === "failed" || status === "sync-failed") {
    return {
      label: "Sync failed",
      className: "border-error/40 bg-error-container text-on-error-container",
    };
  }

  return {
    label: "Saved locally",
    className: "border-outline-variant bg-surface-container-low text-on-surface-variant",
  };
}
