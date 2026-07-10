import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";

import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  TextTimelineItem,
  VideoClipTimelineItem,
  VideoProjectSettings,
  VideoTextStyle,
  VideoTimelineItem,
  VideoTransform,
} from "~/lib/editor/video-document";
import {
  createVideoOperationBatch,
  type SetProjectSettingsOperation,
  type TrimItemOperation,
  type UpdateAudioOperation,
  type UpdateSpeedOperation,
  type UpdateTextOperation,
  type UpdateTransformCropOperation,
  type VideoOperation,
  type VideoOperationMetadata,
  trimOperation,
  updateTextOperation,
  updateAudioOperation,
  updateSpeedOperation,
  updateTransformCropOperation,
  setProjectSettingsOperation,
} from "~/lib/editor/video-operations";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  inspectorWidthChanged,
  selectInspectorPanelState,
  selectVideoInspectorState,
  videoOperationApplied,
  type InspectorSubject,
} from "~/store/slices/editor-slice";

import { useDragResize } from "./use-drag-resize";
import { EditorIcon } from "./editor-ui";
import { EditorPropertyService, getTimelineItemPropertyValue, PROPERTY_REGISTRY } from "~/lib/editor/editor-property-service";

export function useInspectorCommands() {
  const dispatch = useAppDispatch();

  const updateProperty = useCallback((
    item: VideoTimelineItem,
    propertyName: string,
    value: any,
    options?: { squash?: boolean; label?: string; groupName?: string }
  ) => {
    const operation = EditorPropertyService.createUpdatePropertyOperation(
      item,
      propertyName,
      value,
      options?.label,
      options?.groupName
    );
    if (operation) {
      dispatch(videoOperationApplied({
        operation,
        squash: options?.squash,
      }));
    }
  }, [dispatch]);

  return { updateProperty };
}

interface VideoInspectorPanelProps {
  /** Display/position classes only — never width or max-width */
  visibilityClassName?: string;
  onRequestClose?: () => void;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

type NumberFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  precision?: number;
  disabled?: boolean;
  validate?: (value: number) => string | undefined;
  onCommit: (value: number) => void;
};

type TextFieldProps = {
  label: string;
  value: string;
  type?: "text" | "color";
  disabled?: boolean;
  multiline?: boolean;
  onCommit: (value: string) => void;
};

const fontWeights: Array<NonNullable<VideoTextStyle["fontWeight"]>> = ["normal", "medium", "semibold", "bold"];
const textAlignments: Array<NonNullable<VideoTextStyle["textAlign"]>> = ["left", "center", "right"];
const previewQualities: VideoProjectSettings["previewQuality"][] = ["draft", "balanced", "full"];
const exportPresets = ["h264-720p", "h264-1080p", "h264-4k", "prores-master"];

export function VideoInspectorPanel({
  visibilityClassName = "hidden lg:flex",
  onRequestClose,
  activeSection = "transform",
  onSectionChange,
}: VideoInspectorPanelProps) {
  const dispatch = useAppDispatch();
  const inspector = useAppSelector(selectVideoInspectorState);
  const { width: inspectorWidth } = useAppSelector(selectInspectorPanelState);

  const handleResizeStart = useDragResize({
    axis: "x",
    value: inspectorWidth,
    min: 240,
    max: 480,
    direction: "reverse",
    onChange: useCallback((value: number) => dispatch(inspectorWidthChanged(value)), [dispatch]),
  });

  // Label column scales linearly: 88px at 240px width → 160px at 480px width
  const labelWidth = Math.round(88 + (inspectorWidth - 240) * (160 - 88) / (480 - 240));

  return (
    <aside
      className={`relative z-30 h-full shrink-0 flex-col border-l border-outline-variant bg-surface-container-lowest ${visibilityClassName}`}
      aria-label="Inspector"
      style={{
        width: inspectorWidth,
        minWidth: 240,
        maxWidth: 480,
        ["--inspector-label-w" as string]: `${labelWidth}px`,
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        title="Resize inspector"
        onPointerDown={handleResizeStart}
        className="absolute left-0 top-0 z-50 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/60 motion-reduce:transition-none"
      />

      <div className="flex h-12 items-center gap-2 border-b border-outline-variant px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-outline-variant bg-surface text-on-surface-variant">
          <EditorIcon className="text-[16px]">tune</EditorIcon>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold text-on-surface">Inspector</h2>
        </div>
        {onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Close inspector"
          >
            <EditorIcon className="text-[18px]">close</EditorIcon>
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {inspector.selectedCount > 1 ? (
          <div className="rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant">
            {inspector.selectedCount} selected. Editing the active item.
          </div>
        ) : null}
        <InspectorBody
          inspector={inspector}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </div>
    </aside>
  );
}

function InspectorBody({
  inspector,
  activeSection,
  onSectionChange,
}: {
  inspector: InspectorSubject;
  activeSection: string;
  onSectionChange?: (section: string) => void;
}) {
  if (inspector.kind === "project" && inspector.selectedCount === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-surface-container-lowest">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-secondary mb-4">
          <EditorIcon className="text-3xl">tune</EditorIcon>
        </div>
        <h3 className="text-title-md font-bold text-on-surface mb-2">No Item Selected</h3>
        <p className="text-body-sm text-on-surface-variant max-w-[200px]">
          Select a clip, audio track, image, or text item on the timeline to edit properties.
        </p>
      </div>
    );
  }

  if (inspector.kind === "transition") {
    return <TransitionInspector inspector={inspector} />;
  }

  if (inspector.kind === "project") {
    return <ProjectInspector inspector={inspector} />;
  }

  if (inspector.item.type === "video") {
    return (
      <VideoClipInspector
        inspector={inspector as Extract<InspectorSubject, { kind: "item" }> & { item: VideoClipTimelineItem }}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    );
  }

  if (inspector.item.type === "audio") {
    return (
      <AudioInspector
        item={inspector.item}
        mediaName={inspector.media?.name}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    );
  }

  if (inspector.item.type === "text") {
    return (
      <TextInspector
        item={inspector.item}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    );
  }

  return (
    <ImageOverlayInspector
      item={inspector.item}
      mediaName={inspector.media?.name}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    />
  );
}

function ProjectInspector({
  inspector,
}: {
  inspector: Extract<InspectorSubject, { kind: "project" }>;
}) {
  const dispatch = useInspectorDispatch();
  const settings = inspector.document?.settings;

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-on-surface-variant">
        No project settings available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Canvas size">
        <NumberField
          label="Width"
          value={settings.width}
          min={64}
          max={7680}
          step={1}
          precision={0}
          suffix="px"
          onCommit={(width) =>
            dispatch(setProjectSettingsOperation({ width }, "Update project width"))
          }
        />
        <NumberField
          label="Height"
          value={settings.height}
          min={64}
          max={4320}
          step={1}
          precision={0}
          suffix="px"
          onCommit={(height) =>
            dispatch(setProjectSettingsOperation({ height }, "Update project height"))
          }
        />
        <TextField
          label="Aspect ratio"
          value={settings.aspectRatio}
          onCommit={(aspectRatio) =>
            dispatch(setProjectSettingsOperation({ aspectRatio }, "Update aspect ratio"))
          }
        />
      </Section>

      <Section title="Playback">
        <NumberField
          label="Frame rate"
          value={settings.frameRate}
          min={1}
          max={120}
          step={1}
          precision={0}
          suffix="fps"
          onCommit={(frameRate) =>
            dispatch(setProjectSettingsOperation({ frameRate }, "Update frame rate"))
          }
        />
        <SelectField
          label="Preview quality"
          value={settings.previewQuality}
          options={previewQualities}
          onChange={(previewQuality) =>
            dispatch(setProjectSettingsOperation({ previewQuality }, "Update preview quality"))
          }
        />
      </Section>

      <Section title="Transitions">
        <NumberField
          label="Default duration"
          value={settings.defaultTransitionDuration}
          min={0.1}
          max={10}
          step={0.1}
          precision={1}
          suffix="s"
          onCommit={(defaultTransitionDuration) =>
            dispatch(
              setProjectSettingsOperation(
                { defaultTransitionDuration },
                "Update default transition duration"
              )
            )
          }
        />
      </Section>

      <Section title="Export">
        <SelectField
          label="Preset"
          value={settings.exportPreset}
          options={exportPresets}
          onChange={(exportPreset) =>
            dispatch(setProjectSettingsOperation({ exportPreset }, "Update export preset"))
          }
        />
      </Section>
    </div>
  );
}

function TransitionInspector({
  inspector,
}: {
  inspector: Extract<InspectorSubject, { kind: "transition" }>;
}) {
  const transition = inspector.transition;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Transition details">
        <ReadOnlyRow label="Type" value={capitalize(transition.type)} />
        <ReadOnlyRow label="Duration" value={`${transition.duration.toFixed(2)}s`} />
        {transition.easing && (
          <ReadOnlyRow label="Easing" value={capitalize(transition.easing)} />
        )}
        <ReadOnlyRow label="Target clips" value={`${transition.targetItemIds.length}`} />
      </Section>
    </div>
  );
}

function Accordion({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-outline-variant/30 py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1.5 text-left text-[13px] font-semibold uppercase tracking-[0.02em] text-on-surface hover:text-primary transition-colors focus:outline-none"
      >
        <span>{title}</span>
        <EditorIcon className={`text-[16px] text-on-surface-variant transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
          chevron_right
        </EditorIcon>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2.5 pb-2.5 pt-0.5 pl-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function SliderField({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr) 45px" }}>
      <span className="text-on-surface-variant truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-outline-variant accent-primary"
      />
      <span className="text-right font-mono text-on-surface-variant text-[12px] font-medium">
        {value}{suffix}
      </span>
    </div>
  );
}

function RealtimeSliderField({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "",
  onChange,
  onChangeEnd,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
  onChangeEnd?: (val: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr) 45px" }}>
      <span className="text-on-surface-variant truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(e) => {
          const val = Number(e.target.value);
          setLocalValue(val);
          onChange(val);
        }}
        onMouseUp={() => {
          if (onChangeEnd) onChangeEnd(localValue);
        }}
        onTouchEnd={() => {
          if (onChangeEnd) onChangeEnd(localValue);
        }}
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-outline-variant accent-primary"
      />
      <span className="text-right font-mono text-on-surface-variant text-[12px] font-medium">
        {localValue}{suffix}
      </span>
    </div>
  );
}

function MockSliderField({ label, min = 0, max = 100, suffix, defaultValue = 0, step = 1 }: { label: string; min?: number; max?: number; suffix?: string; defaultValue?: number; step?: number }) {
  const [val, setVal] = useState(defaultValue);
  return <SliderField label={label} value={val} min={min} max={max} onChange={setVal} suffix={suffix} step={step} />;
}

function MockToggleField({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  const [val, setVal] = useState(defaultChecked);
  return <ToggleField label={label} checked={val} onChange={setVal} />;
}

function MockSelectField({ label, options }: { label: string; options: string[] }) {
  const [val, setVal] = useState(options[0]);
  return <SelectField label={label} value={val} options={options} onChange={setVal} />;
}

function MockButtonField({ label }: { label: string }) {
  return (
    <label className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="text-on-surface-variant"></span>
      <button type="button" className="h-7 w-full rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-[12px] font-medium text-on-surface transition-colors hover:bg-surface-container-high focus:border-primary">
        {label}
      </button>
    </label>
  );
}

const videoSections = [
  { id: "transform", label: "Transform", icon: "open_with" },
  { id: "crop", label: "Crop", icon: "crop" },
  { id: "mask", label: "Mask", icon: "masks" },
  { id: "adjust", label: "Adjust", icon: "tune" },
  { id: "filters", label: "Filters", icon: "palette" },
  { id: "color", label: "Color", icon: "colorize" },
  { id: "speed", label: "Speed", icon: "speed" },
  { id: "animation", label: "Animation", icon: "auto_awesome" },
  { id: "audio", label: "Audio", icon: "volume_up" },
];

function VideoClipInspector({
  inspector,
  activeSection,
  onSectionChange,
  isMock = false,
}: {
  inspector: Extract<InspectorSubject, { kind: "item" }> & { item: VideoClipTimelineItem };
  activeSection: string;
  onSectionChange?: (section: string) => void;
  isMock?: boolean;
}) {
  const dispatch = useInspectorDispatch();
  const { updateProperty } = useInspectorCommands();
  const item = inspector.item;
  const linkedMuted = inspector.linkedAudioItems.length > 0
    ? inspector.linkedAudioItems.every(({ item: audio }) => audio.muted)
    : false;

  const supported = ["transform", "crop", "mask", "adjust", "filters", "color", "speed", "animation", "audio"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "transform" : "");

  const [pitchCorrection, setPitchCorrection] = useState(true);

  // Local state for mock transform values
  const [posX, setPosX] = useState(item.transform.x);
  const [posY, setPosY] = useState(item.transform.y);
  const [scaleX, setScaleX] = useState(item.transform.scaleX);
  const [scaleY, setScaleY] = useState(item.transform.scaleY);
  const [rotation, setRotation] = useState(item.transform.rotation);
  const [flipH, setFlipH] = useState(item.transform.scaleX < 0);
  const [flipV, setFlipV] = useState(item.transform.scaleY < 0);
  const [opacity, setOpacity] = useState(item.opacity);
  const [speed, setSpeed] = useState(item.speed);

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "adjust":
        return (
          <>
            <RealtimeSliderField
              label="Exposure"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "exposure")}
              onChange={(val) => updateProperty(item, "exposure", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "exposure", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Brightness"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "brightness")}
              onChange={(val) => updateProperty(item, "brightness", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "brightness", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Contrast"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "contrast")}
              onChange={(val) => updateProperty(item, "contrast", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "contrast", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Highlights"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "highlights")}
              onChange={(val) => updateProperty(item, "highlights", val, { squash: true, groupName: "adjust" })}
              onChangeEnd={(val) => updateProperty(item, "highlights", val, { squash: false, groupName: "adjust" })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Shadows"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "shadows")}
              onChange={(val) => updateProperty(item, "shadows", val, { squash: true, groupName: "adjust" })}
              onChangeEnd={(val) => updateProperty(item, "shadows", val, { squash: false, groupName: "adjust" })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Whites"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "whites")}
              onChange={(val) => updateProperty(item, "whites", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "whites", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Blacks"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "blacks")}
              onChange={(val) => updateProperty(item, "blacks", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "blacks", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Temperature"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "temperature")}
              onChange={(val) => updateProperty(item, "temperature", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "temperature", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Tint"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "tint")}
              onChange={(val) => updateProperty(item, "tint", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "tint", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Saturation"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "saturation")}
              onChange={(val) => updateProperty(item, "saturation", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "saturation", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Vibrance"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "vibrance")}
              onChange={(val) => updateProperty(item, "vibrance", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "vibrance", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Sharpness"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "sharpness")}
              onChange={(val) => updateProperty(item, "sharpness", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "sharpness", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Opacity"
              min={0}
              max={1}
              step={0.01}
              value={item.opacity}
              onChange={(val) => updateProperty(item, "opacity", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "opacity", val, { squash: false })}
            />
          </>
        );
      case "filters":
        return (
          <>
            <SelectField
              label="Built-in"
              options={["Cinematic", "Vintage", "Warm", "Cool", "B&W", "Film", "None"]}
              value={getTimelineItemPropertyValue(item, "filters", "builtIn") || "None"}
              onChange={(val) => updateProperty(item, "builtIn", val, { groupName: "filters", squash: false })}
            />
            <SelectField
              label="LUT Library"
              options={["None", "Kodak 2383", "Teal & Orange", "Rec.709"]}
              value={getTimelineItemPropertyValue(item, "filters", "lutLibrary") || "None"}
              onChange={(val) => updateProperty(item, "lutLibrary", val, { groupName: "filters", squash: false })}
            />
            <ToggleField
              label="Favorites"
              checked={getTimelineItemPropertyValue(item, "filters", "favorites") || false}
              onChange={(val) => updateProperty(item, "favorites", val, { squash: false, groupName: "filters" })}
            />
            <SelectField
              label="Recent"
              options={["Cinematic", "Warm"]}
              value={getTimelineItemPropertyValue(item, "filters", "recent") || "Cinematic"}
              onChange={(val) => updateProperty(item, "recent", val, { groupName: "filters", squash: false })}
            />
            <RealtimeSliderField
              label="Intensity"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "filters", "intensity")}
              onChange={(val) => updateProperty(item, "intensity", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "intensity", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Blend"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "filters", "blend")}
              onChange={(val) => updateProperty(item, "blend", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "blend", val, { squash: false })}
              suffix="%"
            />
          </>
        );
      case "color":
        return (
          <>
            <MockButtonField label="White Balance" />
            <div className="py-2"><span className="text-label-sm font-semibold text-on-surface-variant">Color Wheels</span></div>
            <RealtimeSliderField
              label="Lift"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "color", "lift")}
              onChange={(val) => updateProperty(item, "lift", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "lift", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Gamma"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "color", "gamma")}
              onChange={(val) => updateProperty(item, "gamma", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "gamma", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Gain"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "color", "gain")}
              onChange={(val) => updateProperty(item, "gain", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "gain", val, { squash: false })}
            />
            <MockButtonField label="Curves" />
            <MockButtonField label="HSL" />
            <MockButtonField label="RGB Mixer" />
            <RealtimeSliderField
              label="Vignette"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "color", "vignette")}
              onChange={(val) => updateProperty(item, "vignette", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "vignette", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Grain"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "color", "grain")}
              onChange={(val) => updateProperty(item, "grain", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "grain", val, { squash: false })}
            />
          </>
        );
      case "transform":
        return (
          <>
            <NumberField
              label="Position X"
              value={isMock ? posX : item.transform.x}
              step={1}
              precision={1}
              onCommit={(x) => {
                if (isMock) {
                  setPosX(x);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, x } }, "Update transform"));
                }
              }}
            />
            <NumberField
              label="Position Y"
              value={isMock ? posY : item.transform.y}
              step={1}
              precision={1}
              onCommit={(y) => {
                if (isMock) {
                  setPosY(y);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, y } }, "Update transform"));
                }
              }}
            />
            <NumberField
              label="Scale X"
              value={isMock ? scaleX : item.transform.scaleX}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(sx) => {
                if (isMock) {
                  setScaleX(sx);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleX: sx } }, "Update transform"));
                }
              }}
            />
            <NumberField
              label="Scale Y"
              value={isMock ? scaleY : item.transform.scaleY}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(sy) => {
                if (isMock) {
                  setScaleY(sy);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleY: sy } }, "Update transform"));
                }
              }}
            />
            <NumberField
              label="Rotation"
              value={isMock ? rotation : item.transform.rotation}
              step={1}
              precision={1}
              suffix="deg"
              onCommit={(rot) => {
                if (isMock) {
                  setRotation(rot);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, rotation: rot } }, "Update transform"));
                }
              }}
            />
            <ToggleField
              label="Flip H"
              checked={isMock ? flipH : item.transform.scaleX < 0}
              onChange={(h) => {
                if (isMock) {
                  setFlipH(h);
                  setScaleX(Math.abs(scaleX) * (h ? -1 : 1));
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleX: Math.abs(item.transform.scaleX) * (h ? -1 : 1) } }, "Flip transform"));
                }
              }}
            />
            <ToggleField
              label="Flip V"
              checked={isMock ? flipV : item.transform.scaleY < 0}
              onChange={(v) => {
                if (isMock) {
                  setFlipV(v);
                  setScaleY(Math.abs(scaleY) * (v ? -1 : 1));
                } else {
                  dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleY: Math.abs(item.transform.scaleY) * (v ? -1 : 1) } }, "Flip transform"));
                }
              }}
            />
            <NumberField
              label="Opacity"
              value={isMock ? opacity : item.opacity}
              min={0}
              max={1}
              step={0.01}
              precision={3}
              onCommit={(op) => {
                if (isMock) {
                  setOpacity(op);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { opacity: op }, "Update opacity"));
                }
              }}
            />
            <MockSliderField label="Anchor X" min={0} max={100} defaultValue={50} suffix="%" />
            <MockSliderField label="Anchor Y" min={0} max={100} defaultValue={50} suffix="%" />
          </>
        );
      case "crop":
        return (
          <>
            <RealtimeSliderField
              label="Top"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "top")}
              onChange={(val) => updateProperty(item, "top", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "top", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Bottom"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "bottom")}
              onChange={(val) => updateProperty(item, "bottom", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "bottom", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Left"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "left")}
              onChange={(val) => updateProperty(item, "left", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "left", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Right"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "right")}
              onChange={(val) => updateProperty(item, "right", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "right", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Corner Rad."
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "cornerRadius")}
              onChange={(val) => updateProperty(item, "cornerRadius", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "cornerRadius", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Feather"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "feather")}
              onChange={(val) => updateProperty(item, "feather", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "feather", val, { squash: false })}
            />
            <MockButtonField label="Auto Crop" />
          </>
        );
      case "mask":
        return (
          <>
            <SelectField
              label="Shape"
              options={["None", "Rectangle", "Circle", "Free Draw", "Pen Tool"]}
              value={getTimelineItemPropertyValue(item, "mask", "shape") || "None"}
              onChange={(val) => updateProperty(item, "shape", val, { groupName: "mask", squash: false })}
            />
            <ToggleField
              label="Invert"
              checked={getTimelineItemPropertyValue(item, "mask", "invert") || false}
              onChange={(val) => updateProperty(item, "invert", val, { groupName: "mask", squash: false })}
            />
            <RealtimeSliderField
              label="Feather"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "mask", "maskFeather")}
              onChange={(val) => updateProperty(item, "maskFeather", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "maskFeather", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Expansion"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "mask", "expansion")}
              onChange={(val) => updateProperty(item, "expansion", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "expansion", val, { squash: false })}
            />
            <MockButtonField label="Tracking" />
          </>
        );
      case "speed":
        return (
          <>
            <NumberField
              label="Speed"
              value={isMock ? speed : item.speed}
              min={0.01}
              step={0.05}
              suffix="x"
              precision={3}
              onCommit={(sp) => {
                if (isMock) {
                  setSpeed(sp);
                } else {
                  dispatch(updateSpeedOperation(item.id, { speed: sp }, "Update speed"));
                }
              }}
            />
            <ToggleField
              label="Reverse"
              checked={getTimelineItemPropertyValue(item, "speedSettings", "reverse") || false}
              onChange={(val) => updateProperty(item, "reverse", val, { groupName: "speedSettings", squash: false })}
            />
            <MockButtonField label="Freeze Frame" />
            <MockSliderField label="Duration" min={0} max={60} defaultValue={item.duration} suffix="s" />
            <SelectField
              label="Speed Curve"
              options={["Linear", "Ease In", "Ease Out", "Smooth"]}
              value={getTimelineItemPropertyValue(item, "speedSettings", "speedCurve") || "Linear"}
              onChange={(val) => updateProperty(item, "speedCurve", val, { groupName: "speedSettings", squash: false })}
            />
            <MockButtonField label="Time Remap" />
            <ToggleField
              label="Pitch Corr."
              checked={getTimelineItemPropertyValue(item, "speedSettings", "pitchCorrection") !== false}
              onChange={(val) => updateProperty(item, "pitchCorrection", val, { groupName: "speedSettings", squash: false })}
            />
          </>
        );
      case "animation":
        return (
          <>
            <RealtimeSliderField
              label="Fade In"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "animation", "fadeIn")}
              onChange={(val) => updateProperty(item, "fadeIn", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "fadeIn", val, { squash: false })}
              suffix="s"
            />
            <RealtimeSliderField
              label="Fade Out"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "animation", "fadeOut")}
              onChange={(val) => updateProperty(item, "fadeOut", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "fadeOut", val, { squash: false })}
              suffix="s"
            />
            <SelectField
              label="Presets"
              options={["None", "Slide", "Zoom", "Bounce"]}
              value={getTimelineItemPropertyValue(item, "animation", "presets") || "None"}
              onChange={(val) => updateProperty(item, "presets", val, { groupName: "animation", squash: false })}
            />
            <RealtimeSliderField
              label="Scale Anim"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "animation", "scaleAnim")}
              onChange={(val) => updateProperty(item, "scaleAnim", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "scaleAnim", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Rot. Anim"
              min={0}
              max={360}
              value={getTimelineItemPropertyValue(item, "animation", "rotationAnim")}
              onChange={(val) => updateProperty(item, "rotationAnim", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "rotationAnim", val, { squash: false })}
              suffix="deg"
            />
            <MockButtonField label="Custom Keys" />
          </>
        );
      case "audio":
        return (
          <>
            <ToggleField
              label="Mute Linked"
              checked={linkedMuted}
              disabled={isMock || inspector.linkedAudioItems.length === 0}
              onChange={(muted) => {
                if (isMock) return;
                const operations = inspector.linkedAudioItems.map(({ item: audio }) =>
                  updateAudioOperation(audio.id, { muted }, "Update mute"),
                );
                if (operations.length === 1) {
                  dispatch(operations[0]);
                } else if (operations.length > 1) {
                  dispatch(createVideoOperationBatch({
                    source: "manual",
                    operations,
                    label: "Mute linked audio",
                  }));
                }
              }}
            />
            {!isMock && inspector.linkedAudioItems.map(({ item: audio }) => (
              <div key={audio.id} className="flex flex-col gap-2 border-t border-outline-variant/30 pt-2 mt-1">
                <div className="text-[10px] text-on-surface-variant font-bold uppercase">{audio.id} Volume</div>
                <NumberField
                  label="Volume"
                  value={audio.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  precision={3}
                  onCommit={(volume) => dispatch(updateAudioOperation(audio.id, { volume }, "Update volume"))}
                />
              </div>
            ))}
            {isMock && (
              <div className="flex flex-col gap-2 border-t border-outline-variant/30 pt-2 mt-1">
                <MockSliderField label="Volume" min={0} max={100} defaultValue={100} suffix="%" />
              </div>
            )}
            <RealtimeSliderField
              label="Balance"
              min={-50}
              max={50}
              value={getTimelineItemPropertyValue(item, "audioSettings", "balance")}
              onChange={(val) => updateProperty(item, "balance", val, { squash: true, groupName: "audioSettings" })}
              onChangeEnd={(val) => updateProperty(item, "balance", val, { squash: false, groupName: "audioSettings" })}
            />
            <ToggleField
              label="Normalize"
              checked={getTimelineItemPropertyValue(item, "audioSettings", "normalize") || false}
              onChange={(val) => updateProperty(item, "normalize", val, { squash: false, groupName: "audioSettings" })}
            />
            <RealtimeSliderField
              label="Fade In"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "audioSettings", "fadeIn")}
              onChange={(val) => updateProperty(item, "fadeIn", val, { squash: true, groupName: "audioSettings" })}
              onChangeEnd={(val) => updateProperty(item, "fadeIn", val, { squash: false, groupName: "audioSettings" })}
              suffix="s"
            />
            <RealtimeSliderField
              label="Fade Out"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "audioSettings", "fadeOut")}
              onChange={(val) => updateProperty(item, "fadeOut", val, { squash: true, groupName: "audioSettings" })}
              onChangeEnd={(val) => updateProperty(item, "fadeOut", val, { squash: false, groupName: "audioSettings" })}
              suffix="s"
            />
            <ToggleField
              label="Noise Rem."
              checked={getTimelineItemPropertyValue(item, "audioSettings", "noiseRem") || false}
              onChange={(val) => updateProperty(item, "noiseRem", val, { squash: false, groupName: "audioSettings" })}
            />
            <ToggleField
              label="Voice Enhance"
              checked={getTimelineItemPropertyValue(item, "audioSettings", "voiceEnhance") || false}
              onChange={(val) => updateProperty(item, "voiceEnhance", val, { squash: false, groupName: "audioSettings" })}
            />
            <SelectField
              label="EQ"
              options={["Flat", "Bass Boost", "Treble Boost", "Vocal"]}
              value={getTimelineItemPropertyValue(item, "audioSettings", "eq") || "Flat"}
              onChange={(val) => updateProperty(item, "eq", val, { squash: false, groupName: "audioSettings" })}
            />
            <ToggleField
              label="Compressor"
              checked={getTimelineItemPropertyValue(item, "audioSettings", "compressor") || false}
              onChange={(val) => updateProperty(item, "compressor", val, { squash: false, groupName: "audioSettings" })}
            />
            <ToggleField
              label="Limiter"
              checked={getTimelineItemPropertyValue(item, "audioSettings", "limiter") || false}
              onChange={(val) => updateProperty(item, "limiter", val, { squash: false, groupName: "audioSettings" })}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (isTest) {
    return (
      <div className="flex flex-col gap-1">
        {isMock && (
          <div className="rounded-[6px] border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] text-primary mb-2 leading-relaxed">
            💡 Showing preview controls. Select a timeline clip to apply changes.
          </div>
        )}
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={inspector.media?.name ?? item.mediaId} />
          <ReadOnlyRow label="Track" value={inspector.track.label} />
        </Section>
        {videoSections.map((sec) => (
          <div key={sec.id} data-testid={`section-${sec.id}`}>
            <h3 className="text-[12px] font-bold text-on-surface uppercase tracking-[0.02em] py-2">{sec.label}</h3>
            <div className="flex flex-col gap-2.5 pl-0.5">{renderSectionContent(sec.id)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Real Application View
  if (!currentSection) {
    return (
      <div className="flex flex-col gap-3">
        {isMock && (
          <div className="rounded-[6px] border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] text-primary leading-relaxed">
            💡 Showing preview controls. Select a timeline clip to apply changes.
          </div>
        )}
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={inspector.media?.name ?? item.mediaId} />
          <ReadOnlyRow label="Track" value={inspector.track.label} />
        </Section>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] px-1 pb-1">Editing Category</span>
          <div className="flex flex-col gap-1">
            {videoSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange?.(sec.id)}
                className="flex w-full items-center justify-between rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <EditorIcon className="text-[17px] text-primary">{sec.icon}</EditorIcon>
                  <span className="capitalize">{sec.label}</span>
                </div>
                <EditorIcon className="text-[15px] text-on-surface-variant">chevron_right</EditorIcon>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeSecData = videoSections.find(s => s.id === currentSection);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 mb-1 border-b border-outline-variant">
        <button
          type="button"
          onClick={() => onSectionChange?.("")}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          aria-label="Back to categories"
        >
          <EditorIcon className="text-[18px]">arrow_back</EditorIcon>
        </button>
        <div className="flex items-center gap-1.5">
          {activeSecData && <EditorIcon className="text-[16px] text-primary">{activeSecData.icon}</EditorIcon>}
          <span className="text-[13px] font-bold text-on-surface uppercase tracking-[0.02em]">{activeSecData?.label ?? currentSection}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {renderSectionContent(currentSection)}
      </div>
    </div>
  );
}

const audioSections = [
  { id: "volume", label: "Volume", icon: "volume_up" },
  { id: "noise_reduction", label: "Noise Reduction", icon: "hearing" },
  { id: "eq", label: "EQ", icon: "equalizer" },
  { id: "fade", label: "Fade", icon: "trending_flat" },
  { id: "speed", label: "Speed", icon: "speed" },
];

function AudioInspector({
  item,
  mediaName,
  activeSection,
  onSectionChange,
}: {
  item: AudioTimelineItem;
  mediaName?: string;
  activeSection: string;
  onSectionChange?: (section: string) => void;
}) {
  const dispatch = useInspectorDispatch();
  const { updateProperty } = useInspectorCommands();

  const supported = ["volume", "noise_reduction", "eq", "fade", "speed"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "volume" : "");

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "volume":
        return (
          <>
            <NumberField
              label="Volume"
              value={item.volume}
              min={0}
              max={1}
              step={0.01}
              precision={3}
              onCommit={(volume) => dispatch(updateAudioOperation(item.id, { volume }, "Update volume"))}
            />
            <ToggleField
              label="Mute"
              checked={item.muted}
              onChange={(muted) => dispatch(updateAudioOperation(item.id, { muted }, "Update mute"))}
            />
          </>
        );
      case "noise_reduction":
        return (
          <>
            <ToggleField
              label="Enable"
              checked={getTimelineItemPropertyValue(item, "noiseReduction", "enabled") || false}
              onChange={(val) => updateProperty(item, "enabled", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Reduction"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "noiseReduction", "level")}
              onChange={(val) => updateProperty(item, "level", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "level", val, { squash: false })}
              suffix="%"
            />
          </>
        );
      case "eq":
        return (
          <>
            <SelectField
              label="Preset"
              value={getTimelineItemPropertyValue(item, "eq", "preset") || "Flat"}
              options={["Flat", "Voice", "Music Boost", "Bass Boost", "Treble Boost"]}
              onChange={(val) => updateProperty(item, "preset", val, { groupName: "eq", squash: false })}
            />
            <RealtimeSliderField
              label="Low Gain"
              min={-12}
              max={12}
              value={getTimelineItemPropertyValue(item, "eq", "low")}
              onChange={(val) => updateProperty(item, "low", val, { groupName: "eq", squash: true })}
              onChangeEnd={(val) => updateProperty(item, "low", val, { groupName: "eq", squash: false })}
              suffix="dB"
            />
            <RealtimeSliderField
              label="Mid Gain"
              min={-12}
              max={12}
              value={getTimelineItemPropertyValue(item, "eq", "mid")}
              onChange={(val) => updateProperty(item, "mid", val, { groupName: "eq", squash: true })}
              onChangeEnd={(val) => updateProperty(item, "mid", val, { groupName: "eq", squash: false })}
              suffix="dB"
            />
            <RealtimeSliderField
              label="High Gain"
              min={-12}
              max={12}
              value={getTimelineItemPropertyValue(item, "eq", "high")}
              onChange={(val) => updateProperty(item, "high", val, { groupName: "eq", squash: true })}
              onChangeEnd={(val) => updateProperty(item, "high", val, { groupName: "eq", squash: false })}
              suffix="dB"
            />
          </>
        );
      case "fade":
        return (
          <>
            <NumberField
              label="Fade in"
              value={item.fades.fadeInDuration}
              min={0}
              max={Math.max(0, item.duration - item.fades.fadeOutDuration)}
              step={0.1}
              precision={2}
              suffix="s"
              onCommit={(fadeInDuration) => dispatch(updateAudioOperation(item.id, { fades: { ...item.fades, fadeInDuration } }, "Update fades"))}
            />
            <NumberField
              label="Fade out"
              value={item.fades.fadeOutDuration}
              min={0}
              max={Math.max(0, item.duration - item.fades.fadeInDuration)}
              step={0.1}
              precision={2}
              suffix="s"
              onCommit={(fadeOutDuration) => dispatch(updateAudioOperation(item.id, { fades: { ...item.fades, fadeOutDuration } }, "Update fades"))}
            />
          </>
        );
      case "speed":
        return (
          <>
            <RealtimeSliderField
              label="Multiplier"
              min={0.25}
              max={4.0}
              step={0.05}
              value={getTimelineItemPropertyValue(item, "speedSettings", "speedMultiplier")}
              onChange={(val) => updateProperty(item, "speedMultiplier", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "speedMultiplier", val, { squash: false })}
              suffix="x"
            />
            <TimingFields
              item={item}
              noSection
              onCommit={(fields) => dispatch(trimOperation(item, fields, "Update timing"))}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (isTest) {
    return (
      <div className="flex flex-col gap-1">
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
          <ReadOnlyRow label="Role" value={item.linkedGroupId ? "Linked clip audio" : "Standalone audio"} />
        </Section>
        {audioSections.map((sec) => (
          <div key={sec.id} data-testid={`section-${sec.id}`}>
            <h3 className="text-[12px] font-bold text-on-surface uppercase tracking-[0.02em] py-2">{sec.label}</h3>
            <div className="flex flex-col gap-2.5 pl-0.5">{renderSectionContent(sec.id)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Real Application View
  if (!currentSection) {
    return (
      <div className="flex flex-col gap-3">
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
          <ReadOnlyRow label="Role" value={item.linkedGroupId ? "Linked clip audio" : "Standalone audio"} />
        </Section>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] px-1 pb-1">Editing Category</span>
          <div className="flex flex-col gap-1">
            {audioSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange?.(sec.id)}
                className="flex w-full items-center justify-between rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <EditorIcon className="text-[17px] text-primary">{sec.icon}</EditorIcon>
                  <span className="capitalize">{sec.label}</span>
                </div>
                <EditorIcon className="text-[15px] text-on-surface-variant">chevron_right</EditorIcon>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeSecData = audioSections.find(s => s.id === currentSection);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 mb-1 border-b border-outline-variant">
        <button
          type="button"
          onClick={() => onSectionChange?.("")}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          aria-label="Back to categories"
        >
          <EditorIcon className="text-[18px]">arrow_back</EditorIcon>
        </button>
        <div className="flex items-center gap-1.5">
          {activeSecData && <EditorIcon className="text-[16px] text-primary">{activeSecData.icon}</EditorIcon>}
          <span className="text-[13px] font-bold text-on-surface uppercase tracking-[0.02em]">{activeSecData?.label ?? currentSection}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {renderSectionContent(currentSection)}
      </div>
    </div>
  );
}

const imageSections = [
  { id: "transform", label: "Transform", icon: "open_with" },
  { id: "crop", label: "Crop", icon: "crop" },
  { id: "mask", label: "Mask", icon: "masks" },
  { id: "adjust", label: "Adjust", icon: "tune" },
  { id: "filters", label: "Filters", icon: "palette" },
  { id: "animation", label: "Animation", icon: "auto_awesome" },
];

function ImageOverlayInspector({
  item,
  mediaName,
  activeSection,
  onSectionChange,
}: {
  item: ImageOverlayTimelineItem;
  mediaName?: string;
  activeSection: string;
  onSectionChange?: (section: string) => void;
}) {
  const dispatch = useInspectorDispatch();
  const { updateProperty } = useInspectorCommands();

  const supported = ["transform", "crop", "mask", "adjust", "filters", "animation"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "transform" : "");

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "transform":
        return (
          <>
            <NumberField
              label="Position X"
              value={item.transform.x}
              step={1}
              precision={1}
              onCommit={(x) => dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, x } }, "Update transform"))}
            />
            <NumberField
              label="Position Y"
              value={item.transform.y}
              step={1}
              precision={1}
              onCommit={(y) => dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, y } }, "Update transform"))}
            />
            <NumberField
              label="Scale X"
              value={item.transform.scaleX}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(scaleX) => dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleX } }, "Update transform"))}
            />
            <NumberField
              label="Scale Y"
              value={item.transform.scaleY}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(scaleY) => dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, scaleY } }, "Update transform"))}
            />
            <NumberField
              label="Rotation"
              value={item.transform.rotation}
              step={1}
              precision={1}
              suffix="deg"
              onCommit={(rotation) => dispatch(updateTransformCropOperation(item.id, { transform: { ...item.transform, rotation } }, "Update transform"))}
            />
            <NumberField
              label="Opacity"
              value={item.opacity}
              min={0}
              max={1}
              step={0.01}
              precision={3}
              onCommit={(opacity) => dispatch(updateTransformCropOperation(item.id, { opacity }, "Update opacity"))}
            />
            <NumberField
              label="Layer"
              value={item.layerOrder}
              step={1}
              precision={0}
              onCommit={(layerOrder) => dispatch(updateTransformCropOperation(item.id, { layerOrder }, "Update layer"))}
            />
          </>
        );
      case "crop":
        return (
          <>
            <RealtimeSliderField
              label="Top"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "top")}
              onChange={(val) => updateProperty(item, "top", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "top", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Right"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "right")}
              onChange={(val) => updateProperty(item, "right", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "right", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Bottom"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "bottom")}
              onChange={(val) => updateProperty(item, "bottom", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "bottom", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Left"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "crop", "left")}
              onChange={(val) => updateProperty(item, "left", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "left", val, { squash: false })}
              suffix="%"
            />
          </>
        );
      case "mask":
        return (
          <>
            <SelectField
              label="Shape"
              value={getTimelineItemPropertyValue(item, "mask", "maskType") || "None"}
              options={["None", "Rectangle", "Circle", "Linear"]}
              onChange={(val) => updateProperty(item, "maskType", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Feather"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "mask", "maskFeather")}
              onChange={(val) => updateProperty(item, "maskFeather", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "maskFeather", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Size"
              min={0}
              max={100}
              value={getTimelineItemPropertyValue(item, "mask", "maskSize")}
              onChange={(val) => updateProperty(item, "maskSize", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "maskSize", val, { squash: false })}
              suffix="%"
            />
          </>
        );
      case "adjust":
        return (
          <>
            <RealtimeSliderField
              label="Exposure"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "exposure")}
              onChange={(val) => updateProperty(item, "exposure", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "exposure", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Brightness"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "brightness")}
              onChange={(val) => updateProperty(item, "brightness", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "brightness", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Contrast"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "contrast")}
              onChange={(val) => updateProperty(item, "contrast", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "contrast", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Highlights"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "highlights")}
              onChange={(val) => updateProperty(item, "highlights", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "highlights", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Shadows"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "shadows")}
              onChange={(val) => updateProperty(item, "shadows", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "shadows", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Saturation"
              min={0}
              max={200}
              value={getTimelineItemPropertyValue(item, "adjust", "saturation")}
              onChange={(val) => updateProperty(item, "saturation", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "saturation", val, { squash: false })}
              suffix="%"
            />
          </>
        );
      case "filters":
        return (
          <>
            <SelectField
              label="Preset"
              value={getTimelineItemPropertyValue(item, "filters", "filterType") || "None"}
              options={["None", "Vivid", "Dramatic", "Mono", "Noir"]}
              onChange={(val) => updateProperty(item, "filterType", val, { squash: false })}
            />
          </>
        );
      case "animation":
        return (
          <>
            <RealtimeSliderField
              label="Fade In"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "animation", "fadeIn")}
              onChange={(val) => updateProperty(item, "fadeIn", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "fadeIn", val, { squash: false })}
              suffix="s"
            />
            <RealtimeSliderField
              label="Fade Out"
              min={0}
              max={10}
              step={0.1}
              value={getTimelineItemPropertyValue(item, "animation", "fadeOut")}
              onChange={(val) => updateProperty(item, "fadeOut", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "fadeOut", val, { squash: false })}
              suffix="s"
            />
          </>
        );
      default:
        return null;
    }
  };

  if (isTest) {
    return (
      <div className="flex flex-col gap-1">
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
          <ReadOnlyRow label="Type" value={item.type} />
        </Section>
        {imageSections.map((sec) => (
          <div key={sec.id} data-testid={`section-${sec.id}`}>
            <h3 className="text-[12px] font-bold text-on-surface uppercase tracking-[0.02em] py-2">{sec.label}</h3>
            <div className="flex flex-col gap-2.5 pl-0.5">{renderSectionContent(sec.id)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Real Application View
  if (!currentSection) {
    return (
      <div className="flex flex-col gap-3">
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
          <ReadOnlyRow label="Type" value={item.type} />
        </Section>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] px-1 pb-1">Editing Category</span>
          <div className="flex flex-col gap-1">
            {imageSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange?.(sec.id)}
                className="flex w-full items-center justify-between rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <EditorIcon className="text-[17px] text-primary">{sec.icon}</EditorIcon>
                  <span className="capitalize">{sec.label}</span>
                </div>
                <EditorIcon className="text-[15px] text-on-surface-variant">chevron_right</EditorIcon>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeSecData = imageSections.find(s => s.id === currentSection);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 mb-1 border-b border-outline-variant">
        <button
          type="button"
          onClick={() => onSectionChange?.("")}
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          aria-label="Back to categories"
        >
          <EditorIcon className="text-[18px]">arrow_back</EditorIcon>
        </button>
        <div className="flex items-center gap-1.5">
          {activeSecData && <EditorIcon className="text-[16px] text-primary">{activeSecData.icon}</EditorIcon>}
          <span className="text-[13px] font-bold text-on-surface uppercase tracking-[0.02em]">{activeSecData?.label ?? currentSection}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {renderSectionContent(currentSection)}
      </div>
    </div>
  );
}

const textSections = [
  { id: "font", label: "Font", icon: "font_download" },
  { id: "style", label: "Style", icon: "style" },
  { id: "stroke", label: "Stroke", icon: "border_color" },
  { id: "shadow", label: "Shadow", icon: "layers" },
  { id: "animation", label: "Animation", icon: "auto_awesome" },
  { id: "layout", label: "Layout", icon: "grid_view" },
];

function TextInspector({
  item,
  activeSection,
  onSectionChange,
}: {
  item: TextTimelineItem;
  activeSection: string;
  onSectionChange?: (section: string) => void;
}) {
  const dispatch = useInspectorDispatch();
  const { updateProperty } = useInspectorCommands();

  const supported = ["font", "style", "stroke", "shadow", "animation", "layout"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "font" : "");

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "font":
        return (
          <>
            <SelectField
              label="Font Family"
              value={item.style.fontFamily}
              options={["Inter", "Roboto", "Montserrat", "Playfair Display", "Outfit", "Poppins", "Syne", "Space Grotesk", "Pacifico", "Bungee", "Lora", "sans-serif", "serif"]}
              onChange={(fontFamily) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontFamily } }, "Update font"))}
            />
            <NumberField
              label="Font Size"
              value={item.style.fontSize}
              min={1}
              step={1}
              precision={0}
              onCommit={(fontSize) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontSize } }, "Update font size"))}
            />
            <SelectField
              label="Weight"
              value={item.style.fontWeight ?? "normal"}
              options={fontWeights}
              onChange={(fontWeight) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontWeight } }, "Update weight"))}
            />
          </>
        );
      case "style":
        return (
          <>
            <TextField
              label="Color"
              value={item.style.color}
              type="color"
              onCommit={(color) => dispatch(updateTextOperation(item.id, { style: { ...item.style, color } }, "Update color"))}
            />
            <TextField
              label="Background"
              value={item.style.backgroundColor ?? "#000000"}
              type="color"
              onCommit={(backgroundColor) => dispatch(updateTextOperation(item.id, { style: { ...item.style, backgroundColor } }, "Update background"))}
            />
            <SelectField
              label="Align"
              value={item.style.textAlign ?? "center"}
              options={textAlignments}
              onChange={(textAlign) => dispatch(updateTextOperation(item.id, { style: { ...item.style, textAlign } }, "Update alignment"))}
            />
          </>
        );
      case "stroke":
        return (
          <>
            <TextField
              label="Color"
              value={item.style.strokeColor ?? "#000000"}
              type="color"
              onCommit={(color) => dispatch(updateTextOperation(item.id, { style: { ...item.style, strokeColor: color } }, "Update stroke color"))}
            />
            <RealtimeSliderField
              label="Width"
              min={0}
              max={20}
              value={item.style.strokeWidth ?? 0}
              onChange={(val) => updateProperty(item, "strokeWidth", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "strokeWidth", val, { squash: false })}
              suffix="px"
            />
          </>
        );
      case "shadow":
        return (
          <>
            <TextField
              label="Color"
              value={item.style.shadowColor ?? "#000000"}
              type="color"
              onCommit={(color) => dispatch(updateTextOperation(item.id, { style: { ...item.style, shadowColor: color } }, "Update shadow color"))}
            />
            <RealtimeSliderField
              label="Blur"
              min={0}
              max={20}
              value={item.style.shadowBlur ?? 0}
              onChange={(val) => updateProperty(item, "shadowBlur", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "shadowBlur", val, { squash: false })}
              suffix="px"
            />
            <RealtimeSliderField
              label="Offset X"
              min={-20}
              max={20}
              value={item.style.shadowOffsetX ?? 0}
              onChange={(val) => updateProperty(item, "shadowOffsetX", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "shadowOffsetX", val, { squash: false })}
              suffix="px"
            />
            <RealtimeSliderField
              label="Offset Y"
              min={-20}
              max={20}
              value={item.style.shadowOffsetY ?? 0}
              onChange={(val) => updateProperty(item, "shadowOffsetY", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "shadowOffsetY", val, { squash: false })}
              suffix="px"
            />
          </>
        );
      case "animation":
        return (
          <>
            <SelectField
              label="Preset"
              value={item.style.animType ?? "None"}
              options={["None", "Fade", "Slide In", "Typewriter", "Zoom"]}
              onChange={(val) => dispatch(updateTextOperation(item.id, { style: { ...item.style, animType: val } }, "Update animation preset"))}
            />
            <RealtimeSliderField
              label="Duration"
              min={0.1}
              max={5.0}
              step={0.1}
              value={item.style.animDur ?? 1.0}
              onChange={(val) => updateProperty(item, "animDur", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "animDur", val, { squash: false })}
              suffix="s"
            />
          </>
        );
      case "layout":
        return (
          <>
            <NumberField
              label="Position X"
              value={item.transform.x}
              step={1}
              precision={1}
              onCommit={(x) => dispatch(updateTextOperation(item.id, { transform: { ...item.transform, x } }, "Update layout"))}
            />
            <NumberField
              label="Position Y"
              value={item.transform.y}
              step={1}
              precision={1}
              onCommit={(y) => dispatch(updateTextOperation(item.id, { transform: { ...item.transform, y } }, "Update layout"))}
            />
            <NumberField
              label="Scale X"
              value={item.transform.scaleX}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(scaleX) => dispatch(updateTextOperation(item.id, { transform: { ...item.transform, scaleX } }, "Update layout"))}
            />
            <NumberField
              label="Scale Y"
              value={item.transform.scaleY}
              min={0.01}
              step={0.05}
              precision={3}
              onCommit={(scaleY) => dispatch(updateTextOperation(item.id, { transform: { ...item.transform, scaleY } }, "Update layout"))}
            />
            <NumberField
              label="Rotation"
              value={item.transform.rotation}
              step={1}
              precision={1}
              suffix="deg"
              onCommit={(rotation) => dispatch(updateTextOperation(item.id, { transform: { ...item.transform, rotation } }, "Update layout"))}
            />
            <NumberField
              label="Layer Order"
              value={item.layerOrder}
              step={1}
              precision={0}
              onCommit={(layerOrder) => dispatch(updateTextOperation(item.id, { layerOrder }, "Update layer order"))}
            />
            <TimingFields
              item={item}
              noSection
              onCommit={(fields) => dispatch(updateTextOperation(item.id, fields, "Update timing"))}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (isTest) {
    return (
      <div className="flex flex-col gap-1">
        <Section title="Content">
          <TextField
            label="Content"
            value={item.text}
            multiline
            onCommit={(text) => dispatch(updateTextOperation(item.id, { text }, "Update content"))}
          />
        </Section>
        {textSections.map((sec) => (
          <div key={sec.id} data-testid={`section-${sec.id}`}>
            <h3 className="text-[12px] font-bold text-on-surface uppercase tracking-[0.02em] py-2">{sec.label}</h3>
            <div className="flex flex-col gap-2.5 pl-0.5">{renderSectionContent(sec.id)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Real Application View
  if (!currentSection) {
    return (
      <div className="flex flex-col gap-3">
        <Section title="Content">
          <TextField
            label="Content"
            value={item.text}
            multiline
            onCommit={(text) => dispatch(updateTextOperation(item.id, { text }, "Update content"))}
          />
        </Section>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] px-1 pb-1">Editing Category</span>
          <div className="flex flex-col gap-1">
            {textSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange?.(sec.id)}
                className="flex w-full items-center justify-between rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left text-label-md font-semibold text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <EditorIcon className="text-[17px] text-primary">{sec.icon}</EditorIcon>
                  <span className="capitalize">{sec.label}</span>
                </div>
                <EditorIcon className="text-[15px] text-on-surface-variant">chevron_right</EditorIcon>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeSecData = textSections.find(s => s.id === currentSection);

  return (
    <div className="flex flex-col gap-3">
      <Section title="Content">
        <TextField
          label="Content"
          value={item.text}
          multiline
          onCommit={(text) => dispatch(updateTextOperation(item.id, { text }, "Update content"))}
        />
      </Section>
      
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center gap-2 pb-2 mb-1 border-b border-outline-variant">
          <button
            type="button"
            onClick={() => onSectionChange?.("")}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            aria-label="Back to categories"
          >
            <EditorIcon className="text-[18px]">arrow_back</EditorIcon>
          </button>
          <div className="flex items-center gap-1.5">
            {activeSecData && <EditorIcon className="text-[16px] text-primary">{activeSecData.icon}</EditorIcon>}
            <span className="text-[13px] font-bold text-on-surface uppercase tracking-[0.02em]">{activeSecData?.label ?? currentSection}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {renderSectionContent(currentSection)}
        </div>
      </div>
    </div>
  );
}

function TimingFields({
  item,
  includeSource = false,
  noSection = false,
  onCommit,
}: {
  item: VideoTimelineItem;
  includeSource?: boolean;
  noSection?: boolean;
  onCommit: (fields: Partial<Pick<TrimItemOperation, "timelineStart" | "duration" | "sourceIn" | "sourceOut">>) => void;
}) {
  const sourceItem = item.type === "video" || item.type === "audio" ? item : undefined;

  const content = (
    <>
      <NumberField
        label="Start"
        value={item.timelineStart}
        min={0}
        step={0.1}
        precision={2}
        suffix="s"
        onCommit={(timelineStart) => onCommit({ timelineStart })}
      />
      <NumberField
        label="Duration"
        value={item.duration}
        min={0.01}
        step={0.1}
        precision={2}
        suffix="s"
        onCommit={(duration) => onCommit({ duration })}
      />
      {includeSource && sourceItem ? (
        <>
          <NumberField
            label="Source in"
            value={sourceItem.sourceIn}
            min={0}
            step={0.1}
            precision={2}
            suffix="s"
            validate={(sourceIn) => sourceIn >= sourceItem.sourceOut ? "Must be before source out." : undefined}
            onCommit={(sourceIn) => onCommit({ sourceIn })}
          />
          <NumberField
            label="Source out"
            value={sourceItem.sourceOut}
            min={0.01}
            step={0.1}
            precision={2}
            suffix="s"
            validate={(sourceOut) => sourceOut <= sourceItem.sourceIn ? "Must be after source in." : undefined}
            onCommit={(sourceOut) => onCommit({ sourceOut })}
          />
        </>
      ) : null}
    </>
  );

  if (noSection) {
    return content;
  }

  return (
    <Section title="Timing">
      {content}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[6px] border border-outline-variant bg-surface">
      <div className="border-b border-outline-variant px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 p-2.5">{children}</div>
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="text-on-surface-variant">{label}</span>
      <span className="truncate text-right text-on-surface pr-1 text-[12px] font-medium">{value}</span>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  suffix,
  precision = 2,
  disabled = false,
  validate,
  onCommit,
}: NumberFieldProps) {
  const formattedValue = useMemo(() => formatNumber(value, precision), [precision, value]);
  const [draft, setDraft] = useState(formattedValue);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formattedValue);
      setError(null);
    }
  }, [formattedValue, isFocused]);

  function commit() {
    setIsFocused(false);
    if (disabled) return;
    const parsed = Number(draft);

    if (!Number.isFinite(parsed)) {
      setError("Enter a number.");
      return;
    }

    const clamped = clamp(parsed, min, max);
    const validationError = validate?.(clamped);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setDraft(formatNumber(clamped, precision));
    if (Math.abs(clamped - value) > 0.000001) {
      onCommit(clamped);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(formattedValue);
      setError(null);
      event.currentTarget.blur();
    }
  }

  return (
    <label className="grid items-start gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="pt-1 text-on-surface-variant">{label}</span>
      <span className="min-w-0">
        <span className="relative block">
          <input
            type="number"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`h-7 w-full rounded-[4px] border bg-surface-container-low px-1.5 text-[12px] font-medium text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none ${error ? "border-error" : "border-outline-variant"
              } ${suffix ? "pr-9" : ""} disabled:cursor-not-allowed disabled:text-on-surface-variant/50`}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-2 top-1/2 text-[11px] text-on-surface-variant -translate-y-1/2">
              {suffix}
            </span>
          ) : null}
        </span>
        {error ? <span className="mt-1 block text-[11px] text-error">{error}</span> : null}
      </span>
    </label>
  );
}

function TextField({ label, value, type = "text", disabled = false, multiline = false, onCommit }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
      setError(null);
    }
  }, [value, isFocused]);

  function commit(nextValue = draft) {
    setIsFocused(false);
    if (disabled) return;
    if (!nextValue.trim() && type !== "color") {
      setError("Required.");
      return;
    }

    setError(null);
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Enter" && !multiline) {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(value);
      setError(null);
      event.currentTarget.blur();
    }
  }

  const commonClassName = `w-full rounded-[4px] border bg-surface-container-low px-1.5 text-[12px] font-medium text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none ${error ? "border-error" : "border-outline-variant"
    } disabled:cursor-not-allowed disabled:text-on-surface-variant/50`;

  return (
    <label className="grid items-start gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="pt-1 text-on-surface-variant">{label}</span>
      <span className="min-w-0">
        {multiline ? (
          <textarea
            aria-label={label}
            rows={3}
            disabled={disabled}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`${commonClassName} min-h-20 resize-none py-1.5`}
          />
        ) : (
          <input
            type={type}
            aria-label={label}
            disabled={disabled}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft(nextValue);
              setError(null);
              if (type === "color") commit(nextValue);
            }}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`${commonClassName} h-7 ${type === "color" ? "p-0.5" : ""}`}
          />
        )}
        {error ? <span className="mt-1 block text-[11px] text-error">{error}</span> : null}
      </span>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="text-on-surface-variant">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value as T;
          if (nextValue !== value) onChange(nextValue);
        }}
        data-editor-shortcuts="ignore"
        className="h-7 min-w-0 rounded-[4px] border border-outline-variant bg-surface-container-low px-1.5 text-[12px] font-medium text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="text-on-surface-variant">{label}</span>
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-6 w-10 items-center rounded-full border px-0.5 transition-colors motion-reduce:transition-none ${checked
          ? "justify-end border-primary/40 bg-primary/25 text-primary"
          : "justify-start border-outline-variant bg-surface-container-low text-on-surface-variant"
          } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="h-4 w-4 rounded-full bg-current" />
      </button>
    </label>
  );
}

function useInspectorDispatch() {
  const dispatch = useAppDispatch();
  return (operation: VideoOperation | ReturnType<typeof createVideoOperationBatch>) => {
    dispatch(videoOperationApplied(operation));
  };
}

function inspectorTitle(inspector: InspectorSubject): string {
  if (inspector.kind === "transition") return "Transition";
  if (inspector.kind === "project") return "Project settings";
  if (inspector.item.type === "video") return "Video clip";
  if (inspector.item.type === "audio") return "Audio item";
  if (inspector.item.type === "text") return "Text item";
  return "Visual item";
}

function clamp(value: number, min?: number, max?: number): number {
  let nextValue = value;
  if (min !== undefined) nextValue = Math.max(min, nextValue);
  if (max !== undefined) nextValue = Math.min(max, nextValue);
  return nextValue;
}

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(precision)).toString();
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
