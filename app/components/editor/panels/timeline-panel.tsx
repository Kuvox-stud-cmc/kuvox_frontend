import { useCallback, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";

import {
  buildSplitOperation,
  buildTrimPlan,
  createItemLayouts,
  createTrackLayouts,
  expandLinkedItemIds,
  findCompatibleTrack,
  hitTestTimeline,
  marqueeSelectItems,
  pixelToTime,
  planMediaDrop,
  roundTime,
  selectRangeWithinTrack,
  snapTime,
  timelineDuration,
  timelineScale,
  timeToPixel,
  type DropPlacement,
  type MarqueeRect,
  type TimelineItemLayout,
} from "~/lib/editor/editor-timeline";
import { createVideoOperationBatch, type VideoOperation, type VideoOperationMetadata } from "~/lib/editor/video-operations";
import type { VideoTimelineItem, VideoTrack } from "~/lib/editor/video-document";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  activeToolChanged,
  clipsLinkedToggled,
  currentTimeChanged,
  selectActiveToolId,
  selectCurrentTimeSeconds,
  selectSelectedItemIds,
  selectTimelinePanelState,
  selectVideoDocument,
  snappingToggled,
  timelineHeightChanged,
  timelineItemsSelected,
  timelineOpenChanged,
  timelineScrollChanged,
  timelineSelectionCleared,
  timelineZoomChanged,
  toastShown,
  trackSoloToggled,
  videoOperationApplied,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton } from "../editor-ui";
import { useDragResize } from "../use-drag-resize";

type TimelinePanelProps = {
  onMediaDrop?: (mediaId: string, placement?: DropPlacement) => void;
};

type DragState =
  | {
      kind: "move";
      pointerId: number;
      startX: number;
      startY: number;
      initialItems: Array<{ item: VideoTimelineItem; trackId: string }>;
      activeItemId: string;
    }
  | {
      kind: "trim";
      pointerId: number;
      item: VideoTimelineItem;
      edge: "start" | "end";
    }
  | {
      kind: "marquee";
      pointerId: number;
      originX: number;
      originY: number;
    };

type DragPreview =
  | {
      kind: "move";
      itemIds: string[];
      deltaTime: number;
      targetTrackId?: string;
    }
  | {
      kind: "trim";
      itemId: string;
      timelineStart: number;
      duration: number;
    }
  | {
      kind: "marquee";
      rect: MarqueeRect;
    };

const clipToneClass: Record<VideoTimelineItem["type"], string> = {
  video: "border-secondary/70 bg-secondary-container/85 text-on-secondary",
  audio: "border-outline/80 bg-surface-container-high text-on-surface",
  text: "border-tertiary/80 bg-tertiary-container/85 text-on-tertiary",
  image: "border-primary/70 bg-primary-container/85 text-on-primary-container",
  overlay: "border-primary/70 bg-primary-container/80 text-on-primary-container",
};

export function TimelinePanel({ onMediaDrop }: TimelinePanelProps) {
  const dispatch = useAppDispatch();
  const document = useAppSelector(selectVideoDocument);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const activeToolId = useAppSelector(selectActiveToolId);
  const {
    open: timelineOpen,
    height: timelineHeight,
    zoom: timelineZoom,
    snappingEnabled,
    clipsLinked,
    soloedAudioTrackIds,
  } = useAppSelector(selectTimelinePanelState);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dropPlan, setDropPlan] = useState<{ trackId?: string; valid: boolean; x: number; y: number; reason?: string } | null>(null);
  const scale = useMemo(() => timelineScale(timelineZoom), [timelineZoom]);
  const trackLayouts = useMemo(() => document ? createTrackLayouts(document) : [], [document]);
  const itemLayouts = useMemo(() => document ? createItemLayouts(document, scale) : [], [document, scale]);
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const trackHeight = trackLayouts.reduce((height, track) => height + track.height, 0);
  const duration = document ? timelineDuration(document) : 60;
  const contentWidth = Math.max(900, timeToPixel(duration, scale));
  const playheadLeft = timeToPixel(currentTime, scale);
  const handleResizeStart = useDragResize({
    axis: "y",
    value: timelineHeight,
    min: 180,
    max: 420,
    direction: "reverse",
    onChange: (value) => dispatch(timelineHeightChanged(value)),
  });

  const localPoint = useCallback((event: PointerEvent) => {
    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const operationMetadata = useCallback((id: string, label: string, affectedEntityIds: string[]): VideoOperationMetadata => {
    const timestamp = new Date().toISOString();
    return {
      id: `${id}-${timestamp.replace(/[-:.TZ]/g, "")}`,
      source: "manual",
      timestamp,
      label,
      affectedEntityIds,
    };
  }, []);

  const commitOperations = useCallback((label: string, operations: VideoOperation[]) => {
    if (operations.length === 0) return;
    dispatch(videoOperationApplied(createVideoOperationBatch({
      source: "manual",
      label,
      operations,
      affectedEntityIds: Array.from(new Set(operations.flatMap((operation) => operation.affectedEntityIds))),
    })));
  }, [dispatch]);

  const selectItem = useCallback((itemId: string, event: PointerEvent) => {
    if (!document) return;
    if (event.shiftKey) {
      dispatch(timelineItemsSelected({
        itemIds: selectRangeWithinTrack(document, selectedItemIds[0], itemId),
        activeItemId: itemId,
      }));
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      dispatch(timelineItemsSelected({ itemIds: [itemId], activeItemId: itemId, mode: "toggle" }));
      return;
    }

    if (!selectedItemIdSet.has(itemId)) {
      dispatch(timelineItemsSelected({ itemIds: [itemId], activeItemId: itemId }));
    }
  }, [dispatch, document, selectedItemIdSet, selectedItemIds]);

  const splitAtPlayhead = useCallback((items: VideoTimelineItem[]) => {
    if (!document) return;
    const operations = items
      .filter((item) => currentTime > item.timelineStart && currentTime < item.timelineStart + item.duration)
      .map((item) => buildSplitOperation({
        item,
        playheadTime: currentTime,
        frameRate: document.settings.frameRate,
        metadata: operationMetadata("split-item", "Split clip", [item.id]),
      }))
      .filter((operation): operation is NonNullable<typeof operation> => operation !== null);

    if (operations.length === 0) {
      dispatch(toastShown("Move the playhead inside a selected clip to split"));
      return;
    }

    commitOperations("Split clips", operations);
  }, [commitOperations, currentTime, dispatch, document, operationMetadata]);

  const deleteSelected = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    const itemIds = expandLinkedItemIds(document, selectedItemIds, clipsLinked);
    const editableItemIds = itemIds.filter((itemId) => {
      const track = trackForItem(document, itemId);
      return track && !track.locked;
    });
    if (editableItemIds.length === 0) {
      dispatch(toastShown("Selected clips are locked"));
      return;
    }

    dispatch(videoOperationApplied({
      ...operationMetadata("delete-items", "Delete clips", editableItemIds),
      type: "deleteItem",
      itemIds: editableItemIds,
    }));
  }, [clipsLinked, dispatch, document, operationMetadata, selectedItemIds]);

  if (!timelineOpen) {
    return (
      <footer className="z-40 flex h-10 shrink-0 items-center justify-center border-t border-outline-variant bg-surface">
        <button
          type="button"
          onClick={() => dispatch(timelineOpenChanged(true))}
          className="flex h-8 items-center gap-2 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
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
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          dispatch(timelineSelectionCleared());
          setDragPreview(null);
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          deleteSelected();
        }
        if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) {
          splitAtPlayhead(selectedItems(document, selectedItemIds));
        }
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Resize timeline"
        onPointerDown={handleResizeStart}
        className="absolute left-0 top-[-3px] z-50 h-1.5 w-full cursor-row-resize bg-transparent transition-colors hover:bg-primary/40"
      />
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-3">
        <div className="flex items-center gap-2">
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
          <EditorIconButton
            icon="content_cut"
            label="Split at playhead"
            active={activeToolId === "split"}
            className="h-7 w-7"
            onClick={() => {
              dispatch(activeToolChanged(activeToolId === "split" ? "select" : "split"));
              splitAtPlayhead(selectedItems(document, selectedItemIds));
            }}
          />
          <EditorIconButton
            icon="delete"
            label="Delete selected"
            className="h-7 w-7"
            onClick={deleteSelected}
          />
          <div className="mx-1 h-4 w-px bg-outline-variant" />
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
            <span className="text-label-sm font-semibold uppercase text-on-surface-variant">Timecode</span>
          </div>
          {trackLayouts.map(({ track, height }) => (
            <TrackHeader
              key={track.id}
              track={track}
              height={height}
              soloed={soloedAudioTrackIds.includes(track.id)}
              onUpdate={(fields) => {
                dispatch(videoOperationApplied({
                  ...operationMetadata("update-track", "Update track", [track.id]),
                  type: "updateTrack",
                  trackId: track.id,
                  ...fields,
                }));
              }}
              onSolo={() => dispatch(trackSoloToggled(track.id))}
            />
          ))}
        </div>

        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto bg-surface-container-lowest"
          onScroll={(event) => dispatch(timelineScrollChanged({
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          }))}
          onDragOver={(event) => {
            if (!document || !Array.from(event.dataTransfer.types).includes("application/x-kuvox-media-id")) return;
            event.preventDefault();
            const point = pointFromDragEvent(event, trackAreaRef.current);
            if (!point) return;
            const mediaId = event.dataTransfer.getData("application/x-kuvox-media-id");
            const mediaKind = event.dataTransfer.getData("application/x-kuvox-media-kind");
            const hit = hitTestTimeline(point.x, point.y, trackLayouts, itemLayouts);
            const media = mediaId && mediaKind ? ({ id: mediaId, kind: mediaKind } as never) : null;
            const plan = media
              ? planMediaDrop({
                  document,
                  media,
                  trackId: hit.trackId,
                  timelineStart: pixelToTime(point.x, scale),
                })
              : { ok: false as const, reason: "Unknown media" };
            setDropPlan({
              trackId: hit.trackId ?? undefined,
              valid: plan.ok,
              x: point.x,
              y: point.y,
              reason: plan.ok ? undefined : plan.reason,
            });
            event.dataTransfer.dropEffect = plan.ok ? "copy" : "none";
          }}
          onDragLeave={() => setDropPlan(null)}
          onDrop={(event) => {
            if (!document) return;
            const mediaId = event.dataTransfer.getData("application/x-kuvox-media-id");
            if (!mediaId) return;
            event.preventDefault();
            const point = pointFromDragEvent(event, trackAreaRef.current);
            if (!point) return;
            const hit = hitTestTimeline(point.x, point.y, trackLayouts, itemLayouts);
            const placement = {
              trackId: hit.trackId ?? undefined,
              timelineStart: snapTime({
                time: pixelToTime(point.x, scale),
                document,
                playheadTime: currentTime,
                enabled: snappingEnabled,
                scale,
              }).time,
            };
            onMediaDrop?.(mediaId, placement.trackId ? placement as DropPlacement : undefined);
            setDropPlan(null);
          }}
        >
          <div
            className="sticky top-0 z-20 h-8 border-b border-outline-variant bg-surface-container"
            style={{ width: contentWidth }}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              dispatch(currentTimeChanged(pixelToTime(event.clientX - rect.left, scale)));
            }}
          >
            <Ruler duration={duration} scale={scale} />
          </div>

          <div
            ref={trackAreaRef}
            className={`relative ${activeToolId === "trim" ? "cursor-default" : activeToolId === "split" ? "cursor-crosshair" : ""}`}
            style={{ height: trackHeight, width: contentWidth }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              if (activeToolId !== "select") return;
              const point = localPoint(event);
              if (!point) return;
              dragState.current = {
                kind: "marquee",
                pointerId: event.pointerId,
                originX: point.x,
                originY: point.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              dispatch(timelineSelectionCleared());
            }}
            onPointerMove={(event) => {
              const state = dragState.current;
              if (!state) return;
              const point = localPoint(event);
              if (!point) return;
              if (state.kind === "marquee") {
                setDragPreview({
                  kind: "marquee",
                  rect: {
                    left: state.originX,
                    top: state.originY,
                    width: point.x - state.originX,
                    height: point.y - state.originY,
                  },
                });
              }
              if (state.kind === "move" && document) {
                const deltaTime = (point.x - state.startX) / scale.pixelsPerSecond;
                const hit = hitTestTimeline(point.x, point.y, trackLayouts, itemLayouts);
                setDragPreview({
                  kind: "move",
                  itemIds: state.initialItems.map(({ item }) => item.id),
                  deltaTime,
                  targetTrackId: hit.trackId ?? undefined,
                });
              }
              if (state.kind === "trim" && document) {
                const trim = buildTrimPlan({
                  item: state.item,
                  edge: state.edge,
                  pointerTime: snapTime({
                    time: pixelToTime(point.x, scale),
                    document,
                    playheadTime: currentTime,
                    enabled: snappingEnabled,
                    scale,
                    excludeItemIds: [state.item.id],
                  }).time,
                  frameRate: document.settings.frameRate,
                  mediaDuration: mediaDurationForItem(document, state.item),
                });
                if (trim) {
                  setDragPreview({
                    kind: "trim",
                    itemId: state.item.id,
                    timelineStart: trim.operation.timelineStart,
                    duration: trim.operation.duration,
                  });
                }
              }
            }}
            onPointerUp={(event) => {
              const state = dragState.current;
              dragState.current = null;
              const point = localPoint(event);
              if (!state || !point || !document) {
                setDragPreview(null);
                return;
              }

              if (state.kind === "marquee" && dragPreview?.kind === "marquee") {
                const itemIds = marqueeSelectItems(itemLayouts, dragPreview.rect);
                dispatch(timelineItemsSelected({ itemIds }));
              }

              if (state.kind === "move") {
                const rawDelta = (point.x - state.startX) / scale.pixelsPerSecond;
                const hit = hitTestTimeline(point.x, point.y, trackLayouts, itemLayouts);
                const activeInitial = state.initialItems.find(({ item }) => item.id === state.activeItemId);
                const snappedStart = activeInitial
                  ? snapTime({
                      time: activeInitial.item.timelineStart + rawDelta,
                      document,
                      playheadTime: currentTime,
                      enabled: snappingEnabled,
                      scale,
                      excludeItemIds: state.initialItems.map(({ item }) => item.id),
                    }).time
                  : rawDelta;
                const deltaTime = activeInitial ? snappedStart - activeInitial.item.timelineStart : rawDelta;
                const operations = state.initialItems.flatMap(({ item, trackId }) => {
                  const currentTrack = document.tracks.find((track) => track.id === trackId);
                  if (!currentTrack || currentTrack.locked) return [];
                  const targetTrack = item.id === state.activeItemId && hit.trackId
                    ? findCompatibleTrack(document, item.type, hit.trackId)
                    : currentTrack;
                  if (!targetTrack || targetTrack.locked) return [];
                  return [{
                    ...operationMetadata("move-item", "Move clip", [item.id]),
                    type: "moveItem" as const,
                    itemId: item.id,
                    timelineStart: roundTime(Math.max(0, item.timelineStart + deltaTime)),
                    targetTrackId: targetTrack.id,
                  }];
                });
                commitOperations("Move clips", operations);
              }

              if (state.kind === "trim") {
                const trim = buildTrimPlan({
                  item: state.item,
                  edge: state.edge,
                  pointerTime: snapTime({
                    time: pixelToTime(point.x, scale),
                    document,
                    playheadTime: currentTime,
                    enabled: snappingEnabled,
                    scale,
                    excludeItemIds: [state.item.id],
                  }).time,
                  frameRate: document.settings.frameRate,
                  mediaDuration: mediaDurationForItem(document, state.item),
                });
                if (trim) {
                  dispatch(videoOperationApplied({
                    ...operationMetadata("trim-item", "Trim clip", [state.item.id]),
                    ...trim.operation,
                  }));
                }
              }

              setDragPreview(null);
            }}
          >
            {trackLayouts.map((layout) => (
              <div
                key={layout.track.id}
                className={`absolute left-0 w-full border-b border-outline-variant bg-[linear-gradient(to_right,rgba(70,69,84,0.22)_1px,transparent_1px)] ${layout.hidden ? "opacity-45" : ""}`}
                style={{
                  top: layout.top,
                  height: layout.height,
                  backgroundSize: `${scale.pixelsPerSecond}px 100%`,
                }}
              />
            ))}
            {itemLayouts.map((layout) => (
              <TimelineItemBlock
                key={layout.item.id}
                layout={previewLayout(layout, dragPreview, scale)}
                selected={selectedItemIdSet.has(layout.item.id)}
                linked={"linkedGroupId" in layout.item && Boolean(layout.item.linkedGroupId)}
                activeToolId={activeToolId}
                onPointerDown={(event, edge) => {
                  event.stopPropagation();
                  if (!document) return;
                  selectItem(layout.item.id, event);
                  const itemIds = expandLinkedItemIds(
                    document,
                    selectedItemIdSet.has(layout.item.id) ? selectedItemIds : [layout.item.id],
                    clipsLinked,
                  );
                  const initialItems = itemIds.flatMap((itemId) => {
                    const track = trackForItem(document, itemId);
                    const item = track?.items.find((candidate) => candidate.id === itemId);
                    return track && item ? [{ item, trackId: track.id }] : [];
                  });

                  if (activeToolId === "split") {
                    splitAtPlayhead(initialItems.map(({ item }) => item));
                    return;
                  }

                  if (edge && activeToolId === "trim") {
                    dragState.current = {
                      kind: "trim",
                      pointerId: event.pointerId,
                      item: layout.item,
                      edge,
                    };
                  } else if (activeToolId === "select") {
                    dragState.current = {
                      kind: "move",
                      pointerId: event.pointerId,
                      startX: localPoint(event)?.x ?? 0,
                      startY: localPoint(event)?.y ?? 0,
                      initialItems,
                      activeItemId: layout.item.id,
                    };
                  } else {
                    return;
                  }
                  trackAreaRef.current?.setPointerCapture(event.pointerId);
                }}
              />
            ))}
            <button
              type="button"
              className="absolute top-0 z-30 h-full w-px bg-primary"
              style={{ left: playheadLeft }}
              aria-label="Playhead"
              onPointerDown={(event) => {
                event.stopPropagation();
                const target = event.currentTarget.parentElement;
                target?.setPointerCapture(event.pointerId);
              }}
            >
              <span className="absolute top-0 block h-3 w-3 -translate-x-[5px] -translate-y-1/2 rotate-45 rounded-sm bg-primary" />
            </button>
            {dragPreview?.kind === "marquee" ? <Marquee rect={dragPreview.rect} /> : null}
            {dropPlan ? (
              <div
                className={`pointer-events-none absolute z-20 h-8 w-px ${dropPlan.valid ? "bg-primary" : "bg-error"}`}
                style={{ left: dropPlan.x, top: Math.max(0, dropPlan.y - 16) }}
                title={dropPlan.reason}
              />
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrackHeader({
  track,
  height,
  soloed,
  onUpdate,
  onSolo,
}: {
  track: VideoTrack;
  height: number;
  soloed: boolean;
  onUpdate: (fields: { locked?: boolean; hidden?: boolean; muted?: boolean }) => void;
  onSolo: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between border-b border-outline-variant px-3 transition-colors hover:bg-surface-container-high ${track.hidden ? "opacity-55" : ""}`}
      style={{ height }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <EditorIcon className="text-[16px] text-on-surface-variant">{trackIcon(track.kind)}</EditorIcon>
        <span className="truncate text-label-md font-semibold text-on-surface">{track.label}</span>
      </div>
      <div className="flex shrink-0 gap-1 opacity-100 transition-opacity xl:opacity-0 xl:group-hover:opacity-100">
        {track.kind === "audio" ? (
          <SmallIconButton icon="headphones" label={`Solo ${track.label}`} active={soloed} onClick={onSolo} />
        ) : null}
        {track.kind === "audio" ? (
          <SmallIconButton icon={track.muted ? "volume_off" : "volume_up"} label={`Mute ${track.label}`} active={track.muted} onClick={() => onUpdate({ muted: !track.muted })} />
        ) : (
          <SmallIconButton icon={track.hidden ? "visibility_off" : "visibility"} label={`Toggle ${track.label} visibility`} active={track.hidden} onClick={() => onUpdate({ hidden: !track.hidden })} />
        )}
        <SmallIconButton icon={track.locked ? "lock" : "lock_open"} label={`Toggle ${track.label} lock`} active={track.locked} onClick={() => onUpdate({ locked: !track.locked })} />
      </div>
    </div>
  );
}

function SmallIconButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex h-5 w-5 items-center justify-center rounded-[3px] transition-colors hover:bg-surface-container-highest ${active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <EditorIcon className="text-[14px]">{icon}</EditorIcon>
    </button>
  );
}

function Ruler({ duration, scale }: { duration: number; scale: ReturnType<typeof timelineScale> }) {
  const majorStep = scale.pixelsPerSecond >= 40 ? 1 : scale.pixelsPerSecond >= 16 ? 5 : 10;
  const ticks = [];
  for (let time = 0; time <= duration; time += majorStep) {
    ticks.push(time);
  }
  return (
    <div
      className="relative h-full"
      style={{
        backgroundImage: "repeating-linear-gradient(to right, transparent, transparent calc(100% - 1px), rgba(70,69,84,0.7) calc(100% - 1px), rgba(70,69,84,0.7) 100%)",
        backgroundSize: `${scale.pixelsPerSecond}px 8px`,
        backgroundRepeat: "repeat-x",
        backgroundPosition: "0 bottom",
      }}
    >
      {ticks.map((time) => (
        <span
          key={time}
          className="absolute top-1 -translate-x-1/2 font-mono text-[10px] text-on-surface-variant"
          style={{ left: timeToPixel(time, scale) }}
        >
          {formatTimelineTime(time)}
        </span>
      ))}
    </div>
  );
}

function TimelineItemBlock({
  layout,
  selected,
  linked,
  activeToolId,
  onPointerDown,
}: {
  layout: TimelineItemLayout;
  selected: boolean;
  linked: boolean;
  activeToolId: ReturnType<typeof selectActiveToolId>;
  onPointerDown: (event: PointerEvent<HTMLElement>, edge: "start" | "end" | null) => void;
}) {
  const item = layout.item;
  const trimActive = activeToolId === "trim";
  const cursorClass = activeToolId === "split" ? "cursor-crosshair" : activeToolId === "trim" ? "cursor-default" : "cursor-grab active:cursor-grabbing";
  return (
    <button
      type="button"
      className={`absolute z-10 overflow-hidden rounded-[4px] border px-2 text-left text-[10px] font-mono transition-shadow hover:brightness-110 ${cursorClass} ${clipToneClass[item.type]} ${selected ? "ring-2 ring-primary" : ""}`}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }}
      onPointerDown={(event) => onPointerDown(event, null)}
      title={itemLabel(item)}
    >
      <span
        className={`absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-on-surface/10 transition-opacity ${trimActive ? "opacity-70 hover:opacity-100" : "opacity-0"}`}
        onPointerDown={(event) => onPointerDown(event, "start")}
      />
      <span
        className={`absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-on-surface/10 transition-opacity ${trimActive ? "opacity-70 hover:opacity-100" : "opacity-0"}`}
        onPointerDown={(event) => onPointerDown(event, "end")}
      />
      {item.type === "audio" ? (
        <span
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "repeating-linear-gradient(to right, #908fa0, #908fa0 2px, transparent 2px, transparent 5px)",
            backgroundPosition: "center",
            backgroundSize: "5px 60%",
            backgroundRepeat: "repeat-x",
          }}
        />
      ) : null}
      {linked ? <EditorIcon className="absolute right-1 top-1 text-[12px] opacity-80">link</EditorIcon> : null}
      <span className="relative block truncate pr-3">{itemLabel(item)}</span>
    </button>
  );
}

function Marquee({ rect }: { rect: MarqueeRect }) {
  const left = rect.width < 0 ? rect.left + rect.width : rect.left;
  const top = rect.height < 0 ? rect.top + rect.height : rect.top;
  return (
    <div
      className="pointer-events-none absolute z-40 border border-primary bg-primary/15"
      style={{
        left,
        top,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
      }}
    />
  );
}

function previewLayout(
  layout: TimelineItemLayout,
  preview: DragPreview | null,
  scale: ReturnType<typeof timelineScale>,
): TimelineItemLayout {
  if (!preview) return layout;
  if (preview.kind === "move" && preview.itemIds.includes(layout.item.id)) {
    return {
      ...layout,
      left: Math.max(0, layout.left + timeToPixel(preview.deltaTime, scale)),
    };
  }
  if (preview.kind === "trim" && preview.itemId === layout.item.id) {
    return {
      ...layout,
      left: timeToPixel(preview.timelineStart, scale),
      width: Math.max(18, timeToPixel(preview.duration, scale)),
    };
  }
  return layout;
}

function selectedItems(document: ReturnType<typeof selectVideoDocument>, selectedItemIds: string[]): VideoTimelineItem[] {
  if (!document) return [];
  return selectedItemIds.flatMap((itemId) => {
    const track = trackForItem(document, itemId);
    const item = track?.items.find((candidate) => candidate.id === itemId);
    return item ? [item] : [];
  });
}

function trackForItem(document: NonNullable<ReturnType<typeof selectVideoDocument>>, itemId: string): VideoTrack | undefined {
  return document.tracks.find((track) => track.items.some((item) => item.id === itemId));
}

function mediaDurationForItem(document: NonNullable<ReturnType<typeof selectVideoDocument>>, item: VideoTimelineItem): number | undefined {
  if (!("mediaId" in item)) return undefined;
  return document.media[item.mediaId]?.duration;
}

function pointFromDragEvent(
  event: DragEvent,
  trackArea: HTMLDivElement | null,
): { x: number; y: number } | null {
  const rect = trackArea?.getBoundingClientRect();
  if (!rect) return null;
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function itemLabel(item: VideoTimelineItem): string {
  if (item.type === "text") return item.text;
  return item.mediaId;
}

function trackIcon(kind: VideoTrack["kind"]): string {
  if (kind === "audio") return "graphic_eq";
  if (kind === "text") return "subtitles";
  if (kind === "overlay") return "filter";
  return "video_camera_front";
}

function formatTimelineTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
