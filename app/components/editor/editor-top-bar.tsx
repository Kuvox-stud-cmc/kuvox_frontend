import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { editorModeChanged, type EditorMode } from "~/store/slices/editor-slice";

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
  const editorMode = useAppSelector((state) => state.editor.editorMode);

  return (
    <header className="z-50 grid h-toolbar-width shrink-0 grid-cols-[minmax(180px,1fr)_auto_minmax(160px,1fr)] items-center border-b border-outline-variant bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-headline-md font-bold tracking-tight text-primary">Kuvox</span>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="min-w-0">
          <span className="block truncate text-body-sm text-on-surface">{project.name}</span>
          <span className="block text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {project.label}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center rounded-[6px] border border-outline-variant bg-surface-container-low p-1">
          {modes.map((mode) => {
            const active = editorMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => dispatch(editorModeChanged(mode.value))}
                className={`flex h-8 items-center gap-1 rounded-[4px] px-3 text-label-md font-semibold transition-colors duration-150 sm:px-4 ${
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

        <label className="relative hidden xl:block">
          <EditorIcon className="absolute left-3 top-1/2 text-[18px] text-on-surface-variant -translate-y-1/2">
            search
          </EditorIcon>
          <input
            className="h-8 w-60 rounded-[4px] border border-outline-variant bg-surface-container-low py-1 pl-9 pr-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Search tools or media..."
            type="search"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <EditorIconButton icon="notifications" label="Notifications" className="h-8 w-8" />
        <EditorIconButton icon="settings" label="Settings" className="h-8 w-8" />
        <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-primary">
          <span className="text-label-md font-bold">B</span>
        </div>
      </div>
    </header>
  );
}
