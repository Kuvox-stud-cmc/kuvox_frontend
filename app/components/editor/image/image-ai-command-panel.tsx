import { useState, type FormEvent } from "react";
import { EditorIcon } from "../editor-ui";
import {
  createImageAiGroupOperation,
  type ImageAiSuccessfulPlan,
} from "~/lib/editor/image/ai-command-planner";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  imageAiCommandApplied,
  imageAiCommandInputChanged,
  imageDocumentOperationApplied,
} from "~/store/slices/image-editor-slice";

interface ImageAiCommandPanelProps {
  onShowNotification: (message: string) => void;
}

const SUGGESTED_COMMANDS = [
  "Add dramatic sunset lighting",
  "Convert background to grayscale",
  "Add warm vignette effect",
  "Scale overlay image to 80%",
];

export function ImageAiCommandPanel({ onShowNotification }: ImageAiCommandPanelProps) {
  const dispatch = useAppDispatch();
  const imageEditor = useAppSelector((state) => state.imageEditor);
  const { aiCommandInput, aiCommandStatus, aiCommandHistory } = imageEditor;

  const runCommand = async (prompt: string) => {
    onShowNotification(`Running AI plan: "${prompt}"`);

    // Simulated parsing of prompt to command instructions.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const lower = prompt.toLowerCase();
    let plan: ImageAiSuccessfulPlan;
    if (lower.includes("sunset") || lower.includes("lighting")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt,
        label: "sunset lighting",
        summary: "Apply warm sunset gradient filters to backdrop",
        warnings: [],
        operations: [
          {
            type: "set-background",
            background: { type: "color", color: "#ff9055" },
            label: "AI: sunset lighting",
          },
        ],
      };
    } else if (lower.includes("grayscale") || lower.includes("gray")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt,
        label: "grayscale background",
        summary: "Remove color saturation from layer background",
        warnings: [],
        operations: [
          {
            type: "set-background",
            background: { type: "color", color: "#4b5563" },
            label: "AI: grayscale background",
          },
        ],
      };
    } else if (lower.includes("vignette") || lower.includes("warm")) {
      plan = {
        ok: true,
        kind: "make-colors-pop",
        prompt,
        label: "warm vignette",
        summary: "Apply radial warm vignette shadow borders",
        warnings: [],
        operations: [
          {
            type: "set-background",
            background: { type: "color", color: "#78350f" },
            label: "AI: warm vignette",
          },
        ],
      };
    } else if (lower.includes("scale") || lower.includes("80%")) {
      const selectedLayerId = imageEditor.document.selectedLayerId || imageEditor.document.layers[0]?.id;
      plan = {
        ok: true,
        kind: "clean-up-empty-space",
        prompt,
        label: "scale layer to 80%",
        summary: "Shrink target active composition elements to 80%",
        warnings: selectedLayerId ? [] : ["No layers found to scale"],
        operations: selectedLayerId
          ? [
              {
                type: "update-layer-transform",
                layerId: selectedLayerId,
                transform: { scaleX: 0.8, scaleY: 0.8 },
                label: "AI: scale layer to 80%",
              },
            ]
          : [],
      };
    } else {
      onShowNotification(`AI was unable to apply style edits for "${prompt}"`);
      return;
    }

    const operation = createImageAiGroupOperation(plan);
    dispatch(imageDocumentOperationApplied(operation));
    dispatch(
      imageAiCommandApplied({
        summary: operation.type === "group-operation" ? operation.summary : plan.summary,
        prompt,
      }),
    );
    dispatch(imageAiCommandInputChanged(""));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runCommand(aiCommandInput);
  };

  return (
    <section className="space-y-3 border-b border-outline-variant/30 pb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-primary/20 bg-primary/10 text-primary">
          <EditorIcon className="text-[16px]">auto_awesome</EditorIcon>
        </span>
        <div className="min-w-0">
          <h2 className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant/55">
            AI edit
          </h2>
          <p className="truncate text-label-sm text-on-surface-variant/35">
            {statusText(aiCommandStatus)}
          </p>
        </div>
      </div>

      <form className="space-y-2" onSubmit={handleSubmit}>
        <textarea
          rows={4}
          value={aiCommandInput}
          onChange={(event) => dispatch(imageAiCommandInputChanged(event.target.value))}
          className="w-full resize-none rounded-[6px] border border-outline-variant/40 bg-black/20 px-3 py-2 text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/30 focus:border-primary/50"
          placeholder="Describe the image edit..."
        />
        <button
          type="submit"
          disabled={aiCommandStatus === "planning"}
          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:bg-primary-fixed disabled:pointer-events-none disabled:opacity-50"
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
            className="min-h-8 rounded-[4px] border border-outline-variant/40 bg-surface-container-low px-2 py-1.5 text-left text-label-sm font-semibold text-on-surface-variant/70 hover:border-primary/35 hover:text-on-surface"
          >
            {command}
          </button>
        ))}
      </div>

      {aiCommandHistory.length > 0 ? (
        <div className="space-y-2 pt-2">
          <h3 className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant/45">
            Command History
          </h3>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {aiCommandHistory.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HistoryRow({ entry }: { entry: { id: string; label: string; summary: string; prompt: string | null; createdAt: string } }) {
  const prompt = entry.prompt;
  const summary = entry.summary;
  return (
    <div className="rounded-[4px] bg-surface-container-high/40 p-2 border border-outline-variant/20">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-label-sm font-bold text-on-surface/75">
          {entry.label}
        </p>
        <time className="shrink-0 text-label-sm text-on-surface-variant/30">
          {new Date(entry.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      {prompt ? <p className="mt-1 truncate text-label-sm text-on-surface-variant/35">{prompt}</p> : null}
      <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant/45">{summary}</p>
    </div>
  );
}

function StatusBox({ tone, text }: { tone: "success" | "error"; text: string }) {
  const error = tone === "error";
  return (
    <div
      className={`rounded-[5px] border px-3 py-2 text-label-sm ${
        error
          ? "border-danger/25 bg-danger/10 text-danger"
          : "border-primary/20 bg-primary/10 text-primary"
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
