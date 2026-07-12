import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { MediaKind } from "~/lib/api";

import {
  buildSplitOperation,
  buildTrimPlan,
  computeTimelineContentSize,
  createItemLayouts,
  createTimelineLayoutWindow,
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
  type TimelineViewport,
} from "~/lib/editor/editor-timeline";
import { createVideoOperationBatch, type VideoOperation, type VideoOperationMetadata } from "~/lib/editor/video-operations";
import {
  createVideoEditorPerformanceMetric,
  queueVideoEditorPerformanceMetric,
} from "~/lib/editor/video-performance.client";
import type { VideoMediaReference, VideoTimelineItem, VideoTrack, VideoTrackKind } from "~/lib/editor/video-document";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  activeToolChanged,
  clipsLinkedToggled,
  currentTimeChanged,
  mediaPreparationRetried,
  pendingTimelineInsertionRemoved,
  selectActiveToolId,
  selectCanUndo,
  selectCanRedo,
  selectCurrentTimeSeconds,
  selectProjectMediaAvailabilityById,
  selectMediaPreparationState,
  selectPendingTimelineInsertions,
  selectSelectedItemIds,
  selectTimelinePanelState,
  selectVideoDocument,
  selectedTextItemsDuplicated,
  snappingToggled,
  timelineHeightChanged,
  timelineItemsSelected,
  timelineOpenChanged,
  timelineScrollChanged,
  timelineSelectionCleared,
  timelineZoomChanged,
  toastShown,
  trackSoloToggled,
  trackAdded,
  trackDeleted,
  videoOperationApplied,
  videoUndoRequested,
  videoRedoRequested,
} from "~/store/slices/editor-slice";

import { EditorIcon, EditorIconButton } from "../editor-ui";
import { useDragResize } from "../use-drag-resize";

import { getActiveDraggedMedia } from "~/lib/editor/editor-media";

type TimelinePanelProps = {
  onMediaDrop?: (mediaId: string, placement?: DropPlacement) => void;
  className?: string;
};

type DragState =
  | {
      kind: "move";
      pointerId: number;
      startX: number;
      startY: number;
      startedAt: number;
      initialItems: Array<{ item: VideoTimelineItem; trackId: string }>;
      activeItemId: string;
    }
  | {
      kind: "trim";
      pointerId: number;
      startedAt: number;
      item: VideoTimelineItem;
      edge: "start" | "end";
    }
  | {
      kind: "marquee";
      pointerId: number;
      originX: number;
      originY: number;
      startedAt: number;
    }
  | {
      kind: "playhead";
      pointerId: number;
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

type DropPlanPreview = { trackId?: string; valid: boolean; x: number; y: number; reason?: string };

const clipToneClass: Record<VideoTimelineItem["type"], string> = {
  video: "border-secondary/70 bg-secondary-container/85 text-on-secondary",
  audio: "border-outline/80 bg-surface-container-high text-on-surface",
  text: "border-tertiary/80 bg-tertiary-container/85 text-on-tertiary",
  image: "border-primary/70 bg-primary-container/85 text-on-primary-container",
  overlay: "border-primary/70 bg-primary-container/80 text-on-primary-container",
};

export function TimelinePanel({ onMediaDrop, className = "" }: TimelinePanelProps) {
  const dispatch = useAppDispatch();
  const document = useAppSelector(selectVideoDocument);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const activeToolId = useAppSelector(selectActiveToolId);
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const projectMediaAvailabilityById = useAppSelector(selectProjectMediaAvailabilityById);
  const mediaPreparationByKey = useAppSelector(selectMediaPreparationState);
  const pendingInsertions = useAppSelector(selectPendingTimelineInsertions);
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
  const dragPreviewFrame = useRef<number | null>(null);
  const dropPlanFrame = useRef<number | null>(null);
  const pendingDragPreview = useRef<DragPreview | null>(null);
  const pendingDropPlan = useRef<DropPlanPreview | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dropPlan, setDropPlan] = useState<DropPlanPreview | null>(null);
  const [viewport, setViewport] = useState<TimelineViewport>({
    scrollLeft: 0,
    scrollTop: 0,
    width: 1,
    height: 1,
  });
  const [clipboard, setClipboard] = useState<VideoTimelineItem[] | null>(null);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [trackDropTargetId, setTrackDropTargetId] = useState<string | null>(null);

  const getDynamicTrackHeight = useCallback((kind: string) => {
    if (timelineHeight >= 220) {
      return kind === "text" ? 48 : 64;
    }

    if (kind === "text") {
      if (timelineHeight < 170) return 0;
      return 48 * (timelineHeight - 170) / 50;
    }

    if (kind === "audio") {
      if (timelineHeight < 120) return 0;
      if (timelineHeight >= 170) {
        return 50 + 14 * (timelineHeight - 170) / 50;
      }
      return 50 * (timelineHeight - 120) / 50;
    }

    // video/image/overlay track
    if (timelineHeight >= 170) {
      return 50 + 14 * (timelineHeight - 170) / 50;
    }
    return 48 + 2 * (timelineHeight - 120) / 50;
  }, [timelineHeight]);

  const scale = useMemo(() => timelineScale(timelineZoom), [timelineZoom]);

  const trackLayouts = useMemo(() => {
    if (!document) return [];
    let top = 12;
    const layouts = [];
    let visibleIndex = 0;
    for (const track of document.tracks) {
      const height = getDynamicTrackHeight(track.kind);
      if (height <= 0) continue;

      layouts.push({
        track,
        trackIndex: visibleIndex,
        top,
        height,
        hidden: track.hidden,
        locked: track.locked,
      });
      top += height;
      visibleIndex++;
    }
    return layouts;
  }, [document, getDynamicTrackHeight]);

  const itemLayouts = useMemo(() => {
    return trackLayouts.flatMap((trackLayout) =>
      trackLayout.track.items.map((item) => ({
        trackId: trackLayout.track.id,
        trackIndex: trackLayout.trackIndex,
        item,
        left: timeToPixel(item.timelineStart, scale),
        top: trackLayout.top + 5,
        width: Math.max(20, timeToPixel(item.duration, scale)),
        height: Math.max(16, trackLayout.height - 10),
      })),
    );
  }, [trackLayouts, scale]);

  const contentSize = useMemo(() => {
    if (!document) return { width: 960, height: 192 };
    const totalHeight = trackLayouts.reduce((sum, layout) => sum + layout.height, 0) + 16;
    const maxDur = trackLayouts.reduce((maxDur, layout) => {
      const trackDuration = layout.track.items.reduce(
        (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
        0,
      );
      return Math.max(maxDur, trackDuration);
    }, 0);
    return {
      width: Math.max(960, timeToPixel(maxDur, scale)),
      height: totalHeight,
    };
  }, [document, trackLayouts, scale]);

  const layoutWindow = useMemo(() => {
    return {
      windowed: false,
      trackLayouts,
      itemLayouts,
      renderedItemCount: itemLayouts.length,
      totalItemCount: itemLayouts.length,
      totalTrackCount: trackLayouts.length,
      contentSize,
    };
  }, [trackLayouts, itemLayouts, contentSize]);

  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  const duration = useMemo(() => {
    if (!document) return 60;
    const maxDur = trackLayouts.reduce((maxDur, layout) => {
      const trackDuration = layout.track.items.reduce(
        (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
        0,
      );
      return Math.max(maxDur, trackDuration);
    }, 0);
    return Math.max(60, maxDur);
  }, [document, trackLayouts]);

  const maxPlayheadTime = useMemo(() => {
    if (!document) return 0;
    return trackLayouts.reduce((maxDur, layout) => {
      const trackDuration = layout.track.items.reduce(
        (maxEnd, item) => Math.max(maxEnd, item.timelineStart + item.duration),
        0,
      );
      return Math.max(maxDur, trackDuration);
    }, 0);
  }, [document, trackLayouts]);
  const contentWidth = Math.max(960, timeToPixel(duration, scale), contentSize.width);
  const hasTimelineItems = itemLayouts.length > 0;
  const timelineTrackAreaHeight = contentSize.height;
  const playheadLeft = timeToPixel(currentTime, scale);
  const pendingLayouts = useMemo(() => {
    if (!document) return [];
    return pendingInsertions.flatMap((pending) => {
      const kind = pending.media.kind === MediaKind.Audio ? "audio" : pending.media.kind === MediaKind.Image ? "image" : "video";
      const track = findCompatibleTrack(document, kind, pending.trackId);
      const trackLayout = trackLayouts.find((layout) => layout.track.id === track?.id);
      if (!trackLayout) return [];
      return [{
        pending,
        left: timeToPixel(pending.timelineStart, scale),
        top: trackLayout.top + 3,
        width: Math.max(30, timeToPixel(pending.provisionalDuration, scale)),
        height: Math.max(24, trackLayout.height - 6),
      }];
    });
  }, [document, pendingInsertions, scale, trackLayouts]);
  const deletedMediaTimelineItemIds = useMemo(() => {
    if (!document) return [];

    return document.tracks.flatMap((track) => {
      if (track.locked) return [];

      return track.items.flatMap((item) => {
        if (!("mediaId" in item)) return [];
        return projectMediaAvailabilityById[item.mediaId]?.availability === "deleted" ? [item.id] : [];
      });
    });
  }, [document, projectMediaAvailabilityById]);
  const [trackHeadersWidth, setTrackHeadersWidth] = useState(200);
  const [addTrackDropdownOpen, setAddTrackDropdownOpen] = useState(false);

  const handleHeadersResizeStart = useDragResize({
    axis: "x",
    value: trackHeadersWidth,
    min: 150,
    max: 360,
    direction: "normal",
    onChange: (value) => setTrackHeadersWidth(value),
  });

  const handleResizeStart = useDragResize({
    axis: "y",
    value: timelineHeight,
    min: 120,
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

  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode) return undefined;

    const updateViewportSize = () => {
      setViewport((current) => ({
        ...current,
        scrollLeft: scrollNode.scrollLeft,
        scrollTop: scrollNode.scrollTop,
        width: Math.max(1, scrollNode.clientWidth),
        height: Math.max(1, scrollNode.clientHeight),
      }));
    };
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(scrollNode);
    updateViewportSize();

    return () => observer.disconnect();
  }, [timelineOpen]);

  useEffect(() => () => {
    if (dragPreviewFrame.current !== null) cancelAnimationFrame(dragPreviewFrame.current);
    if (dropPlanFrame.current !== null) cancelAnimationFrame(dropPlanFrame.current);
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
  }, []);

  const queueDragPreview = useCallback((preview: DragPreview | null) => {
    pendingDragPreview.current = preview;
    if (dragPreviewFrame.current !== null) return;
    dragPreviewFrame.current = requestAnimationFrame(() => {
      dragPreviewFrame.current = null;
      setDragPreview(pendingDragPreview.current);
    });
  }, []);

  const flushDragPreview = useCallback(() => {
    if (dragPreviewFrame.current !== null) {
      cancelAnimationFrame(dragPreviewFrame.current);
      dragPreviewFrame.current = null;
    }
    setDragPreview(pendingDragPreview.current);
    return pendingDragPreview.current;
  }, []);

  const clearDragPreview = useCallback(() => {
    pendingDragPreview.current = null;
    flushDragPreview();
  }, [flushDragPreview]);

  const queueDropPlan = useCallback((plan: DropPlanPreview | null) => {
    pendingDropPlan.current = plan;
    if (dropPlanFrame.current !== null) return;
    dropPlanFrame.current = requestAnimationFrame(() => {
      dropPlanFrame.current = null;
      setDropPlan(pendingDropPlan.current);
    });
  }, []);

  const flushDropPlan = useCallback(() => {
    if (dropPlanFrame.current !== null) {
      cancelAnimationFrame(dropPlanFrame.current);
      dropPlanFrame.current = null;
    }
    setDropPlan(pendingDropPlan.current);
    return pendingDropPlan.current;
  }, []);

  const clearDropPlan = useCallback(() => {
    pendingDropPlan.current = null;
    flushDropPlan();
  }, [flushDropPlan]);

  const scheduleScrollUpdate = useCallback((left: number, top: number, width: number, height: number) => {
    pendingScroll.current = { left, top };
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const next = pendingScroll.current;
      if (!next) return;
      setViewport((current) => ({
        ...current,
        scrollLeft: next.left,
        scrollTop: next.top,
        width,
        height,
      }));
      dispatch(timelineScrollChanged(next));
    });
  }, [dispatch]);

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

  const reorderTrack = useCallback((trackId: string, targetTrackId: string) => {
    if (!document || trackId === targetTrackId) return;
    const targetIndex = document.tracks.findIndex((track) => track.id === targetTrackId);
    if (targetIndex < 0) return;
    dispatch(videoOperationApplied({
      ...operationMetadata("reorder-track", "Reorder track", [trackId, targetTrackId]),
      type: "reorderTrack",
      trackId,
      targetIndex,
    }));
  }, [dispatch, document, operationMetadata]);

  useEffect(() => {
    if (!document || deletedMediaTimelineItemIds.length === 0) return;

    dispatch(videoOperationApplied({
      ...operationMetadata("remove-deleted-media", "Remove deleted media", deletedMediaTimelineItemIds),
      type: "deleteItem",
      itemIds: deletedMediaTimelineItemIds,
    }));
  }, [deletedMediaTimelineItemIds, dispatch, document, operationMetadata]);

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

  const cloneJson = useCallback(<T,>(value: T): T => JSON.parse(JSON.stringify(value)), []);

  const duplicateSelected = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    
    const itemsWithTracks: Array<{ item: VideoTimelineItem; track: VideoTrack }> = [];
    for (const itemId of selectedItemIds) {
      const track = trackForItem(document, itemId);
      const item = track?.items.find((i) => i.id === itemId);
      if (track && item && !track.locked) {
        itemsWithTracks.push({ item, track });
      }
    }

    if (itemsWithTracks.length === 0) {
      dispatch(toastShown("No unlocked clips selected to duplicate"));
      return;
    }

    const timelineOffset = 0.5;

    const operations = itemsWithTracks.map(({ item, track }, index) => {
      const duplicateId = `${item.id}-copy-${Date.now()}-${index}`;
      const duplicate = {
        ...cloneJson(item),
        id: duplicateId,
        timelineStart: item.timelineStart + timelineOffset,
      };

      let type: "addTextItem" | "addAudioItem" | "addMediaToTimeline";
      if (item.type === "text") {
        type = "addTextItem";
      } else if (item.type === "audio") {
        type = "addAudioItem";
      } else {
        type = "addMediaToTimeline";
      }

      return {
        ...operationMetadata(`duplicate-clip-${duplicateId}`, "Duplicate clip", [item.id, duplicateId]),
        type,
        trackId: track.id,
        item: duplicate,
      };
    });

    commitOperations("Duplicate clips", operations as VideoOperation[]);
  }, [commitOperations, dispatch, document, operationMetadata, selectedItemIds, cloneJson]);

  const trimStartToPlayhead = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    const selected = selectedItems(document, selectedItemIds);
    const operations: VideoOperation[] = [];
    for (const item of selected) {
      const track = trackForItem(document, item.id);
      if (!track || track.locked) continue;
      const offset = currentTime - item.timelineStart;
      if (offset > 0 && offset < item.duration) {
        const newStart = currentTime;
        const newDuration = item.duration - offset;
        
        if (item.type === "video" || item.type === "audio") {
          const mediaDuration = mediaDurationForItem(document, item) ?? item.duration;
          const currentSourceIn = (item as any).sourceIn ?? 0;
          const newSourceIn = Math.min(mediaDuration, currentSourceIn + offset);
          const currentSourceOut = (item as any).sourceOut ?? item.duration;
          operations.push({
            ...operationMetadata(`trim-start-${item.id}`, "Trim clip start", [item.id]),
            type: "trimItem" as const,
            itemId: item.id,
            timelineStart: newStart,
            duration: newDuration,
            sourceIn: newSourceIn,
            sourceOut: currentSourceOut,
          } as any);
        } else {
          operations.push({
            ...operationMetadata(`trim-start-${item.id}`, "Trim clip start", [item.id]),
            type: "trimItem" as const,
            itemId: item.id,
            timelineStart: newStart,
            duration: newDuration,
          } as any);
        }
      }
    }
    if (operations.length > 0) {
      commitOperations("Trim clip start", operations);
    } else {
      dispatch(toastShown("Playhead must be inside a selected clip to trim"));
    }
  }, [document, selectedItemIds, currentTime, operationMetadata, commitOperations, dispatch]);

  const trimEndToPlayhead = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    const selected = selectedItems(document, selectedItemIds);
    const operations: VideoOperation[] = [];
    for (const item of selected) {
      const track = trackForItem(document, item.id);
      if (!track || track.locked) continue;
      const offset = currentTime - item.timelineStart;
      if (offset > 0 && offset < item.duration) {
        const newDuration = offset;
        if (item.type === "video" || item.type === "audio") {
          const currentSourceIn = (item as any).sourceIn ?? 0;
          const newSourceOut = Math.max(currentSourceIn, currentSourceIn + offset);
          operations.push({
            ...operationMetadata(`trim-end-${item.id}`, "Trim clip end", [item.id]),
            type: "trimItem" as const,
            itemId: item.id,
            timelineStart: item.timelineStart,
            duration: newDuration,
            sourceIn: currentSourceIn,
            sourceOut: newSourceOut,
          } as any);
        } else {
          operations.push({
            ...operationMetadata(`trim-end-${item.id}`, "Trim clip end", [item.id]),
            type: "trimItem" as const,
            itemId: item.id,
            timelineStart: item.timelineStart,
            duration: newDuration,
          } as any);
        }
      }
    }
    if (operations.length > 0) {
      commitOperations("Trim clip end", operations);
    } else {
      dispatch(toastShown("Playhead must be inside a selected clip to trim"));
    }
  }, [document, selectedItemIds, currentTime, operationMetadata, commitOperations, dispatch]);

  const handleSplit = useCallback(() => {
    const selected = selectedItems(document, selectedItemIds);
    if (selected.length > 0) {
      splitAtPlayhead(selected);
    } else {
      const allClips = document?.tracks.flatMap((track) => track.items) ?? [];
      const clipsUnderPlayhead = allClips.filter((item) => currentTime > item.timelineStart && currentTime < item.timelineStart + item.duration);
      if (clipsUnderPlayhead.length > 0) {
        splitAtPlayhead(clipsUnderPlayhead);
      } else {
        dispatch(toastShown("Move playhead over a clip to split"));
      }
    }
  }, [document, selectedItemIds, splitAtPlayhead, currentTime, dispatch]);

  const handleCopy = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    const selected = selectedItems(document, selectedItemIds);
    if (selected.length > 0) {
      setClipboard(selected);
      dispatch(toastShown(`Copied ${selected.length} clip(s)`));
    }
  }, [document, selectedItemIds, dispatch]);

  const handlePaste = useCallback(() => {
    if (!document || !clipboard || clipboard.length === 0) {
      dispatch(toastShown("Clipboard is empty"));
      return;
    }
    
    const minStart = Math.min(...clipboard.map((item) => item.timelineStart));
    const operations: any[] = [];

    clipboard.forEach((item, index) => {
      const offset = item.timelineStart - minStart;
      const newStart = currentTime + offset;
      const newId = `${item.id}-copy-${Date.now()}-${index}`;
      
      const originalTrack = trackForItem(document, item.id);
      let targetTrackId = originalTrack?.id;
      
      if (!targetTrackId) {
        const trackKind: VideoTrackKind = item.type === "text" ? "text" : item.type === "audio" ? "audio" : "video";
        const compatibleTrack = document.tracks.find((t) => t.kind === trackKind && !t.locked);
        targetTrackId = compatibleTrack?.id;
      } else {
        const track = document.tracks.find((t) => t.id === targetTrackId);
        if (track?.locked) {
          const trackKind: VideoTrackKind = item.type === "text" ? "text" : item.type === "audio" ? "audio" : "video";
          const compatibleTrack = document.tracks.find((t) => t.kind === trackKind && !t.locked);
          targetTrackId = compatibleTrack?.id;
        }
      }
      
      if (!targetTrackId) return;

      const duplicate = {
        ...cloneJson(item),
        id: newId,
        timelineStart: newStart,
      };

      let type: "addTextItem" | "addAudioItem" | "addMediaToTimeline";
      if (item.type === "text") {
        type = "addTextItem";
      } else if (item.type === "audio") {
        type = "addAudioItem";
      } else {
        type = "addMediaToTimeline";
      }

      operations.push({
        ...operationMetadata(`paste-clip-${newId}`, "Paste clip", [newId]),
        type,
        trackId: targetTrackId,
        item: duplicate,
      });
    });

    if (operations.length > 0) {
      commitOperations("Paste clips", operations as VideoOperation[]);
      dispatch(toastShown(`Pasted ${operations.length} clip(s)`));
    } else {
      dispatch(toastShown("No unlocked compatible tracks to paste into"));
    }
  }, [clipboard, currentTime, commitOperations, dispatch, document, operationMetadata, cloneJson]);

  const toggleLockSelectedTracks = useCallback(() => {
    if (!document || selectedItemIds.length === 0) return;
    const tracksToLock = Array.from(new Set(selectedItemIds.map(id => trackForItem(document, id)).filter((t): t is VideoTrack => !!t)));
    const operations = tracksToLock.map((track) => ({
      ...operationMetadata(`lock-track-${track.id}`, `${track.locked ? "Unlock" : "Lock"} track`, [track.id]),
      type: "updateTrack" as const,
      trackId: track.id,
      locked: !track.locked,
    }));
    commitOperations("Toggle track lock", operations);
  }, [commitOperations, document, operationMetadata, selectedItemIds]);

  if (!timelineOpen) {
    return (
      <footer
        data-tour="timeline-panel"
        className={`z-40 flex h-10 shrink-0 items-center justify-center border-t border-outline-variant bg-surface ${className}`}
      >
        <button
          type="button"
          onClick={() => dispatch(timelineOpenChanged(true))}
          className="flex h-8 items-center gap-2 rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface motion-reduce:transition-none"
        >
          <EditorIcon className="text-[18px]">keyboard_arrow_up</EditorIcon>
          Timeline
        </button>
      </footer>
    );
  }

  return (
    <footer
      data-tour="timeline-panel"
      className={`relative z-40 flex min-h-video-timeline-min max-h-video-timeline-max shrink-0 flex-col border-t border-outline-variant bg-surface ${className}`}
      style={{ height: timelineHeight }}
      tabIndex={0}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Resize timeline"
        onPointerDown={handleResizeStart}
        className="absolute left-0 top-[-3px] z-50 h-1.5 w-full cursor-row-resize bg-transparent transition-colors hover:bg-primary/40 motion-reduce:transition-none"
      />
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-2 lg:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          {/* History Group */}
          <div className="flex items-center gap-1 shrink-0">
            <EditorIconButton
              icon="undo"
              label="Undo"
              className="h-7 w-7 shrink-0"
              disabled={!canUndo}
              onClick={() => dispatch(videoUndoRequested())}
            />
            <EditorIconButton
              icon="redo"
              label="Redo"
              className="h-7 w-7 shrink-0"
              disabled={!canRedo}
              onClick={() => dispatch(videoRedoRequested())}
            />
          </div>

          <div className="mx-2 h-4 w-px bg-outline-variant shrink-0" />

          {/* Editing Group */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Split */}
            <div className="relative flex items-center shrink-0">
              <button
                type="button"
                title="Split at playhead"
                aria-label="Split at playhead"
                onClick={handleSplit}
                className={`flex h-7 items-center justify-center rounded-l-[4px] border border-r-0 border-outline-variant/50 px-2.5 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface ${activeToolId === "split" ? "bg-surface-container-high text-primary" : ""}`}
              >
                <EditorIcon className="text-[15px] mr-1">content_cut</EditorIcon>
                Split
              </button>
              <button
                type="button"
                title="Split options"
                aria-label="Split options"
                onClick={() => setSplitOpen(!splitOpen)}
                className="flex h-7 w-4 items-center justify-center rounded-r-[4px] border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <EditorIcon className="text-[10px]">keyboard_arrow_down</EditorIcon>
              </button>
              
              {splitOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setSplitOpen(false)}
                    aria-label="Close split menu"
                  />
                  <div className="absolute left-0 top-8 z-50 w-44 rounded-[4px] border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        splitAtPlayhead(selectedItems(document, selectedItemIds));
                        setSplitOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[2px] px-2.5 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                    >
                      Split Selected Clips
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        splitAtPlayhead(document?.tracks.flatMap((t) => t.items) ?? []);
                        setSplitOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[2px] px-2.5 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                    >
                      Split All Tracks
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Trim */}
            <div className="relative flex items-center shrink-0">
              <button
                type="button"
                title="Toggle Trim Tool"
                aria-label="Toggle Trim Tool"
                onClick={() => dispatch(activeToolChanged(activeToolId === "trim" ? "select" : "trim"))}
                className={`flex h-7 items-center justify-center rounded-l-[4px] border border-r-0 border-outline-variant/50 px-2.5 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface ${activeToolId === "trim" ? "bg-surface-container-high text-primary" : ""}`}
              >
                <EditorIcon className="text-[15px] mr-1">play_arrow</EditorIcon>
                Trim
              </button>
              <button
                type="button"
                title="Trim options"
                aria-label="Trim options"
                onClick={() => setTrimOpen(!trimOpen)}
                className="flex h-7 w-4 items-center justify-center rounded-r-[4px] border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <EditorIcon className="text-[10px]">keyboard_arrow_down</EditorIcon>
              </button>
              
              {trimOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setTrimOpen(false)}
                    aria-label="Close trim menu"
                  />
                  <div className="absolute left-0 top-8 z-50 w-44 rounded-[4px] border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        trimStartToPlayhead();
                        setTrimOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[2px] px-2.5 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                    >
                      Trim Start to Playhead
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        trimEndToPlayhead();
                        setTrimOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[2px] px-2.5 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                    >
                      Trim End to Playhead
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mx-2 h-4 w-px bg-outline-variant shrink-0" />

          {/* Selection Group */}
          <div className="flex items-center gap-1 shrink-0">
            <EditorIconButton
              icon="delete"
              label="Delete selected"
              className="h-7 w-7 shrink-0"
              disabled={selectedItemIds.length === 0}
              onClick={deleteSelected}
            />
            <EditorIconButton
              icon="content_copy"
              label="Duplicate selected clips"
              className="h-7 w-7 shrink-0"
              disabled={selectedItemIds.length === 0}
              onClick={duplicateSelected}
            />
            <div className="mx-1 h-3.5 w-px bg-outline-variant/35 shrink-0" />
            <EditorIconButton
              icon="copy_all"
              label="Copy selected clips"
              className="h-7 w-7 shrink-0"
              disabled={selectedItemIds.length === 0}
              onClick={handleCopy}
            />
            <EditorIconButton
              icon="content_paste"
              label="Paste clips"
              className="h-7 w-7 shrink-0"
              disabled={!clipboard || clipboard.length === 0}
              onClick={handlePaste}
            />
          </div>

          <div className="mx-2 h-4 w-px bg-outline-variant shrink-0" />

          {/* Snap & Ripple Group */}
          <div className="flex items-center gap-1 shrink-0">
            <EditorIconButton
              icon={clipsLinked ? "link" : "link_off"}
              label={clipsLinked ? "Unlink clips" : "Link clips"}
              active={clipsLinked}
              className="h-7 w-7 shrink-0"
              onClick={() => dispatch(clipsLinkedToggled())}
            />
            <EditorIconButton
              icon="lock"
              label="Toggle track lock"
              className="h-7 w-7 shrink-0"
              disabled={selectedItemIds.length === 0}
              onClick={toggleLockSelectedTracks}
            />
            <div className="mx-1 h-3.5 w-px bg-outline-variant/35 shrink-0" />
            <EditorIconButton
              icon="nest_cam_magnet_mount"
              label={snappingEnabled ? "Disable snapping" : "Enable snapping"}
              active={snappingEnabled}
              className="h-7 w-7 shrink-0"
              onClick={() => dispatch(snappingToggled())}
            />
            <EditorIconButton
              icon="waves"
              label={rippleEnabled ? "Disable ripple edit" : "Enable ripple edit"}
              active={rippleEnabled}
              className="h-7 w-7 shrink-0"
              onClick={() => {
                const nextVal = !rippleEnabled;
                setRippleEnabled(nextVal);
                dispatch(toastShown(nextVal ? "Ripple edit enabled" : "Ripple edit disabled"));
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-surface-container-low rounded-[4px] border border-outline-variant/50 p-0.5 shrink-0">
            <EditorIconButton
              icon="zoom_out"
              label="Zoom Out"
              className="h-6 w-6"
              onClick={() => dispatch(timelineZoomChanged(timelineZoom - 10))}
            />
            <button
              type="button"
              title="Reset Zoom to 50%"
              onClick={() => dispatch(timelineZoomChanged(50))}
              className="h-6 px-1.5 text-[11px] font-bold text-on-surface-variant hover:text-on-surface rounded-[2px] transition-colors"
            >
              {timelineZoom}%
            </button>
            <EditorIconButton
              icon="zoom_in"
              label="Zoom In"
              className="h-6 w-6"
              onClick={() => dispatch(timelineZoomChanged(timelineZoom + 10))}
            />
          </div>

          <div className="mx-1 h-4 w-px bg-outline-variant/60 shrink-0" />

          {/* Hide Timeline */}
          <EditorIconButton
            icon="keyboard_arrow_down"
            label="Hide timeline"
            className="h-7 w-7 shrink-0"
            onClick={() => dispatch(timelineOpenChanged(false))}
          />
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div
          className="relative z-10 flex shrink-0 flex-col border-r border-outline-variant bg-surface-container"
          style={{ width: trackHeadersWidth }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            title="Resize track headers"
            onPointerDown={handleHeadersResizeStart}
            className="absolute right-[-3px] top-0 z-50 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 motion-reduce:transition-none"
          />
          <div
            className="flex h-8 items-center justify-between border-b border-outline-variant pl-2 pr-1 bg-surface-container-high/40"
            onMouseLeave={() => setAddTrackDropdownOpen(false)}
          >
            <span className="text-label-sm font-semibold uppercase text-on-surface-variant truncate">Tracks</span>
            <div className="relative flex shrink-0">
              <button
                type="button"
                onClick={() => setAddTrackDropdownOpen(!addTrackDropdownOpen)}
                className="flex items-center justify-center rounded-[4px] hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface h-5 w-5"
                title="Add Track"
              >
                <EditorIcon className="text-[16px]">add</EditorIcon>
              </button>
              {addTrackDropdownOpen && (
                <div className="absolute right-0 top-6 z-50 w-36 rounded-[4px] border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(trackAdded({ kind: "video", label: `Video ${(document?.tracks ?? []).filter(t => t.kind === "video").length + 1}` }));
                      setAddTrackDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                  >
                    <EditorIcon className="text-[14px]">video_camera_front</EditorIcon>
                    Video Track
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(trackAdded({ kind: "audio", label: `Audio ${(document?.tracks ?? []).filter(t => t.kind === "audio").length + 1}` }));
                      setAddTrackDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                  >
                    <EditorIcon className="text-[14px]">graphic_eq</EditorIcon>
                    Audio Track
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(trackAdded({ kind: "text", label: `Text ${(document?.tracks ?? []).filter(t => t.kind === "text").length + 1}` }));
                      setAddTrackDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-label-md text-on-surface hover:bg-surface-container-highest"
                  >
                    <EditorIcon className="text-[14px]">subtitles</EditorIcon>
                    Text Track
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="relative"
              style={{
                height: timelineTrackAreaHeight,
                transform: `translateY(${-viewport.scrollTop}px)`,
              }}
            >
              {layoutWindow.trackLayouts.map(({ track, top, height }) => (
                <div key={track.id} className="absolute left-0 w-full" style={{ top, height }}>
                  <TrackHeader
                    track={track}
                    height={height}
                    soloed={soloedAudioTrackIds.includes(track.id)}
                    showControls={trackHeadersWidth >= 140}
                    dragging={draggedTrackId === track.id}
                    dropTarget={trackDropTargetId === track.id && draggedTrackId !== track.id}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-kuvox-track-id", track.id);
                      setDraggedTrackId(track.id);
                    }}
                    onDragOver={(event) => {
                      if (!draggedTrackId || draggedTrackId === track.id) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setTrackDropTargetId(track.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceTrackId = event.dataTransfer.getData("application/x-kuvox-track-id") || draggedTrackId;
                      if (sourceTrackId) reorderTrack(sourceTrackId, track.id);
                      setDraggedTrackId(null);
                      setTrackDropTargetId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTrackId(null);
                      setTrackDropTargetId(null);
                    }}
                    onUpdate={(fields) => {
                      dispatch(videoOperationApplied({
                        ...operationMetadata("update-track", "Update track", [track.id]),
                        type: "updateTrack",
                        trackId: track.id,
                        ...fields,
                      }));
                    }}
                    onSolo={() => dispatch(trackSoloToggled(track.id))}
                    onDelete={() => dispatch(trackDeleted(track.id))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto bg-surface-container-lowest"
          aria-label="Timeline tracks"
          onScroll={(event) => scheduleScrollUpdate(
            event.currentTarget.scrollLeft,
            event.currentTarget.scrollTop,
            Math.max(1, event.currentTarget.clientWidth),
            Math.max(1, event.currentTarget.clientHeight),
          )}
          onDragOver={(event) => {
            if (!document || !Array.from(event.dataTransfer.types).includes("application/x-kuvox-media-id")) return;
            event.preventDefault();
            const point = pointFromDragEvent(event, trackAreaRef.current);
            if (!point) return;
            let mediaId = event.dataTransfer.getData("application/x-kuvox-media-id");
            let mediaKindStr = event.dataTransfer.getData("application/x-kuvox-media-kind");
            if (!mediaId) {
              const activeDrag = getActiveDraggedMedia();
              if (activeDrag) {
                mediaId = activeDrag.id;
                mediaKindStr = String(activeDrag.kind);
              }
            }
            const mediaKind = Number(mediaKindStr);
            const hit = hitTestTimeline(point.x, point.y, trackLayouts, layoutWindow.itemLayouts);
            const media = mediaId && Number.isFinite(mediaKind)
              ? ({ id: mediaId, kind: mediaKind } as never)
              : null;
            const plan = media
              ? planMediaDrop({
                  document,
                  media,
                  trackId: hit.trackId,
                  timelineStart: pixelToTime(point.x, scale),
                })
              : { ok: false as const, reason: "Unknown media" };
            queueDropPlan({
              trackId: hit.trackId ?? undefined,
              valid: plan.ok,
              x: point.x,
              y: point.y,
              reason: plan.ok ? undefined : plan.reason,
            });
            event.dataTransfer.dropEffect = plan.ok ? "copy" : "none";
          }}
          onDragLeave={() => clearDropPlan()}
          onDrop={(event) => {
            if (!document) return;
            let mediaId = event.dataTransfer.getData("application/x-kuvox-media-id");
            if (!mediaId) {
              const activeDrag = getActiveDraggedMedia();
              if (activeDrag) {
                mediaId = activeDrag.id;
              }
            }
            if (!mediaId) return;
            event.preventDefault();
            const point = pointFromDragEvent(event, trackAreaRef.current);
            if (!point) return;
            flushDropPlan();
            const hit = hitTestTimeline(point.x, point.y, trackLayouts, layoutWindow.itemLayouts);
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
            clearDropPlan();
          }}
        >
          <div
            className="sticky top-0 z-20 h-8 border-b border-outline-variant bg-surface-container"
            style={{ width: contentWidth }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              const clientX = event.clientX - rect.left;
              dispatch(currentTimeChanged(pixelToTime(clientX, scale)));
              dragState.current = {
                kind: "playhead",
                pointerId: event.pointerId,
              };
              trackAreaRef.current?.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (dragState.current?.kind === "playhead") {
                const rect = event.currentTarget.getBoundingClientRect();
                const clientX = event.clientX - rect.left;
                dispatch(currentTimeChanged(pixelToTime(clientX, scale)));
              }
            }}
            onPointerUp={(event) => {
              if (dragState.current?.kind === "playhead") {
                dragState.current = null;
                clearDragPreview();
              }
            }}
            onPointerCancel={(event) => {
              if (dragState.current?.kind === "playhead") {
                dragState.current = null;
                clearDragPreview();
              }
            }}
            aria-label="Timeline ruler"
          >
            <Ruler duration={duration} scale={scale} />
          </div>

          <div
            ref={trackAreaRef}
            className={`relative ${activeToolId === "trim" ? "cursor-default" : activeToolId === "split" ? "cursor-crosshair" : ""}`}
            style={{ height: timelineTrackAreaHeight, width: contentWidth }}
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
                startedAt: performance.now(),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              dispatch(timelineSelectionCleared());
            }}
            onPointerMove={(event) => {
              const state = dragState.current;
              if (!state) return;
              const point = localPoint(event);
              if (!point) return;
              if (state.kind === "playhead") {
                dispatch(currentTimeChanged(pixelToTime(point.x, scale)));
                return;
              }
              if (state.kind === "marquee") {
                queueDragPreview({
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
                const hit = hitTestTimeline(point.x, point.y, trackLayouts, layoutWindow.itemLayouts);
                queueDragPreview({
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
                  queueDragPreview({
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
              const latestDragPreview = flushDragPreview();
              if (!state || !point || !document) {
                clearDragPreview();
                return;
              }

              if (state.kind === "playhead") {
                clearDragPreview();
                return;
              }

              if (state.kind === "marquee" && latestDragPreview?.kind === "marquee") {
                const itemIds = marqueeSelectItems(layoutWindow.itemLayouts, latestDragPreview.rect);
                dispatch(timelineItemsSelected({ itemIds }));
              }

              if (state.kind === "move") {
                const rawDelta = (point.x - state.startX) / scale.pixelsPerSecond;
                const hit = hitTestTimeline(point.x, point.y, trackLayouts, layoutWindow.itemLayouts);
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

              if (state.kind === "move" || state.kind === "trim") {
                queueVideoEditorPerformanceMetric(
                  document.projectId,
                  createVideoEditorPerformanceMetric(
                    "timeline-drag-latency",
                    performance.now() - state.startedAt,
                    { document, renderedItemCount: layoutWindow.renderedItemCount },
                  ),
                );
              }

              clearDragPreview();
            }}
            onPointerCancel={() => {
              if (dragState.current?.kind === "playhead") {
                dragState.current = null;
                clearDragPreview();
              }
            }}
          >
            {layoutWindow.trackLayouts.map((layout) => (
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
            {!hasTimelineItems ? <EmptyTimelineState /> : null}
            {layoutWindow.itemLayouts.map((layout) => (
              <TimelineItemBlock
                key={layout.item.id}
                layout={previewLayout(layout, dragPreview, scale)}
                media={"mediaId" in layout.item ? document?.media[layout.item.mediaId] : undefined}
                availability={"mediaId" in layout.item ? projectMediaAvailabilityById[layout.item.mediaId]?.availability ?? "missing" : undefined}
                selected={selectedItemIdSet.has(layout.item.id)}
                linked={"linkedGroupId" in layout.item && Boolean(layout.item.linkedGroupId)}
                activeToolId={activeToolId}
                preparationStatus={"mediaId" in layout.item
                  ? mediaItemStatus(layout.item.mediaId, mediaPreparationByKey)
                  : "ready"}
                onPointerDown={(event, edge) => {
                  event.stopPropagation();
                  if (!document) return;
                  selectItem(layout.item.id, event);
                  if ("mediaId" in layout.item && mediaItemStatus(layout.item.mediaId, mediaPreparationByKey) !== "ready") {
                    if (activeToolId !== "select") dispatch(toastShown("Preparing media is locked"));
                    return;
                  }
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
                      startedAt: performance.now(),
                      item: layout.item,
                      edge,
                    };
                  } else if (activeToolId === "select") {
                    dragState.current = {
                      kind: "move",
                      pointerId: event.pointerId,
                      startX: localPoint(event)?.x ?? 0,
                      startY: localPoint(event)?.y ?? 0,
                      startedAt: performance.now(),
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
            {pendingLayouts.map(({ pending, ...layout }) => (
              <PendingTimelineItemBlock
                key={pending.id}
                pending={pending}
                layout={layout}
                onRetry={() => dispatch(mediaPreparationRetried(pending.resourceKey))}
                onRemove={() => dispatch(pendingTimelineInsertionRemoved(pending.id))}
              />
            ))}
            <button
              type="button"
              className="absolute top-0 z-30 h-full w-px bg-primary"
              style={{ left: playheadLeft }}
              aria-label="Playhead"
              role="slider"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={maxPlayheadTime}
              aria-valuenow={currentTime}
              onPointerDown={(event) => {
                event.stopPropagation();
                const point = localPoint(event);
                if (!point) return;
                dragState.current = {
                  kind: "playhead",
                  pointerId: event.pointerId,
                };
                dispatch(currentTimeChanged(pixelToTime(point.x, scale)));
                trackAreaRef.current?.setPointerCapture(event.pointerId);
              }}
              onKeyDown={(event) => {
                let nextTime = currentTime;
                const frameDuration = 1 / 30; // standard 30fps
                const step = event.shiftKey ? 1 : frameDuration;
                if (event.key === "ArrowRight") {
                  nextTime = Math.min(maxPlayheadTime, currentTime + step);
                } else if (event.key === "ArrowLeft") {
                  nextTime = Math.max(0, currentTime - step);
                } else if (event.key === "Home") {
                  nextTime = 0;
                } else if (event.key === "End") {
                  nextTime = maxPlayheadTime;
                } else {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                dispatch(currentTimeChanged(nextTime));
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

function EmptyTimelineState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[linear-gradient(to_right,rgba(70,69,84,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(70,69,84,0.2)_1px,transparent_1px)] bg-[length:48px_100%,100%_48px]">
      <div className="rounded-[4px] border border-dashed border-outline-variant bg-surface/80 px-4 py-3 text-center">
        <p className="text-body-sm font-semibold text-on-surface">Empty timeline</p>
        <p className="mt-1 text-label-md text-on-surface-variant">Drag ready media here to start editing.</p>
      </div>
    </div>
  );
}

function TrackHeader({
  track,
  height,
  soloed,
  showControls = true,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onUpdate,
  onSolo,
  onDelete,
}: {
  track: VideoTrack;
  height: number;
  soloed: boolean;
  showControls?: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onUpdate: (fields: { locked?: boolean; hidden?: boolean; muted?: boolean }) => void;
  onSolo: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative flex items-center justify-between border-b px-2 bg-surface-container transition-colors hover:bg-surface-container-high motion-reduce:transition-none ${dropTarget ? "border-primary bg-primary/10" : "border-outline-variant"} ${dragging ? "opacity-45" : track.hidden ? "opacity-75" : ""}`}
      style={{ height }}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-2">
        <EditorIcon className="cursor-grab text-[15px] text-on-surface-variant/70 shrink-0 active:cursor-grabbing">drag_indicator</EditorIcon>
        <EditorIcon className="text-[15px] text-on-surface-variant shrink-0">{trackIcon(track.kind)}</EditorIcon>
        <span className="truncate text-label-md font-semibold text-on-surface leading-tight">{track.label}</span>
      </div>
      {showControls && (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {track.kind === "audio" ? (
              <>
                <SmallIconButton icon="headphones" label={`Solo ${track.label}`} active={soloed} onClick={onSolo} />
                <SmallIconButton icon={track.muted ? "volume_off" : "volume_up"} label={`Mute ${track.label}`} active={track.muted} onClick={() => onUpdate({ muted: !track.muted })} />
              </>
            ) : (
              <>
                <SmallIconButton icon={track.hidden ? "visibility_off" : "visibility"} label={`Toggle ${track.label} visibility`} active={track.hidden} onClick={() => onUpdate({ hidden: !track.hidden })} />
                {track.kind === "video" ? (
                  <SmallIconButton icon={track.muted ? "volume_off" : "volume_up"} label={`Mute ${track.label}`} active={track.muted} onClick={() => onUpdate({ muted: !track.muted })} />
                ) : null}
              </>
            )}
            <SmallIconButton icon={track.locked ? "lock" : "lock_open"} label={`Toggle ${track.label} lock`} active={track.locked} onClick={() => onUpdate({ locked: !track.locked })} />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-6 w-5 items-center justify-center rounded-[3px] text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
              aria-label="Track options"
            >
              <EditorIcon className="text-[16px]">more_vert</EditorIcon>
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close track options"
                />
                <div className="absolute right-0 top-7 z-40 w-28 rounded-[4px] border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1 text-left text-label-sm text-error hover:bg-error/10 hover:text-error"
                  >
                    <EditorIcon className="text-[14px]">delete</EditorIcon>
                    Delete Track
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
      className={`flex h-5 w-5 items-center justify-center rounded-[3px] transition-colors hover:bg-surface-container-highest motion-reduce:transition-none ${active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
      aria-label={label}
      aria-pressed={active}
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
        backgroundImage: "repeating-linear-gradient(to right, transparent, transparent calc(100% - 1px), color-mix(in srgb, var(--color-on-surface) 40%, transparent) calc(100% - 1px), color-mix(in srgb, var(--color-on-surface) 40%, transparent) 100%)",
        backgroundSize: `${scale.pixelsPerSecond}px 12px`,
        backgroundRepeat: "repeat-x",
        backgroundPosition: "0 bottom",
      }}
    >
      {ticks.map((time) => (
        <span
          key={time}
          className="absolute top-1 -translate-x-1/2 font-mono text-[10px] font-bold text-on-surface"
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
  media,
  availability,
  selected,
  linked,
  activeToolId,
  preparationStatus,
  onPointerDown,
}: {
  layout: TimelineItemLayout;
  media?: VideoMediaReference;
  availability?: string;
  selected: boolean;
  linked: boolean;
  activeToolId: ReturnType<typeof selectActiveToolId>;
  preparationStatus: "queued" | "loading" | "ready" | "failed";
  onPointerDown: (event: PointerEvent<HTMLElement>, edge: "start" | "end" | null) => void;
}) {
  const item = layout.item;
  const trimActive = activeToolId === "trim";
  const preparing = preparationStatus !== "ready";
  const cursorClass = preparing ? "cursor-default" : activeToolId === "split" ? "cursor-crosshair" : activeToolId === "trim" ? "cursor-default" : "cursor-grab active:cursor-grabbing";
  const thumbnailCount = Math.max(1, Math.floor(layout.width / 50));
  return (
    <button
      type="button"
      className={`absolute z-10 overflow-hidden rounded-[4px] border px-2 text-left text-[10px] font-mono outline-none transition-shadow hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest motion-reduce:transition-none ${cursorClass} ${clipToneClass[item.type]} ${selected ? "ring-2 ring-primary" : ""}`}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }}
      onPointerDown={(event) => onPointerDown(event, null)}
      title={itemTitle(item, media)}
      aria-label={timelineItemAriaLabel(item, media, selected)}
      aria-selected={selected}
    >
      <span
        className={`absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-on-surface/10 transition-opacity motion-reduce:transition-none ${trimActive ? "opacity-70 hover:opacity-100" : "opacity-0"}`}
        onPointerDown={(event) => onPointerDown(event, "start")}
      />
      <span
        className={`absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-on-surface/10 transition-opacity motion-reduce:transition-none ${trimActive ? "opacity-70 hover:opacity-100" : "opacity-0"}`}
        onPointerDown={(event) => onPointerDown(event, "end")}
      />
      {item.type === "audio" ? (
        <div className="absolute inset-x-0 bottom-1.5 top-6 flex items-end justify-between gap-[1.5px] px-2 opacity-70 pointer-events-none">
          {getWaveformBars(item.id, Math.max(8, Math.floor(layout.width / 4.5))).map((h, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t-[1.5px] bg-primary/45"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      ) : null}
      {(item.type === "video" || item.type === "overlay") ? (
        <div className="absolute inset-0 flex overflow-hidden pointer-events-none opacity-45">
          {Array.from({ length: thumbnailCount }).map((_, idx) => (
            <div
              key={idx}
              className="h-full border-r border-black/10 shrink-0 bg-cover bg-center bg-no-repeat"
              style={{
                width: 50,
                backgroundImage: media?.thumbnailUrl ? `url(${media.thumbnailUrl})` : undefined,
                backgroundColor: !media?.thumbnailUrl ? "rgba(100, 110, 140, 0.2)" : undefined,
              }}
            >
              {!media?.thumbnailUrl && (
                <div className="flex h-full w-full items-center justify-center text-on-surface/20">
                  <EditorIcon className="text-[16px]">movie</EditorIcon>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {unavailableBadge(availability) ? (
        <span className="absolute bottom-1 right-1 rounded-[3px] bg-error-container px-1.5 py-0.5 text-[9px] font-semibold uppercase text-on-error-container">
          {unavailableBadge(availability)}
        </span>
      ) : linked ? <EditorIcon className="absolute right-1 top-1 text-[12px] opacity-80">link</EditorIcon> : null}
      <span className={`relative z-20 block truncate pr-2 font-semibold ${
        item.type === "video" || item.type === "overlay"
          ? "text-white drop-shadow-[0_1px_2.5px_rgba(0,0,0,0.85)]"
          : "text-current"
      }`}>
        {itemLabel(item, media)}
      </span>
      {preparing ? (
        <span className="absolute inset-0 z-30 flex items-center justify-center gap-1 bg-surface-container-high/85 text-[9px] font-semibold text-on-surface">
          <EditorIcon className={`text-[13px] ${preparationStatus === "failed" ? "text-error" : "animate-spin motion-reduce:animate-none"}`}>
            {preparationStatus === "failed" ? "error" : "progress_activity"}
          </EditorIcon>
          {preparationStatus === "failed" ? "Failed" : "Preparing"}
        </span>
      ) : null}
    </button>
  );
}

function PendingTimelineItemBlock({
  pending,
  layout,
  onRetry,
  onRemove,
}: {
  pending: ReturnType<typeof selectPendingTimelineInsertions>[number];
  layout: { left: number; top: number; width: number; height: number };
  onRetry: () => void;
  onRemove: () => void;
}) {
  const failed = pending.status === "failed";
  return (
    <div
      className={`absolute z-20 overflow-hidden rounded-[4px] border px-2 py-1 text-left text-[10px] font-mono ${failed ? "border-error bg-error-container text-on-error-container" : "border-primary/70 bg-surface-container-high text-on-surface"}`}
      style={layout}
      aria-label={`${pending.media.filename}, ${failed ? "preparation failed" : "preparing"}`}
    >
      {!failed ? <span className="absolute inset-0 animate-[pulse_1.4s_ease-in-out_infinite] bg-[repeating-linear-gradient(135deg,transparent_0,transparent_8px,rgba(255,255,255,0.08)_8px,rgba(255,255,255,0.08)_16px)] motion-reduce:animate-none" /> : null}
      <span className="relative z-10 flex min-w-0 items-center gap-1.5">
        <EditorIcon className={`shrink-0 text-[14px] ${failed ? "text-error" : "animate-spin motion-reduce:animate-none"}`}>
          {failed ? "error" : "progress_activity"}
        </EditorIcon>
        <span className="min-w-0 flex-1 truncate font-semibold">{pending.media.filename}</span>
      </span>
      <span className="relative z-10 mt-0.5 block truncate text-[9px] opacity-75">{failed ? "Preparation failed" : "Preparing"}</span>
      {failed ? (
        <span className="absolute bottom-1 right-1 z-20 flex gap-1">
          <button type="button" className="rounded-[3px] bg-surface px-1.5 py-0.5 font-semibold text-on-surface" onClick={onRetry}>Retry</button>
          <button type="button" className="rounded-[3px] bg-surface px-1.5 py-0.5 font-semibold text-on-surface" onClick={onRemove}>Remove</button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Remove preparing ${pending.media.filename}`}
          className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-[3px] bg-surface/80 text-on-surface opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 motion-reduce:transition-none"
          onClick={onRemove}
        >
          <EditorIcon className="text-[13px]">close</EditorIcon>
        </button>
      )}
    </div>
  );
}

function mediaItemStatus(
  mediaId: string,
  resources: ReturnType<typeof selectMediaPreparationState>,
): "queued" | "loading" | "ready" | "failed" {
  const matches = Object.values(resources).filter((resource) => resource.mediaId === mediaId);
  if (matches.length === 0) return "ready";
  if (matches.some((resource) => resource.status === "ready")) return "ready";
  if (matches.some((resource) => resource.status === "failed")) return "failed";
  if (matches.some((resource) => resource.status === "loading")) return "loading";
  return "queued";
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

function itemLabel(item: VideoTimelineItem, media?: VideoMediaReference): string {
  if (item.type === "text") return item.text;
  return media?.name ?? item.mediaId;
}

function itemTitle(item: VideoTimelineItem, media?: VideoMediaReference): string {
  if (item.type === "audio") {
    const role = item.linkedGroupId ? "Linked clip audio" : "Standalone audio";
    return `${itemLabel(item, media)} • ${role}`;
  }

  return itemLabel(item, media);
}

function timelineItemAriaLabel(item: VideoTimelineItem, media: VideoMediaReference | undefined, selected: boolean): string {
  const status = selected ? "selected" : "not selected";
  return `${item.type} timeline item, ${itemLabel(item, media)}, starts at ${formatTimelineTime(item.timelineStart)}, duration ${formatTimelineTime(item.duration)}, ${status}`;
}

function unavailableBadge(availability: string | undefined): string | null {
  if (availability === "deleted") return "Deleted";
  if (availability === "inaccessible") return "No access";
  if (availability === "missing") return "Missing";
  return null;
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

function getWaveformBars(itemId: string, count: number): number[] {
  let seed = 0;
  for (let i = 0; i < itemId.length; i++) {
    seed = (seed * 31 + itemId.charCodeAt(i)) & 0xffffff;
  }
  const bars = [];
  for (let i = 0; i < count; i++) {
    const x = i * 0.15 + seed;
    const y = i * 0.5 + seed;
    const envelope = Math.abs(Math.sin(x) * 0.7 + Math.sin(x * 0.3) * 0.3);
    const detail = 0.4 + Math.abs(Math.cos(y)) * 0.6;
    const height = Math.round(10 + envelope * detail * 80);
    bars.push(height);
  }
  return bars;
}
