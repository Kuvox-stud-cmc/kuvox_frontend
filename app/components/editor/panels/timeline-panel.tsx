import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { clipSelected, timelineZoomChanged } from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton } from "../editor-ui";
import type { TimelineClipMock, TimelineTrackMock } from "../mock-editor-data";

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
  const timelineZoom = useAppSelector((state) => state.editor.timelineZoom);
  const trackHeight = tracks.reduce((height, track) => height + track.height, 0);

  return (
    <footer className="z-40 flex h-[292px] shrink-0 flex-col border-t border-outline-variant bg-surface">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-3">
        <div className="flex items-center gap-3">
          <EditorIconButton icon="nest_cam_magnet_mount" label="Snapping on" active className="h-7 w-7" />
          <EditorIconButton icon="link" label="Link clips" className="h-7 w-7" />
          <div className="mx-1 h-4 w-px bg-outline-variant" />
          <EditorIconButton icon="add_box" label="Add track" className="h-7 w-7" />
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
        <div className="z-10 flex w-44 shrink-0 flex-col border-r border-outline-variant bg-surface-container">
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
                <EditorIcon className="text-[14px] text-on-surface-variant">visibility</EditorIcon>
                <EditorIcon className="text-[14px] text-on-surface-variant">lock_open</EditorIcon>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-x-auto bg-surface-container-lowest">
          <div className="sticky top-0 z-10 h-8 border-b border-outline-variant bg-surface-container">
            <div
              className="relative h-full min-w-[1000px]"
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

          <div className="relative min-w-[1000px]" style={{ height: trackHeight }}>
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
