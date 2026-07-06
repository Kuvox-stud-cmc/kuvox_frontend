import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";

import {
  computeFrameBounds,
  computeMediaBounds,
  computeSafeGuides,
  computeTextOverlayBounds,
  createProgramMonitorPlan,
  type PreviewMediaOverlayPlan,
  type PreviewOverlayPlan,
  type PreviewQualityPreference,
  type PreviewRect,
  type PreviewVisualPlan,
  stepPreviewTime,
} from "~/lib/editor/editor-preview";
import type { VideoProjectSettings, VideoTextStyle } from "~/lib/editor/video-document";
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
} from "~/store/slices/editor-slice";

import { editorProject, type EditorProjectMock } from "../mock-editor-data";
import { EditorIcon, EditorIconButton } from "../editor-ui";

interface PreviewPanelProps {
  project: EditorProjectMock;
}

interface StageSize {
  width: number;
  height: number;
}

type MediaErrorMap = Record<string, string>;

const defaultStageSize: StageSize = { width: 960, height: 540 };

export function PreviewPanel({ project = editorProject }: Partial<PreviewPanelProps>) {
  const dispatch = useAppDispatch();
  const { document, playback, timelineDuration, soloedAudioTrackIds } = useAppSelector(selectProgramMonitorState);
  const activeModal = useAppSelector((state) => selectOverlayState(state).activeModal);
  const [qualityPreference, setQualityPreference] = useState<PreviewQualityPreference>("balanced");
  const [timecodeDraft, setTimecodeDraft] = useState<string | null>(null);
  const [mediaErrors, setMediaErrors] = useState<MediaErrorMap>({});
  const [stageSize, setStageSize] = useElementSize(defaultStageSize);
  const [fullscreenStageSize, setFullscreenStageSize] = useElementSize(defaultStageSize);
  const mediaLayerRef = useRef<Konva.Layer>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const plan = useMemo(
    () =>
      document
        ? createProgramMonitorPlan({
            document,
            currentTime: playback.currentTime,
            previewQuality: qualityPreference,
            soloedAudioTrackIds,
          })
        : null,
    [document, playback.currentTime, qualityPreference, soloedAudioTrackIds],
  );
  const frameRate = document?.settings.frameRate ?? 30;
  const activeVideo =
    plan?.activeVisual?.item.type === "video" && plan.activeVisual.objectUrl
      ? plan.activeVisual
      : null;
  const activeAudio = plan?.primaryAudio?.objectUrl ? plan.primaryAudio : null;
  const displayTime = timecodeDraft ?? formatTimecode(playback.currentTime, frameRate);
  const durationTime = formatTimecode(timelineDuration, frameRate);
  const planWarnings = plan?.warnings.map((warning) => warning.message) ?? [];
  const objectErrorMessages = Object.values(mediaErrors);
  const monitorMessages = [...planWarnings, ...objectErrorMessages];

  usePlaybackClock({
    playing: playback.playing,
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
    onError: (message) => {
      setMediaErrors((errors) => ({ ...errors, video: message }));
      dispatch(playbackPaused());
    },
    onDrawNeeded: () => mediaLayerRef.current?.batchDraw(),
  });

  useAudioElementSync({
    ref: audioRef,
    activeAudio,
    playing: playback.playing,
    muted: playback.muted,
    volume: playback.volume,
    onError: (message) => {
      setMediaErrors((errors) => ({ ...errors, audio: message }));
      dispatch(playbackPaused());
    },
  });

  useEffect(() => {
    setMediaErrors({});
  }, [activeVideo?.objectUrl, activeAudio?.objectUrl]);

  const seekToTimecode = useCallback(() => {
    if (timecodeDraft === null) {
      return;
    }

    const parsed = parseTimecode(timecodeDraft, frameRate);
    if (parsed !== null) {
      dispatch(currentTimeChanged(parsed));
    }
    setTimecodeDraft(null);
  }, [dispatch, frameRate, timecodeDraft]);

  const seekByFrame = useCallback(
    (direction: -1 | 1) => {
      if (!document) {
        return;
      }

      dispatch(playbackFrameStepped(direction));
    },
    [dispatch, document],
  );

  const seekToEnd = useCallback(() => {
    dispatch(currentTimeChanged(timelineDuration));
  }, [dispatch, timelineDuration]);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest">
      <video ref={videoRef} className="pointer-events-none absolute h-px w-px opacity-0" playsInline preload="auto" />
      <audio ref={audioRef} className="pointer-events-none absolute h-px w-px opacity-0" preload="auto" />

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 lg:p-3 2xl:p-5">
        <div
          ref={setStageSize.ref}
          className="relative aspect-video w-full max-h-full overflow-hidden rounded-[6px] border border-outline-variant bg-black shadow-[0_18px_50px_rgba(0,0,0,0.38)]"
          style={{
            maxWidth:
              "min(100%, calc((100vh - 64px - var(--editor-timeline-space, 292px) - 56px) * 1.777))",
          }}
        >
          <ProgramMonitorStage
            plan={plan}
            stageSize={stageSize}
            videoElement={videoRef.current}
            mediaLayerRef={mediaLayerRef}
            messages={monitorMessages}
            fallbackTitle={project.previewTitle}
          />
        </div>
      </div>

      <div className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-outline-variant bg-surface px-2 lg:px-3 2xl:h-16 2xl:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <input
            aria-label="Current timecode"
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
            className="h-8 w-[118px] rounded-[4px] border border-outline-variant bg-surface-container-high px-2 font-mono text-label-md font-semibold tracking-widest text-primary outline-none focus:border-primary"
          />
          <span className="hidden truncate text-label-md text-on-surface-variant 2xl:block">/ {durationTime}</span>
        </div>

        <div className="flex items-center justify-center gap-1 lg:gap-1.5 2xl:gap-3">
          <EditorIconButton
            icon="skip_previous"
            label="Start"
            className="hidden h-8 w-8 lg:flex"
            onClick={() => dispatch(currentTimeChanged(0))}
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
            onClick={() => dispatch(playbackStepChanged(-5))}
          />
          <button
            type="button"
            onClick={() => dispatch(playbackToggled())}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-opacity hover:opacity-90"
            aria-label={playback.playing ? "Pause" : "Play"}
          >
            <EditorIcon filled>{playback.playing ? "pause" : "play_arrow"}</EditorIcon>
          </button>
          <EditorIconButton
            icon="fast_forward"
            label="Forward"
            className="h-8 w-8"
            onClick={() => dispatch(playbackStepChanged(5))}
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
                className={`h-7 rounded-[3px] px-2 text-label-sm font-semibold capitalize ${
                  qualityPreference === quality
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
            <span className="font-mono text-label-md font-semibold tracking-widest text-white/80">
              {formatTimecode(playback.currentTime, frameRate)} / {durationTime}
            </span>
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
}: {
  plan: ReturnType<typeof createProgramMonitorPlan> | null;
  stageSize: StageSize;
  videoElement: HTMLVideoElement | null;
  mediaLayerRef: RefObject<Konva.Layer | null>;
  messages: string[];
  fallbackTitle: string;
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

  return (
    <Stage width={stageSize.width} height={stageSize.height} className="h-full w-full bg-black">
      <Layer>
        <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#050505" />
        <Rect {...frameBounds} fill="#070707" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      </Layer>

      <Layer ref={mediaLayerRef}>
        <Group clip={frameBounds}>
          {plan?.activeVisual ? (
            <VisualNode
              visual={plan.activeVisual}
              videoElement={videoElement}
              frameBounds={frameBounds}
              settings={settings}
            />
          ) : (
            <EmptyFrame frameBounds={frameBounds} title={fallbackTitle} />
          )}
          {plan?.overlays.map((overlay) => (
            <OverlayNode key={overlay.item.id} overlay={overlay} frameBounds={frameBounds} settings={settings} />
          ))}
        </Group>
      </Layer>

      <Layer listening={false}>
        {safeGuides.map((guide, index) => (
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
  videoElement,
  frameBounds,
  settings,
}: {
  visual: PreviewVisualPlan;
  videoElement: HTMLVideoElement | null;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}) {
  const image = useLoadedImage(visual.item.type === "video" ? null : visual.objectUrl);
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
  frameBounds,
  settings,
}: {
  overlay: PreviewOverlayPlan;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}) {
  if (overlay.kind === "text") {
    return <TextOverlayNode overlay={overlay} frameBounds={frameBounds} settings={settings} />;
  }

  return <MediaOverlayNode overlay={overlay} frameBounds={frameBounds} settings={settings} />;
}

function TextOverlayNode({
  overlay,
  frameBounds,
  settings,
}: {
  overlay: Extract<PreviewOverlayPlan, { kind: "text" }>;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}) {
  const bounds = computeTextOverlayBounds({
    frameBounds,
    frameWidth: settings.width,
    frameHeight: settings.height,
    transform: overlay.item.transform,
  });
  const frameScale = frameBounds.width / settings.width;

  return (
    <Text
      text={overlay.item.text}
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      fontFamily={overlay.item.style.fontFamily}
      fontSize={overlay.item.style.fontSize * frameScale}
      fill={overlay.item.style.color}
      fontStyle={fontStyleForText(overlay.item.style)}
      align={overlay.item.style.textAlign ?? "center"}
      rotation={overlay.item.transform.rotation}
      verticalAlign="middle"
      shadowColor="black"
      shadowBlur={10}
      shadowOpacity={0.55}
    />
  );
}

function MediaOverlayNode({
  overlay,
  frameBounds,
  settings,
}: {
  overlay: PreviewMediaOverlayPlan;
  frameBounds: PreviewRect;
  settings: VideoProjectSettings;
}) {
  const image = useLoadedImage(overlay.objectUrl);
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

function EmptyFrame({ frameBounds, title }: { frameBounds: PreviewRect; title: string }) {
  return (
    <>
      <Rect {...frameBounds} fillLinearGradientStartPoint={{ x: frameBounds.x, y: frameBounds.y }} fillLinearGradientEndPoint={{ x: frameBounds.x + frameBounds.width, y: frameBounds.y + frameBounds.height }} fillLinearGradientColorStops={[0, "#111111", 0.55, "#1b2426", 1, "#191919"]} />
      <Text
        text={title}
        x={frameBounds.x}
        y={frameBounds.y + frameBounds.height / 2 - 14}
        width={frameBounds.width}
        align="center"
        fill="rgba(255,255,255,0.62)"
        fontFamily="Inter"
        fontSize={14}
      />
    </>
  );
}

function MediaPlaceholder({ bounds, label }: { bounds: PreviewRect; label: string }) {
  return (
    <>
      <Rect {...bounds} fill="#151515" stroke="rgba(255,255,255,0.2)" dash={[8, 6]} />
      <Text
        text={label}
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

function usePlaybackClock({
  playing,
  currentTime,
  timelineDuration,
  frameRate,
  onTimeChange,
  onEnd,
}: {
  playing: boolean;
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
    if (!playing) {
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
  }, [playing]);
}

function useVideoElementSync({
  ref,
  activeVideo,
  playing,
  muted,
  volume,
  onError,
  onDrawNeeded,
}: {
  ref: RefObject<HTMLVideoElement | null>;
  activeVideo: PreviewVisualPlan | null;
  playing: boolean;
  muted: boolean;
  volume: number;
  onError: (message: string) => void;
  onDrawNeeded: () => void;
}) {
  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }

    if (!activeVideo?.objectUrl) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      return;
    }

    if (video.src !== new URL(activeVideo.objectUrl, window.location.href).href) {
      video.src = activeVideo.objectUrl;
      video.load();
    }

    video.playbackRate = activeVideo.item.type === "video" ? activeVideo.item.speed : 1;
    video.muted = muted;
    video.volume = Math.max(0, Math.min(1, volume));
    syncElementCurrentTime(video, activeVideo.sourceTime ?? 0);

    if (playing) {
      video.play().catch(() => onError("Video preview could not start."));
    } else {
      video.pause();
    }
  }, [activeVideo, muted, onError, playing, ref, volume]);

  useEffect(() => {
    if (!playing || !activeVideo) {
      return undefined;
    }

    let frameId = 0;
    const draw = () => {
      onDrawNeeded();
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [activeVideo, onDrawNeeded, playing]);
}

function useAudioElementSync({
  ref,
  activeAudio,
  playing,
  muted,
  volume,
  onError,
}: {
  ref: RefObject<HTMLAudioElement | null>;
  activeAudio: ReturnType<typeof createProgramMonitorPlan>["primaryAudio"];
  playing: boolean;
  muted: boolean;
  volume: number;
  onError: (message: string) => void;
}) {
  useEffect(() => {
    const audio = ref.current;
    if (!audio) {
      return;
    }

    if (!activeAudio?.objectUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    if (audio.src !== new URL(activeAudio.objectUrl, window.location.href).href) {
      audio.src = activeAudio.objectUrl;
      audio.load();
    }

    audio.muted = muted || activeAudio.muted;
    audio.volume = Math.max(0, Math.min(1, volume * activeAudio.volume));
    syncElementCurrentTime(audio, activeAudio.sourceTime);

    if (playing) {
      audio.play().catch(() => onError("Audio preview could not start."));
    } else {
      audio.pause();
    }
  }, [activeAudio, muted, onError, playing, ref, volume]);
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

function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return undefined;
    }

    const nextImage = new window.Image();
    nextImage.decoding = "async";
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setImage(null);
    nextImage.src = url;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [url]);

  return image;
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

function fontStyleForText(style: VideoTextStyle): string {
  const weight = style.fontWeight && style.fontWeight !== "normal" ? style.fontWeight : "";
  const italic = style.fontStyle === "italic" ? "italic" : "";
  return `${italic} ${weight}`.trim() || "normal";
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
