import type { CachedCommandHistoryRecord } from "./editor-cache";
import { roundTime } from "./editor-timeline";
import type {
  VideoEditorSelection,
  VideoPlaybackState,
  VideoProjectDocument,
  VideoTimelineItem,
} from "./video-document";

export type VideoAiCommandSuggestionSource = "history" | "template" | "context";

export interface VideoAiCommandSuggestion {
  id: string;
  label: string;
  command: string;
  source: VideoAiCommandSuggestionSource;
  description?: string;
}

export interface BuildVideoAiCommandSuggestionsContext {
  document: VideoProjectDocument | null;
  selection: VideoEditorSelection;
  playback: VideoPlaybackState;
  selectedItem?: VideoTimelineItem | null;
  commandHistory: CachedCommandHistoryRecord[];
  currentInput?: string;
}

const maxHistorySuggestions = 5;
const maxSuggestions = 10;

export function buildVideoAiCommandSuggestions(
  context: BuildVideoAiCommandSuggestionsContext,
): VideoAiCommandSuggestion[] {
  const input = normalizeCommand(context.currentInput ?? "");
  const suggestions = dedupeSuggestions([
    ...historySuggestions(context.commandHistory),
    ...contextualSuggestions(context),
    ...playheadSuggestions(context),
  ]);

  const filtered = input
    ? suggestions.filter((suggestion) => normalizeCommand(suggestion.command).includes(input))
    : suggestions;

  return filtered.slice(0, maxSuggestions);
}

function historySuggestions(history: CachedCommandHistoryRecord[]): VideoAiCommandSuggestion[] {
  const seen = new Set<string>();
  return [...history]
    .filter((record) => record.status === "applied")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .flatMap((record) => {
      const command = record.text.trim();
      const key = normalizeCommand(command);
      if (!command || seen.has(key)) return [];
      seen.add(key);
      return [{
        id: `history-${stableId(command)}`,
        label: command,
        command,
        source: "history" as const,
        description: "Recent successful command",
      }];
    })
    .slice(0, maxHistorySuggestions);
}

function contextualSuggestions(context: BuildVideoAiCommandSuggestionsContext): VideoAiCommandSuggestion[] {
  const item = resolveSelectedItem(context);
  if (!item) return [];

  const target = item.id;
  const start = formatSeconds(item.timelineStart);
  const end = formatSeconds(item.timelineStart + item.duration);
  const playhead = formatSeconds(context.playback.currentTime);

  if (item.type === "audio") {
    return [
      suggestion("context", `volume-${target}`, "Lower selected audio", `set volume ${target} to 50%`, "context"),
      suggestion("context", `trim-${target}`, "Trim selected audio to its range", `trim ${target} from ${start} to ${end}`, "context"),
      suggestion("context", `move-${target}`, "Move selected audio to playhead", `move ${target} to ${playhead}`, "context"),
    ];
  }

  if (item.type === "text") {
    return [
      suggestion("context", `move-${target}`, "Move selected text to playhead", `move ${target} to ${playhead}`, "context"),
      suggestion("context", `delete-${target}`, "Delete selected text", `delete ${target}`, "context"),
      suggestion("context", `new-text-${target}`, "Add text at playhead", `add text "New caption" at ${playhead}`, "context"),
    ];
  }

  const base = [
    suggestion("context", `trim-${target}`, "Trim selected clip to its range", `trim ${target} from ${start} to ${end}`, "context"),
    suggestion("context", `move-${target}`, "Move selected clip to playhead", `move ${target} to ${playhead}`, "context"),
  ];

  if (isPlayheadInside(item, context.playback.currentTime)) {
    base.unshift(suggestion("context", `split-${target}`, "Split selected clip at playhead", `split ${target} at ${playhead}`, "context"));
  }

  if (item.type === "video") {
    base.push(suggestion("context", `speed-${target}`, "Speed up selected clip", `change speed ${target} to 2x`, "context"));
  }

  return base;
}

function playheadSuggestions(context: BuildVideoAiCommandSuggestionsContext): VideoAiCommandSuggestion[] {
  const playhead = formatSeconds(context.playback.currentTime);
  const suggestions = [
    suggestion("template", "add-text-playhead", "Add text at playhead", `add text "New caption" at ${playhead}`, "template"),
  ];

  const item = resolveSelectedItem(context);
  if (item && isPlayheadInside(item, context.playback.currentTime)) {
    suggestions.unshift(suggestion("template", "split-here", "Split here", "split here", "template"));
  }

  return suggestions;
}

function resolveSelectedItem(context: BuildVideoAiCommandSuggestionsContext): VideoTimelineItem | null {
  if (context.selectedItem) return context.selectedItem;
  const activeItemId = context.selection.activeItemId;
  if (!activeItemId || !context.document) return null;
  return context.document.tracks.flatMap((track) => track.items).find((item) => item.id === activeItemId) ?? null;
}

function dedupeSuggestions(suggestions: VideoAiCommandSuggestion[]): VideoAiCommandSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = normalizeCommand(suggestion.command);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suggestion(
  idPrefix: string,
  id: string,
  label: string,
  command: string,
  source: VideoAiCommandSuggestionSource,
  description?: string,
): VideoAiCommandSuggestion {
  return {
    id: `${idPrefix}-${id}`,
    label,
    command,
    source,
    description,
  };
}

function isPlayheadInside(item: VideoTimelineItem, playhead: number): boolean {
  return playhead > item.timelineStart && playhead < item.timelineStart + item.duration;
}

function formatSeconds(value: number): string {
  return `${roundTime(value)}s`;
}

function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}
