import type { FormEvent } from "react";

import { EditorIcon } from "../editor-ui";
import {
  createImageAiGroupOperation,
  planMockImageAiCommand,
} from "./ai-command-planner";
import type {
  ImageCompositionDocument,
  ImageHistoryEntry,
} from "./document/types";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  imageAiCommandApplied,
  imageAiCommandFailed,
  imageAiCommandInputChanged,
  imageAiCommandStarted,
  imageDocumentOperationApplied,
} from "~/store/slices/image-editor-slice";

const SUGGESTED_COMMANDS = [
  "Remove background",
  "Make colors pop",
  "Add title",
  "Clean up empty space",
  "YouTube thumbnail",
  "Resize for social post",
];

export function ImageAiCommandPanel({
  document,
}: {
  document: ImageCompositionDocument;
}) {
  const dispatch = useAppDispatch();
  const { aiCommandInput, aiCommandStatus, aiCommandError, aiLastSummary } =
    useAppSelector((state) => state.imageEditor);
  const aiHistory = document.operationHistory
    .filter((entry) => entry.source === "ai")
    .slice()
    .reverse();

  const runCommand = (command: string) => {
    dispatch(imageAiCommandStarted());
    const plan = planMockImageAiCommand(document, command);
    if (!plan.ok) {
      dispatch(imageAiCommandFailed(messageWithWarnings(plan.error, plan.warnings)));
      return;
    }

    const operation = createImageAiGroupOperation(plan);
    dispatch(imageDocumentOperationApplied(operation));
    dispatch(
      imageAiCommandApplied({
        summary: operation.type === "group-operation" ? operation.summary : plan.summary,
      }),
    );
    dispatch(imageAiCommandInputChanged(""));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runCommand(aiCommandInput);
  };

  return (
    <section className="space-y-3 border-b border-white/10 pb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#8fd6c8]/25 bg-[#8fd6c8]/10 text-[#8fd6c8]">
          <EditorIcon className="text-[16px]">auto_awesome</EditorIcon>
        </span>
        <div className="min-w-0">
          <h2 className="text-label-sm font-semibold uppercase tracking-wide text-white/55">
            AI edit
          </h2>
          <p className="truncate text-label-sm text-white/35">
            {statusText(aiCommandStatus)}
          </p>
        </div>
      </div>

      <form className="space-y-2" onSubmit={handleSubmit}>
        <textarea
          rows={4}
          value={aiCommandInput}
          onChange={(event) => dispatch(imageAiCommandInputChanged(event.target.value))}
          className="w-full resize-none rounded-[6px] border border-white/10 bg-black/20 px-3 py-2 text-body-sm text-white outline-none placeholder:text-white/30 focus:border-[#8fd6c8]/50"
          placeholder="Describe the image edit..."
        />
        <button
          type="submit"
          disabled={aiCommandStatus === "planning"}
          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-[4px] bg-[#8fd6c8] px-3 text-label-md font-semibold text-[#10201d] hover:bg-[#a8eee1] disabled:pointer-events-none disabled:opacity-50"
        >
          <EditorIcon className="text-[16px]">send</EditorIcon>
          Apply
        </button>
      </form>

      <div className="grid grid-cols-2 gap-1.5">
        {SUGGESTED_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => runCommand(command)}
            className="min-h-8 rounded-[4px] border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left text-label-sm font-semibold text-white/70 hover:border-[#8fd6c8]/35 hover:text-white"
          >
            {command}
          </button>
        ))}
      </div>

      {aiCommandStatus === "failed" && aiCommandError ? (
        <StatusBox tone="error" text={aiCommandError} />
      ) : null}
      {aiCommandStatus === "applied" && aiLastSummary ? (
        <StatusBox tone="success" text={aiLastSummary} />
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-label-sm font-semibold uppercase tracking-wide text-white/45">
            Command history
          </h3>
          <span className="text-label-sm text-white/30">{aiHistory.length}</span>
        </div>
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {aiHistory.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-white/10 bg-black/15 px-3 py-4 text-center text-label-sm text-white/35">
              No AI edits yet
            </div>
          ) : (
            aiHistory.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
          )}
        </div>
      </div>
    </section>
  );
}

function HistoryRow({ entry }: { entry: ImageHistoryEntry }) {
  const operation = entry.operation;
  const summary = operation.type === "group-operation" ? operation.summary : entry.label;
  const prompt = operation.type === "group-operation" ? operation.prompt : null;

  return (
    <div className="rounded-[5px] border border-white/10 bg-black/15 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-label-md font-semibold text-white/75">
          {entry.label}
        </p>
        <time className="shrink-0 text-label-sm text-white/30">
          {new Date(entry.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      {prompt ? <p className="mt-1 truncate text-label-sm text-white/35">{prompt}</p> : null}
      <p className="mt-1 line-clamp-2 text-label-sm text-white/45">{summary}</p>
    </div>
  );
}

function StatusBox({ tone, text }: { tone: "success" | "error"; text: string }) {
  const error = tone === "error";
  return (
    <div
      className={`rounded-[5px] border px-3 py-2 text-label-sm ${
        error
          ? "border-red-400/25 bg-red-500/10 text-red-100"
          : "border-[#8fd6c8]/25 bg-[#8fd6c8]/10 text-[#d8fff8]"
      }`}
    >
      {text}
    </div>
  );
}

function statusText(status: "idle" | "planning" | "applied" | "failed") {
  if (status === "planning") return "Planning";
  if (status === "applied") return "Applied";
  if (status === "failed") return "Needs a supported command";
  return "Ready";
}

function messageWithWarnings(message: string, warnings: string[]) {
  if (warnings.length === 0) return message;
  return `${message} ${warnings.join(" ")}`;
}
