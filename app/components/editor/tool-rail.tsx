import { EditorIconButton } from "./editor-ui";
import type { EditorToolMock } from "./mock-editor-data";

interface ToolRailProps {
  tools: EditorToolMock[];
}

export function ToolRail({ tools }: ToolRailProps) {
  return (
    <aside className="z-40 hidden w-14 shrink-0 flex-col items-center gap-3 border-l border-outline-variant bg-surface py-3 lg:flex">
      {tools.map((tool, index) => (
        <div key={tool.id} className={index === 2 ? "flex flex-col items-center gap-3" : undefined}>
          {index === 2 ? <div className="h-px w-7 bg-outline-variant" /> : null}
          <EditorIconButton
            icon={tool.icon}
            label={tool.label}
            active={tool.active}
            className="h-9 w-9"
          />
        </div>
      ))}
    </aside>
  );
}
