import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { projectOpened } from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import {
  assistantMessages,
  assistantSuggestions,
  editorProject,
  editorTools,
  mediaAssets,
  timelineTracks,
} from "./mock-editor-data";
import { PreviewPanel } from "./panels/preview-panel";
import { TimelinePanel } from "./panels/timeline-panel";
import { ToolRail } from "./tool-rail";

interface EditorWorkspaceProps {
  projectId: string;
}

/**
 * The full editor UI. Client-only: it lives under the route's Redux `<Provider>`
 * and never renders on the server. Lays out the AI agent, preview, timeline and
 * suggestion panels; the "Video / Image editing" sub-mode is Redux state.
 */
export function EditorWorkspace({ projectId }: EditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const editorMode = useAppSelector((state) => state.editor.editorMode);

  useEffect(() => {
    dispatch(projectOpened(projectId));
  }, [dispatch, projectId]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-on-background">
      <EditorTopBar project={{ ...editorProject, id: projectId }} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MediaLibraryPanel assets={mediaAssets} />
        <PreviewPanel project={editorProject} />
        {editorMode === "ai" ? (
          <AiAssistantPanel messages={assistantMessages} suggestions={assistantSuggestions} />
        ) : (
          <ToolRail tools={editorTools} />
        )}
      </div>

      <TimelinePanel tracks={timelineTracks} />
    </div>
  );

  /*
  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
        <span className="text-sm font-semibold">Editor — {projectId}</span>
        <div className="flex gap-1 text-xs">
          {(["video", "image"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => dispatch(mediaModeChanged(mode))}
              className={`rounded px-2 py-1 ${
                mediaMode === mode
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {mode === "video" ? "Video editing" : "Image editing"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-gray-200 bg-white">
          <AgentPanel />
        </aside>
        <main className="flex-1">
          <PreviewPanel />
        </main>
        <aside className="w-80 border-l border-gray-200 bg-white">
          <SuggestionsPanel />
        </aside>
      </div>

      <footer className="h-40 border-t border-gray-200 bg-white">
        <TimelinePanel />
      </footer>
    </div>
  );
  */
}
