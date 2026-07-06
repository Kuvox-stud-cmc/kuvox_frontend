import { useEffect, type CSSProperties } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { projectOpened } from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorModalLayer, EditorPopoverLayer, EditorToast } from "./editor-overlays";
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

interface VideoEditorWorkspaceProps {
  projectId: string;
  projectName?: string;
}

/**
 * Video editor UI. Client-only: it lives under the route's Redux `<Provider>`
 * and never renders on the server.
 */
export function VideoEditorWorkspace({ projectId, projectName }: VideoEditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const editorMode = useAppSelector((state) => state.editor.editorMode);
  const timelineHeight = useAppSelector((state) => state.editor.timelineHeight);
  const timelineOpen = useAppSelector((state) => state.editor.timelineOpen);

  useEffect(() => {
    dispatch(projectOpened(projectId));
  }, [dispatch, projectId]);

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-background text-on-background"
      style={
        {
          "--editor-timeline-space": `${timelineOpen ? timelineHeight : 40}px`,
        } as CSSProperties
      }
    >
      <EditorTopBar project={{ ...editorProject, id: projectId, name: projectName ?? editorProject.name }} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <MediaLibraryPanel assets={mediaAssets} />
        <PreviewPanel project={editorProject} />
        {editorMode === "ai" ? (
          <AiAssistantPanel messages={assistantMessages} suggestions={assistantSuggestions} />
        ) : (
          <ToolRail tools={editorTools} />
        )}
      </div>

      <TimelinePanel tracks={timelineTracks} />
      <EditorPopoverLayer />
      <EditorModalLayer />
      <EditorToast />
    </div>
  );
}
