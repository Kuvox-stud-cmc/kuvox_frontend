import { EditorIcon, EditorIconButton } from "../editor-ui";
import type { ImageEditorTool } from "~/store/slices/image-editor-slice";

interface ImageEditorToolbarProps {
  activeTool: ImageEditorTool;
  onToolChange: (tool: ImageEditorTool) => void;
}

const tools: Array<{ id: ImageEditorTool; icon: string; label: string }> = [
  { id: "select", icon: "near_me", label: "Select" },
  { id: "text", icon: "title", label: "Text" },
  { id: "image", icon: "imagesmode", label: "Image" },
  { id: "shape", icon: "category", label: "Shape" },
  { id: "crop", icon: "crop", label: "Crop" },
  { id: "adjust", icon: "tune", label: "Adjust" },
  { id: "hand", icon: "pan_tool", label: "Hand" },
  { id: "zoom", icon: "search", label: "Zoom" },
];

export function ImageEditorToolbar({ activeTool, onToolChange }: ImageEditorToolbarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-center border-b border-white/10 bg-[#14161a]/95">
      <div className="flex items-center gap-1 rounded-[6px] border border-white/10 bg-black/25 p-1">
        {tools.map((tool) => (
          <EditorIconButton
            key={tool.id}
            icon={tool.icon}
            label={tool.label}
            active={activeTool === tool.id}
            className="h-8 w-8"
            onClick={() => onToolChange(tool.id)}
          />
        ))}
      </div>
      <div className="ml-3 hidden items-center gap-1 text-label-sm uppercase tracking-wide text-white/35 md:flex">
        <EditorIcon className="text-[15px]">lock_open</EditorIcon>
        Local document
      </div>
    </div>
  );
}
