import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  saveCommandHistoryEntry,
  type EditorCacheScope,
} from "~/lib/editor/editor-cache";
import { logVideoEditorEvent } from "~/lib/editor/editor-observability.client";
import type { MediaDto } from "~/lib/api";
import {
  applyVideoOperationBatch,
} from "~/lib/editor/video-operations";
import { planVideoAiCommandWithService } from "~/lib/editor/video-ai-service-planner";
import {
  buildVideoAiCommandSuggestions,
  type VideoAiCommandSuggestion,
} from "~/lib/editor/video-ai-command-suggestions";
import {
  searchVideoEditorRetrieval,
  type VideoEditorShotSearchResult,
} from "~/lib/editor/video-retrieval";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  aiAutocompleteClosed,
  aiAutocompleteOpened,
  aiCommandApplied,
  aiCommandFailed,
  aiCommandHistoryEntrySaved,
  aiCommandStarted,
  aiSuggestionHighlighted,
  aiSuggestionInserted,
  aiSuggestionsLoaded,
  commandInputChanged,
  selectAssistantState,
  selectEditorState,
  semanticReferenceSelected,
  semanticSearchFailed,
  semanticSearchStarted,
  semanticSearchSucceeded,
  semanticShotAddedToTimeline,
  toastShown,
  videoOperationApplied,
} from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";
import type { AssistantMessageMock } from "./mock-editor-data";

interface AiAssistantPanelProps {
  messages: AssistantMessageMock[];
  projectId: string;
  cacheScope: EditorCacheScope;
  media?: MediaDto[];
  canPlanCommands?: boolean;
}

export function AiAssistantPanel({ messages, projectId, cacheScope, media = [], canPlanCommands = true }: AiAssistantPanelProps) {
  const dispatch = useAppDispatch();
  const [semanticQuery, setSemanticQuery] = useState("");
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const {
    commandInput,
    messages: extraMessages,
    aiCommandStatus,
    aiCommandError,
    aiLastSummary,
    aiLastWarnings,
    aiSuggestions,
    aiAutocompleteOpen,
    aiActiveSuggestionIndex,
    semanticSearch,
    recentCommandHistory,
  } = useAppSelector(selectAssistantState);
  const editor = useAppSelector(selectEditorState);
  const visibleMessages = [...messages, ...extraMessages];
  const showActivity = workspaceExpanded || extraMessages.length > 0 || aiCommandStatus === "failed" || aiCommandStatus === "applied";
  const visibleAutocompleteSuggestions = aiAutocompleteOpen ? aiSuggestions.slice(0, 6) : [];
  const keyboardSuggestionCount = Math.min(aiSuggestions.length, 6);

  useEffect(() => {
    const selectedItem = editor.selection.activeItemId && editor.document
      ? editor.document.tracks.flatMap((track) => track.items).find((item) => item.id === editor.selection.activeItemId) ?? null
      : null;

    dispatch(aiSuggestionsLoaded(buildVideoAiCommandSuggestions({
      document: editor.document,
      selection: editor.selection,
      playback: editor.playback,
      selectedItem,
      commandHistory: recentCommandHistory,
      currentInput: commandInput,
    })));
  }, [
    commandInput,
    dispatch,
    editor.document,
    editor.playback,
    editor.selection,
    recentCommandHistory,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = commandInput.trim();

    if (!trimmedCommand) {
      dispatch(toastShown("Enter a command for the assistant"));
      return;
    }

    if (!editor.document) {
      dispatch(toastShown("No active video document"));
      return;
    }

    if (!canPlanCommands) {
      dispatch(toastShown("View only: you cannot edit this timeline"));
      return;
    }

    const timestamp = new Date().toISOString();
    const commandId = createUiCommandId(timestamp);
    logVideoEditorEvent("editor.ai.command.start", {
      projectId,
      commandId,
      revisionNumber: editor.document.history.revision,
      selectedItemCount: editor.selection.selectedItemIds.length,
    });
    dispatch(aiCommandStarted({ commandId, prompt: trimmedCommand }));
    dispatch(commandInputChanged(""));

    const queued = await saveCommandHistoryEntry({
      scope: cacheScope,
      projectId,
      text: trimmedCommand,
      source: "ai",
      commandId,
      status: "queued",
      timestamp,
    });
    if (queued.ok) {
      dispatch(aiCommandHistoryEntrySaved(queued.value));
    }

    const plan = await planVideoAiCommandWithService(
      {
        document: editor.document,
        selection: editor.selection,
        playback: editor.playback,
        selectedItem: editor.selection.activeItemId
          ? editor.document.tracks.flatMap((track) => track.items).find((item) => item.id === editor.selection.activeItemId) ?? null
          : null,
        mediaReferences: editor.document.media,
      },
      trimmedCommand,
      { commandId, now: timestamp },
    );

    if (!plan.ok) {
      logVideoEditorEvent("editor.ai.command.failure", {
        projectId,
        commandId,
        warningCount: plan.warnings.length,
        reason: plan.error,
      }, "warn");
      dispatch(aiCommandFailed({ commandId, prompt: trimmedCommand, error: plan.error, warnings: plan.warnings }));
      const failed = await saveCommandHistoryEntry({
        scope: cacheScope,
        projectId,
        text: trimmedCommand,
        source: "ai",
        commandId,
        status: "failed",
        timestamp,
      });
      if (failed.ok) dispatch(aiCommandHistoryEntrySaved(failed.value));
      return;
    }

    const validation = applyVideoOperationBatch(editor.document, plan.batch);
    if (!validation.ok) {
      const error = validation.errors?.join(" ") ?? "AI edit failed validation.";
      logVideoEditorEvent("editor.ai.command.failure", {
        projectId,
        commandId,
        operationBatchId: plan.batch.id,
        operationCount: plan.batch.operations.length,
        reason: "validation-failed",
      }, "error");
      dispatch(aiCommandFailed({ commandId, prompt: trimmedCommand, error, warnings: validation.warnings }));
      const failed = await saveCommandHistoryEntry({
        scope: cacheScope,
        projectId,
        text: trimmedCommand,
        source: "ai",
        commandId,
        status: "failed",
        timestamp,
      });
      if (failed.ok) dispatch(aiCommandHistoryEntrySaved(failed.value));
      return;
    }

    dispatch(videoOperationApplied(plan.batch));
    logVideoEditorEvent("editor.ai.command.applied", {
      projectId,
      commandId,
      operationBatchId: plan.batch.id,
      operationCount: plan.batch.operations.length,
      operationIds: plan.batch.operations.map((operation) => operation.id),
      warningCount: plan.warnings.length,
    });
    dispatch(
      aiCommandApplied({
        commandId,
        summary: plan.summary,
        warnings: plan.warnings,
        operationBatchId: plan.batch.id,
      }),
    );

    const applied = await saveCommandHistoryEntry({
      scope: cacheScope,
      projectId,
      text: trimmedCommand,
      source: "ai",
      commandId,
      operationBatchId: plan.batch.id,
      status: "applied",
      timestamp,
    });
    if (applied.ok) dispatch(aiCommandHistoryEntrySaved(applied.value));
  }

  function insertSuggestion(suggestion: VideoAiCommandSuggestion) {
    dispatch(aiSuggestionInserted(suggestion));
  }

  function handleCommandInputChange(value: string) {
    dispatch(commandInputChanged(value));
    dispatch(aiAutocompleteOpened());
  }

  function handleCommandInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      dispatch(aiAutocompleteClosed());
      return;
    }

    if (keyboardSuggestionCount === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      dispatch(aiSuggestionHighlighted(aiActiveSuggestionIndex >= keyboardSuggestionCount - 1 ? 0 : aiActiveSuggestionIndex + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      dispatch(aiSuggestionHighlighted(aiActiveSuggestionIndex <= 0 ? keyboardSuggestionCount - 1 : aiActiveSuggestionIndex - 1));
      return;
    }

    if (event.key === "Enter" && aiAutocompleteOpen && aiActiveSuggestionIndex >= 0) {
      event.preventDefault();
      insertSuggestion(aiSuggestions[aiActiveSuggestionIndex]);
    }
  }

  async function runSemanticSearch(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      dispatch(toastShown("Enter a semantic search"));
      return;
    }

    dispatch(semanticSearchStarted({ query: trimmedQuery, modalities: ["transcript", "ocr"] }));
    try {
      const response = await searchVideoEditorRetrieval({
        projectId,
        query: trimmedQuery,
        modalities: ["transcript", "ocr"],
        topK: 8,
        expandGraph: true,
      });
      dispatch(semanticSearchSucceeded({
        query: trimmedQuery,
        results: response.results,
        warnings: response.warnings,
      }));
    } catch (error) {
      dispatch(semanticSearchFailed({
        query: trimmedQuery,
        error: error instanceof Error ? error.message : "Semantic search failed.",
      }));
    }
  }

  function handleSemanticSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSemanticSearch(semanticQuery);
  }

  function applySemanticPreset(query: string) {
    setSemanticQuery(query);
    void runSemanticSearch(query);
  }

  function selectSemanticResult(result: VideoEditorShotSearchResult) {
    dispatch(semanticReferenceSelected(result));
  }

  function addSemanticResult(result: VideoEditorShotSearchResult) {
    const item = media.find((candidate) => candidate.id === result.mediaId);
    if (!item) {
      dispatch(toastShown("Media is no longer available"));
      return;
    }

    dispatch(semanticShotAddedToTimeline({
      result,
      media: item,
      canWrite: canPlanCommands,
      timelineStart: editor.playback.currentTime,
    }));
  }

  return (
    <aside
      className="absolute inset-0 z-40 flex h-full w-full min-w-0 max-w-none shrink-0 flex-col border-l border-outline-variant bg-surface min-[760px]:relative min-[760px]:inset-auto min-[760px]:w-80 min-[760px]:min-w-80 min-[760px]:max-w-80"
      aria-label="AI Assistant"
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-outline-variant px-4">
        <EditorIcon className="text-[20px] text-primary" filled>
          auto_awesome
        </EditorIcon>
        <div className="min-w-0 flex-1">
          <h2 className="text-body-sm font-bold text-on-surface">AI Assistant</h2>
          <p className="truncate text-label-sm text-on-surface-variant">{statusText(aiCommandStatus)}</p>
        </div>
        <button
          type="button"
          onClick={() => setWorkspaceExpanded((expanded) => !expanded)}
          aria-label={workspaceExpanded ? "Collapse AI workspace" : "Expand AI workspace"}
          aria-expanded={workspaceExpanded}
          className="flex h-9 w-9 items-center justify-center rounded-[6px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <EditorIcon className={`text-[18px] transition-transform motion-reduce:transition-none ${workspaceExpanded ? "rotate-180" : ""}`}>
            expand_more
          </EditorIcon>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          Quick tools
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {quickAiTools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              aria-label={tool.label}
              disabled={!canPlanCommands}
              onClick={() => {
                dispatch(commandInputChanged(tool.command));
                dispatch(aiAutocompleteOpened());
              }}
              className="group min-h-[88px] rounded-[10px] border border-outline-variant bg-surface-container-low p-2.5 text-left transition-colors hover:border-primary/35 hover:bg-surface-container disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-[7px] ${tool.iconClass}`}>
                <EditorIcon className="text-[18px]">{tool.icon}</EditorIcon>
              </span>
              <span className="mt-1.5 block text-[10px] font-bold text-on-surface">{tool.label}</span>
              <span className="mt-0.5 block text-[9px] leading-3 text-on-surface-variant">{tool.description}</span>
            </button>
          ))}
        </div>
        {showActivity ? (
          <div className="mt-5 space-y-3 border-t border-outline-variant pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Activity</p>
        {visibleMessages.map((message) => {
          const fromUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${fromUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] ${
                  fromUser
                    ? "bg-surface-variant text-on-surface"
                    : "border border-primary/25 bg-surface-container-high text-primary"
                }`}
              >
                {fromUser ? (
                  <span className="text-label-sm font-bold">B</span>
                ) : (
                  <EditorIcon className="text-[14px]" filled>
                    smart_toy
                  </EditorIcon>
                )}
              </div>
              <div className={`flex max-w-[85%] flex-col gap-2 ${fromUser ? "items-end" : ""}`}>
                <div
                  className={`rounded-[6px] border p-3 text-body-sm text-on-surface ${
                    fromUser
                      ? "rounded-tr-[2px] border-outline-variant bg-surface-container-high"
                      : "rounded-tl-[2px] border-outline-variant bg-surface-container-low"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          );
        })}
        {aiCommandStatus === "failed" && aiCommandError ? (
          <StatusBox tone="error" text={aiCommandError} />
        ) : null}
        {aiCommandStatus === "applied" && aiLastSummary ? (
          <StatusBox
            tone="success"
            text={aiLastWarnings.length > 0 ? `${aiLastSummary} ${aiLastWarnings.join(" ")}` : aiLastSummary}
          />
        ) : null}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-outline-variant bg-surface-container-lowest p-2.5">
        <div className={workspaceExpanded ? "max-h-[320px] overflow-y-auto pr-1" : "hidden"}>
        <div className="mb-3 overflow-hidden rounded-[6px] border border-outline-variant bg-surface-container-low">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container px-3 py-2">
            <span className="text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
              Semantic
            </span>
            <span className="text-label-sm text-on-surface-variant">{semanticStatusText(semanticSearch.status)}</span>
          </div>
          <div className="space-y-2 p-3">
            <div className="grid grid-cols-2 gap-1.5">
              {semanticPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applySemanticPreset(preset.query)}
                  className="flex min-h-8 items-center gap-1.5 rounded-[5px] border border-outline-variant px-2 text-left text-label-sm text-on-surface transition-colors hover:border-primary/50 hover:bg-surface-container-high motion-reduce:transition-none"
                >
                  <EditorIcon className="text-[14px] text-primary">{preset.icon}</EditorIcon>
                  <span className="truncate">{preset.label}</span>
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleSemanticSubmit}>
              <input
                className="h-9 min-w-0 flex-1 rounded-[6px] border border-outline-variant bg-surface px-2 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary motion-reduce:transition-none"
                placeholder="Search moments..."
                aria-label="Search moments"
                data-editor-shortcuts="ignore"
                value={semanticQuery}
                onChange={(event) => setSemanticQuery(event.target.value)}
              />
              <button
                type="submit"
                disabled={semanticSearch.status === "searching"}
                className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-outline-variant text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50 motion-reduce:transition-none"
                aria-label="Search moments"
              >
                <EditorIcon>search</EditorIcon>
              </button>
            </form>
            {semanticSearch.error ? (
              <StatusBox tone="error" text={semanticSearch.error} />
            ) : null}
            {semanticSearch.warnings.length > 0 ? (
              <p className="text-label-sm text-on-surface-variant">{semanticSearch.warnings.slice(0, 2).join(" ")}</p>
            ) : null}
            {semanticSearch.results.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {semanticSearch.results.slice(0, 6).map((result) => {
                  const selected = semanticSearch.selectedReference?.shotId === result.shotId;
                  return (
                    <li key={result.shotId}>
                      <div
                        className={`flex w-full items-start gap-2 rounded-[5px] border px-2 py-2 text-left transition-colors motion-reduce:transition-none ${
                          selected
                            ? "border-primary/50 bg-primary-container/40"
                            : "border-outline-variant bg-surface hover:bg-surface-container-high"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectSemanticResult(result)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          <EditorIcon className="mt-0.5 text-[15px] text-primary">movie</EditorIcon>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm text-on-surface">
                              {formatTimeRange(result.startSeconds, result.endSeconds)}
                            </span>
                            <span className="block truncate text-label-sm text-on-surface-variant">
                              {result.evidence[0]?.text ?? result.shotId}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addSemanticResult(result)}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-outline-variant transition-colors motion-reduce:transition-none ${
                            canPlanCommands ? "text-on-surface-variant hover:border-primary/50 hover:text-primary" : "text-on-surface-variant/60"
                          }`}
                          aria-label="Add shot to timeline"
                          title={canPlanCommands ? "Add shot" : "View only"}
                        >
                          <EditorIcon>add</EditorIcon>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : semanticSearch.status === "succeeded" ? (
              <div className="rounded-[5px] border border-dashed border-outline-variant px-3 py-3 text-center text-label-md text-on-surface-variant">
                No matching moments found.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-3 overflow-hidden rounded-[6px] border border-outline-variant bg-surface-container-low">
          <div className="border-b border-outline-variant bg-surface-container px-3 py-2">
            <span className="text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
              Suggestions
            </span>
          </div>
          {aiSuggestions.length > 0 ? (
            <ul className="flex flex-col">
              {aiSuggestions.slice(0, 5).map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => insertSuggestion(suggestion)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-on-surface transition-colors hover:bg-surface-container-high motion-reduce:transition-none"
                  >
                    <EditorIcon className="text-[16px] text-primary">{suggestionIcon(suggestion.source)}</EditorIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{suggestion.label}</span>
                      <span className="block truncate text-label-sm text-on-surface-variant">{suggestion.command}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-center text-label-md text-on-surface-variant">
              Suggestions appear when the timeline or selection changes.
            </div>
          )}
        </div>
        </div>

        <div className="rounded-[13px] border border-primary/70 bg-surface-container-low p-2.5 shadow-[0_0_24px_rgba(139,124,255,0.12)]">
          <h3 className="mb-2 text-[11px] font-bold text-on-surface">Ask AI Assistant</h3>
        <form className="relative" onSubmit={handleSubmit}>
          {visibleAutocompleteSuggestions.length > 0 ? (
            <div className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-full overflow-y-auto rounded-[6px] border border-outline-variant bg-surface-container-low shadow-xl">
              {visibleAutocompleteSuggestions.map((suggestion, index) => {
                const active = index === aiActiveSuggestionIndex;
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertSuggestion(suggestion)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-body-sm transition-colors motion-reduce:transition-none ${
                      active ? "bg-surface-container-high text-on-surface" : "text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <EditorIcon className="mt-0.5 text-[16px] text-primary">{suggestionIcon(suggestion.source)}</EditorIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{suggestion.command}</span>
                      {suggestion.description ? (
                        <span className="block truncate text-label-sm text-on-surface-variant">{suggestion.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <input
            className="h-9 w-full rounded-[7px] border border-outline-variant bg-surface py-2 pl-3 pr-10 text-[11px] text-on-surface outline-none transition-all placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary motion-reduce:transition-none"
            placeholder="Type your command..."
            aria-label="AI edit command"
            data-editor-shortcuts="ignore"
            type="text"
            value={commandInput}
            disabled={!canPlanCommands}
            onChange={(event) => handleCommandInputChange(event.target.value)}
            onFocus={() => dispatch(aiAutocompleteOpened())}
            onBlur={() => dispatch(aiAutocompleteClosed())}
            onKeyDown={handleCommandInputKeyDown}
          />
          <button
            type="submit"
            disabled={!canPlanCommands || aiCommandStatus === "planning"}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 items-center justify-center text-primary transition-colors -translate-y-1/2 hover:text-on-surface disabled:opacity-40 motion-reduce:transition-none"
            aria-label="Send command"
          >
            <EditorIcon filled>send</EditorIcon>
          </button>
        </form>
        </div>
      </div>
    </aside>
  );
}

function StatusBox({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <div
      className={`rounded-[6px] border px-3 py-2 text-body-sm ${
        tone === "error"
          ? "border-error/30 bg-error-container text-on-error-container"
          : "border-primary/25 bg-primary-container text-on-primary-container"
      }`}
    >
      {text}
    </div>
  );
}

function statusText(status: "idle" | "planning" | "applied" | "failed"): string {
  if (status === "planning") return "Planning edit";
  if (status === "applied") return "Last edit applied";
  if (status === "failed") return "Needs a clearer command";
  return "Ready to help with your cut";
}

const quickAiTools = [
  {
    label: "Auto Enhance",
    description: "Improve color & clarity",
    icon: "auto_awesome",
    command: "Auto enhance the selected clip",
    iconClass: "bg-primary/15 text-primary",
  },
  {
    label: "Remove Background",
    description: "AI background removal",
    icon: "person_remove",
    command: "Remove the background from the selected clip",
    iconClass: "bg-primary-container/30 text-primary",
  },
  {
    label: "Smart Cut",
    description: "Remove silences",
    icon: "content_cut",
    command: "Smart cut the selected clip and remove silences",
    iconClass: "bg-secondary/15 text-secondary",
  },
  {
    label: "AI Color Grade",
    description: "Cinematic look",
    icon: "palette",
    command: "Apply a cinematic color grade to the selected clip",
    iconClass: "bg-tertiary/15 text-tertiary",
  },
] as const;

const semanticPresets = [
  { label: "Moments", query: "memorable moments", icon: "travel_explore" },
  { label: "B-roll", query: "usable b-roll shots", icon: "video_library" },
  { label: "Highlights", query: "best highlights", icon: "auto_awesome" },
  { label: "Speakers", query: "people speaking or named entities", icon: "record_voice_over" },
] as const;

function semanticStatusText(status: "idle" | "searching" | "succeeded" | "failed"): string {
  if (status === "searching") return "Searching";
  if (status === "succeeded") return "Results";
  if (status === "failed") return "Failed";
  return "Ready";
}

function formatTimeRange(startSeconds: number, endSeconds: number): string {
  return `${formatTimestamp(startSeconds)} - ${formatTimestamp(endSeconds)}`;
}

function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}`;
}

function suggestionIcon(source: "history" | "template" | "context"): string {
  if (source === "history") return "history";
  if (source === "context") return "ads_click";
  return "auto_awesome";
}

function createUiCommandId(timestamp: string): string {
  return `command-${timestamp.replace(/[^0-9a-z]/gi, "").toLowerCase()}`;
}
