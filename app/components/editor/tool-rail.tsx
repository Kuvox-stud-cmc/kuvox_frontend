import { useState } from "react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { activeToolChanged, selectToolRailState, textItemCreated } from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";

interface ToolRailProps {
  orientation?: "vertical" | "horizontal";
  className?: string;
  showLabels?: boolean;
  inspectorOpen?: boolean;
  onInspectorToggle?: () => void;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

export function ToolRail({
  orientation = "vertical",
  className = "",
  showLabels = false,
  inspectorOpen = false,
  onInspectorToggle,
  activeSection = "transform",
  onSectionChange,
}: ToolRailProps) {
  const dispatch = useAppDispatch();
  const { tools } = useAppSelector(selectToolRailState);
  const horizontal = orientation === "horizontal";
  const [moreOpen, setMoreOpen] = useState(false);

  const isRightRail = Boolean(onInspectorToggle);

  const inspectorTabs = [
    { id: "adjust", label: "Adjust", icon: "tune" },
    { id: "filters", label: "Filters", icon: "palette" },
    { id: "color", label: "Color", icon: "colorize" },
    { id: "transform", label: "Transform", icon: "open_with" },
    { id: "crop", label: "Crop", icon: "crop" },
    { id: "mask", label: "Mask", icon: "masks" },
    { id: "speed", label: "Speed", icon: "speed" },
    { id: "animation", label: "Animation", icon: "auto_awesome" },
    { id: "audio", label: "Audio", icon: "volume_up" },
  ];

  const mainTabs = inspectorTabs.slice(0, 5);
  const moreTabs = inspectorTabs.slice(5);
  const isMoreActive = inspectorOpen && moreTabs.some((t) => t.id === activeSection);

  return (
    <aside
      data-tour={isRightRail ? "inspector-tools" : undefined}
      className={
        className ||
        "z-40 hidden h-full w-video-tool-rail-width shrink-0 flex-col border-l border-outline-variant bg-surface lg:flex"
      }
      aria-label="Editor tools"
    >
      <div className={`flex items-center gap-2 p-1.5 ${horizontal ? "min-w-max flex-row" : "flex-col"}`}>
        {isRightRail ? (
          <>
            {mainTabs.map((tab) => {
              const isActive = inspectorOpen && activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.label}
                  aria-label={tab.label}
                  onClick={() => {
                    if (onSectionChange) {
                      onSectionChange(tab.id);
                    }
                  }}
                  className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-[6px] text-label-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${isActive
                      ? "bg-primary/8 text-primary font-bold"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                >
                  {isActive && (
                    <span className="absolute left-[-2px] top-1/4 h-1/2 w-[3px] rounded-r bg-primary" />
                  )}
                  <EditorIcon className="text-[18px]">{tab.icon}</EditorIcon>
                  {showLabels ? <span className="mt-0.5 max-w-full truncate text-[8.5px] font-normal tracking-normal scale-[0.95] capitalize">{tab.label}</span> : null}
                </button>
              );
            })}

            {/* More dropdown button */}
            <div className="relative">
              <button
                type="button"
                title="More options"
                aria-label="More options"
                onClick={() => setMoreOpen(!moreOpen)}
                className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-[6px] text-label-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${isMoreActive
                    ? "bg-primary/8 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
              >
                {isMoreActive && (
                  <span className="absolute left-[-2px] top-1/4 h-1/2 w-[3px] rounded-r bg-primary" />
                )}
                <EditorIcon className="text-[18px]">more_horiz</EditorIcon>
                {showLabels ? <span className="mt-0.5 max-w-full truncate text-[8.5px] font-normal tracking-normal scale-[0.95] capitalize">More</span> : null}
              </button>
              {moreOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                    aria-label="Close more options"
                  />
                  <div className="absolute right-full bottom-0 z-40 mr-2 w-32 rounded-[6px] border border-outline-variant bg-surface-container-high p-1 shadow-lg flex flex-col gap-0.5">
                    {moreTabs.map((tab) => {
                      const isTabActive = inspectorOpen && activeSection === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            if (onSectionChange) onSectionChange(tab.id);
                            setMoreOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1 text-left text-[9px] font-normal tracking-normal transition-colors ${isTabActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                            }`}
                        >
                          <EditorIcon className="text-[13px]">{tab.icon}</EditorIcon>
                          <span className="capitalize">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {onInspectorToggle ? (
              <>
                <button
                  type="button"
                  title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                  aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
                  aria-pressed={inspectorOpen}
                  onClick={onInspectorToggle}
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-[6px] text-label-sm font-semibold transition-colors motion-reduce:transition-none ${inspectorOpen
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
                    if (["transform", "speed", "color", "audio"].includes(tool.id)) {
                      if (onSectionChange) {
                        onSectionChange(tool.id);
                      }
                      return;
                    }
                    dispatch(activeToolChanged(tool.id));
                  }}
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-[6px] text-label-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${tool.disabled
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
          </>
        )}
      </div>
    </aside>
  );
}
