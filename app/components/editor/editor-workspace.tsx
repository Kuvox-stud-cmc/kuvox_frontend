import { useCallback, useEffect, type CSSProperties } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  projectOpened,
  mediaAssetAddedToTimeline,
  selectEditorMode,
  selectTimelinePanelState,
} from "~/store/slices/editor-slice";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { EditorModalLayer, EditorPopoverLayer, EditorToast } from "./editor-overlays";
import { EditorTopBar } from "./editor-top-bar";
import { MediaLibraryPanel } from "./media-library-panel";
import { hydrateMediaDurationFromBrowserMetadata } from "~/lib/editor/editor-media";
import {
  assistantMessages,
  editorProject,
  workspaceMediaAssets,
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
 * suggestion panels. Kept as a compatibility export path while callers move to
 * the video-specific workspace.
 */
export function EditorWorkspace({ projectId }: EditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const editorMode = useAppSelector(selectEditorMode);
  const { height: timelineHeight, open: timelineOpen } = useAppSelector(selectTimelinePanelState);
  const cacheScope = { userId: "mock-user", ownerKind: "user" as const, ownerId: "mock-user" };

  const addMediaToTimeline = useCallback(async (media: (typeof workspaceMediaAssets)[number], placement?: { trackId?: string; timelineStart: number }) => {
    const hydrated = await hydrateMediaDurationFromBrowserMetadata(media);
    dispatch(mediaAssetAddedToTimeline(placement ? { media: hydrated, ...placement } : hydrated));
  }, [dispatch]);

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
      <EditorTopBar project={{ ...editorProject, id: projectId }} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <MediaLibraryPanel
          media={workspaceMediaAssets}
          onAddMedia={(media) => void addMediaToTimeline(media)}
        />
        <PreviewPanel project={editorProject} />
        {editorMode === "ai" ? (
          <AiAssistantPanel
            messages={assistantMessages}
            projectId={projectId}
            cacheScope={cacheScope}
            media={workspaceMediaAssets}
          />
        ) : (
          <ToolRail />
        )}
      </div>

      <TimelinePanel
        onMediaDrop={(mediaId, placement) => {
          const media = workspaceMediaAssets.find((item) => item.id === mediaId);
          if (media) void addMediaToTimeline(media, placement);
        }}
      />
      <EditorPopoverLayer />
      <EditorModalLayer />
      <EditorToast />
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
