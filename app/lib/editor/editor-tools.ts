export type EditorToolId =
  | "select"
  | "trim"
  | "split"
  | "text"
  | "transform"
  | "speed"
  | "color"
  | "audio"
  | "ai";

export type TimelineEditorToolId = Extract<EditorToolId, "select" | "trim" | "split">;
export type EditorToolAvailability = "enabled" | "disabled";
export type EditorToolKind = "timeline" | "create" | "mode" | "future";
export type EditorToolSection = "timeline" | "create" | "adjust" | "assistant";

export interface EditorToolDefinition {
  id: EditorToolId;
  label: string;
  icon: string;
  availability: EditorToolAvailability;
  kind: EditorToolKind;
  section: EditorToolSection;
}

export interface EditorToolViewModel extends EditorToolDefinition {
  active: boolean;
  disabled: boolean;
}

export const editorToolDefinitions = [
  {
    id: "select",
    label: "Select",
    icon: "near_me",
    availability: "enabled",
    kind: "timeline",
    section: "timeline",
  },
  {
    id: "trim",
    label: "Trim",
    icon: "content_cut",
    availability: "enabled",
    kind: "timeline",
    section: "timeline",
  },
  {
    id: "split",
    label: "Split",
    icon: "call_split",
    availability: "enabled",
    kind: "timeline",
    section: "timeline",
  },
  {
    id: "text",
    label: "Text",
    icon: "title",
    availability: "enabled",
    kind: "create",
    section: "create",
  },
  {
    id: "transform",
    label: "Transform",
    icon: "open_with",
    availability: "enabled",
    kind: "timeline",
    section: "adjust",
  },
  {
    id: "speed",
    label: "Speed",
    icon: "speed",
    availability: "enabled",
    kind: "timeline",
    section: "adjust",
  },
  {
    id: "color",
    label: "Color",
    icon: "palette",
    availability: "enabled",
    kind: "timeline",
    section: "adjust",
  },
  {
    id: "audio",
    label: "Audio",
    icon: "graphic_eq",
    availability: "enabled",
    kind: "timeline",
    section: "adjust",
  },
  {
    id: "ai",
    label: "AI assistant",
    icon: "auto_awesome",
    availability: "enabled",
    kind: "mode",
    section: "assistant",
  },
] as const satisfies readonly EditorToolDefinition[];

const editorToolIds = new Set<EditorToolId>(editorToolDefinitions.map((tool) => tool.id));
const enabledEditorToolIds = new Set<EditorToolId>(
  editorToolDefinitions
    .filter((tool) => tool.availability === "enabled")
    .map((tool) => tool.id),
);

export function isEditorToolId(value: string): value is EditorToolId {
  return editorToolIds.has(value as EditorToolId);
}

export function isEnabledEditorToolId(value: string): value is EditorToolId {
  return isEditorToolId(value) && enabledEditorToolIds.has(value);
}

export function isTimelineEditorToolId(value: EditorToolId): value is TimelineEditorToolId {
  return value === "select" || value === "trim" || value === "split";
}
