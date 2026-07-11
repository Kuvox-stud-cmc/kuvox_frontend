import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";

import {
  computeFrameBounds,
  computeMediaBounds,
  computeSafeGuides,
  computeTextOverlayBounds,
  createProgramMonitorPlan,
  mediaSourceTimeToTimelineTime,
  type PreviewAudioPlan,
  type PreviewMediaOverlayPlan,
  type PreviewOverlayPlan,
  type PreviewQualityPreference,
  type PreviewRect,
  type PreviewVisualPlan,
  stepPreviewTime,
} from "~/lib/editor/editor-preview";
import {
  createVideoEditorPerformanceMetric,
  queueVideoEditorPerformanceMetric,
} from "~/lib/editor/video-performance.client";
import { createEditorCorrelationId, logVideoEditorEvent } from "~/lib/editor/editor-observability.client";
import type { VideoProjectSettings, VideoTextStyle, VideoTransform } from "~/lib/editor/video-document";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  currentTimeChanged,
  modalClosed,
  modalOpened,
  muteToggled,
  playbackFrameStepped,
  playbackPaused,
  playbackStepChanged,
  playbackToggled,
  selectOverlayState,
  selectProgramMonitorState,
  selectSelectedItemIds,
  timelineItemsSelected,
  videoOperationApplied,
} from "~/store/slices/editor-slice";
import type { UpdateTextOperation } from "~/lib/editor/video-operations";

import { editorProject, type EditorProjectMock } from "../mock-editor-data";
import { EditorIcon, EditorIconButton } from "../editor-ui";
import { getActiveDraggedMedia } from "~/lib/editor/editor-media";

interface PreviewPanelProps {
  project: EditorProjectMock;
  className?: string;
  onMediaDrop?: (mediaId: string, placement?: { trackId?: string; timelineStart: number }) => void;
}

interface StageSize {
  width: number;
  height: number;
}

type MediaErrorMap = Record<string, string>;
type ResizeCorner = "nw" | "ne" | "sw" | "se";
type TextTransformPreview = Record<string, VideoTransform>;
type HTMLVideoElementWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};
type TextGesture = {
  kind: "move" | "resize";
  itemId: string;
  startPointer: { x: number; y: number };
  startTransform: VideoTransform;
  corner?: ResizeCorner;
};

const defaultStageSize: StageSize = { width: 960, height: 540 };
const mediaClockEndEpsilon = 0.01;
const decodedImageCache = new Map<string, HTMLImageElement>();

export function PreviewPanel({
  project = editorProject,
  className = "",
  onMediaDrop,
}: Partial<PreviewPanelProps>) {
  const [dragOverActive, setDragOverActive] = useState(false);
  const dispatch = useAppDispatch();
  const { document, playback, timelineDuration, soloedAudioTrackIds } = useAppSelector(selectProgramMonitorState);
  const selectedItemIds = useAppSelector(selectSelectedItemIds);
  const activeModal = useAppSelector((state) => selectOverlayState(state).activeModal);
  const [qualityPreference, setQualityPreference] = useState<PreviewQualityPreference>("balanced");
  const [timecodeDraft, setTimecodeDraft] = useState<string | null>(null);
  const [mediaErrors, setMediaErrors] = useState<MediaErrorMap>({});
  const [previewAreaSize, setPreviewAreaSize] = useElementSize(defaultStageSize);
  const [fullscreenStageSize, setFullscreenStageSize] = useElementSize(defaultStageSize);
  const mediaLayerRef = useRef<Konva.Layer>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [activeEffect, setActiveEffect] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kuvox_active_effect");
    }
    return null;
  });

  const [activeTransition, setActiveTransition] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kuvox_active_transition");
    }
    return null;
  });

  const [transitionTrigger, setTransitionTrigger] = useState(0);

  useEffect(() => {
    const handleEffectChange = () => {
      setActiveEffect(localStorage.getItem("kuvox_active_effect"));
    };
    const handleTransitionChange = () => {
      setActiveTransition(localStorage.getItem("kuvox_active_transition"));
      setTransitionTrigger(prev => prev + 1);
    };
    window.addEventListener("kuvox-effect-changed", handleEffectChange);
    window.addEventListener("kuvox-transition-changed", handleTransitionChange);
    return () => {
      window.removeEventListener("kuvox-effect-changed", handleEffectChange);
      window.removeEventListener("kuvox-transition-changed", handleTransitionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const linkId = "kuvox-google-fonts";
      if (!window.document.getElementById(linkId)) {
        const link = window.document.createElement("link");
        link.id = linkId;
        link.href = "https://fonts.googleapis.com/css2?family=Bungee&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Outfit:wght@400;600;700&family=Pacifico&family=Playfair+Display:wght@700&family=Poppins:wght@400;600;700&family=Roboto:wght@400;700&family=Space+Grotesk:wght@500;700&family=Syne:wght@700;800&display=swap";
        link.rel = "stylesheet";
        window.document.head.appendChild(link);
      }
    }
  }, []);

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
    plan?.activeVisual?.item.type === "video" && plan.activeVisual.objectUrl
      ? plan.activeVisual
      : null;
  const activeAudio = plan?.activeAudio.filter((audio) => audio.objectUrl) ?? [];
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
    onTimeChange: (time) => dispatch(currentTimeChanged(time)),
    onEnd: () => dispatch(playbackPaused()),
  });

  useVideoElementSync({
    ref: videoRef,
    activeVideo,
    playing: playback.playing,
    muted: playback.muted,
    volume: playback.volume,
    timelineDuration,
    onTimeChange: (time) => dispatch(currentTimeChanged(time)),
    onEnd: () => dispatch(playbackPaused()),
    onError: (message) => {
      logMediaObjectFailure(document?.projectId, activeVideo?.media.id, activeVideo?.item.id, activeVideo?.objectVariant, "video", message);
      setMediaErrors((errors) => ({ ...errors, video: message }));
      dispatch(playbackPaused());
    },
    onDrawNeeded: () => mediaLayerRef.current?.batchDraw(),
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
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest">
      <video ref={videoRef} className="pointer-events-none absolute h-px w-px opacity-0" playsInline preload="auto" />
      {activeAudio.map((audioPlan) => (
        <PreviewAudioElement
          key={audioPlan.item.id}
          activeAudio={audioPlan}
          playing={playback.playing}
          primaryClock={primaryClockAudio?.item.id === audioPlan.item.id}
          timelineDuration={timelineDuration}
          onTimeChange={(time) => dispatch(currentTimeChanged(time))}
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
              filter: getCSSFilterForEffect(activeEffect),
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
              videoElement={videoRef.current}
              mediaLayerRef={mediaLayerRef}
              messages={monitorMessages}
              fallbackTitle={project.previewTitle}
              selectedItemIds={selectedItemIds}
              onSelectTextOverlay={selectTextOverlay}
              onCommitTextTransform={commitTextTransform}
            />
            {activeEffect === "Vignette" && (
              <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.65)_100%)]" />
            )}
            {transitionTrigger > 0 && (
              <TransitionPreviewOverlay
                key={transitionTrigger}
                transitionType={activeTransition}
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
              videoElement={videoRef.current}
              mediaLayerRef={mediaLayerRef}
              messages={monitorMessages}
              fallbackTitle={project.previewTitle}
              selectedItemIds={selectedItemIds}
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
  videoElement,
  mediaLayerRef,
  messages,
  fallbackTitle,
  selectedItemIds,
  onSelectTextOverlay,
  onCommitTextTransform,
}: {
  plan: ReturnType<typeof createProgramMonitorPlan> | null;
  stageSize: StageSize;
  videoElement: HTMLVideoElement | null;
  mediaLayerRef: RefObject<Konva.Layer | null>;
  messages: string[];
  fallbackTitle: string;
  selectedItemIds: string[];
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
  const textGestureRef = useRef<TextGesture | null>(null);

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

  const hasActiveVisual = Boolean(plan?.activeVisual);

  return (
    <Stage
      width={stageSize.width}
      height={stageSize.height}
      className="h-full w-full bg-black"
      onPointerMove={updateTextGesturePreview}
      onPointerUp={commitTextGesture}
      onPointerCancel={commitTextGesture}
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
          {plan?.activeVisual ? (
            <VisualNode
              visual={plan.activeVisual}
              projectId={plan.document.projectId}
              videoElement={videoElement}
              frameBounds={frameBounds}
              settings={settings}
            />
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
              previewTransform={textPreview[overlay.item.id]}
              onTextGestureStart={handleTextGestureStart}
            />
          ))}
        </Group>
      </Layer>

      <Layer listening={false}>
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
  videoElement,
  frameBounds,
  settings,
}: {
  visual: PreviewVisualPlan;
  projectId: string;
  videoElement: HTMLVideoElement | null;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}) {
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
  const bounds = computeMediaBounds({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: visual.media.width,
    mediaHeight: visual.media.height,
    transform: visual.item.transform,
  });
  const opacity = "opacity" in visual.item ? visual.item.opacity : 1;
  const sourceImage = visual.item.type === "video" ? videoElement : image;

  if (!visual.objectUrl || !sourceImage) {
    return <MediaPlaceholder bounds={bounds} label={visual.media.name} />;
  }

  return (
    <KonvaImage
      image={sourceImage}
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      rotation={visual.item.transform.rotation}
      opacity={opacity}
    />
  );
}

function OverlayNode({
  overlay,
  projectId,
  frameBounds,
  settings,
  selected,
  previewTransform,
  onTextGestureStart,
}: {
  overlay: PreviewOverlayPlan;
  projectId: string;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
  selected: boolean;
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

  return <MediaOverlayNode overlay={overlay} projectId={projectId} frameBounds={frameBounds} settings={settings} />;
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
}: {
  overlay: PreviewMediaOverlayPlan;
  projectId: string;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
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
  const bounds = computeMediaBounds({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    mediaWidth: overlay.media.width,
    mediaHeight: overlay.media.height,
    transform: overlay.item.transform,
  });

  if (!image) {
    return <MediaPlaceholder bounds={bounds} label={overlay.media.name} />;
  }

  return (
    <KonvaImage
      image={image}
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      rotation={overlay.item.transform.rotation}
      opacity={overlay.item.opacity}
    />
  );
}

function EmptyFrame({ frameBounds }: { frameBounds: PreviewRect }) {
  const calculatedFontSize = Math.floor(frameBounds.height * 0.10);
  return (
    <>
      <Rect {...frameBounds} fillLinearGradientStartPoint={{ x: frameBounds.x, y: frameBounds.y }} fillLinearGradientEndPoint={{ x: frameBounds.x + frameBounds.width, y: frameBounds.y + frameBounds.height }} fillLinearGradientColorStops={[0, "#111111", 0.55, "#1b2426", 1, "#191919"]} />
      <Text
        text="Preview"
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

function useVideoElementSync({
  ref,
  activeVideo,
  playing,
  muted,
  volume,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
  onDrawNeeded,
}: {
  ref: RefObject<HTMLVideoElement | null>;
  activeVideo: PreviewVisualPlan | null;
  playing: boolean;
  muted: boolean;
  volume: number;
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
      syncElementCurrentTime(video, sourceTimeRef.current);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [itemId, muted, objectUrl, ref, speed, volume]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !objectUrl) {
      return undefined;
    }

    const handleError = () => onErrorRef.current("Video preview object could not be loaded.");
    video.addEventListener("error", handleError);
    return () => video.removeEventListener("error", handleError);
  }, [objectUrl, ref]);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }

    if (!playing || !objectUrl) {
      video.pause();
      return;
    }

    video.play().catch(() => onErrorRef.current("Video preview could not start."));
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
      syncElementCurrentTime(video, sourceTime);
    }
    lastSourceKeyRef.current = sourceKey;
  }, [itemId, objectUrl, playing, ref, sourceTime]);

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
  playing,
  primaryClock,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
}: {
  activeAudio: PreviewAudioPlan;
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
  playing,
  primaryClock,
  timelineDuration,
  onTimeChange,
  onEnd,
  onError,
}: {
  ref: RefObject<HTMLAudioElement | null>;
  activeAudio: PreviewAudioPlan;
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

function sameTransform(left: VideoTransform, right: VideoTransform): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.rotation === right.rotation
  );
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
