import { EditorIcon } from "./editor-ui";
import type { AssistantMessageMock, AssistantSuggestionMock } from "./mock-editor-data";

interface AiAssistantPanelProps {
  messages: AssistantMessageMock[];
  suggestions: AssistantSuggestionMock[];
}

export function AiAssistantPanel({ messages, suggestions }: AiAssistantPanelProps) {
  return (
    <aside className="z-40 hidden h-full w-[360px] shrink-0 flex-col border-l border-outline-variant bg-surface md:flex xl:w-[392px]">
      <div className="flex h-14 items-center gap-3 border-b border-outline-variant px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-primary/25 bg-surface-container-high text-primary">
          <EditorIcon className="text-[18px]" filled>
            smart_toy
          </EditorIcon>
        </div>
        <div>
          <h2 className="text-body-sm font-semibold text-on-surface">Editing Assistant</h2>
          <p className="text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
            Ready to help with your cut
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {messages.map((message) => {
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
                {message.actions ? (
                  <div className="flex flex-wrap gap-2">
                    {message.actions.map((action, index) => (
                      <button
                        key={action}
                        type="button"
                        className={`h-8 rounded-[4px] px-3 text-label-md font-semibold transition-colors ${
                          index === 0
                            ? "bg-primary text-on-primary hover:opacity-90"
                            : "border border-outline-variant text-on-surface hover:bg-surface-container-highest"
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-outline-variant bg-surface-container-lowest p-3">
        <div className="mb-3 overflow-hidden rounded-[6px] border border-outline-variant bg-surface-container-low">
          <div className="border-b border-outline-variant bg-surface-container px-3 py-2">
            <span className="text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
              Suggestions
            </span>
          </div>
          <ul className="flex flex-col">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <EditorIcon className="text-[16px] text-primary">{suggestion.icon}</EditorIcon>
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <input
            className="h-11 w-full rounded-[6px] border border-outline-variant bg-surface py-2 pl-3 pr-11 text-body-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Tell me what to edit..."
            type="text"
            defaultValue="Add cap"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-8 w-8 items-center justify-center text-on-surface-variant transition-colors -translate-y-1/2 hover:text-primary"
            aria-label="Send command"
          >
            <EditorIcon filled>send</EditorIcon>
          </button>
        </div>
      </div>
    </aside>
  );
}
