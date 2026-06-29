import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { activeToolChanged } from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";
import type { EditorToolMock } from "./mock-editor-data";

interface ToolRailProps {
  tools: EditorToolMock[];
}

export function ToolRail({ tools }: ToolRailProps) {
  const dispatch = useAppDispatch();
  const activeToolId = useAppSelector((state) => state.editor.activeToolId);

  return (
    <aside className="z-40 flex h-full w-14 shrink-0 flex-col border-l border-outline-variant bg-surface">
      <div className="flex flex-col items-center gap-3 p-3">
        {tools.map((tool, index) => (
          <div
            key={tool.id}
            className={index === 2 ? "flex flex-col items-center gap-3" : undefined}
          >
            {index === 2 ? <div className="h-px w-7 bg-outline-variant" /> : null}
            <button
              type="button"
              title={tool.label}
              onClick={() => dispatch(activeToolChanged(tool.id))}
              className={`flex h-9 w-9 items-center justify-center rounded-[4px] text-label-md font-semibold transition-colors ${
                activeToolId === tool.id
                  ? "border border-primary/35 bg-surface-container-high text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <EditorIcon className="text-[20px]">{tool.icon}</EditorIcon>
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
