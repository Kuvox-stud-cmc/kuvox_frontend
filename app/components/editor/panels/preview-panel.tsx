import { useMemo } from "react";

import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  currentTimeChanged,
  modalOpened,
  muteToggled,
  playbackStepChanged,
  playbackToggled,
} from "~/store/slices/editor-slice";

import { editorProject, mediaAssets, type EditorProjectMock } from "../mock-editor-data";
import { EditorIcon, EditorIconButton } from "../editor-ui";

interface PreviewPanelProps {
  project: EditorProjectMock;
}

/**
 * Preview playback panel — renders the current timeline output. Stub for now.
 */
export function PreviewPanel({ project = editorProject }: Partial<PreviewPanelProps>) {
  const dispatch = useAppDispatch();
  const selectedAssetId = useAppSelector((state) => state.editor.selectedAssetId);
  const currentTimeSeconds = useAppSelector((state) => state.editor.currentTimeSeconds);
  const isPlaying = useAppSelector((state) => state.editor.isPlaying);
  const isMuted = useAppSelector((state) => state.editor.isMuted);
  const selectedAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedAssetId),
    [selectedAssetId],
  );
  const displayTime = formatTimecode(currentTimeSeconds);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 lg:p-3 2xl:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(192,193,255,0.05),transparent_48%)]" />
        <div
          className="relative aspect-video w-full max-h-full overflow-hidden rounded-[6px] border border-outline-variant bg-black shadow-[0_18px_50px_rgba(0,0,0,0.38)]"
          style={{
            maxWidth:
              "min(100%, calc((100vh - 64px - var(--editor-timeline-space, 292px) - 56px) * 1.777))",
          }}
        >
          <div
            className="absolute inset-[1px]"
            style={{ background: selectedAsset?.gradient ?? project.previewGradient }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_24%,rgba(255,255,255,0.18),transparent_27%),linear-gradient(to_top,rgba(0,0,0,0.5),rgba(0,0,0,0.08)_46%,rgba(0,0,0,0.22))]" />
          <div className="absolute bottom-4 left-4 rounded-[4px] border border-white/15 bg-black/35 px-2 py-1 text-label-sm font-semibold uppercase tracking-[0.08em] text-white/75">
            Program monitor
          </div>
          <div className="absolute bottom-4 right-4 rounded-[4px] border border-white/15 bg-black/35 px-2 py-1 font-mono text-[10px] text-white/75">
            {selectedAsset?.title ?? project.previewTitle}
          </div>
          <div className="absolute inset-4 grid grid-cols-3 grid-rows-3 border border-outline/30 opacity-0 transition-opacity hover:opacity-100">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`${index % 3 !== 2 ? "border-r border-outline/30" : ""} ${
                  index < 6 ? "border-b border-outline/30" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-outline-variant bg-surface px-2 lg:px-3 2xl:h-16 2xl:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-[4px] border border-outline-variant bg-surface-container-high px-2 py-1 font-mono text-label-md font-semibold tracking-widest text-primary">
            {displayTime}
          </span>
          <span className="hidden truncate text-label-md text-on-surface-variant 2xl:block">/ {project.duration}</span>
        </div>

        <div className="flex items-center justify-center gap-1 lg:gap-1.5 2xl:gap-3">
          <EditorIconButton
            icon="skip_previous"
            label="Previous"
            className="hidden h-8 w-8 lg:flex"
            onClick={() => dispatch(currentTimeChanged(0))}
          />
          <EditorIconButton
            icon="fast_rewind"
            label="Rewind"
            className="h-8 w-8"
            onClick={() => dispatch(playbackStepChanged(-5))}
          />
          <button
            type="button"
            onClick={() => dispatch(playbackToggled())}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-opacity hover:opacity-90"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <EditorIcon filled>{isPlaying ? "pause" : "play_arrow"}</EditorIcon>
          </button>
          <EditorIconButton
            icon="fast_forward"
            label="Forward"
            className="h-8 w-8"
            onClick={() => dispatch(playbackStepChanged(5))}
          />
          <EditorIconButton
            icon="skip_next"
            label="Next"
            className="hidden h-8 w-8 lg:flex"
            onClick={() => dispatch(currentTimeChanged(300))}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <EditorIconButton
            icon={isMuted ? "volume_off" : "volume_up"}
            label={isMuted ? "Unmute" : "Mute"}
            active={isMuted}
            className="hidden h-8 w-8 lg:flex"
            onClick={() => dispatch(muteToggled())}
          />
          <EditorIconButton
            icon="fullscreen"
            label="Fullscreen"
            className="h-8 w-8"
            onClick={() => dispatch(modalOpened("fullscreen"))}
          />
        </div>
      </div>
    </main>
  );
}

function formatTimecode(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `00:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}:00`;
}
