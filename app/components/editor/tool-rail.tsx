import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { activeToolChanged, selectToolRailState } from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";

export function ToolRail() {
  const dispatch = useAppDispatch();
  const { tools } = useAppSelector(selectToolRailState);

  return (
    <aside
      className="z-40 flex h-full w-14 shrink-0 flex-col border-l border-outline-variant bg-surface"
      aria-label="Editor tools"
    >
      <div className="flex flex-col items-center gap-2 p-2">
        {tools.map((tool, index) => (
          <div
            key={tool.id}
            className="flex flex-col items-center gap-2"
          >
            {index > 0 && tools[index - 1].section !== tool.section ? (
              <div className="my-1 h-px w-8 bg-outline-variant" />
            ) : null}
            <button
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.disabled ? undefined : tool.active}
              aria-disabled={tool.disabled}
              onClick={() => {
                if (!tool.disabled) dispatch(activeToolChanged(tool.id));
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-[4px] text-label-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                tool.disabled
                  ? "cursor-not-allowed text-on-surface-variant/40"
                  : tool.active
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
