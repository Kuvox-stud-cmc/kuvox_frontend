import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { activeToolChanged, selectToolRailState, textItemCreated } from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";

interface ToolRailProps {
  orientation?: "vertical" | "horizontal";
  className?: string;
  showLabels?: boolean;
  inspectorOpen?: boolean;
  onInspectorToggle?: () => void;
}

export function ToolRail({
  orientation = "vertical",
  className = "",
  showLabels = false,
  inspectorOpen = false,
  onInspectorToggle,
}: ToolRailProps) {
  const dispatch = useAppDispatch();
  const { tools } = useAppSelector(selectToolRailState);
  const horizontal = orientation === "horizontal";

  return (
    <aside
      className={
        className ||
        "z-40 hidden h-full w-video-tool-rail-width shrink-0 flex-col border-l border-outline-variant bg-surface lg:flex"
      }
      aria-label="Editor tools"
    >
      <div className={`flex items-center gap-2 p-1.5 ${horizontal ? "min-w-max flex-row" : "flex-col"}`}>
        {onInspectorToggle ? (
          <>
            <button
              type="button"
              title={inspectorOpen ? "Hide inspector" : "Show inspector"}
              aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
              aria-pressed={inspectorOpen}
              onClick={onInspectorToggle}
              className={`flex h-12 w-12 flex-col items-center justify-center rounded-[6px] text-label-sm font-semibold transition-colors motion-reduce:transition-none ${
                inspectorOpen
                  ? "border border-primary/35 bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <EditorIcon className="text-[20px]">tune</EditorIcon>
              {showLabels ? <span className="mt-0.5 text-[9px]">Adjust</span> : null}
            </button>
            <div className={horizontal ? "mx-1 h-8 w-px bg-outline-variant" : "my-1 h-px w-9 bg-outline-variant"} />
          </>
        ) : null}
        {tools.map((tool, index) => (
          <div
            key={tool.id}
            className={`flex items-center gap-2 ${horizontal ? "flex-row" : "flex-col"}`}
          >
            {index > 0 && tools[index - 1].section !== tool.section ? (
              <div className={horizontal ? "mx-1 h-8 w-px bg-outline-variant" : "my-1 h-px w-8 bg-outline-variant"} />
            ) : null}
            <button
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.disabled ? undefined : tool.active}
              aria-disabled={tool.disabled}
              onClick={() => {
                if (tool.disabled) return;
                if (tool.id === "text") {
                  dispatch(textItemCreated({ preset: "caption" }));
                  return;
                }
                dispatch(activeToolChanged(tool.id));
              }}
              className={`flex h-12 w-12 flex-col items-center justify-center rounded-[6px] text-label-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                tool.disabled
                  ? "cursor-not-allowed text-on-surface-variant/40"
                  : tool.active
                  ? "border border-primary/35 bg-surface-container-high text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <EditorIcon className="text-[20px]">{tool.icon}</EditorIcon>
              {showLabels ? <span className="mt-0.5 max-w-full truncate text-[9px]">{tool.label}</span> : null}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
