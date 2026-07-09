import { useEffect, type RefObject } from "react";

import {
  buildShortcutDeleteOperation,
  buildShortcutNudgeOperations,
  buildShortcutSplitOperations,
  classifyVideoEditorShortcut,
  frameDurationSeconds,
  resolveEscapeShortcut,
  selectVisibleTimelineItemIds,
} from "~/lib/editor/video-keyboard-shortcuts";
import { createVideoOperationBatch } from "~/lib/editor/video-operations";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  activeToolChanged,
  modalClosed,
  playbackFrameStepped,
  playbackStepChanged,
  playbackToggled,
  popoverClosed,
  selectCurrentTimeSeconds,
  selectOverlayState,
  selectSelectedItemIds,
  selectTimelinePanelState,
  selectTimelineZoom,
  selectVideoDocument,
  timelineItemsSelected,
  timelineSelectionCleared,
  timelineZoomChanged,
  videoOperationApplied,
  videoRedoRequested,
  videoUndoRequested,
} from "~/store/slices/editor-slice";

export function useVideoKeyboardShortcuts(
  rootRef: RefObject<HTMLElement | null>,
  options: { onSave?: () => void | Promise<void> } = {},
) {
  const onSave = options.onSave;
  const dispatch = useAppDispatch();
  const document = useAppSelector(selectVideoDocument);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const timelineZoom = useAppSelector(selectTimelineZoom);
  const { activeModal, activePopover } = useAppSelector(selectOverlayState);
  const { clipsLinked } = useAppSelector(selectTimelinePanelState);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void onSave?.();
        return;
      }

      const shortcut = classifyVideoEditorShortcut(event);
      if (!shortcut) return;

      if (shortcut.type === "playPause") {
        event.preventDefault();
        dispatch(playbackToggled());
        return;
      }

      if (shortcut.type === "undo") {
        event.preventDefault();
        dispatch(videoUndoRequested());
        return;
      }

      if (shortcut.type === "redo") {
        event.preventDefault();
        dispatch(videoRedoRequested());
        return;
      }

      if (shortcut.type === "selectTool") {
        event.preventDefault();
        dispatch(activeToolChanged("select"));
        return;
      }

      if (shortcut.type === "splitTool") {
        event.preventDefault();
        dispatch(activeToolChanged("split"));
        return;
      }

      if (shortcut.type === "escape") {
        event.preventDefault();
        const resolution = resolveEscapeShortcut({ activeModal, activePopover, selectedItemIds });
        if (resolution === "closeModal") {
          dispatch(modalClosed());
          return;
        }
        if (resolution === "closePopover") {
          dispatch(popoverClosed());
          return;
        }
        if (resolution === "clearSelection") {
          dispatch(timelineSelectionCleared());
        }
        return;
      }

      if (shortcut.type === "zoomIn" || shortcut.type === "zoomOut") {
        event.preventDefault();
        dispatch(timelineZoomChanged(timelineZoom + (shortcut.type === "zoomIn" ? 8 : -8)));
        return;
      }

      if (!document) return;

      if (shortcut.type === "selectAllVisible") {
        event.preventDefault();
        const itemIds = selectVisibleTimelineItemIds(document);
        if (itemIds.length > 0) {
          dispatch(timelineItemsSelected({ itemIds, activeItemId: itemIds[itemIds.length - 1] }));
        }
        return;
      }

      if (shortcut.type === "deleteSelected") {
        event.preventDefault();
        const operation = buildShortcutDeleteOperation({
          document,
          selectedItemIds,
          clipsLinked,
        });
        if (operation) {
          dispatch(videoOperationApplied(operation));
        }
        return;
      }

      if (shortcut.type === "splitAtPlayhead") {
        event.preventDefault();
        const operations = buildShortcutSplitOperations({
          document,
          selectedItemIds,
          clipsLinked,
          currentTime,
        });
        if (operations.length > 0) {
          dispatch(videoOperationApplied(createVideoOperationBatch({
            source: "manual",
            label: "Split clips",
            operations,
          })));
        }
        return;
      }

      if (shortcut.type === "nudgeSelected") {
        event.preventDefault();
        if (selectedItemIds.length === 0) {
          if (shortcut.seconds === 1) {
            dispatch(playbackStepChanged(shortcut.direction));
          } else {
            dispatch(playbackFrameStepped(shortcut.direction));
          }
          return;
        }

        const operations = buildShortcutNudgeOperations({
          document,
          selectedItemIds,
          clipsLinked,
          direction: shortcut.direction,
          seconds: shortcut.seconds || frameDurationSeconds(document),
        });
        if (operations.length > 0) {
          dispatch(videoOperationApplied(createVideoOperationBatch({
            source: "manual",
            label: "Nudge clips",
            operations,
          })));
        }
        return;
      }

      if (shortcut.type === "stepPlayhead") {
        event.preventDefault();
        if (shortcut.seconds === 1) {
          dispatch(playbackStepChanged(shortcut.direction));
        } else {
          dispatch(playbackFrameStepped(shortcut.direction));
        }
      }
    }

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [
    activeModal,
    activePopover,
    clipsLinked,
    currentTime,
    dispatch,
    document,
    rootRef,
    selectedItemIds,
    timelineZoom,
    onSave,
  ]);
}
