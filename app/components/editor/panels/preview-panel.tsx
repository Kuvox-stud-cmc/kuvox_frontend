import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type Konva from "konva";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";

import {
  applyHandlePointerOffset,
  applyEvaluatedCropTransformDeltasToRaw,
  clampInteractiveHandle,
  computeCenterOriginMediaGeometry,
  computeCroppedSourceGeometry,
  computeFrameBounds,
  computeSafeGuides,
  computeTextOverlayBounds,
  createProgramMonitorPlan,
  mediaSourceTimeToTimelineTime,
  normalizeRotation,
  panCropSourceWindow,
  previewDeltaToProjectDelta,
  previewPointToProjectPoint,
  resizeVisualFromOppositeCorner,
  resizeCropFromOppositeEdge,
  rotationForPointer,
  roundVisualTransformForCommit,
  roundCropForCommit,
  type CropEdge,
  type InteractiveHandlePlacement,
  type PreviewAudioPlan,
  type PreviewMediaOverlayPlan,
  type PreviewOverlayPlan,
  type PreviewQualityPreference,
  type PreviewRect,
  type PreviewVisualPlan,
  type VisualResizeCorner,
  stepPreviewTime,
} from "~/lib/editor/editor-preview";
import { mediaPreparationKey, type MediaPreparationRequest } from "~/lib/editor/media-preparation";
import {
  createVideoEditorPerformanceMetric,
  queueVideoEditorPerformanceMetric,
} from "~/lib/editor/video-performance.client";
import { createEditorCorrelationId, logVideoEditorEvent } from "~/lib/editor/editor-observability.client";
import type { VideoCrop, VideoProjectDocument, VideoProjectSettings, VideoTextStyle, VideoTransform, VideoTransition } from "~/lib/editor/video-document";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  currentTimeChanged,
  activeInspectorSectionChanged,
  modalClosed,
  modalOpened,
  muteToggled,
  playbackFrameStepped,
  playbackClockTimeChanged,
  playbackPaused,
  playbackStepChanged,
  playbackToggled,
  mediaPreparationRequested,
  mediaPreparationRetried,
  previewBufferingResolved,
  previewBufferingStarted,
  selectActiveToolId,
  selectInspectorPanelState,
  selectOverlayState,
  selectProgramMonitorState,
  selectMediaPreparationState,
  selectMediaPreparationEnabled,
  selectPreviewBufferingState,
  selectSelectedItemIds,
  selectVisualScalesLinked,
  timelineItemsSelected,
  videoOperationApplied,
} from "~/store/slices/editor-slice";
import { updateTransformCropOperation, type UpdateTextOperation } from "~/lib/editor/video-operations";

import { EditorIcon, EditorIconButton } from "../editor-ui";
import { getActiveDraggedMedia } from "~/lib/editor/editor-media";
import "~/styles/video-fonts.css";

interface PreviewPanelProps {
  className?: string;
  onMediaDrop?: (mediaId: string, placement?: { trackId?: string; timelineStart: number }) => void;
}

interface StageSize {
  width: number;
  height: number;
}

type MediaErrorMap = Record<string, string>;
type ResizeCorner = VisualResizeCorner;
type PreviewEditableVisualItem = PreviewVisualPlan["item"] | PreviewMediaOverlayPlan["item"];
type TextTransformPreview = Record<string, VideoTransform>;
type VisualTransformPreview = Record<string, VideoTransform>;
type VisualCropPreview = Record<string, { crop: VideoCrop; transform: VideoTransform }>;
type HTMLVideoElementWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

declare global {
  interface Window {
    __KUVOX_CAPTURE_PREVIEW_PNG__?: () => string | null;
  }
}
type TextGesture = {
  kind: "move" | "resize";
  itemId: string;
  startPointer: { x: number; y: number };
  startTransform: VideoTransform;
  corner?: ResizeCorner;
};
type VisualGesture = {
  kind: "move" | "resize" | "rotate";
  activated: boolean;
  pointerCaptured: boolean;
  itemId: string;
  pointerId: number;
  pointerContainer: HTMLDivElement;
  startPointer: { x: number; y: number };
  documentTransform: VideoTransform;
  renderedTransform: VideoTransform;
  mediaWidth?: number;
  mediaHeight?: number;
  corner?: ResizeCorner;
  handlePlacement?: InteractiveHandlePlacement;
};
type CropGesture = {
  kind: "pan" | "edge";
  itemId: string;
  pointerId: number;
  pointerContainer: HTMLDivElement;
  startPointer: { x: number; y: number };
  documentCrop: VideoCrop;
  documentTransform: VideoTransform;
  renderedCrop: VideoCrop;
  renderedTransform: VideoTransform;
  mediaWidth: number;
  mediaHeight: number;
  edge?: CropEdge;
  handlePlacement?: InteractiveHandlePlacement;
};

const defaultStageSize: StageSize = { width: 960, height: 540 };
const mediaClockEndEpsilon = 0.01;
const visualMoveDragThreshold = 5;
const decodedImageCache = new Map<string, HTMLImageElement>();

function findActiveTransition(document: VideoProjectDocument, currentTime: number): VideoTransition | null {
  for (const transition of document.transitions) {
    const targets = transition.targetItemIds.flatMap((itemId) =>
      document.tracks.flatMap((track) => track.items.filter((item) => item.id === itemId)),
    );
    const boundary = targets.length > 1
      ? Math.max(...targets.slice(0, -1).map((item) => item.timelineStart + item.duration))
      : targets[0]?.timelineStart;
    if (boundary !== undefined && Math.abs(currentTime - boundary) <= transition.duration / 2) {
      return transition;
    }
  }
  return null;
}

export function PreviewPanel({
  className = "",
  onMediaDrop,
}: PreviewPanelProps) {
  const [dragOverActive, setDragOverActive] = useState(false);
  const dispatch = useAppDispatch();
  const { document, playback, playbackSeekRevision, timelineDuration, soloedAudioTrackIds } = useAppSelector(selectProgramMonitorState);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const activeToolId = useAppSelector(selectActiveToolId);
  const visualScalesLinked = useAppSelector(selectVisualScalesLinked);
  const inspectorPanel = useAppSelector(selectInspectorPanelState);
  const activeModal = useAppSelector((state) => selectOverlayState(state).activeModal);
  const preparationByKey = useAppSelector(selectMediaPreparationState);
  const preparationEnabled = useAppSelector(selectMediaPreparationEnabled);
  const previewBuffering = useAppSelector(selectPreviewBufferingState);
  const [qualityPreference, setQualityPreference] = useState<PreviewQualityPreference>("balanced");
  const [timecodeDraft, setTimecodeDraft] = useState<string | null>(null);
  const [mediaErrors, setMediaErrors] = useState<MediaErrorMap>({});
  const [previewAreaSize, setPreviewAreaSize] = useElementSize(defaultStageSize);
  const [fullscreenStageSize, setFullscreenStageSize] = useElementSize(defaultStageSize);
  const mediaLayerRef = useRef<Konva.Layer>(null);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  const plan = useMemo(
    () =>
      document
        ? createProgramMonitorPlan({
          document,
          currentTime: playback.currentTime,
          previewQuality: qualityPreference,
          soloedAudioTrackIds,
          previewVolume: playback.volume,
          previewMuted: playback.muted,
        })
        : null,
    [document, playback.currentTime, playback.muted, playback.volume, qualityPreference, soloedAudioTrackIds],
  );
  const frameRate = document?.settings.frameRate ?? 30;
  const activeVideo =
    plan?.activeVideo?.item.type === "video" && plan.activeVideo.objectUrl
      ? plan.activeVideo
      : null;
  const nextVideo = useMemo(
    () => document && activeVideo
      ? nextVideoPreviewPlan({
        document,
        activeVideo,
        currentTime: playback.currentTime,
        previewQuality: qualityPreference,
        soloedAudioTrackIds,
        previewVolume: playback.volume,
        previewMuted: playback.muted,
      })
      : null,
    [activeVideo, document, playback.currentTime, playback.muted, playback.volume, qualityPreference, soloedAudioTrackIds],
  );
  const activeVideoRef = videoRefForSource(videoRefA, videoRefB, activeVideo?.objectUrl ?? null);
  const preloadVideoRef = activeVideoRef === videoRefA ? videoRefB : videoRefA;
  const activePreviewItem = useMemo(() => {
    if (!plan) return null;
    if (selectedItemIds.length === 1) {
      const selectedId = selectedItemIds[0];
      return plan.visuals.find((visual) => visual.item.id === selectedId)?.item
        ?? plan.overlays.find((overlay): overlay is PreviewMediaOverlayPlan =>
          overlay.kind === "media" && overlay.item.id === selectedId,
        )?.item
        ?? null;
    }
    return plan.activeVisual?.item ?? null;
  }, [plan, selectedItemIds]);
  const activeEffect = document && activePreviewItem
    ? document.effects.find((effect) => effect.enabled && effect.targetItemIds.includes(activePreviewItem.id))?.type ?? null
    : null;
  const visualPreviewOverlay = useMemo(
    () => getVisualPreviewOverlay(activeEffect, activePreviewItem),
    [activeEffect, activePreviewItem],
  );
  const activeTransition = document
    ? findActiveTransition(document, playback.currentTime)
    : null;
  const activeAudio = plan?.activeAudio.filter((audio) => audio.objectUrl) ?? [];
  const requiredPreparationRequests = useMemo(() => {
    if (!plan) return [];
    const requests = new Map<string, MediaPreparationRequest>();
    const add = (media: PreviewVisualPlan["media"], objectUrl: string | null, sourceTime: number | null) => {
      if (!objectUrl) return;
      const request: MediaPreparationRequest = {
        key: mediaPreparationKey(media.kind, objectUrl),
        mediaId: media.id,
        kind: media.kind,
        objectUrl,
        sourceTime: sourceTime ?? 0,
        timelineStart: playback.currentTime,
        priority: "playhead",
      };
      requests.set(request.key, request);
    };
    plan.visuals.forEach((visual) => add(visual.media, visual.objectUrl, visual.sourceTime));
    plan.overlays.forEach((overlay) => {
      if (overlay.kind === "media") add(overlay.media, overlay.objectUrl, null);
    });
    plan.activeAudio.filter((audio) => !audio.muted).forEach((audio) => add(audio.media, audio.objectUrl, audio.sourceTime));
    return [...requests.values()];
  }, [plan, playback.currentTime]);
  const activeVisualVideoObjectUrls = plan?.visuals.flatMap((visual) =>
    visual.item.type === "video" && visual.objectUrl ? [visual.objectUrl] : []
  ) ?? [];
  const primaryClockAudio = activeVideo ? null : activeAudio[0] ?? null;
  const mediaClockActive = Boolean(activeVideo || primaryClockAudio);
  const stageSize = useMemo(
    () => fitStageToArea(previewAreaSize, document?.settings),
    [document?.settings, previewAreaSize],
  );
  const displayTime = timecodeDraft ?? formatTimecode(playback.currentTime, frameRate);
  const durationTime = formatTimecode(timelineDuration, frameRate);
  const planWarnings = plan?.warnings.map((warning) => warning.message) ?? [];
  const objectErrorMessages = Object.values(mediaErrors);
  const monitorMessages = [...planWarnings, ...objectErrorMessages];
  const bufferingSignatureRef = useRef("");

  useEffect(() => {
    if (!preparationEnabled) return;
    for (const request of requiredPreparationRequests) dispatch(mediaPreparationRequested(request));
    const unready = requiredPreparationRequests.filter((request) => preparationByKey[request.key]?.status !== "ready");
    if (unready.length === 0) {
      bufferingSignatureRef.current = "";
      if (previewBuffering.buffering) {
        const durationMs = previewBuffering.startedAt === null ? 0 : Math.max(0, performance.now() - previewBuffering.startedAt);
        logVideoEditorEvent("editor.preview.buffering.end", {
          projectId: document?.projectId,
          durationMs,
          automaticResume: previewBuffering.resumeIntent,
        }, "debug");
        dispatch(previewBufferingResolved());
      }
      return;
    }
    const keys = unready.map((request) => request.key).sort();
    const signature = `${playback.currentTime}:${keys.map((key) => `${key}:${preparationByKey[key]?.status ?? "queued"}`).join("|")}`;
    if (bufferingSignatureRef.current === signature && previewBuffering.buffering) return;
    bufferingSignatureRef.current = signature;
    const failureResourceKey = keys.find((key) => preparationByKey[key]?.status === "failed");
    logVideoEditorEvent("editor.preview.buffering.start", {
      projectId: document?.projectId,
      requiredResourceCount: keys.length,
      requestedTime: playback.currentTime,
    }, "debug");
    dispatch(previewBufferingStarted({
      requestedTime: playback.currentTime,
      requiredResourceKeys: keys,
      startedAt: performance.now(),
      failureResourceKey,
    }));
  }, [dispatch, document?.projectId, playback.currentTime, preparationByKey, preparationEnabled, previewBuffering.buffering, previewBuffering.resumeIntent, previewBuffering.startedAt, requiredPreparationRequests]);

  const recordPlaybackSeek = useCallback((startedAt: number) => {
    if (!document) return;
    queueVideoEditorPerformanceMetric(
      document.projectId,
      createVideoEditorPerformanceMetric("playback-seek-latency", performance.now() - startedAt, { document }),
    );
  }, [document]);

  usePlaybackClock({
    playing: playback.playing,
    mediaClockActive,
    currentTime: playback.currentTime,
    timelineDuration,
    frameRate,
    onTimeChange: (time) => dispatch(playbackClockTimeChanged(time)),
    onEnd: () => dispatch(playbackPaused()),
  });

  useVideoElementSync({
    ref: activeVideoRef,
    activeVideo,
    seekRevision: playbackSeekRevision,
    playing: playback.playing,
    muted: activeVideo?.audioMuted ?? playback.muted,
    volume: activeVideo?.audioVolume ?? playback.volume,
    activeVisualObjectUrls: activeVisualVideoObjectUrls,
    timelineDuration,
    onTimeChange: (time) => dispatch(playbackClockTimeChanged(time)),
    onEnd: () => dispatch(playbackPaused()),
    onError: (message) => {
      logMediaObjectFailure(document?.projectId, activeVideo?.media.id, activeVideo?.item.id, activeVideo?.objectVariant, "video", message);
      setMediaErrors((errors) => ({ ...errors, video: message }));
      dispatch(playbackPaused());
    },
    onDrawNeeded: () => mediaLayerRef.current?.batchDraw(),
  });
  useVideoElementPreload({
    ref: preloadVideoRef,
    video: nextVideo,
    activeObjectUrl: activeVideo?.objectUrl ?? null,
  });

  useEffect(() => {
    setMediaErrors({});
  }, [activeVideo?.objectUrl, activeAudioSignature(activeAudio)]);

  const seekToTimecode = useCallback(() => {
    if (timecodeDraft === null) {
      return;
    }

    const startedAt = performance.now();
    const parsed = parseTimecode(timecodeDraft, frameRate);
    if (parsed !== null) {
      dispatch(currentTimeChanged(parsed));
      recordPlaybackSeek(startedAt);
    }
    setTimecodeDraft(null);
  }, [dispatch, frameRate, recordPlaybackSeek, timecodeDraft]);

  const seekByFrame = useCallback(
    (direction: -1 | 1) => {
      if (!document) {
        return;
      }

      const startedAt = performance.now();
      dispatch(playbackFrameStepped(direction));
      recordPlaybackSeek(startedAt);
    },
    [dispatch, document, recordPlaybackSeek],
  );

  const seekToEnd = useCallback(() => {
    const startedAt = performance.now();
    dispatch(currentTimeChanged(timelineDuration));
    recordPlaybackSeek(startedAt);
  }, [dispatch, recordPlaybackSeek, timelineDuration]);

  const seekToStart = useCallback(() => {
    const startedAt = performance.now();
    dispatch(currentTimeChanged(0));
    recordPlaybackSeek(startedAt);
  }, [dispatch, recordPlaybackSeek]);

  const stepPlayback = useCallback((seconds: number) => {
    const startedAt = performance.now();
    dispatch(playbackStepChanged(seconds));
    recordPlaybackSeek(startedAt);
  }, [dispatch, recordPlaybackSeek]);

  const selectTextOverlay = useCallback((itemId: string) => {
    dispatch(timelineItemsSelected({ itemIds: [itemId], activeItemId: itemId }));
  }, [dispatch]);

  const selectVisual = useCallback((itemId: string) => {
    dispatch(timelineItemsSelected({ itemIds: [itemId], activeItemId: itemId }));
  }, [dispatch]);

  const commitVisualTransform = useCallback((itemId: string, transform: VideoTransform) => {
    dispatch(videoOperationApplied(updateTransformCropOperation(itemId, { transform }, "Move visual")));
  }, [dispatch]);
  const commitVisualCrop = useCallback((
    itemId: string,
    crop: VideoCrop,
    transform?: VideoTransform,
  ) => {
    dispatch(videoOperationApplied(updateTransformCropOperation(
      itemId,
      { crop, ...(transform ? { transform } : {}) },
      transform ? "Resize crop" : "Pan crop",
    )));
  }, [dispatch]);

  const commitTextTransform = useCallback((itemId: string, transform: VideoTransform) => {
    const timestamp = new Date().toISOString();
    const operation: UpdateTextOperation = {
      id: `preview-text-transform-${itemId}-${timestamp.replace(/[-:.TZ]/g, "")}`,
      source: "manual",
      timestamp,
      label: "Update text transform",
      affectedEntityIds: [itemId],
      type: "updateText",
      itemId,
      transform,
    };
    dispatch(videoOperationApplied(operation));
  }, [dispatch]);

  return (
    <main
      data-tour="preview-panel"
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest"
    >
      <video ref={videoRefA} data-preview-video-slot="a" className="pointer-events-none absolute h-px w-px opacity-0" playsInline preload="auto" />
      <video ref={videoRefB} data-preview-video-slot="b" className="pointer-events-none absolute h-px w-px opacity-0" playsInline preload="auto" />
      {activeAudio.map((audioPlan) => (
        <PreviewAudioElement
          key={audioPlan.item.id}
          activeAudio={audioPlan}
          seekRevision={playbackSeekRevision}
          playing={playback.playing}
          primaryClock={primaryClockAudio?.item.id === audioPlan.item.id}
          timelineDuration={timelineDuration}
          onTimeChange={(time) => dispatch(playbackClockTimeChanged(time))}
          onEnd={() => dispatch(playbackPaused())}
          onError={(message) => {
            logMediaObjectFailure(document?.projectId, audioPlan.media.id, audioPlan.item.id, audioPlan.objectVariant, "audio", message);
            setMediaErrors((errors) => ({ ...errors, [`audio:${audioPlan.item.id}`]: message }));
            dispatch(playbackPaused());
          }}
        />
      ))}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1.5 lg:p-2 2xl:p-3">
        <div
          ref={setPreviewAreaSize.ref}
          className="flex h-full w-full items-center justify-center overflow-hidden"
        >
          <div
            className={`relative overflow-hidden rounded-[6px] border bg-black shadow-[0_18px_50px_rgba(0,0,0,0.38)] transition-colors duration-200 ${dragOverActive ? "border-primary" : "border-outline-variant"
              }`}
            style={{
              width: stageSize.width,
              height: stageSize.height,
              filter: getPreviewCSSFilter(activeEffect, activePreviewItem),
            }}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("application/x-kuvox-media-id")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragOverActive(true);
            }}
            onDragLeave={() => {
              setDragOverActive(false);
            }}
            onDrop={(event) => {
              setDragOverActive(false);
              let mediaId = event.dataTransfer.getData("application/x-kuvox-media-id");
              if (!mediaId) {
                const activeDrag = getActiveDraggedMedia();
                if (activeDrag) {
                  mediaId = activeDrag.id;
                }
              }
              if (!mediaId) return;
              event.preventDefault();
              onMediaDrop?.(mediaId, { timelineStart: playback.currentTime });
            }}
          >
            <ProgramMonitorStage
              plan={plan}
              stageSize={stageSize}
              activeVideoId={activeVideo?.item.id ?? null}
              activeVideoElement={activeVideoRef.current}
              videoElements={[videoRefA.current, videoRefB.current]}
              playing={playback.playing}
              mediaLayerRef={mediaLayerRef}
              messages={monitorMessages}
              fallbackTitle={document?.name ?? "Untitled video"}
              selectedItemIds={selectedItemIds}
              selectToolActive={activeToolId === "select"}
              visualScalesLinked={visualScalesLinked}
              cropModeRequested={inspectorPanel.open && inspectorPanel.activeSection === "crop"}
              onSelectVisual={selectVisual}
              onCommitVisualTransform={commitVisualTransform}
              onCommitVisualCrop={commitVisualCrop}
              onExitCropMode={() => dispatch(activeInspectorSectionChanged("transform"))}
              onSelectTextOverlay={selectTextOverlay}
              onCommitTextTransform={commitTextTransform}
            />
            {previewBuffering.buffering ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55">
                <div className="flex max-w-[260px] flex-col items-center gap-2 rounded-[6px] border border-white/15 bg-surface-container-high px-4 py-3 text-center shadow-xl">
                  <EditorIcon className={`text-[24px] ${previewBuffering.failureResourceKey ? "text-error" : "animate-spin text-primary motion-reduce:animate-none"}`}>
                    {previewBuffering.failureResourceKey ? "error" : "progress_activity"}
                  </EditorIcon>
                  <span className="text-body-sm font-semibold text-on-surface">
                    {previewBuffering.failureResourceKey ? "Media preparation failed" : "Preparing media"}
                  </span>
                  {previewBuffering.failureResourceKey ? (
                    <button
                      type="button"
                      className="rounded-[4px] bg-primary px-3 py-1.5 text-label-md font-semibold text-on-primary"
                      onClick={() => dispatch(mediaPreparationRetried(previewBuffering.failureResourceKey!))}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {visualPreviewOverlay.vignetteOpacity > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-30"
                style={{
                  background: `radial-gradient(circle, transparent 42%, rgba(0,0,0,${visualPreviewOverlay.vignetteOpacity}) 100%)`,
                }}
              />
            )}
            {visualPreviewOverlay.grainOpacity > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-30 mix-blend-overlay"
                style={{
                  opacity: visualPreviewOverlay.grainOpacity,
                  backgroundImage:
                    "repeating-radial-gradient(circle at 17% 23%, rgba(255,255,255,0.42) 0 1px, transparent 1px 4px), repeating-linear-gradient(115deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 5px)",
                }}
              />
            )}
            {visualPreviewOverlay.maskWindowStyle && (
              <div className="pointer-events-none absolute z-30" style={visualPreviewOverlay.maskWindowStyle} />
            )}
            {activeTransition && (
              <TransitionPreviewOverlay
                key={`${activeTransition.id}:${Math.floor(playback.currentTime * frameRate)}`}
                transitionType={activeTransition.type}
              />
            )}
            <style>{`
              @keyframes kuvoxFadeInOut {
                0% { opacity: 0; }
                40% { opacity: 1; }
                60% { opacity: 1; }
                100% { opacity: 0; }
              }
              @keyframes kuvoxFlashInOut {
                0% { opacity: 0; }
                25% { opacity: 1; }
                100% { opacity: 0; }
              }
              .animate-fade-in-out {
                animation: kuvoxFadeInOut 0.8s ease-in-out forwards;
              }
              .animate-flash-in-out {
                animation: kuvoxFlashInOut 0.6s ease-out forwards;
              }
            `}</style>
            {dragOverActive && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 pointer-events-none">
                <div className="rounded-[6px] border border-primary/30 bg-surface-container-high/90 px-4 py-2 text-label-md font-semibold text-primary shadow-lg backdrop-blur-sm">
                  Drop to insert at playhead ({formatTimecode(playback.currentTime, frameRate)})
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-outline-variant bg-surface px-2 lg:px-3 2xl:h-14 2xl:px-4">
        <div className="flex min-w-0 items-center font-mono text-[13px] font-semibold tracking-widest">
          <input
            aria-label="Current timecode"
            data-editor-shortcuts="ignore"
            value={displayTime}
            onChange={(event) => setTimecodeDraft(event.target.value)}
            onBlur={seekToTimecode}
            onFocus={() => setTimecodeDraft(formatTimecode(playback.currentTime, frameRate))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setTimecodeDraft(null);
                event.currentTarget.blur();
              }
            }}
            className="w-[106px] rounded-[4px] bg-transparent text-primary outline-none transition-colors hover:bg-white/5 focus:bg-surface-container-high px-1 py-1"
          />
          <span className="px-1 text-on-surface-variant/40">/</span>
          <span className="text-on-surface-variant">{durationTime}</span>
        </div>

        <div className="flex items-center justify-center gap-1 lg:gap-1.5 2xl:gap-3">
          <EditorIconButton
            icon="skip_previous"
            label="Start"
            className="hidden h-8 w-8 lg:flex"
            onClick={seekToStart}
          />
          <EditorIconButton
            icon="first_page"
            label="Previous frame"
            className="hidden h-8 w-8 md:flex"
            onClick={() => seekByFrame(-1)}
          />
          <EditorIconButton
            icon="fast_rewind"
            label="Rewind"
            className="h-8 w-8"
            onClick={() => stepPlayback(-5)}
          />
          <button
            type="button"
            onClick={() => dispatch(playbackToggled())}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-opacity hover:opacity-90 motion-reduce:transition-none"
            aria-label={playback.playing ? "Pause" : "Play"}
          >
            <EditorIcon filled>{playback.playing ? "pause" : "play_arrow"}</EditorIcon>
          </button>
          <EditorIconButton
            icon="fast_forward"
            label="Forward"
            className="h-8 w-8"
            onClick={() => stepPlayback(5)}
          />
          <EditorIconButton
            icon="last_page"
            label="Next frame"
            className="hidden h-8 w-8 md:flex"
            onClick={() => seekByFrame(1)}
          />
          <EditorIconButton
            icon="skip_next"
            label="End"
            className="hidden h-8 w-8 lg:flex"
            onClick={seekToEnd}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <div className="hidden items-center rounded-[4px] border border-outline-variant bg-surface-container-low p-0.5 lg:flex">
            {(["balanced", "full"] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => setQualityPreference(quality)}
                className={`h-7 rounded-[3px] px-2 text-label-sm font-semibold capitalize ${qualityPreference === quality
                    ? "bg-surface-container-high text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                  }`}
              >
                {quality === "balanced" ? "Proxy" : "Full"}
              </button>
            ))}
          </div>
          <EditorIconButton
            icon={playback.muted ? "volume_off" : "volume_up"}
            label={playback.muted ? "Unmute" : "Mute"}
            active={playback.muted}
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

      {activeModal === "fullscreen" ? (
        <div className="fixed inset-0 z-[76] flex flex-col bg-black">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
            <div className="flex items-center font-mono text-[13px] font-semibold tracking-widest">
              <span className="text-primary">{formatTimecode(playback.currentTime, frameRate)}</span>
              <span className="px-2 text-white/30">/</span>
              <span className="text-white/70">{durationTime}</span>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white/75 hover:bg-white/10 hover:text-white"
              aria-label="Close fullscreen preview"
              onClick={() => dispatch(modalClosed())}
            >
              <EditorIcon className="text-[20px]">close</EditorIcon>
            </button>
          </div>
          <div ref={setFullscreenStageSize.ref} className="min-h-0 flex-1">
            <ProgramMonitorStage
              plan={plan}
              stageSize={fullscreenStageSize}
              activeVideoId={activeVideo?.item.id ?? null}
              activeVideoElement={activeVideoRef.current}
              videoElements={[videoRefA.current, videoRefB.current]}
              playing={playback.playing}
              mediaLayerRef={mediaLayerRef}
              messages={monitorMessages}
              fallbackTitle={document?.name ?? "Untitled video"}
              selectedItemIds={selectedItemIds}
              selectToolActive={activeToolId === "select"}
              visualScalesLinked={visualScalesLinked}
              cropModeRequested={inspectorPanel.open && inspectorPanel.activeSection === "crop"}
              onSelectVisual={selectVisual}
              onCommitVisualTransform={commitVisualTransform}
              onCommitVisualCrop={commitVisualCrop}
              onExitCropMode={() => dispatch(activeInspectorSectionChanged("transform"))}
              onSelectTextOverlay={selectTextOverlay}
              onCommitTextTransform={commitTextTransform}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ProgramMonitorStage({
  plan,
  stageSize,
  activeVideoId,
  activeVideoElement,
  videoElements,
  playing,
  mediaLayerRef,
  messages,
  fallbackTitle,
  selectedItemIds,
  selectToolActive,
  visualScalesLinked,
  cropModeRequested,
  onSelectVisual,
  onCommitVisualTransform,
  onCommitVisualCrop,
  onExitCropMode,
  onSelectTextOverlay,
  onCommitTextTransform,
}: {
  plan: ReturnType<typeof createProgramMonitorPlan> | null;
  stageSize: StageSize;
  activeVideoId: string | null;
  activeVideoElement: HTMLVideoElement | null;
  videoElements: Array<HTMLVideoElement | null>;
  playing: boolean;
  mediaLayerRef: RefObject<Konva.Layer | null>;
  messages: string[];
  fallbackTitle: string;
  selectedItemIds: string[];
  selectToolActive: boolean;
  visualScalesLinked: boolean;
  cropModeRequested: boolean;
  onSelectVisual: (itemId: string) => void;
  onCommitVisualTransform: (itemId: string, transform: VideoTransform) => void;
  onCommitVisualCrop: (itemId: string, crop: VideoCrop, transform?: VideoTransform) => void;
  onExitCropMode: () => void;
  onSelectTextOverlay: (itemId: string) => void;
  onCommitTextTransform: (itemId: string, transform: VideoTransform) => void;
}) {
  const settings = plan?.settings ?? {
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    frameRate: 30,
    previewQuality: "balanced" as const,
    defaultTransitionDuration: 0.4,
    exportPreset: "h264-1080p",
  };
  const frameBounds = computeFrameBounds(stageSize.width, stageSize.height, settings.width, settings.height);
  const safeGuides = computeSafeGuides(frameBounds);
  const selectedTextIds = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const [textPreview, setTextPreview] = useState<TextTransformPreview>({});
  const [visualPreview, setVisualPreview] = useState<VisualTransformPreview>({});
  const [cropPreview, setCropPreview] = useState<VisualCropPreview>({});
  const textGestureRef = useRef<TextGesture | null>(null);
  const visualGestureRef = useRef<VisualGesture | null>(null);
  const cropGestureRef = useRef<CropGesture | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("previewTest")) return;
    window.__KUVOX_CAPTURE_PREVIEW_PNG__ = () => {
      const stage = stageRef.current;
      if (!stage || frameBounds.width <= 0) return null;
      return stage.toCanvas({
        x: frameBounds.x,
        y: frameBounds.y,
        width: frameBounds.width,
        height: frameBounds.height,
        pixelRatio: settings.width / frameBounds.width,
      }).toDataURL("image/png");
    };
    return () => {
      delete window.__KUVOX_CAPTURE_PREVIEW_PNG__;
    };
  }, [frameBounds.height, frameBounds.width, frameBounds.x, frameBounds.y, settings.width]);

  const clearVisualPreview = useCallback((itemId: string) => {
    setVisualPreview((current) => {
      if (!current[itemId]) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const cancelVisualGesture = useCallback(() => {
    const gesture = visualGestureRef.current;
    if (!gesture) return;
    visualGestureRef.current = null;
    if (gesture.pointerCaptured) {
      try {
        gesture.pointerContainer.releasePointerCapture(gesture.pointerId);
      } catch {
        // The pointer may already be released by the browser.
      }
    }
    clearVisualPreview(gesture.itemId);
  }, [clearVisualPreview]);

  const clearCropPreview = useCallback((itemId: string) => {
    setCropPreview((current) => {
      if (!current[itemId]) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const cancelCropGesture = useCallback(() => {
    const gesture = cropGestureRef.current;
    if (!gesture) return;
    cropGestureRef.current = null;
    try {
      gesture.pointerContainer.releasePointerCapture(gesture.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
    clearCropPreview(gesture.itemId);
  }, [clearCropPreview]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (cropGestureRef.current) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        cancelCropGesture();
        return;
      }
      if (visualGestureRef.current) {
        event.preventDefault();
        event.stopPropagation();
        cancelVisualGesture();
      }
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [cancelCropGesture, cancelVisualGesture]);

  useEffect(() => {
    const gesture = visualGestureRef.current;
    if (!gesture) return;
    if (!selectToolActive || selectedItemIds.length !== 1 || selectedItemIds[0] !== gesture.itemId) {
      cancelVisualGesture();
    }
  }, [cancelVisualGesture, selectToolActive, selectedItemIds]);

  useEffect(() => {
    const cancelPendingVisualClick = (event: PointerEvent) => {
      const gesture = visualGestureRef.current;
      if (!gesture || gesture.activated || event.pointerId !== gesture.pointerId) return;
      cancelVisualGesture();
    };
    const cancelVisualOnBlur = () => cancelVisualGesture();

    window.addEventListener("pointerup", cancelPendingVisualClick, true);
    window.addEventListener("pointercancel", cancelPendingVisualClick, true);
    window.addEventListener("blur", cancelVisualOnBlur);
    return () => {
      window.removeEventListener("pointerup", cancelPendingVisualClick, true);
      window.removeEventListener("pointercancel", cancelPendingVisualClick, true);
      window.removeEventListener("blur", cancelVisualOnBlur);
    };
  }, [cancelVisualGesture]);

  useEffect(() => {
    const gesture = cropGestureRef.current;
    if (!gesture) return;
    if (!cropModeRequested || selectedItemIds.length !== 1 || selectedItemIds[0] !== gesture.itemId) {
      cancelCropGesture();
    }
  }, [cancelCropGesture, cropModeRequested, selectedItemIds]);

  const handleVisualGestureStart = useCallback((
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
    kind: VisualGesture["kind"] = "move",
    corner?: ResizeCorner,
    handlePlacement?: InteractiveHandlePlacement,
  ) => {
    if (!selectToolActive || event.evt.isPrimary === false) return;
    if (event.evt.pointerType === "mouse" && event.evt.button !== 0) return;
    event.cancelBubble = true;
    if (kind === "move") onSelectVisual(visual.item.id);

    const track = plan?.document.tracks.find((candidate) =>
      candidate.items.some((item) => item.id === visual.item.id),
    );
    if (!track || track.locked || track.hidden) return;

    const documentItem = track.items.find((item) => item.id === visual.item.id);
    if (!documentItem || (documentItem.type !== "video" && documentItem.type !== "image")) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;

    const pointerId = event.evt.pointerId ?? 0;
    const pointerContainer = event.target.getStage()?.container();
    if (!pointerContainer) return;
    const activated = kind !== "move";
    let pointerCaptured = false;
    if (activated) {
      try {
        pointerContainer.setPointerCapture(pointerId);
        pointerCaptured = true;
      } catch {
        // Pointer capture can fail when the browser has already released the pointer.
      }
    }
    visualGestureRef.current = {
      kind,
      activated,
      pointerCaptured,
      itemId: visual.item.id,
      pointerId,
      pointerContainer,
      startPointer: handlePlacement ? applyHandlePointerOffset(pointer, handlePlacement) : pointer,
      documentTransform: { ...documentItem.transform },
      renderedTransform: { ...visual.item.transform },
      mediaWidth: visual.media.width,
      mediaHeight: visual.media.height,
      corner,
      handlePlacement,
    };
  }, [onSelectVisual, plan?.document.tracks, selectToolActive]);

  const updateVisualGesturePreview = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = visualGestureRef.current;
    if (!gesture) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    if (gesture.kind === "move" && !gesture.activated) {
      const distance = Math.hypot(
        pointer.x - gesture.startPointer.x,
        pointer.y - gesture.startPointer.y,
      );
      if (distance < visualMoveDragThreshold) return;
      gesture.activated = true;
      try {
        gesture.pointerContainer.setPointerCapture(gesture.pointerId);
        gesture.pointerCaptured = true;
      } catch {
        // The drag can continue inside the preview even if capture is unavailable.
      }
    }
    const next = transformsForVisualGesture({
      gesture,
      pointer,
      shiftKey: event.evt.shiftKey,
      frameBounds,
      settings,
      visualScalesLinked,
    });
    setVisualPreview({
      [gesture.itemId]: next.rendered,
    });
  }, [frameBounds, settings, visualScalesLinked]);

  const commitVisualGesture = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = visualGestureRef.current;
    if (!gesture) return;
    visualGestureRef.current = null;
    clearVisualPreview(gesture.itemId);
    if (!gesture.activated) return;
    const pointer = event.target.getStage()?.getPointerPosition() ?? gesture.startPointer;
    const next = transformsForVisualGesture({
      gesture,
      pointer,
      shiftKey: event.evt.shiftKey,
      frameBounds,
      settings,
      visualScalesLinked,
    });
    const nextTransform = roundVisualTransformForCommit(next.document);
    if (gesture.pointerCaptured) {
      try {
        gesture.pointerContainer.releasePointerCapture(gesture.pointerId);
      } catch {
        // The pointer may already be released by the browser.
      }
    }
    if (!sameTransform(nextTransform, gesture.documentTransform)) {
      onCommitVisualTransform(gesture.itemId, nextTransform);
    }
  }, [clearVisualPreview, frameBounds, onCommitVisualTransform, settings, visualScalesLinked]);

  const handleCropGestureStart = useCallback((
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
    kind: CropGesture["kind"],
    edge?: CropEdge,
    handlePlacement?: InteractiveHandlePlacement,
  ) => {
    if (event.evt.isPrimary === false) return;
    if (event.evt.pointerType === "mouse" && event.evt.button !== 0) return;
    const width = visual.media.width;
    const height = visual.media.height;
    if (!width || !height) return;
    const track = plan?.document.tracks.find((candidate) => candidate.items.some((item) => item.id === visual.item.id));
    const documentItem = track?.items.find((item) => item.id === visual.item.id);
    if (!track || track.locked || track.hidden || !documentItem || documentItem.type === "audio" || documentItem.type === "text") return;
    const pointer = event.target.getStage()?.getPointerPosition();
    const pointerContainer = event.target.getStage()?.container();
    if (!pointer || !pointerContainer) return;
    event.cancelBubble = true;
    const pointerId = event.evt.pointerId ?? 0;
    try {
      pointerContainer.setPointerCapture(pointerId);
    } catch {
      // Pointer capture can fail when the browser has already released the pointer.
    }
    cropGestureRef.current = {
      kind,
      itemId: visual.item.id,
      pointerId,
      pointerContainer,
      startPointer: handlePlacement ? applyHandlePointerOffset(pointer, handlePlacement) : pointer,
      documentCrop: { ...documentItem.crop },
      documentTransform: { ...documentItem.transform },
      renderedCrop: { ...visual.item.crop },
      renderedTransform: { ...visual.item.transform },
      mediaWidth: width,
      mediaHeight: height,
      edge,
      handlePlacement,
    };
  }, [plan?.document.tracks]);

  const updateCropGesturePreview = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = cropGestureRef.current;
    if (!gesture) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const next = cropResultForGesture({ gesture, pointer, frameBounds, settings });
    setCropPreview({ [gesture.itemId]: next });
  }, [frameBounds, settings]);

  const commitCropGesture = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = cropGestureRef.current;
    if (!gesture) return;
    const pointer = event.target.getStage()?.getPointerPosition() ?? gesture.startPointer;
    const evaluatedNext = cropResultForGesture({ gesture, pointer, frameBounds, settings });
    const rawNext = applyEvaluatedCropTransformDeltasToRaw({
      rawCrop: gesture.documentCrop,
      rawTransform: gesture.documentTransform,
      evaluatedCrop: gesture.renderedCrop,
      evaluatedTransform: gesture.renderedTransform,
      nextEvaluatedCrop: evaluatedNext.crop,
      nextEvaluatedTransform: evaluatedNext.transform,
    });
    const crop = roundCropForCommit(rawNext.crop, gesture.mediaWidth, gesture.mediaHeight);
    const transform = roundVisualTransformForCommit(rawNext.transform);
    cropGestureRef.current = null;
    clearCropPreview(gesture.itemId);
    try {
      gesture.pointerContainer.releasePointerCapture(gesture.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
    if (!sameCrop(crop, gesture.documentCrop) || (gesture.kind === "edge" && !sameTransform(transform, gesture.documentTransform))) {
      onCommitVisualCrop(gesture.itemId, crop, gesture.kind === "edge" ? transform : undefined);
    }
  }, [clearCropPreview, frameBounds, onCommitVisualCrop, settings]);

  const handleTextGestureStart = useCallback((
    event: Konva.KonvaEventObject<PointerEvent>,
    itemId: string,
    transform: VideoTransform,
    kind: "move" | "resize",
    corner?: ResizeCorner,
  ) => {
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    event.cancelBubble = true;
    onSelectTextOverlay(itemId);
    textGestureRef.current = {
      kind,
      itemId,
      startPointer: pointer,
      startTransform: { ...transform },
      corner,
    };
  }, [onSelectTextOverlay]);

  const updateTextGesturePreview = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = textGestureRef.current;
    if (!gesture) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const nextTransform = transformForTextGesture(gesture, pointer, frameBounds, settings);
    setTextPreview((current) => ({ ...current, [gesture.itemId]: nextTransform }));
  }, [frameBounds, settings]);

  const commitTextGesture = useCallback((event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = textGestureRef.current;
    if (!gesture) return;
    const pointer = event.target.getStage()?.getPointerPosition() ?? gesture.startPointer;
    const nextTransform = transformForTextGesture(gesture, pointer, frameBounds, settings);
    textGestureRef.current = null;
    setTextPreview((current) => {
      const next = { ...current };
      delete next[gesture.itemId];
      return next;
    });
    if (!sameTransform(nextTransform, gesture.startTransform)) {
      onCommitTextTransform(gesture.itemId, nextTransform);
    }
  }, [frameBounds, onCommitTextTransform, settings]);

  const hasActiveVisual = Boolean(plan?.visuals.length);
  const selectedVisual = useMemo(() => {
    if (selectedItemIds.length !== 1) return null;
    const selectedId = selectedItemIds[0];
    return plan?.visuals.find((visual) => visual.item.id === selectedId)
      ?? plan?.overlays.find((overlay): overlay is PreviewMediaOverlayPlan =>
        overlay.kind === "media" && overlay.item.id === selectedId,
      )
      ?? null;
  }, [plan?.overlays, plan?.visuals, selectedItemIds]);
  const selectedVisualEditable = useMemo(() => {
    if (!selectedVisual) return false;
    const track = plan?.document.tracks.find((candidate) =>
      candidate.items.some((item) => item.id === selectedVisual.item.id),
    );
    return Boolean(track && !track.locked && !track.hidden);
  }, [plan?.document.tracks, selectedVisual]);
  const cropModeActive = Boolean(
    cropModeRequested &&
    selectedVisual &&
    selectedVisualEditable &&
    selectedVisual.media.width && selectedVisual.media.width > 0 &&
    selectedVisual.media.height && selectedVisual.media.height > 0,
  );

  useEffect(() => {
    if (!cropGestureRef.current) return;
    if (!cropModeActive || cropGestureRef.current.itemId !== selectedVisual?.item.id) cancelCropGesture();
  }, [cancelCropGesture, cropModeActive, selectedVisual?.item.id]);

  useEffect(() => {
    function handleCropModeEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !cropModeActive || cropGestureRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      onExitCropMode();
    }
    window.addEventListener("keydown", handleCropModeEscape, true);
    return () => window.removeEventListener("keydown", handleCropModeEscape, true);
  }, [cropModeActive, onExitCropMode]);

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      className="h-full w-full bg-black"
      onPointerMove={(event) => {
        updateTextGesturePreview(event);
        updateVisualGesturePreview(event);
        updateCropGesturePreview(event);
      }}
      onPointerUp={(event) => {
        commitTextGesture(event);
        commitVisualGesture(event);
        commitCropGesture(event);
      }}
      onPointerCancel={(event) => {
        commitTextGesture(event);
        cancelVisualGesture();
        cancelCropGesture();
      }}
    >
      <Layer>
        <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#050505" />
        <Rect
          {...frameBounds}
          fill="#070707"
          stroke={hasActiveVisual ? "transparent" : "rgba(255,255,255,0.18)"}
          strokeWidth={hasActiveVisual ? 0 : 1}
        />
      </Layer>

      <Layer ref={mediaLayerRef}>
        <Group clip={frameBounds}>
          {plan?.visuals.length ? (
            plan.visuals.map((visual) => (
              <VisualNode
                key={visual.item.id}
                visual={visual}
                projectId={plan.document.projectId}
                clockVideo={visual.item.id === activeVideoId}
                videoElement={visual.item.id === activeVideoId
                  ? activeVideoElement
                  : videoElementForSource(videoElements, visual.item.type === "video" ? visual.objectUrl : null)}
                playing={playing}
                frameBounds={frameBounds}
                settings={settings}
                interactive={selectToolActive && !cropModeActive}
                previewTransform={visualPreview[visual.item.id]}
                cropPreview={cropPreview[visual.item.id]}
                cropModeActive={cropModeActive && selectedVisual?.item.id === visual.item.id}
                onGestureStart={handleVisualGestureStart}
              />
            ))
          ) : (
            <EmptyFrame frameBounds={frameBounds} />
          )}
          {plan?.overlays.map((overlay) => (
            <OverlayNode
              key={overlay.item.id}
              overlay={overlay}
              projectId={plan.document.projectId}
              frameBounds={frameBounds}
              settings={settings}
              selected={selectedTextIds.has(overlay.item.id)}
              visualInteractive={selectToolActive && !cropModeActive}
              visualPreviewTransform={visualPreview[overlay.item.id]}
              cropPreview={cropPreview[overlay.item.id]}
              cropModeActive={cropModeActive && selectedVisual?.item.id === overlay.item.id}
              onVisualGestureStart={handleVisualGestureStart}
              previewTransform={textPreview[overlay.item.id]}
              onTextGestureStart={handleTextGestureStart}
            />
          ))}
        </Group>
      </Layer>

      <Layer>
        {selectedVisual && selectedVisualEditable && selectToolActive && !cropModeActive ? (
          <VisualTransformOverlay
            visual={selectedVisual}
            frameBounds={frameBounds}
            stageSize={stageSize}
            settings={settings}
            previewTransform={visualPreview[selectedVisual.item.id]}
            onGestureStart={handleVisualGestureStart}
          />
        ) : null}
        {selectedVisual && cropModeActive ? (
          <VisualCropOverlay
            visual={selectedVisual}
            frameBounds={frameBounds}
            stageSize={stageSize}
            settings={settings}
            preview={cropPreview[selectedVisual.item.id]}
            onGestureStart={handleCropGestureStart}
          />
        ) : null}
        {!hasActiveVisual && safeGuides.map((guide, index) => (
          <Rect
            key={index}
            {...guide}
            stroke={index === 0 ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.22)"}
            strokeWidth={1}
            dash={[8, 8]}
          />
        ))}
        {messages[0] ? <MonitorMessage frameBounds={frameBounds} message={messages[0]} /> : null}
      </Layer>
    </Stage>
  );
}

function VisualNode({
  visual,
  projectId,
  clockVideo,
  videoElement,
  playing,
  frameBounds,
  settings,
  interactive,
  previewTransform,
  cropPreview,
  cropModeActive,
  onGestureStart,
}: {
  visual: PreviewVisualPlan;
  projectId: string;
  clockVideo: boolean;
  videoElement: HTMLVideoElement | null;
  playing: boolean;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  interactive: boolean;
  previewTransform?: VideoTransform;
  cropPreview?: { crop: VideoCrop; transform: VideoTransform };
  cropModeActive: boolean;
  onGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
  ) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const image = useLoadedImage(visual.item.type === "video" ? null : visual.objectUrl, () => {
    logMediaObjectFailure(
      projectId,
      visual.media.id,
      visual.item.id,
      visual.objectVariant,
      "image",
      "Preview image could not be decoded.",
    );
  });
  const layerVideoElement = useLayerVideoElement({
    enabled: visual.item.type === "video" && videoElement === null,
    objectUrl: visual.item.type === "video" ? visual.objectUrl : null,
    sourceTime: visual.item.type === "video" ? visual.sourceTime ?? 0 : 0,
    speed: visual.item.type === "video" ? visual.item.speed : 1,
    playing,
    muted: visual.audioMuted ?? true,
    volume: visual.audioVolume ?? 0,
    onError: () => {
      logMediaObjectFailure(
        projectId,
        visual.media.id,
        visual.item.id,
        visual.objectVariant,
        "video",
        "Preview video could not be decoded.",
      );
    },
    onDrawNeeded: () => groupRef.current?.getLayer()?.batchDraw(),
  });
  useExistingLayerVideoPlayback({
    enabled: visual.item.type === "video" && videoElement !== null && !clockVideo,
    video: videoElement,
    sourceTime: visual.item.type === "video" ? visual.sourceTime ?? 0 : 0,
    speed: visual.item.type === "video" ? visual.item.speed : 1,
    playing,
    muted: visual.audioMuted ?? true,
    volume: visual.audioVolume ?? 0,
    onError: () => {
      logMediaObjectFailure(
        projectId,
        visual.media.id,
        visual.item.id,
        visual.objectVariant,
        "video",
        "Preview video could not continue playback.",
      );
    },
    onDrawNeeded: () => groupRef.current?.getLayer()?.batchDraw(),
  });
  const transform = cropPreview?.transform ?? previewTransform ?? visual.item.transform;
  const crop = cropPreview?.crop ?? visual.item.crop;
  const geometry = computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: visual.media.width,
    mediaHeight: visual.media.height,
    transform,
    crop,
  });
  const sourceCrop = computeCroppedSourceGeometry(
    visual.media.width ?? settings.width,
    visual.media.height ?? settings.height,
    crop,
  );
  const densityX = sourceCrop.width > 0 ? geometry.width / sourceCrop.width : 0;
  const densityY = sourceCrop.height > 0 ? geometry.height / sourceCrop.height : 0;
  const opacity = "opacity" in visual.item ? visual.item.opacity : 1;
  const sourceImage = visual.item.type === "video" ? videoElement ?? layerVideoElement : image;

  return (
    <Group
      ref={groupRef}
      name={`preview-visual-${visual.item.id}`}
      listening={interactive}
      onPointerDown={(event) => onGestureStart(event, visual)}
    >
      <Group
        x={geometry.center.x}
        y={geometry.center.y}
        rotation={geometry.rotation}
        scaleX={transform.scaleX < 0 ? -1 : 1}
        scaleY={transform.scaleY < 0 ? -1 : 1}
      >
        {!visual.objectUrl || !sourceImage ? (
          <MediaPlaceholder bounds={{ x: -geometry.width / 2, y: -geometry.height / 2, width: geometry.width, height: geometry.height }} label={visual.media.name} />
        ) : (
          <>
            {cropModeActive ? (
              <KonvaImage
                name={`preview-crop-ghost-${visual.item.id}`}
                image={sourceImage}
                x={-geometry.width / 2 - sourceCrop.x * densityX}
                y={-geometry.height / 2 - sourceCrop.y * densityY}
                width={(visual.media.width ?? settings.width) * densityX}
                height={(visual.media.height ?? settings.height) * densityY}
                opacity={opacity * 0.3}
                listening={false}
              />
            ) : null}
            <KonvaImage
              image={sourceImage}
              x={-geometry.width / 2}
              y={-geometry.height / 2}
              width={geometry.width}
              height={geometry.height}
              cropX={sourceCrop.x}
              cropY={sourceCrop.y}
              cropWidth={sourceCrop.width}
              cropHeight={sourceCrop.height}
              opacity={opacity}
            />
          </>
        )}
      </Group>
    </Group>
  );
}

function OverlayNode({
  overlay,
  projectId,
  frameBounds,
  settings,
  selected,
  visualInteractive,
  visualPreviewTransform,
  cropPreview,
  cropModeActive,
  onVisualGestureStart,
  previewTransform,
  onTextGestureStart,
}: {
  overlay: PreviewOverlayPlan;
  projectId: string;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  selected: boolean;
  visualInteractive: boolean;
  visualPreviewTransform?: VideoTransform;
  cropPreview?: { crop: VideoCrop; transform: VideoTransform };
  cropModeActive: boolean;
  onVisualGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
  ) => void;
  previewTransform?: VideoTransform;
  onTextGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    itemId: string,
    transform: VideoTransform,
    kind: "move" | "resize",
    corner?: ResizeCorner,
  ) => void;
}) {
  if (overlay.kind === "text") {
    return (
      <TextOverlayNode
        overlay={overlay}
        frameBounds={frameBounds}
        settings={settings}
        selected={selected}
        previewTransform={previewTransform}
        onGestureStart={onTextGestureStart}
      />
    );
  }

  return (
    <MediaOverlayNode
      overlay={overlay}
      projectId={projectId}
      frameBounds={frameBounds}
      settings={settings}
      interactive={visualInteractive}
      previewTransform={visualPreviewTransform}
      cropPreview={cropPreview}
      cropModeActive={cropModeActive}
      onGestureStart={onVisualGestureStart}
    />
  );
}

function TextOverlayNode({
  overlay,
  frameBounds,
  settings,
  selected,
  previewTransform,
  onGestureStart,
}: {
  overlay: Extract<PreviewOverlayPlan, { kind: "text" }>;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  selected: boolean;
  previewTransform?: VideoTransform;
  onGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    itemId: string,
    transform: VideoTransform,
    kind: "move" | "resize",
    corner?: ResizeCorner,
  ) => void;
}) {
  const transform = previewTransform ?? overlay.item.transform;
  const bounds = computeTextOverlayBounds({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    transform,
  });
  const frameScale = frameBounds.width / settings.width;
  const handleSize = Math.max(8, 10 * frameScale);
  const handleOffset = handleSize / 2;

  return (
    <Group
      x={bounds.x}
      y={bounds.y}
      rotation={transform.rotation}
      opacity={overlay.opacity}
      onPointerDown={(event) => onGestureStart(event, overlay.item.id, transform, "move")}
    >
      {overlay.item.style.backgroundColor ? (
        <Rect
          x={0}
          y={0}
          width={bounds.width}
          height={bounds.height}
          fill={overlay.item.style.backgroundColor}
          opacity={0.72}
          cornerRadius={6 * frameScale}
        />
      ) : null}
      <Text
        text={overlay.item.text}
        x={0}
        y={0}
        width={bounds.width}
        height={bounds.height}
        fontFamily={overlay.item.style.fontFamily}
        fontSize={overlay.item.style.fontSize * frameScale * Math.max(0.1, transform.scaleY)}
        fill={overlay.item.style.color}
        fontStyle={fontStyleForText(overlay.item.style)}
        align={overlay.item.style.textAlign ?? "center"}
        verticalAlign="middle"
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.55}
      />
      {selected ? (
        <>
          <Rect
            x={0}
            y={0}
            width={bounds.width}
            height={bounds.height}
            stroke="rgba(192,193,255,0.9)"
            strokeWidth={1}
            dash={[5, 4]}
          />
          {([
            ["nw", 0, 0],
            ["ne", bounds.width, 0],
            ["sw", 0, bounds.height],
            ["se", bounds.width, bounds.height],
          ] as const).map(([corner, x, y]) => (
            <Rect
              key={corner}
              x={x - handleOffset}
              y={y - handleOffset}
              width={handleSize}
              height={handleSize}
              fill="#c0c1ff"
              stroke="#050505"
              strokeWidth={1}
              cornerRadius={2}
              onPointerDown={(event) => onGestureStart(event, overlay.item.id, transform, "resize", corner)}
            />
          ))}
        </>
      ) : null}
    </Group>
  );
}

function MediaOverlayNode({
  overlay,
  projectId,
  frameBounds,
  settings,
  interactive,
  previewTransform,
  cropPreview,
  cropModeActive,
  onGestureStart,
}: {
  overlay: PreviewMediaOverlayPlan;
  projectId: string;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  interactive: boolean;
  previewTransform?: VideoTransform;
  cropPreview?: { crop: VideoCrop; transform: VideoTransform };
  cropModeActive: boolean;
  onGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
  ) => void;
}) {
  const image = useLoadedImage(overlay.objectUrl, () => {
    logMediaObjectFailure(
      projectId,
      overlay.media.id,
      overlay.item.id,
      overlay.objectVariant,
      "image",
      "Preview overlay image could not be decoded.",
    );
  });
  const transform = cropPreview?.transform ?? previewTransform ?? overlay.item.transform;
  const crop = cropPreview?.crop ?? overlay.item.crop;
  const geometry = computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: overlay.media.width,
    mediaHeight: overlay.media.height,
    transform,
    crop,
  });
  const sourceCrop = computeCroppedSourceGeometry(
    overlay.media.width ?? settings.width,
    overlay.media.height ?? settings.height,
    crop,
  );
  const densityX = sourceCrop.width > 0 ? geometry.width / sourceCrop.width : 0;
  const densityY = sourceCrop.height > 0 ? geometry.height / sourceCrop.height : 0;

  return (
    <Group
      name={`preview-visual-${overlay.item.id}`}
      listening={interactive}
      onPointerDown={(event) => onGestureStart(event, overlay)}
    >
      <Group
        x={geometry.center.x}
        y={geometry.center.y}
        rotation={geometry.rotation}
        scaleX={transform.scaleX < 0 ? -1 : 1}
        scaleY={transform.scaleY < 0 ? -1 : 1}
      >
        {!image ? (
          <MediaPlaceholder bounds={{ x: -geometry.width / 2, y: -geometry.height / 2, width: geometry.width, height: geometry.height }} label={overlay.media.name} />
        ) : (
          <>
            {cropModeActive ? (
              <KonvaImage
                name={`preview-crop-ghost-${overlay.item.id}`}
                image={image}
                x={-geometry.width / 2 - sourceCrop.x * densityX}
                y={-geometry.height / 2 - sourceCrop.y * densityY}
                width={(overlay.media.width ?? settings.width) * densityX}
                height={(overlay.media.height ?? settings.height) * densityY}
                opacity={overlay.item.opacity * 0.3}
                listening={false}
              />
            ) : null}
            <KonvaImage
              image={image}
              x={-geometry.width / 2}
              y={-geometry.height / 2}
              width={geometry.width}
              height={geometry.height}
              cropX={sourceCrop.x}
              cropY={sourceCrop.y}
              cropWidth={sourceCrop.width}
              cropHeight={sourceCrop.height}
              opacity={overlay.item.opacity}
            />
          </>
        )}
      </Group>
    </Group>
  );
}

function VisualTransformOverlay({
  visual,
  frameBounds,
  stageSize,
  settings,
  previewTransform,
  onGestureStart,
}: {
  visual: PreviewVisualPlan | PreviewMediaOverlayPlan;
  frameBounds: PreviewRect;
  stageSize: StageSize;
  settings: VideoProjectSettings;
  previewTransform?: VideoTransform;
  onGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
    kind?: VisualGesture["kind"],
    corner?: ResizeCorner,
    placement?: InteractiveHandlePlacement,
  ) => void;
}) {
  const transform = previewTransform ?? visual.item.transform;
  const geometry = computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: visual.media.width,
    mediaHeight: visual.media.height,
    transform,
    crop: visual.item.crop,
  });
  const stageBounds = { x: 0, y: 0, width: stageSize.width, height: stageSize.height };
  const handleRadius = 5;
  const cornerPlacements = (Object.keys(geometry.corners) as ResizeCorner[]).map((corner) => ({
    corner,
    placement: clampInteractiveHandle(geometry.corners[corner], stageBounds, handleRadius + 2),
  }));
  const topVector = {
    x: geometry.edgeCenters.top.x - geometry.center.x,
    y: geometry.edgeCenters.top.y - geometry.center.y,
  };
  const topLength = Math.hypot(topVector.x, topVector.y) || 1;
  const rotationActual = {
    x: geometry.edgeCenters.top.x + topVector.x / topLength * 28,
    y: geometry.edgeCenters.top.y + topVector.y / topLength * 28,
  };
  const rotationPlacement = clampInteractiveHandle(rotationActual, stageBounds, handleRadius + 2);
  const outlinePoints = [
    geometry.corners.nw.x, geometry.corners.nw.y,
    geometry.corners.ne.x, geometry.corners.ne.y,
    geometry.corners.se.x, geometry.corners.se.y,
    geometry.corners.sw.x, geometry.corners.sw.y,
  ];

  return (
    <Group name={`preview-selection-${visual.item.id}`}>
      <Line points={outlinePoints} closed stroke="rgba(192,193,255,0.95)" strokeWidth={1.5} dash={[6, 4]} listening={false} />
      <Line
        points={[geometry.edgeCenters.top.x, geometry.edgeCenters.top.y, rotationPlacement.reachable.x, rotationPlacement.reachable.y]}
        stroke="rgba(192,193,255,0.8)"
        strokeWidth={1.25}
        listening={false}
      />
      {cornerPlacements.map(({ corner, placement }) => (
        <Rect
          key={corner}
          name={`preview-resize-${corner}-${visual.item.id}`}
          x={placement.reachable.x - handleRadius}
          y={placement.reachable.y - handleRadius}
          width={handleRadius * 2}
          height={handleRadius * 2}
          fill="#c0c1ff"
          stroke="#050505"
          strokeWidth={1}
          cornerRadius={2}
          onPointerDown={(event) => onGestureStart(event, visual, "resize", corner, placement)}
        />
      ))}
      <Circle
        name={`preview-rotate-${visual.item.id}`}
        x={rotationPlacement.reachable.x}
        y={rotationPlacement.reachable.y}
        radius={handleRadius + 1}
        fill="#c0c1ff"
        stroke="#050505"
        strokeWidth={1}
        onPointerDown={(event) => onGestureStart(event, visual, "rotate", undefined, rotationPlacement)}
      />
    </Group>
  );
}

function VisualCropOverlay({
  visual,
  frameBounds,
  stageSize,
  settings,
  preview,
  onGestureStart,
}: {
  visual: PreviewVisualPlan | PreviewMediaOverlayPlan;
  frameBounds: PreviewRect;
  stageSize: StageSize;
  settings: VideoProjectSettings;
  preview?: { crop: VideoCrop; transform: VideoTransform };
  onGestureStart: (
    event: Konva.KonvaEventObject<PointerEvent>,
    visual: PreviewVisualPlan | PreviewMediaOverlayPlan,
    kind: CropGesture["kind"],
    edge?: CropEdge,
    placement?: InteractiveHandlePlacement,
  ) => void;
}) {
  const crop = preview?.crop ?? visual.item.crop;
  const transform = preview?.transform ?? visual.item.transform;
  const geometry = computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: visual.media.width,
    mediaHeight: visual.media.height,
    transform,
    crop,
  });
  const stageBounds = { x: 0, y: 0, width: stageSize.width, height: stageSize.height };
  const handleHalfWidth = 7;
  const handleHalfHeight = 4;
  const placements = (Object.keys(geometry.edgeCenters) as CropEdge[]).map((edge) => ({
    edge,
    placement: clampInteractiveHandle(geometry.edgeCenters[edge], stageBounds, handleHalfWidth + 2),
  }));
  const outlinePoints = [
    geometry.corners.nw.x, geometry.corners.nw.y,
    geometry.corners.ne.x, geometry.corners.ne.y,
    geometry.corners.se.x, geometry.corners.se.y,
    geometry.corners.sw.x, geometry.corners.sw.y,
  ];

  return (
    <Group name={`preview-crop-overlay-${visual.item.id}`}>
      <Group listening={false}>
        <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="rgba(0,0,0,0.5)" />
        <Group x={geometry.center.x} y={geometry.center.y} rotation={geometry.rotation}>
          <Rect
            x={-geometry.width / 2}
            y={-geometry.height / 2}
            width={geometry.width}
            height={geometry.height}
            fill="#000"
            globalCompositeOperation="destination-out"
          />
        </Group>
      </Group>
      <Group
        x={geometry.center.x}
        y={geometry.center.y}
        rotation={geometry.rotation}
        onPointerDown={(event) => onGestureStart(event, visual, "pan")}
      >
        <Rect
          name={`preview-crop-pan-${visual.item.id}`}
          x={-geometry.width / 2}
          y={-geometry.height / 2}
          width={geometry.width}
          height={geometry.height}
          fill="rgba(0,0,0,0.001)"
        />
      </Group>
      <Line points={outlinePoints} closed stroke="rgba(0,0,0,0.8)" strokeWidth={3.5} listening={false} />
      <Line points={outlinePoints} closed stroke="#ffffff" strokeWidth={1.5} listening={false} />
      {placements.map(({ edge, placement }) => {
        const vertical = edge === "left" || edge === "right";
        return (
          <Rect
            key={edge}
            name={`preview-crop-${edge}-${visual.item.id}`}
            x={placement.reachable.x - (vertical ? handleHalfHeight : handleHalfWidth)}
            y={placement.reachable.y - (vertical ? handleHalfWidth : handleHalfHeight)}
            width={(vertical ? handleHalfHeight : handleHalfWidth) * 2}
            height={(vertical ? handleHalfWidth : handleHalfHeight) * 2}
            fill="#ffffff"
            stroke="#050505"
            strokeWidth={1}
            cornerRadius={2}
            onPointerDown={(event) => onGestureStart(event, visual, "edge", edge, placement)}
          />
        );
      })}
    </Group>
  );
}

function EmptyFrame({ frameBounds }: { frameBounds: PreviewRect }) {
  const calculatedFontSize = Math.floor(frameBounds.height * 0.10);
  return (
    <>
      <Rect {...frameBounds} fillLinearGradientStartPoint={{ x: frameBounds.x, y: frameBounds.y }} fillLinearGradientEndPoint={{ x: frameBounds.x + frameBounds.width, y: frameBounds.y + frameBounds.height }} fillLinearGradientColorStops={[0, "#111111", 0.55, "#1b2426", 1, "#191919"]} />
      <Text
        text="No active visual"
        x={frameBounds.x}
        y={frameBounds.y + frameBounds.height / 2 - calculatedFontSize / 2}
        width={frameBounds.width}
        align="center"
        fill="rgba(255,255,255,0.46)"
        fontFamily="Roboto"
        fontSize={calculatedFontSize}
        fontStyle="bold"
      />
    </>
  );
}

function MediaPlaceholder({ bounds, label }: { bounds: PreviewRect; label: string }) {
  return (
    <>
      <Rect {...bounds} fill="#151515" stroke="rgba(255,255,255,0.2)" dash={[8, 6]} />
      <Text
        text={`Media unavailable: ${label}`}
        x={bounds.x + 12}
        y={bounds.y + Math.max(8, bounds.height / 2 - 10)}
        width={Math.max(0, bounds.width - 24)}
        align="center"
        fill="rgba(255,255,255,0.58)"
        fontFamily="Inter"
        fontSize={12}
        ellipsis
      />
    </>
  );
}

function MonitorMessage({ frameBounds, message }: { frameBounds: PreviewRect; message: string }) {
  const width = Math.min(frameBounds.width - 24, 520);
  return (
    <>
      <Rect
        x={frameBounds.x + 12}
        y={frameBounds.y + 12}
        width={width}
        height={34}
        fill="rgba(0,0,0,0.62)"
        stroke="rgba(255,255,255,0.18)"
        cornerRadius={4}
      />
      <Text
        text={message}
        x={frameBounds.x + 24}
        y={frameBounds.y + 22}
        width={Math.max(0, width - 24)}
        fill="rgba(255,255,255,0.78)"
        fontFamily="Inter"
        fontSize={11}
        ellipsis
      />
    </>
  );
}

function fitStageToArea(area: StageSize, settings: VideoProjectSettings | undefined): StageSize {
  const projectWidth = settings?.width && settings.width > 0 ? settings.width : 16;
  const projectHeight = settings?.height && settings.height > 0 ? settings.height : 9;
  const aspectRatio = projectWidth / projectHeight || 16 / 9;
  const areaWidth = Math.max(1, area.width);
  const areaHeight = Math.max(1, area.height);
  const widthByHeight = areaHeight * aspectRatio;

  if (widthByHeight <= areaWidth) {
    return {
      width: Math.max(1, Math.floor(widthByHeight)),
      height: Math.max(1, Math.floor(areaHeight)),
    };
  }

  return {
    width: Math.max(1, Math.floor(areaWidth)),
    height: Math.max(1, Math.floor(areaWidth / aspectRatio)),
  };
}

function usePlaybackClock({
  playing,
  mediaClockActive,
  currentTime,
  timelineDuration,
  frameRate,
  onTimeChange,
  onEnd,
}: {
  playing: boolean;
  mediaClockActive: boolean;
  currentTime: number;
  timelineDuration: number;
  frameRate: number;
  onTimeChange: (time: number) => void;
  onEnd: () => void;
}) {
  const stateRef = useRef({ currentTime, timelineDuration, frameRate, onTimeChange, onEnd });

  useEffect(() => {
    stateRef.current = { currentTime, timelineDuration, frameRate, onTimeChange, onEnd };
  }, [currentTime, frameRate, onEnd, onTimeChange, timelineDuration]);

  useEffect(() => {
    if (!playing || mediaClockActive) {
      return undefined;
    }

    let frameId = 0;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const state = stateRef.current;
      const elapsed = (now - lastFrame) / 1000;
      lastFrame = now;
      const nextTime = Math.min(state.timelineDuration, state.currentTime + elapsed);

      if (nextTime >= state.timelineDuration) {
        state.onTimeChange(state.timelineDuration);
        state.onEnd();
        return;
      }

      const snappedTime = stepPreviewTime({
        currentTime: nextTime,
        direction: 1,
        frameRate: state.frameRate,
        timelineDuration: state.timelineDuration,
        frames: 0,
      });
      state.onTimeChange(snappedTime);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [mediaClockActive, playing]);
}

function nextVideoPreviewPlan({
  document,
  activeVideo,
  currentTime,
  previewQuality,
  soloedAudioTrackIds,
  previewVolume,
  previewMuted,
}: {
  document: VideoProjectDocument;
  activeVideo: PreviewVisualPlan;
  currentTime: number;
  previewQuality: PreviewQualityPreference;
  soloedAudioTrackIds: string[];
  previewVolume: number;
  previewMuted: boolean;
}): PreviewVisualPlan | null {
  const nextStart = document.tracks
    .filter((track) => !track.hidden)
    .flatMap((track) => track.items)
    .filter((item) =>
      item.type === "video"
      && item.id !== activeVideo.item.id
      && item.timelineStart > currentTime + mediaClockEndEpsilon
    )
    .sort((left, right) => left.timelineStart - right.timelineStart)[0]?.timelineStart;
  if (nextStart === undefined) return null;

  const nextPlan = createProgramMonitorPlan({
    document,
    currentTime: nextStart + Math.min(mediaClockEndEpsilon, 1 / Math.max(1, document.settings.frameRate)),
    previewQuality,
    soloedAudioTrackIds,
    previewVolume,
    previewMuted,
  });
  return nextPlan.activeVideo?.item.type === "video" && nextPlan.activeVideo.objectUrl
    ? nextPlan.activeVideo
    : null;
}

function videoRefForSource(
  first: RefObject<HTMLVideoElement | null>,
  second: RefObject<HTMLVideoElement | null>,
  objectUrl: string | null,
): RefObject<HTMLVideoElement | null> {
  if (!objectUrl) return first;
  const resolvedUrl = new URL(objectUrl, window.location.href).href;
  if (first.current?.src === resolvedUrl) return first;
  if (second.current?.src === resolvedUrl) return second;
  return first;
}

function videoElementForSource(
  elements: Array<HTMLVideoElement | null>,
  objectUrl: string | null,
): HTMLVideoElement | null {
  if (!objectUrl || typeof window === "undefined") return null;
  const resolvedUrl = new URL(objectUrl, window.location.href).href;
  return elements.find((element) => element?.src === resolvedUrl) ?? null;
}

function useLayerVideoElement({
  enabled,
  objectUrl,
  sourceTime,
  speed,
  playing,
  muted,
  volume,
  onError,
  onDrawNeeded,
}: {
  enabled: boolean;
  objectUrl: string | null;
  sourceTime: number;
  speed: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  onError: () => void;
  onDrawNeeded: () => void;
}): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const sourceTimeRef = useRef(sourceTime);
  const onErrorRef = useRef(onError);
  const onDrawNeededRef = useRef(onDrawNeeded);

  useEffect(() => {
    sourceTimeRef.current = sourceTime;
    onErrorRef.current = onError;
    onDrawNeededRef.current = onDrawNeeded;
  }, [onDrawNeeded, onError, sourceTime]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setVideo(null);
      return undefined;
    }
    const element = document.createElement("video");
    element.muted = muted;
    element.volume = Math.max(0, Math.min(1, volume));
    element.playsInline = true;
    element.preload = "auto";
    setVideo(element);
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [enabled]);

  useEffect(() => {
    if (!video || !objectUrl) return undefined;
    const resolvedUrl = new URL(objectUrl, window.location.href).href;
    const handleMetadataLoaded = () => syncElementCurrentTime(video, sourceTimeRef.current);
    const handleDecodedFrame = () => onDrawNeededRef.current();
    const handleError = () => onErrorRef.current();
    video.addEventListener("loadedmetadata", handleMetadataLoaded);
    video.addEventListener("loadeddata", handleDecodedFrame);
    video.addEventListener("canplay", handleDecodedFrame);
    video.addEventListener("seeked", handleDecodedFrame);
    video.addEventListener("error", handleError);
    if (video.src !== resolvedUrl) {
      video.src = objectUrl;
      video.load();
    } else {
      syncElementCurrentTime(video, sourceTimeRef.current);
    }
    return () => {
      video.removeEventListener("loadedmetadata", handleMetadataLoaded);
      video.removeEventListener("loadeddata", handleDecodedFrame);
      video.removeEventListener("canplay", handleDecodedFrame);
      video.removeEventListener("seeked", handleDecodedFrame);
      video.removeEventListener("error", handleError);
    };
  }, [objectUrl, video]);

  useEffect(() => {
    if (!video || !objectUrl) return;
    video.playbackRate = speed;
    video.muted = muted;
    video.volume = Math.max(0, Math.min(1, volume));
    const drift = Math.abs(video.currentTime - sourceTime);
    if (!playing || drift > 0.35) syncElementCurrentTime(video, sourceTime);
  }, [muted, objectUrl, playing, sourceTime, speed, video, volume]);

  useEffect(() => {
    if (!video || !objectUrl || !playing) {
      video?.pause();
      return undefined;
    }
    const playResult = video.play();
    if (playResult) {
      void playResult.catch((error) => {
        if (!isInterruptedMediaPlayError(error)) onErrorRef.current();
      });
    }
    return () => video.pause();
  }, [objectUrl, playing, video]);

  useEffect(() => {
    if (!video || !playing) return undefined;
    const frameVideo = video as HTMLVideoElementWithFrameCallback;
    if (typeof frameVideo.requestVideoFrameCallback !== "function") {
      const handleTimeUpdate = () => onDrawNeededRef.current();
      video.addEventListener("timeupdate", handleTimeUpdate);
      return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    }
    let cancelled = false;
    let callbackId = 0;
    const schedule = () => {
      callbackId = frameVideo.requestVideoFrameCallback(() => {
        onDrawNeededRef.current();
        if (!cancelled) schedule();
      });
    };
    schedule();
    return () => {
      cancelled = true;
      frameVideo.cancelVideoFrameCallback?.(callbackId);
    };
  }, [playing, video]);

  return enabled ? video : null;
}

function useExistingLayerVideoPlayback({
  enabled,
  video,
  sourceTime,
  speed,
  playing,
  muted,
  volume,
  onError,
  onDrawNeeded,
}: {
  enabled: boolean;
  video: HTMLVideoElement | null;
  sourceTime: number;
  speed: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  onError: () => void;
  onDrawNeeded: () => void;
}): void {
  const onErrorRef = useRef(onError);
  const onDrawNeededRef = useRef(onDrawNeeded);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    onErrorRef.current = onError;
    onDrawNeededRef.current = onDrawNeeded;
  }, [onDrawNeeded, onError]);

  useEffect(() => {
    if (!enabled || !video) return;
    video.playbackRate = speed;
    video.muted = muted;
    video.volume = Math.max(0, Math.min(1, volume));
    if (!playing || Math.abs(video.currentTime - sourceTime) > 0.35) {
      syncElementCurrentTime(video, sourceTime);
    }
  }, [enabled, muted, playing, sourceTime, speed, video, volume]);

  useEffect(() => {
    if (!enabled || !video || !playing) return undefined;
    const playResult = video.paused ? video.play() : null;
    if (playResult) {
      void playResult.catch((error) => {
        if (!isInterruptedMediaPlayError(error)) onErrorRef.current();
      });
    }
    return () => {
      if (enabledRef.current) video.pause();
    };
  }, [enabled, playing, video]);

  useEffect(() => {
    if (!enabled || !video || !playing) return undefined;
    const frameVideo = video as HTMLVideoElementWithFrameCallback;
    if (typeof frameVideo.requestVideoFrameCallback !== "function") {
      const handleTimeUpdate = () => onDrawNeededRef.current();
      video.addEventListener("timeupdate", handleTimeUpdate);
      return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    }
    let cancelled = false;
    let callbackId = 0;
    const schedule = () => {
      callbackId = frameVideo.requestVideoFrameCallback(() => {
        onDrawNeededRef.current();
        if (!cancelled) schedule();
      });
    };
    schedule();
    return () => {
      cancelled = true;
      frameVideo.cancelVideoFrameCallback?.(callbackId);
    };
  }, [enabled, playing, video]);
}

function useVideoElementPreload({
  ref,
  video,
  activeObjectUrl,
}: {
  ref: RefObject<HTMLVideoElement | null>;
  video: PreviewVisualPlan | null;
  activeObjectUrl: string | null;
}) {
  const objectUrl = video?.objectUrl ?? null;
  const sourceTime = video?.sourceTime ?? 0;

  useEffect(() => {
    const element = ref.current;
    if (!element || !objectUrl || objectUrl === activeObjectUrl) return undefined;

    const resolvedUrl = new URL(objectUrl, window.location.href).href;
    const handleMetadataLoaded = () => syncElementCurrentTime(element, sourceTime);
    element.muted = true;
    element.volume = 0;
    element.preload = "auto";
    element.addEventListener("loadedmetadata", handleMetadataLoaded);
    if (element.src !== resolvedUrl) {
      element.src = objectUrl;
      element.load();
    } else {
      syncElementCurrentTime(element, sourceTime);
    }

    return () => element.removeEventListener("loadedmetadata", handleMetadataLoaded);
  }, [activeObjectUrl, objectUrl, ref, sourceTime]);
}

function useVideoElementSync({
  ref,
  activeVideo,
  seekRevision,
  playing,
  muted,
  volume,
  activeVisualObjectUrls,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
  onDrawNeeded,
}: {
  ref: RefObject<HTMLVideoElement | null>;
  activeVideo: PreviewVisualPlan | null;
  seekRevision: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  activeVisualObjectUrls: string[];
  timelineDuration: number;
  onTimeChange: (time: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
  onDrawNeeded: () => void;
}) {
  const item = activeVideo?.item.type === "video" ? activeVideo.item : null;
  const objectUrl = activeVideo?.objectUrl ?? null;
  const sourceTime = activeVideo?.sourceTime ?? 0;
  const itemId = item?.id ?? null;
  const speed = item?.speed ?? 1;
  const sourceTimeRef = useRef(sourceTime);
  const onErrorRef = useRef(onError);
  const onDrawNeededRef = useRef(onDrawNeeded);
  const onTimeChangeRef = useRef(onTimeChange);
  const onEndRef = useRef(onEnd);
  const lastSourceKeyRef = useRef<string | null>(null);
  const pendingSeekSourceTimeRef = useRef<number | null>(null);
  const lastSeekRevisionRef = useRef(seekRevision);
  const playingRef = useRef(playing);
  const activeVisualObjectUrlsRef = useRef(new Set(activeVisualObjectUrls));
  playingRef.current = playing;
  activeVisualObjectUrlsRef.current = new Set(activeVisualObjectUrls);
  sourceTimeRef.current = sourceTime;
  if (seekRevision !== lastSeekRevisionRef.current) {
    pendingSeekSourceTimeRef.current = sourceTime;
    lastSeekRevisionRef.current = seekRevision;
  }
  const requestClockSeek = useCallback((
    video: HTMLVideoElement,
    targetSourceTime: number,
    guardClock = true,
  ) => {
    if (guardClock) pendingSeekSourceTimeRef.current = targetSourceTime;
    syncElementCurrentTime(video, targetSourceTime);
  }, []);

  useEffect(() => {
    sourceTimeRef.current = sourceTime;
    onErrorRef.current = onError;
    onDrawNeededRef.current = onDrawNeeded;
    onTimeChangeRef.current = onTimeChange;
    onEndRef.current = onEnd;
  }, [onDrawNeeded, onEnd, onError, onTimeChange, sourceTime]);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }

    if (!objectUrl) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      lastSourceKeyRef.current = null;
      pendingSeekSourceTimeRef.current = null;
      return;
    }

    const sourceKey = `${itemId ?? ""}:${objectUrl}`;
    const sourceChanged = lastSourceKeyRef.current !== sourceKey;

    if (video.src !== new URL(objectUrl, window.location.href).href) {
      video.src = objectUrl;
      video.load();
    }

    video.playbackRate = speed;
    video.muted = muted;
    video.volume = Math.max(0, Math.min(1, volume));
    if (sourceChanged) {
      requestClockSeek(video, sourceTimeRef.current, pendingSeekSourceTimeRef.current !== null);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [itemId, muted, objectUrl, ref, speed, volume]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !objectUrl) {
      return undefined;
    }

    const handleError = () => onErrorRef.current("Video preview object could not be loaded.");
    const handleMetadataLoaded = () => {
      requestClockSeek(video, sourceTimeRef.current, pendingSeekSourceTimeRef.current !== null);
    };
    const handleDecodedFrameAvailable = () => {
      onDrawNeededRef.current();
    };
    const handleSeeked = () => {
      onDrawNeededRef.current();
    };
    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleMetadataLoaded);
    video.addEventListener("loadeddata", handleDecodedFrameAvailable);
    video.addEventListener("canplay", handleDecodedFrameAvailable);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadedmetadata", handleMetadataLoaded);
      video.removeEventListener("loadeddata", handleDecodedFrameAvailable);
      video.removeEventListener("canplay", handleDecodedFrameAvailable);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [objectUrl, ref, requestClockSeek]);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return undefined;
    }

    if (!playing || !objectUrl) {
      video.pause();
      return undefined;
    }

    let cancelled = false;
    const retryWhenPlayable = () => {
      if (cancelled) return;
      void startPlayback();
    };
    const startPlayback = async () => {
      try {
        await video.play();
      } catch (error) {
        if (cancelled) return;
        if (isInterruptedMediaPlayError(error)) {
          video.addEventListener("canplay", retryWhenPlayable, { once: true });
          return;
        }
        onErrorRef.current("Video preview could not start.");
      }
    };

    void startPlayback();
    return () => {
      cancelled = true;
      video.removeEventListener("canplay", retryWhenPlayable);
      if (!playingRef.current || !objectUrl || !activeVisualObjectUrlsRef.current.has(objectUrl)) {
        video.pause();
      }
    };
  }, [objectUrl, playing, ref]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !objectUrl) {
      return;
    }

    const sourceKey = `${itemId ?? ""}:${objectUrl}`;
    const sourceChanged = lastSourceKeyRef.current !== sourceKey;
    const drift = Math.abs(video.currentTime - sourceTime);
    if (!playing || sourceChanged || drift > 0.35) {
      requestClockSeek(video, sourceTime, pendingSeekSourceTimeRef.current !== null);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [itemId, objectUrl, playing, ref, requestClockSeek, sourceTime]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !playing || !item || !objectUrl) {
      return undefined;
    }

    const handleEnded = () => {
      const clipEndTime = item.timelineStart + item.duration;
      const nextTime = mediaClockHandoffTime(clipEndTime, timelineDuration);
      onDrawNeededRef.current();
      onTimeChangeRef.current(nextTime);
      if (nextTime >= timelineDuration - mediaClockEndEpsilon) {
        onEndRef.current();
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [itemId, item?.duration, item?.timelineStart, objectUrl, playing, ref, timelineDuration]);

  useEffect(() => {
    if (!playing || !item || !objectUrl) {
      return undefined;
    }

    let frameId = 0;
    let videoFrameId = 0;
    const video = ref.current;
    if (!video) {
      return undefined;
    }

    const publish = () => {
      const pendingSourceTime = pendingSeekSourceTimeRef.current;
      if (pendingSourceTime !== null) {
        onDrawNeededRef.current();
        if (Math.abs(video.currentTime - pendingSourceTime) > 0.12) {
          return true;
        }
        pendingSeekSourceTimeRef.current = null;
        return true;
      }
      const timelineTime = mediaSourceTimeToTimelineTime(item, video.currentTime);
      const clipEndTime = item.timelineStart + item.duration;
      const clipEnded =
        video.currentTime >= item.sourceOut - mediaClockEndEpsilon ||
        timelineTime >= clipEndTime - mediaClockEndEpsilon;
      onDrawNeededRef.current();

      if (clipEnded) {
        const nextTime = mediaClockHandoffTime(clipEndTime, timelineDuration);
        onTimeChangeRef.current(nextTime);
        if (nextTime >= timelineDuration - mediaClockEndEpsilon) {
          onEndRef.current();
        }
        return false;
      }

      onTimeChangeRef.current(timelineTime);
      return true;
    };

    const draw = () => {
      if (publish()) {
        frameId = requestAnimationFrame(draw);
      }
    };

    if ("requestVideoFrameCallback" in video) {
      const requestVideoFrameCallback = (video as HTMLVideoElementWithFrameCallback).requestVideoFrameCallback.bind(video);
      const cancelVideoFrameCallback = (video as HTMLVideoElementWithFrameCallback).cancelVideoFrameCallback?.bind(video);
      let cancelled = false;
      const onFrame = () => {
        if (cancelled) {
          return;
        }
        if (publish()) {
          videoFrameId = requestVideoFrameCallback(onFrame);
        }
      };
      videoFrameId = requestVideoFrameCallback(onFrame);
      return () => {
        cancelled = true;
        if (cancelVideoFrameCallback) {
          cancelVideoFrameCallback(videoFrameId);
        }
      };
    }

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [item, objectUrl, playing, ref, timelineDuration]);
}

function PreviewAudioElement({
  activeAudio,
  seekRevision,
  playing,
  primaryClock,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
}: {
  activeAudio: PreviewAudioPlan;
  seekRevision: number;
  playing: boolean;
  primaryClock: boolean;
  timelineDuration: number;
  onTimeChange: (time: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useAudioElementSync({
    ref,
    activeAudio,
    seekRevision,
    playing,
    primaryClock,
    timelineDuration,
    onTimeChange,
    onEnd,
    onError,
  });

  return <audio ref={ref} className="pointer-events-none absolute h-px w-px opacity-0" preload="auto" />;
}

function useAudioElementSync({
  ref,
  activeAudio,
  seekRevision,
  playing,
  primaryClock,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
}: {
  ref: RefObject<HTMLAudioElement | null>;
  activeAudio: PreviewAudioPlan;
  seekRevision: number;
  playing: boolean;
  primaryClock: boolean;
  timelineDuration: number;
  onTimeChange: (time: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}) {
  const {
    item,
    objectUrl,
    sourceTime,
    muted,
    effectiveVolume,
  } = activeAudio;
  const sourceTimeRef = useRef(sourceTime);
  const onErrorRef = useRef(onError);
  const onTimeChangeRef = useRef(onTimeChange);
  const onEndRef = useRef(onEnd);
  const lastSourceKeyRef = useRef<string | null>(null);
  const pendingSeekSourceTimeRef = useRef<number | null>(null);
  const lastSeekRevisionRef = useRef(seekRevision);

  sourceTimeRef.current = sourceTime;
  if (seekRevision !== lastSeekRevisionRef.current) {
    pendingSeekSourceTimeRef.current = sourceTime;
    lastSeekRevisionRef.current = seekRevision;
  }

  useEffect(() => {
    sourceTimeRef.current = sourceTime;
    onErrorRef.current = onError;
    onTimeChangeRef.current = onTimeChange;
    onEndRef.current = onEnd;
  }, [onEnd, onError, onTimeChange, sourceTime]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) {
      return;
    }

    if (!objectUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      lastSourceKeyRef.current = null;
      return;
    }

    const sourceKey = `${item.id}:${objectUrl}`;
    const sourceChanged = lastSourceKeyRef.current !== sourceKey;

    if (audio.src !== new URL(objectUrl, window.location.href).href) {
      audio.src = objectUrl;
      audio.load();
    }

    audio.muted = muted;
    audio.volume = Math.max(0, Math.min(1, effectiveVolume));
    if (sourceChanged) {
      syncElementCurrentTime(audio, sourceTimeRef.current);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [effectiveVolume, item.id, muted, objectUrl, ref]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !objectUrl) {
      return undefined;
    }

    const handleError = () => onErrorRef.current("Audio preview object could not be loaded.");
    audio.addEventListener("error", handleError);
    return () => audio.removeEventListener("error", handleError);
  }, [objectUrl, ref]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) {
      return;
    }

    if (!playing || !objectUrl) {
      audio.pause();
      return;
    }

    audio.play().catch(() => onErrorRef.current("Audio preview could not start."));
  }, [objectUrl, playing, ref]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !objectUrl) {
      return;
    }

    const sourceKey = `${item.id}:${objectUrl}`;
    const sourceChanged = lastSourceKeyRef.current !== sourceKey;
    const drift = Math.abs(audio.currentTime - sourceTime);
    if (!playing || sourceChanged || drift > 0.35) {
      syncElementCurrentTime(audio, sourceTime);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [item.id, objectUrl, playing, ref, sourceTime]);

  useEffect(() => {
    if (!playing || !primaryClock || !objectUrl) {
      return undefined;
    }

    let frameId = 0;
    const audio = ref.current;
    if (!audio) {
      return undefined;
    }
    const tick = () => {
      const pendingSourceTime = pendingSeekSourceTimeRef.current;
      if (pendingSourceTime !== null) {
        if (Math.abs(audio.currentTime - pendingSourceTime) <= 0.12) {
          pendingSeekSourceTimeRef.current = null;
        }
        frameId = requestAnimationFrame(tick);
        return;
      }
      const timelineTime = mediaSourceTimeToTimelineTime(item, audio.currentTime);
      const clipEndTime = item.timelineStart + item.duration;
      const clipEnded =
        audio.currentTime >= item.sourceOut - mediaClockEndEpsilon ||
        timelineTime >= clipEndTime - mediaClockEndEpsilon;

      if (clipEnded) {
        const nextTime = mediaClockHandoffTime(clipEndTime, timelineDuration);
        onTimeChangeRef.current(nextTime);
        if (nextTime >= timelineDuration - mediaClockEndEpsilon) {
          onEndRef.current();
        }
        return;
      }

      onTimeChangeRef.current(timelineTime);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [item, objectUrl, playing, primaryClock, ref, timelineDuration]);
}

function useElementSize(initialSize: StageSize): [StageSize, { ref: (node: HTMLDivElement | null) => void }] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState(initialSize);

  useEffect(() => {
    if (!node) {
      return undefined;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    updateSize();

    return () => observer.disconnect();
  }, [node]);

  return [size, { ref: setNode }];
}

function useLoadedImage(url: string | null, onError?: () => void): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() => cachedImageForUrl(url));
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return undefined;
    }

    const cached = cachedImageForUrl(url);
    if (cached) {
      setImage(cached);
      return undefined;
    }

    const nextImage = new window.Image();
    nextImage.decoding = "async";
    nextImage.onload = () => {
      decodedImageCache.set(url, nextImage);
      setImage(nextImage);
    };
    nextImage.onerror = () => {
      setImage(null);
      onErrorRef.current?.();
    };
    nextImage.src = url;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [url]);

  return image;
}

function logMediaObjectFailure(
  projectId: string | undefined,
  mediaId: string | undefined,
  itemId: string | undefined,
  variant: string | null | undefined,
  elementKind: "image" | "video" | "audio",
  reason: string,
): void {
  logVideoEditorEvent("editor.media.object.failure", {
    projectId,
    mediaId,
    itemId,
    variant,
    elementKind,
    reason,
    correlationId: createEditorCorrelationId("media-object"),
  }, "warn");
}

function cachedImageForUrl(url: string | null): HTMLImageElement | null {
  return url ? decodedImageCache.get(url) ?? null : null;
}

function syncElementCurrentTime(element: HTMLMediaElement, sourceTime: number): void {
  if (!Number.isFinite(sourceTime)) {
    return;
  }

  if (Math.abs(element.currentTime - sourceTime) > 0.08) {
    try {
      element.currentTime = sourceTime;
    } catch {
      // Some browsers reject seeks before metadata is loaded; the next plan update retries.
    }
  }
}

function isInterruptedMediaPlayError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function mediaClockHandoffTime(clipEndTime: number, timelineDuration: number): number {
  if (clipEndTime >= timelineDuration - mediaClockEndEpsilon) {
    return timelineDuration;
  }

  return Math.min(timelineDuration, clipEndTime + mediaClockEndEpsilon);
}

function activeAudioSignature(activeAudio: PreviewAudioPlan[]): string {
  return activeAudio
    .map((audio) => `${audio.item.id}:${audio.objectUrl ?? ""}:${audio.effectiveVolume}:${audio.muted}`)
    .join("|");
}

function fontStyleForText(style: VideoTextStyle): string {
  const weight = style.fontWeight && style.fontWeight !== "normal" ? style.fontWeight : "";
  const italic = style.fontStyle === "italic" ? "italic" : "";
  return `${italic} ${weight}`.trim() || "normal";
}

function transformForTextGesture(
  gesture: TextGesture,
  pointer: { x: number; y: number },
  frameBounds: PreviewRect,
  settings: VideoProjectSettings,
): VideoTransform {
  const frameScale = frameBounds.width / settings.width;
  const deltaX = frameScale > 0 ? (pointer.x - gesture.startPointer.x) / frameScale : 0;
  const deltaY = frameScale > 0 ? (pointer.y - gesture.startPointer.y) / frameScale : 0;

  if (gesture.kind === "move") {
    return {
      ...gesture.startTransform,
      x: roundTransformValue(gesture.startTransform.x + deltaX),
      y: roundTransformValue(gesture.startTransform.y + deltaY),
    };
  }

  const corner = gesture.corner ?? "se";
  const horizontalSign = corner.endsWith("e") ? 1 : -1;
  const verticalSign = corner.startsWith("s") ? 1 : -1;
  const baseWidth = settings.width * 0.8;
  const baseHeight = settings.height * 0.12;

  return {
    ...gesture.startTransform,
    scaleX: roundTransformValue(Math.max(0.1, gesture.startTransform.scaleX + (deltaX * horizontalSign) / baseWidth)),
    scaleY: roundTransformValue(Math.max(0.1, gesture.startTransform.scaleY + (deltaY * verticalSign) / baseHeight)),
  };
}

function transformsForVisualGesture({
  gesture,
  pointer,
  shiftKey,
  frameBounds,
  settings,
  visualScalesLinked,
}: {
  gesture: VisualGesture;
  pointer: { x: number; y: number };
  shiftKey: boolean;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  visualScalesLinked: boolean;
}): { rendered: VideoTransform; document: VideoTransform } {
  const correctedPointer = gesture.handlePlacement
    ? applyHandlePointerOffset(pointer, gesture.handlePlacement)
    : pointer;

  if (gesture.kind === "move") {
    const deltaX = previewDeltaToProjectDelta(correctedPointer.x - gesture.startPointer.x, frameBounds, settings.width);
    const deltaY = previewDeltaToProjectDelta(correctedPointer.y - gesture.startPointer.y, frameBounds, settings.width);
    return {
      rendered: {
        ...gesture.renderedTransform,
        x: gesture.renderedTransform.x + deltaX,
        y: gesture.renderedTransform.y + deltaY,
      },
      document: {
        ...gesture.documentTransform,
        x: gesture.documentTransform.x + deltaX,
        y: gesture.documentTransform.y + deltaY,
      },
    };
  }

  if (gesture.kind === "resize") {
    const projectPointer = previewPointToProjectPoint(
      correctedPointer,
      frameBounds,
      settings.width,
      settings.height,
    );
    const rendered = resizeVisualFromOppositeCorner({
      transform: gesture.renderedTransform,
      projectWidth: settings.width,
      projectHeight: settings.height,
      mediaWidth: gesture.mediaWidth,
      mediaHeight: gesture.mediaHeight,
      corner: gesture.corner ?? "se",
      pointer: projectPointer,
      linked: visualScalesLinked && !shiftKey,
    });
    const scaleXMultiplier = rendered.scaleX / Math.max(0.01, Math.abs(gesture.renderedTransform.scaleX));
    const scaleYMultiplier = rendered.scaleY / Math.max(0.01, Math.abs(gesture.renderedTransform.scaleY));
    return {
      rendered,
      document: {
        ...gesture.documentTransform,
        x: gesture.documentTransform.x + rendered.x - gesture.renderedTransform.x,
        y: gesture.documentTransform.y + rendered.y - gesture.renderedTransform.y,
        scaleX: Math.max(0.01, Math.abs(gesture.documentTransform.scaleX) * scaleXMultiplier),
        scaleY: Math.max(0.01, Math.abs(gesture.documentTransform.scaleY) * scaleYMultiplier),
      },
    };
  }

  const geometry = computeCenterOriginMediaGeometry({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: gesture.mediaWidth,
    mediaHeight: gesture.mediaHeight,
    transform: gesture.renderedTransform,
  });
  const renderedRotation = rotationForPointer({
    center: geometry.center,
    startPointer: gesture.startPointer,
    pointer: correctedPointer,
    startRotation: gesture.renderedTransform.rotation,
    snap: shiftKey,
  });
  const rotationDelta = normalizeRotation(renderedRotation - gesture.renderedTransform.rotation);
  return {
    rendered: { ...gesture.renderedTransform, rotation: renderedRotation },
    document: {
      ...gesture.documentTransform,
      rotation: normalizeRotation(gesture.documentTransform.rotation + rotationDelta),
    },
  };
}

function cropResultForGesture({
  gesture,
  pointer,
  frameBounds,
  settings,
}: {
  gesture: CropGesture;
  pointer: { x: number; y: number };
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}): { crop: VideoCrop; transform: VideoTransform } {
  const correctedPointer = gesture.handlePlacement
    ? applyHandlePointerOffset(pointer, gesture.handlePlacement)
    : pointer;
  if (gesture.kind === "pan") {
    const projectDelta = {
      x: previewDeltaToProjectDelta(correctedPointer.x - gesture.startPointer.x, frameBounds, settings.width),
      y: previewDeltaToProjectDelta(correctedPointer.y - gesture.startPointer.y, frameBounds, settings.width),
    };
    return {
      crop: panCropSourceWindow({
        crop: gesture.renderedCrop,
        transform: gesture.renderedTransform,
        projectWidth: settings.width,
        projectHeight: settings.height,
        mediaWidth: gesture.mediaWidth,
        mediaHeight: gesture.mediaHeight,
        projectDelta,
      }),
      transform: gesture.renderedTransform,
    };
  }

  return resizeCropFromOppositeEdge({
    crop: gesture.renderedCrop,
    transform: gesture.renderedTransform,
    projectWidth: settings.width,
    projectHeight: settings.height,
    mediaWidth: gesture.mediaWidth,
    mediaHeight: gesture.mediaHeight,
    edge: gesture.edge ?? "right",
    pointer: previewPointToProjectPoint(correctedPointer, frameBounds, settings.width, settings.height),
  });
}

function sameTransform(left: VideoTransform, right: VideoTransform): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.rotation === right.rotation
  );
}

function sameCrop(left: VideoCrop, right: VideoCrop): boolean {
  return left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom &&
    left.left === right.left;
}

function roundTransformValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatTimecode(totalSeconds: number, frameRate: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const wholeSeconds = Math.floor(safeSeconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const frames = Math.floor((safeSeconds - wholeSeconds) * frameRate);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

function parseTimecode(value: string, frameRate: number): number | null {
  const parts = value.trim().split(":").map((part) => Number(part));
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    return Math.max(0, parts[0]);
  }

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  const [hours, minutes, seconds, frames] = parts;
  return hours * 3600 + minutes * 60 + seconds + frames / Math.max(1, frameRate);
}

function getPreviewCSSFilter(effect: string | null, item: PreviewEditableVisualItem | null): string {
  const parts: string[] = [];
  const effectFilter = getCSSFilterForEffect(effect);
  if (effectFilter !== "none") parts.push(effectFilter);

  if (item) {
    const preset = previewStringProperty(item, "filters", item.type === "video" ? "builtIn" : "filterType", "None");
    const lut = previewStringProperty(item, "filters", "lutLibrary", "None");
    const intensity = previewNumberProperty(item, "filters", "intensity", 100);
    const blend = previewNumberProperty(item, "filters", "blend", 100);
    const presetFilter = getCSSFilterForEffect(preset !== "None" ? preset : lut);
    if (presetFilter !== "none" && intensity > 0 && blend > 0) parts.push(presetFilter);

    const exposure = previewNumberProperty(item, "adjust", "exposure", 0);
    const brightness = previewNumberProperty(item, "adjust", "brightness", 100);
    const contrast = previewNumberProperty(item, "adjust", "contrast", 100);
    const highlights = previewNumberProperty(item, "adjust", "highlights", 100);
    const shadows = previewNumberProperty(item, "adjust", "shadows", 100);
    const whites = previewNumberProperty(item, "adjust", "whites", 0);
    const blacks = previewNumberProperty(item, "adjust", "blacks", 0);
    const temperature = previewNumberProperty(item, "adjust", "temperature", 0);
    const tint = previewNumberProperty(item, "adjust", "tint", 0);
    const saturation = previewNumberProperty(item, "adjust", "saturation", 100);
    const vibrance = previewNumberProperty(item, "adjust", "vibrance", 100);
    const lift = previewNumberProperty(item, "color", "lift", 0);
    const gamma = previewNumberProperty(item, "color", "gamma", 0);
    const gain = previewNumberProperty(item, "color", "gain", 0);

    const brightnessValue = clampPreviewValue(
      brightness / 100 + exposure / 240 + lift / 320 + whites / 520 - blacks / 520 + (shadows - 100) / 700,
      0.08,
      3,
    );
    const contrastValue = clampPreviewValue(
      contrast / 100 + gamma / 260 + gain / 420 + (highlights - 100) / 700 - (shadows - 100) / 900,
      0.08,
      3,
    );
    const saturationValue = clampPreviewValue(saturation / 100 + (vibrance - 100) / 260 + gain / 340, 0, 3.5);
    const hueRotation = clampPreviewValue((temperature * -0.18) + (tint * 0.22), -45, 45);
    const sepia = clampPreviewValue(Math.max(0, temperature) / 420, 0, 0.28);

    parts.push(
      `brightness(${formatFilterNumber(brightnessValue)})`,
      `contrast(${formatFilterNumber(contrastValue)})`,
      `saturate(${formatFilterNumber(saturationValue)})`,
    );
    if (Math.abs(hueRotation) > 0.01) parts.push(`hue-rotate(${formatFilterNumber(hueRotation)}deg)`);
    if (sepia > 0) parts.push(`sepia(${formatFilterNumber(sepia)})`);
  }

  return parts.length ? parts.join(" ") : "none";
}

function getVisualPreviewOverlay(effect: string | null, item: PreviewEditableVisualItem | null): {
  vignetteOpacity: number;
  grainOpacity: number;
  maskWindowStyle: CSSProperties | null;
} {
  const vignette = item ? previewNumberProperty(item, "color", "vignette", 0) : 0;
  const grain = item ? previewNumberProperty(item, "color", "grain", 0) : 0;

  return {
    vignetteOpacity: effect === "Vignette" ? 0.65 : clampPreviewValue(vignette / 135, 0, 0.72),
    grainOpacity: clampPreviewValue(grain / 360, 0, 0.28),
    maskWindowStyle: item ? getMaskWindowStyle(item) : null,
  };
}

function getMaskWindowStyle(item: PreviewEditableVisualItem): CSSProperties | null {
  const shape = previewStringProperty(item, "mask", item.type === "video" ? "shape" : "maskType", "None");
  if (!shape || shape === "None") return null;

  const expansion = previewNumberProperty(item, "mask", "expansion", 0);
  const size = clampPreviewValue(previewNumberProperty(item, "mask", "maskSize", 66) + expansion / 4, 12, 112);
  const feather = clampPreviewValue(previewNumberProperty(item, "mask", "maskFeather", 10) / 100, 0, 1);
  const invert = Boolean(previewRawProperty(item, "mask", "invert", false));
  const isCircle = shape === "Circle";
  const width = isCircle ? size : clampPreviewValue(size * 1.35, 16, 118);
  const height = isCircle ? size : clampPreviewValue(size * 0.82, 12, 100);

  return {
    left: "50%",
    top: "50%",
    width: `${width}%`,
    height: `${height}%`,
    transform: "translate(-50%, -50%)",
    borderRadius: isCircle ? "999px" : "10px",
    border: "1.5px solid rgba(255,255,255,0.74)",
    boxShadow: invert
      ? `inset 0 0 ${Math.round(18 + feather * 40)}px rgba(0,0,0,0.38)`
      : `0 0 0 9999px rgba(0,0,0,${formatFilterNumber(0.2 + feather * 0.32)})`,
  };
}

function previewNumberProperty(item: PreviewEditableVisualItem, groupName: string, propertyName: string, fallback: number): number {
  const value = previewRawProperty(item, groupName, propertyName, fallback);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function previewStringProperty(item: PreviewEditableVisualItem, groupName: string, propertyName: string, fallback: string): string {
  const value = previewRawProperty(item, groupName, propertyName, fallback);
  return typeof value === "string" ? value : fallback;
}

function previewRawProperty(
  item: PreviewEditableVisualItem,
  groupName: string,
  propertyName: string,
  fallback: unknown,
): unknown {
  return (item as any).properties?.[groupName]?.[propertyName]?.value ?? fallback;
}

function clampPreviewValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatFilterNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function getCSSFilterForEffect(effect: string | null): string {
  if (!effect) return "none";
  switch (effect) {
    case "Gaussian":
    case "Box Blur":
    case "Motion Blur":
    case "Background Blur":
      return "blur(4px)";
    case "Glow":
    case "Bloom":
      return "brightness(1.15) contrast(1.1) saturate(1.1)";
    case "Sharpen":
      return "contrast(1.08) brightness(1.02)";
    case "Cinematic":
    case "Rec.709":
      return "contrast(1.12) saturate(1.05) brightness(0.96)";
    case "Teal & Orange":
      return "hue-rotate(-5deg) saturate(1.25) contrast(1.05)";
    case "Warm":
      return "sepia(0.2) saturate(1.1) brightness(1.04)";
    case "Cool":
      return "hue-rotate(-15deg) saturate(1.15) brightness(1.02)";
    case "B&W":
    case "Film":
      return "grayscale(1) contrast(1.15)";
    case "Glitch":
    case "RGB Split":
      return "hue-rotate(20deg) contrast(1.2)";
    case "Lens":
      return "contrast(1.1) saturate(0.9)";
    case "Shadow":
      return "brightness(0.85) contrast(1.05)";
    case "Light Leak":
    case "Lens Flare":
      return "brightness(1.1) saturate(1.2)";
    default:
      return "none";
  }
}

function TransitionPreviewOverlay({ transitionType }: { transitionType: string | null }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(timer);
  }, [transitionType]);

  if (!visible || !transitionType) return null;

  if (transitionType === "Fade" || transitionType === "Cross Dissolve" || transitionType === "Cut") {
    return (
      <div className="pointer-events-none absolute inset-0 z-35 bg-black animate-fade-in-out" />
    );
  }

  if (transitionType === "Flash" || transitionType === "Light Leak" || transitionType === "Glitch") {
    return (
      <div className="pointer-events-none absolute inset-0 z-35 bg-white animate-flash-in-out" />
    );
  }

  return null;
}
