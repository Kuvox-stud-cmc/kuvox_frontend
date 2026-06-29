import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  clipsLinkedToggled,
  clipSelected,
  operationAdded,
  snappingToggled,
  timelineHeightChanged,
  timelineOpenChanged,
  timelineZoomChanged,
  toastShown,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton } from "../editor-ui";
import type { TimelineClipMock, TimelineTrackMock } from "../mock-editor-data";
import { useDragResize } from "../use-drag-resize";

interface TimelinePanelProps {
  tracks: TimelineTrackMock[];
}

const clipToneClass: Record<TimelineClipMock["tone"], string> = {
  video: "border-secondary/70 bg-secondary-container/85 text-on-secondary",
  audio: "border-outline/80 bg-surface-container-high text-on-surface",
  text: "border-tertiary/80 bg-tertiary-container/85 text-on-tertiary",
};

/**
 * Manual editing surface — the conventional timeline where shots/operations are
 * arranged. Reads from the editor slice. Stub for now.
 */
export function TimelinePanel({ tracks = [] }: Partial<TimelinePanelProps>) {
  const dispatch = useAppDispatch();
  const selectedClipId = useAppSelector((state) => state.editor.selectedClipId);
  const timelineOpen = useAppSelector((state) => state.editor.timelineOpen);
  const timelineHeight = useAppSelector((state) => state.editor.timelineHeight);
  const timelineZoom = useAppSelector((state) => state.editor.timelineZoom);
  const snappingEnabled = useAppSelector((state) => state.editor.snappingEnabled);
  const clipsLinked = useAppSelector((state) => state.editor.clipsLinked);
  const trackHeight = tracks.reduce((height, track) => height + track.height, 0);
  const handleResizeStart = useDragResize({
    axis: "y",
    value: timelineHeight,
    min: 180,
    max: 420,
    direction: "reverse",
    onChange: (value) => dispatch(timelineHeightChanged(value)),
  });

  if (!timelineOpen) {
    return (
      <footer className="z-40 flex h-10 shrink-0 items-center justify-center border-t border-outline-variant bg-surface">
        <button
          type="button"
          onClick={() => dispatch(timelineOpenChanged(true))}
          className="flex h-8 items-center gap-2 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <EditorIcon className="text-[18px]">keyboard_arrow_up</EditorIcon>
          Timeline
        </button>
      </footer>
    );
  }

  return (
    <footer
      className="relative z-40 flex shrink-0 flex-col border-t border-outline-variant bg-surface"
      style={{ height: timelineHeight }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Resize timeline"
        onPointerDown={handleResizeStart}
        className="absolute left-0 top-[-3px] z-50 h-1.5 w-full cursor-row-resize bg-transparent transition-colors hover:bg-primary/40"
      />
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-3">
        <div className="flex items-center gap-3">
          <EditorIconButton
            icon="nest_cam_magnet_mount"
            label={snappingEnabled ? "Disable snapping" : "Enable snapping"}
            active={snappingEnabled}
            className="h-7 w-7"
            onClick={() => dispatch(snappingToggled())}
          />
          <EditorIconButton
            icon={clipsLinked ? "link" : "link_off"}
            label={clipsLinked ? "Unlink clips" : "Link clips"}
            active={clipsLinked}
            className="h-7 w-7"
            onClick={() => dispatch(clipsLinkedToggled())}
          />
          <div className="mx-1 h-4 w-px bg-outline-variant" />
          <EditorIconButton
            icon="add_box"
            label="Add track"
            className="h-7 w-7"
            onClick={() =>
              dispatch(
                operationAdded({
                  id: `mock-track-${Date.now()}`,
                  type: "add-track",
                  shotId: "timeline",
                }),
              )
            }
          />
          <EditorIconButton
            icon="keyboard_arrow_down"
            label="Hide timeline"
            className="h-7 w-7"
            onClick={() => dispatch(timelineOpenChanged(false))}
          />
        </div>
        <label className="flex items-center gap-2">
          <EditorIcon className="text-[16px] text-on-surface-variant">zoom_out</EditorIcon>
          <input
            className="h-1 w-32 cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-primary"
            min={1}
            max={100}
            type="range"
            value={timelineZoom}
            onChange={(event) => dispatch(timelineZoomChanged(Number(event.target.value)))}
            aria-label="Timeline zoom"
          />
          <EditorIcon className="text-[16px] text-on-surface-variant">zoom_in</EditorIcon>
        </label>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="z-10 flex w-36 shrink-0 flex-col border-r border-outline-variant bg-surface-container xl:w-40 2xl:w-44">
          <div className="flex h-8 items-center border-b border-outline-variant px-2">
            <span className="text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Timecode
            </span>
          </div>
          {tracks.map((track) => (
            <div
              key={track.id}
              className="group flex items-center justify-between border-b border-outline-variant px-3 transition-colors hover:bg-surface-container-high"
              style={{ height: track.height }}
            >
              <div className="flex items-center gap-2">
                <EditorIcon className="text-[16px] text-on-surface-variant">{track.icon}</EditorIcon>
                <span className="text-label-md font-semibold text-on-surface">{track.label}</span>
              </div>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-[3px] text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                  aria-label={`Toggle ${track.label} visibility`}
                  onClick={() => dispatch(toastShown(`${track.label} visibility toggled`))}
                >
                  <EditorIcon className="text-[14px]">visibility</EditorIcon>
                </button>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-[3px] text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                  aria-label={`Toggle ${track.label} lock`}
                  onClick={() => dispatch(toastShown(`${track.label} lock toggled`))}
                >
                  <EditorIcon className="text-[14px]">lock_open</EditorIcon>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-x-auto bg-surface-container-lowest">
          <div className="sticky top-0 z-10 h-8 border-b border-outline-variant bg-surface-container">
            <div
              className="relative h-full min-w-[760px] xl:min-w-[920px] 2xl:min-w-[1000px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, transparent, transparent 49px, #464554 49px, #464554 50px)",
                backgroundPosition: "0 bottom",
                backgroundSize: "50px 8px",
                backgroundRepeat: "repeat-x",
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((tick) => (
                <span
                  key={tick}
                  className="absolute top-1 text-[10px] text-on-surface-variant -translate-x-1/2"
                  style={{ left: tick * 100 }}
                >
                  00:0{tick}
                </span>
              ))}
            </div>
          </div>

          <div
            className="relative min-w-[760px] xl:min-w-[920px] 2xl:min-w-[1000px]"
            style={{ height: trackHeight }}
          >
            {tracks.map((track, trackIndex) => {
              const top = tracks
                .slice(0, trackIndex)
                .reduce((height, item) => height + item.height, 0);
              return (
                <div
                  key={track.id}
                  className="absolute left-0 w-full border-b border-outline-variant bg-[linear-gradient(to_right,rgba(70,69,84,0.22)_1px,transparent_1px)] bg-[length:50px_100%]"
                  style={{ top, height: track.height }}
                >
                  {track.clips.map((clip) => (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => dispatch(clipSelected(clip.id))}
                      className={`absolute top-1 overflow-hidden rounded-[4px] border px-2 text-left text-[10px] font-mono transition-shadow hover:brightness-110 ${
                        clipToneClass[clip.tone]
                      } ${selectedClipId === clip.id ? "ring-1 ring-primary" : ""}`}
                      style={{
                        left: clip.start,
                        width: clip.width,
                        height: Math.max(track.height - 10, 36),
                      }}
                    >
                      {clip.tone === "audio" ? (
                        <span
                          className="absolute inset-0 opacity-30"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(to right, #908fa0, #908fa0 2px, transparent 2px, transparent 5px)",
                            backgroundPosition: "center",
                            backgroundSize: "5px 60%",
                            backgroundRepeat: "repeat-x",
                          }}
                        />
                      ) : null}
                      <span className="relative block truncate">{clip.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            <div className="pointer-events-none absolute bottom-0 top-0 left-[180px] z-20 w-px bg-primary">
              <div className="absolute top-0 h-3 w-3 rounded-sm bg-primary rotate-45 -translate-x-[5px] -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
