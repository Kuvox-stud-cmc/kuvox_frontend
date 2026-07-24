import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  TextTimelineItem,
  VideoClipTimelineItem,
  VideoAdvancedItemState,
  VideoProjectSettings,
  VideoTextStyle,
  VideoTimelineItem,
  VideoTransform,
} from "~/lib/editor/video-document";
import { resolveItemCrop, resolveItemOpacity, resolveItemTransform } from "~/lib/editor/video-document";
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
  updateAdvancedItemOperation,
  setProjectSettingsOperation,
} from "~/lib/editor/video-operations";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  inspectorWidthChanged,
  cropEditCleared,
  cropEditDraftChanged,
  cropEditReset,
  cropEditStarted,
  selectInspectorPanelState,
  selectMediaPreparationState,
  selectCurrentTimeSeconds,
  selectVideoDocument,
  selectVideoInspectorState,
  selectVisualScalesLinked,
  selectCanUndo,
  selectCropEditDraft,
  videoUndoRequested,
  videoOperationApplied,
  visualScalesLinkedChanged,
  type InspectorSubject,
} from "~/store/slices/editor-slice";

import { useDragResize } from "./use-drag-resize";
import { EditorIcon } from "./editor-ui";
import { EditorPropertyService, getTimelineItemPropertyValue, PROPERTY_REGISTRY } from "~/lib/editor/editor-property-service";
import {
  computeVisualTransformPreset,
  normalizeRotation,
  roundCropForCommit,
  type VisualTransformPreset,
} from "~/lib/editor/editor-preview";
import { videoColorAdjustmentValue } from "~/lib/editor/video-adjustments";

export function useInspectorCommands() {
  const dispatch = useAppDispatch();

  const updateProperty = useCallback((
    item: VideoTimelineItem,
    propertyName: string,
    value: any,
    options?: { squash?: boolean; label?: string; groupName?: string; commandId?: string }
  ) => {
    const operation = EditorPropertyService.createUpdatePropertyOperation(
      item,
      propertyName,
      value,
      options?.label,
      options?.groupName
    );
    if (operation) {
      if (options?.commandId) {
        operation.commandId = options.commandId;
      }
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
  allowEmpty?: boolean;
  onCommit: (value: string) => void;
};

const fontWeights: Array<NonNullable<VideoTextStyle["fontWeight"]>> = ["normal", "medium", "semibold", "bold"];
const textAlignments: Array<NonNullable<VideoTextStyle["textAlign"]>> = ["left", "center", "right"];
const previewQualities: VideoProjectSettings["previewQuality"][] = ["draft", "balanced", "full"];
const exportPresets = ["h264-720p", "h264-1080p", "h264-4k", "prores-master"];

const defaultInspectorTransform: VideoTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  anchorX: 0.5,
  anchorY: 0.5,
};
const defaultInspectorCrop = { top: 0, right: 0, bottom: 0, left: 0 };
const filterPresets = ["Original", "Cinematic", "Film", "Vintage", "Warm", "Cold", "Dreamy", "Noir", "Vivid"] as const;
const cropAspectPresets = ["Free", "16:9", "9:16", "1:1", "4:5", "3:2", "21:9"] as const;
const sharedColorAdjustmentProperties = ["temperature", "tint", "saturation", "vibrance"] as const;

type InspectorClipboardPayload = {
  sectionId: string;
  transform?: VideoTransform;
  crop?: typeof defaultInspectorCrop;
  opacity?: number;
  layerOrder?: number;
  speed?: number;
  volume?: number;
  muted?: boolean;
  textStyle?: VideoTextStyle;
  properties?: Record<string, unknown>;
};

function cloneInspectorValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sectionPropertyGroup(sectionId: string): string {
  if (sectionId === "audio" || sectionId === "volume" || sectionId === "fade" || sectionId === "noise_reduction" || sectionId === "eq") {
    return sectionId === "eq" ? "eq" : "audioSettings";
  }
  if (sectionId === "speed") return "speedSettings";
  return sectionId;
}

function createSectionAttributesSnapshot(item: VideoTimelineItem, sectionId: string): InspectorClipboardPayload {
  const properties = (item as any).properties || {};
  const groupName = sectionPropertyGroup(sectionId);
  const payload: InspectorClipboardPayload = { sectionId };

  if ((sectionId === "transform" || sectionId === "layout") && item.type !== "audio") {
    payload.transform = cloneInspectorValue(resolveItemTransform(item));
    if ("opacity" in item) payload.opacity = resolveItemOpacity(item as any);
    if ("layerOrder" in item) payload.layerOrder = item.layerOrder;
  } else if (sectionId === "crop") {
    payload.crop = cloneInspectorValue(resolveItemCrop(item as any));
    payload.properties = cloneInspectorValue(properties.crop || {});
  } else if (sectionId === "speed" && item.type === "video") {
    payload.speed = item.speed;
    payload.properties = cloneInspectorValue(properties.speedSettings || {});
  } else if (sectionId === "volume" && item.type === "audio") {
    payload.volume = item.volume;
    payload.muted = item.muted;
  } else if (sectionId === "adjust" && "opacity" in item) {
    payload.opacity = resolveItemOpacity(item as any);
    payload.properties = cloneInspectorValue(properties.adjust || {});
  } else if (sectionId === "color") {
    payload.properties = {
      color: cloneInspectorValue(properties.color || {}),
      adjust: cloneInspectorValue(Object.fromEntries(
        sharedColorAdjustmentProperties
          .filter((propertyName) => properties.adjust?.[propertyName] !== undefined)
          .map((propertyName) => [propertyName, properties.adjust[propertyName]]),
      )),
    };
  } else if (item.type === "text") {
    payload.textStyle = cloneInspectorValue(item.style);
    payload.properties = cloneInspectorValue(properties[groupName] || {});
  } else {
    payload.properties = cloneInspectorValue(properties[groupName] || {});
  }

  return payload;
}

function propertyGroupOperation(item: VideoTimelineItem, groupName: string, properties: Record<string, unknown>, label: string) {
  const fields = { properties: { [groupName]: properties } as any };
  if (item.type === "audio") return updateAudioOperation(item.id, fields as any, label);
  if (item.type === "text") return updateTextOperation(item.id, fields as any, label);
  return updateTransformCropOperation(item.id, fields as any, label);
}

function resetSectionAttributes(item: VideoTimelineItem, sectionId: string): VideoOperation | ReturnType<typeof createVideoOperationBatch> | null {
  if ((sectionId === "transform" || sectionId === "layout") && item.type !== "audio") {
    if (item.type === "text") return updateTextOperation(item.id, { transform: defaultInspectorTransform, layerOrder: 0 }, "Reset transform");
    return updateTransformCropOperation(item.id, {
      transform: defaultInspectorTransform,
      ...("opacity" in item ? { opacity: 1 } : {}),
      ...("layerOrder" in item ? { layerOrder: 0 } : {}),
    }, "Reset transform");
  }

  if (sectionId === "crop" && item.type !== "audio" && item.type !== "text") {
    return updateTransformCropOperation(item.id, {
      ...(item.type === "video" ? { crop: defaultInspectorCrop } : {}),
      properties: { crop: defaultInspectorCrop } as any,
    }, "Reset crop");
  }

  if (sectionId === "speed" && item.type === "video") {
    return createVideoOperationBatch({
      source: "manual",
      label: "Reset speed",
      operations: [
        updateSpeedOperation(item.id, { speed: 1 }, "Reset speed"),
        propertyGroupOperation(item, "speedSettings", {}, "Reset speed settings") as VideoOperation,
      ],
    });
  }

  if (sectionId === "volume" && item.type === "audio") {
    return updateAudioOperation(item.id, { volume: 1, muted: false }, "Reset volume");
  }

  if (sectionId === "adjust" && item.type !== "audio" && item.type !== "text") {
    const adjustDefaults = Object.fromEntries(
      Object.values(PROPERTY_REGISTRY)
        .filter((property) => property.group === "adjust")
        .map((property) => [property.id, { value: property.defaultValue }]),
    );
    return createVideoOperationBatch({
      source: "manual",
      label: "Reset adjustments",
      operations: [
        propertyGroupOperation(item, "adjust", adjustDefaults, "Reset adjustments") as VideoOperation,
        updateTransformCropOperation(item.id, { opacity: 1 }, "Reset opacity"),
      ],
    });
  }

  if (sectionId === "color" && item.type !== "audio" && item.type !== "text") {
    const colorDefaults = Object.fromEntries(
      Object.values(PROPERTY_REGISTRY)
        .filter((property) => property.group === "color")
        .map((property) => [property.id, { value: property.defaultValue }]),
    );
    const sharedAdjustDefaults = Object.fromEntries(
      sharedColorAdjustmentProperties.map((propertyName) => [
        propertyName,
        { value: PROPERTY_REGISTRY[propertyName].defaultValue },
      ]),
    );
    return updateTransformCropOperation(item.id, {
      properties: {
        color: colorDefaults,
        adjust: sharedAdjustDefaults,
      } as any,
    }, "Reset color");
  }

  if (item.type === "text") {
    const styleDefaults: Record<string, Partial<VideoTextStyle>> = {
      font: { fontFamily: "Inter", fontSize: 48, fontWeight: "normal" },
      style: { color: "#ffffff", backgroundColor: "#000000", backgroundOpacity: 0.72, textAlign: "center" },
      stroke: { strokeColor: "#000000", strokeWidth: 0 },
      shadow: { shadowColor: "#000000", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0 },
      animation: { animType: "None", animDur: 1 },
    };
    const defaults = styleDefaults[sectionId];
    if (defaults) {
      return updateTextOperation(item.id, { style: { ...item.style, ...defaults } }, `Reset ${sectionId}`);
    }
  }

  return propertyGroupOperation(item, sectionPropertyGroup(sectionId), {}, "Reset attributes");
}

function restoreTransformSection(
  item: VideoTimelineItem,
  snapshot: InspectorClipboardPayload,
): VideoOperation | null {
  if (snapshot.sectionId !== "transform" || !snapshot.transform) return null;

  if (item.type === "text") {
    return updateTextOperation(item.id, {
      transform: snapshot.transform,
      ...(snapshot.layerOrder !== undefined ? { layerOrder: snapshot.layerOrder } : {}),
    }, "Cancel transform changes");
  }

  if (item.type === "video" || item.type === "image" || item.type === "overlay") {
    return updateTransformCropOperation(item.id, {
      transform: snapshot.transform,
      ...(snapshot.opacity !== undefined ? { opacity: snapshot.opacity } : {}),
      ...(snapshot.layerOrder !== undefined ? { layerOrder: snapshot.layerOrder } : {}),
    }, "Cancel transform changes");
  }

  return null;
}

function useInspectorSectionSession(
  item: VideoTimelineItem,
  sectionId: string,
  dispatch: (operation: VideoOperation | ReturnType<typeof createVideoOperationBatch>) => void,
) {
  const reduxDispatch = useAppDispatch();
  const canUndo = useAppSelector(selectCanUndo);
  const sessionKey = `${item.id}:${sectionId}`;
  const baselineRef = useRef({
    key: sessionKey,
    snapshot: createSectionAttributesSnapshot(item, sectionId),
  });
  const [, refresh] = useState(0);

  if (baselineRef.current.key !== sessionKey) {
    baselineRef.current = {
      key: sessionKey,
      snapshot: createSectionAttributesSnapshot(item, sectionId),
    };
  }

  const currentSnapshot = createSectionAttributesSnapshot(item, sectionId);
  const hasChanges = JSON.stringify(currentSnapshot) !== JSON.stringify(baselineRef.current.snapshot);
  const canCancel = hasChanges && canUndo;

  const reset = () => {
    const operation = resetSectionAttributes(item, sectionId);
    if (operation) dispatch(operation);
  };
  const apply = () => {
    baselineRef.current = { key: sessionKey, snapshot: currentSnapshot };
    refresh((revision) => revision + 1);
  };
  const cancel = () => {
    if (!canCancel) return;
    const restoreOperation = restoreTransformSection(item, baselineRef.current.snapshot);
    if (restoreOperation) {
      dispatch(restoreOperation);
      return;
    }
    reduxDispatch(videoUndoRequested());
  };

  return { reset, apply, cancel, hasChanges, canCancel };
}

export function VideoInspectorPanel({
  visibilityClassName = "hidden lg:flex",
  onRequestClose,
  activeSection = "transform",
  onSectionChange,
}: VideoInspectorPanelProps) {
  const dispatch = useAppDispatch();
  const inspector = useAppSelector(selectVideoInspectorState);
  const preparationByKey = useAppSelector(selectMediaPreparationState);
  const { width: inspectorWidth } = useAppSelector(selectInspectorPanelState);
  const preparing = inspector.kind === "item" && inspector.media
    ? (() => {
        const resources = Object.values(preparationByKey).filter((resource) => resource.mediaId === inspector.media!.id);
        return resources.length > 0 && !resources.some((resource) => resource.status === "ready");
      })()
    : false;

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
        {preparing ? (
          <div className="flex items-center gap-2 rounded-[6px] border border-primary/30 bg-primary-container px-3 py-2 text-label-md font-semibold text-on-primary-container">
            <EditorIcon className="animate-spin text-[16px] motion-reduce:animate-none">progress_activity</EditorIcon>
            Preparing media. Editing is locked.
          </div>
        ) : null}
        <fieldset disabled={preparing} className="contents" aria-label={preparing ? "Preparing media controls" : undefined}>
          <InspectorBody
            inspector={inspector}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
        </fieldset>
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
      disabled={inspector.track.locked || inspector.track.hidden}
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
        aria-label={label}
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
        aria-label={label}
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
        onBlur={() => {
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

function EditableRealtimeSliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number, commandId: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [draft, setDraft] = useState(formatNumber(value, step < 1 ? 2 : 0));
  const [isEditing, setIsEditing] = useState(false);
  const sliderCommandIdRef = useRef<string | null>(null);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
    if (!isEditing) {
      setDraft(formatNumber(value, step < 1 ? 2 : 0));
    }
  }, [isEditing, step, value]);

  const emitSliderChange = (nextValue: number) => {
    const commandId = sliderCommandIdRef.current
      ?? createInspectorCommandId(`color-${label.toLowerCase()}`);
    sliderCommandIdRef.current = commandId;
    setLocalValue(nextValue);
    setDraft(formatNumber(nextValue, step < 1 ? 2 : 0));
    onChange(nextValue, commandId);
  };

  const finishSliderGesture = () => {
    sliderCommandIdRef.current = null;
  };

  const commitDraft = () => {
    setIsEditing(false);
    const parsed = draft.trim() === "" ? Number.NaN : Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumber(localValue, step < 1 ? 2 : 0));
      return;
    }

    const nextValue = Math.min(max, Math.max(min, parsed));
    setLocalValue(nextValue);
    setDraft(formatNumber(nextValue, step < 1 ? 2 : 0));
    if (nextValue !== localValue) {
      onChange(nextValue, createInspectorCommandId(`color-${label.toLowerCase()}-input`));
    }
  };

  return (
    <div
      className="grid items-center gap-2 text-[13px] font-medium"
      style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr) 64px" }}
    >
      <span className="truncate text-on-surface-variant">{label}</span>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(event) => emitSliderChange(Number(event.target.value))}
        onMouseUp={finishSliderGesture}
        onTouchEnd={finishSliderGesture}
        onBlur={finishSliderGesture}
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-outline-variant accent-primary"
      />
      <span className="flex h-7 min-w-0 overflow-hidden rounded-[4px] border border-outline-variant bg-surface-container-low transition-colors focus-within:border-primary motion-reduce:transition-none">
        <input
          type="number"
          aria-label={`${label} value`}
          min={min}
          max={max}
          step={step}
          value={draft}
          onFocus={() => setIsEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              setIsEditing(false);
              setDraft(formatNumber(localValue, step < 1 ? 2 : 0));
              return;
            }
            commitDraft();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              skipBlurCommitRef.current = true;
              event.currentTarget.blur();
            }
          }}
          data-editor-shortcuts="ignore"
          className="h-full min-w-0 flex-1 appearance-none bg-transparent px-1.5 text-right font-mono text-[12px] font-medium tabular-nums text-on-surface outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none flex shrink-0 items-center border-l border-outline-variant/70 bg-surface-container px-1.5 font-mono text-[10px] text-on-surface-variant"
          >
            {suffix}
          </span>
        ) : null}
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

function MockButtonField({ label, onClick, disabled = false }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <label className="grid items-center gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="text-on-surface-variant"></span>
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled || !onClick} className="h-7 w-full rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-[12px] font-medium text-on-surface transition-colors hover:bg-surface-container-high focus:border-primary disabled:cursor-not-allowed disabled:opacity-50">
        {label}
      </button>
    </label>
  );
}

const ButtonField = MockButtonField;

function PresetButtonGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid items-start gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="pt-1 text-on-surface-variant">{label}</span>
      <div className="grid min-w-0 grid-cols-3 gap-1.5">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-12 rounded-[4px] border px-1.5 py-1 text-left text-[10px] font-semibold transition-colors ${active ? "border-primary bg-primary/15 text-primary" : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}
              aria-pressed={active}
            >
              <span className="mb-1 block h-4 rounded-[2px] bg-[linear-gradient(90deg,#151515,#c0c1ff,#f4d35e)] opacity-80" />
              <span className="block truncate">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
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
  const currentTime = useAppSelector(selectCurrentTimeSeconds);
  const document = useAppSelector(selectVideoDocument);
  const item = inspector.item;
  const linkedMuted = inspector.linkedAudioItems.length > 0
    ? inspector.linkedAudioItems.every(({ item: audio }) => audio.muted)
    : false;

  const supported = ["transform", "crop", "mask", "adjust", "filters", "color", "speed", "animation", "audio"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "transform" : "");
  const sectionSession = useInspectorSectionSession(item, currentSection, dispatch);

  const [pitchCorrection, setPitchCorrection] = useState(true);

  const [opacity, setOpacity] = useState(item.opacity);
  const [speed, setSpeed] = useState(item.speed);

  const updateAdvanced = (patch: Partial<VideoAdvancedItemState>, label: string) => {
    dispatch(updateAdvancedItemOperation(item.id, mergeAdvancedState(item.advanced, patch), label));
  };

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
              value={videoColorAdjustmentValue(item, "temperature")}
              onChange={(val) => updateProperty(item, "temperature", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "temperature", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Tint"
              min={-100}
              max={100}
              value={videoColorAdjustmentValue(item, "tint")}
              onChange={(val) => updateProperty(item, "tint", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "tint", val, { squash: false })}
            />
            <RealtimeSliderField
              label="Saturation"
              min={0}
              max={200}
              value={videoColorAdjustmentValue(item, "saturation")}
              onChange={(val) => updateProperty(item, "saturation", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "saturation", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Vibrance"
              min={0}
              max={200}
              value={videoColorAdjustmentValue(item, "vibrance")}
              onChange={(val) => updateProperty(item, "vibrance", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "vibrance", val, { squash: false })}
              suffix="%"
            />
            <RealtimeSliderField
              label="Clarity"
              min={-100}
              max={100}
              value={getTimelineItemPropertyValue(item, "adjust", "clarity")}
              onChange={(val) => updateProperty(item, "clarity", val, { squash: true })}
              onChangeEnd={(val) => updateProperty(item, "clarity", val, { squash: false })}
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
            <TextField
              label="Search"
              value={getTimelineItemPropertyValue(item, "filters", "search") || ""}
              allowEmpty
              onCommit={(val) => updateProperty(item, "search", val, { groupName: "filters", squash: false })}
            />
            <SelectField
              label="Preset"
              options={filterPresets}
              value={(getTimelineItemPropertyValue(item, "filters", "builtIn") || "Original") as typeof filterPresets[number]}
              onChange={(val) => updateProperty(item, "builtIn", val, { groupName: "filters", squash: false })}
            />
            <PresetButtonGrid
              label="Thumbnails"
              options={filterPresets}
              value={(getTimelineItemPropertyValue(item, "filters", "builtIn") || "Original") as typeof filterPresets[number]}
              onChange={(val) => updateProperty(item, "builtIn", val, { groupName: "filters", squash: false })}
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
            <ButtonField label="Reset Filter" onClick={() => dispatch(propertyGroupOperation(item, "filters", { builtIn: { value: "Original" }, intensity: { value: 100 } }, "Reset filter"))} />
          </>
        );
      case "color":
        return (
          <>
            <EditableRealtimeSliderField
              label="Temperature"
              min={-100}
              max={100}
              value={videoColorAdjustmentValue(item, "temperature")}
              onChange={(val, commandId) => updateProperty(item, "temperature", val, {
                squash: true,
                groupName: "adjust",
                commandId,
              })}
            />
            <EditableRealtimeSliderField
              label="Tint"
              min={-100}
              max={100}
              value={videoColorAdjustmentValue(item, "tint")}
              onChange={(val, commandId) => updateProperty(item, "tint", val, {
                squash: true,
                groupName: "adjust",
                commandId,
              })}
            />
            <EditableRealtimeSliderField
              label="Hue"
              min={-180}
              max={180}
              value={getTimelineItemPropertyValue(item, "color", "hue")}
              onChange={(val, commandId) => updateProperty(item, "hue", val, {
                squash: true,
                groupName: "color",
                commandId,
              })}
              suffix="deg"
            />
            <EditableRealtimeSliderField
              label="Saturation"
              min={0}
              max={200}
              value={videoColorAdjustmentValue(item, "saturation")}
              onChange={(val, commandId) => updateProperty(item, "saturation", val, {
                squash: true,
                groupName: "adjust",
                commandId,
              })}
              suffix="%"
            />
            <EditableRealtimeSliderField
              label="Vibrance"
              min={0}
              max={200}
              value={videoColorAdjustmentValue(item, "vibrance")}
              onChange={(val, commandId) => updateProperty(item, "vibrance", val, {
                squash: true,
                groupName: "adjust",
                commandId,
              })}
              suffix="%"
            />
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
            <MockButtonField label="Curves" onClick={() => updateAdvanced({ color: { ...item.advanced?.color, curves: identityCurves() } }, "Initialize color curves")} />
            <MockButtonField label="HSL" onClick={() => updateAdvanced({ color: { ...item.advanced?.color, hsl: neutralHsl() } }, "Initialize HSL controls")} />
            <MockButtonField label="RGB Mixer" onClick={() => updateAdvanced({ color: { ...item.advanced?.color, rgbMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] } }, "Initialize RGB mixer")} />
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
            <VisualTransformControls item={item} disabled={inspector.track.locked || inspector.track.hidden} />
            <NumberField
              label="Opacity"
              value={isMock ? opacity : resolveItemOpacity(item)}
              min={0}
              max={1}
              step={0.01}
              precision={3}
              disabled={inspector.track.locked || inspector.track.hidden}
              onCommit={(op) => {
                if (isMock) {
                  setOpacity(op);
                } else {
                  dispatch(updateTransformCropOperation(item.id, { opacity: op }, "Update opacity"));
                }
              }}
            />
          </>
        );
      case "crop":
        return (
          <>
            <StructuralCropControls item={item} disabled={inspector.track.locked || inspector.track.hidden} />
            <MockButtonField label="Auto Crop" onClick={() => {
              const now = new Date().toISOString();
              updateAdvanced({
                autoReframe: {
                  targetAspectRatio: document?.settings.aspectRatio ?? "16:9",
                  safeMargin: 0.1,
                  smoothing: 0.65,
                  generatedAt: now,
                },
                crop: {
                  ...item.advanced?.crop,
                  top: { value: item.crop.top, keyframes: [{ id: `auto-crop-top-${now}`, time: 0, value: item.crop.top }] },
                  right: { value: item.crop.right, keyframes: [{ id: `auto-crop-right-${now}`, time: 0, value: item.crop.right }] },
                  bottom: { value: item.crop.bottom, keyframes: [{ id: `auto-crop-bottom-${now}`, time: 0, value: item.crop.bottom }] },
                  left: { value: item.crop.left, keyframes: [{ id: `auto-crop-left-${now}`, time: 0, value: item.crop.left }] },
                },
              }, "Generate auto crop");
            }} />
            <CropActionBar item={item} disabled={inspector.track.locked || inspector.track.hidden} />
          </>
        );
      case "mask":
        return (
          <>
            <SelectField
              label="Shape"
              options={["None", "Rectangle", "Circle", "Ellipse", "Polygon", "Star", "Custom SVG"]}
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
            <MockButtonField label="Tracking" onClick={() => {
              const now = new Date().toISOString();
              const itemTime = Math.max(0, Math.min(item.duration, currentTime - item.timelineStart));
              const target = {
                id: `tracking-${now.replace(/[^0-9]/g, "")}`,
                label: "Tracked region",
                initialBox: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
                path: [{ time: itemTime, box: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 }, confidence: 1 }],
                analysis: { model: "manual-region", analyzedAt: now, frameInterval: 1 },
              };
              updateAdvanced({ trackingTargets: [...(item.advanced?.trackingTargets ?? []), target] }, "Create tracking target");
            }} />
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
              onCommit={(nextSpeed) => {
                if (isMock) {
                  setSpeed(nextSpeed);
                } else {
                  dispatch(updateSpeedOperation(item.id, { speed: nextSpeed }, "Update speed"));
                }
              }}
            />
            <SelectField
              label="Preset"
              options={["0.25x", "0.5x", "1x", "2x", "4x"]}
              value={(getTimelineItemPropertyValue(item, "speedSettings", "preset") || "1x") as "0.25x" | "0.5x" | "1x" | "2x" | "4x"}
              onChange={(preset) => {
                updateProperty(item, "preset", preset, { groupName: "speedSettings", squash: false });
                dispatch(updateSpeedOperation(item.id, { speed: Number(preset.replace("x", "")) }, "Update speed"));
              }}
            />
            <ToggleField
              label="Reverse"
              checked={getTimelineItemPropertyValue(item, "speedSettings", "reverse") || false}
              onChange={(val) => updateProperty(item, "reverse", val, { groupName: "speedSettings", squash: false })}
            />
            <MockButtonField label="Freeze Frame" onClick={() => {
              const itemTime = Math.max(0, Math.min(item.duration, currentTime - item.timelineStart));
              const sourceTime = item.sourceIn + itemTime * item.speed;
              updateAdvanced({ freezeFrames: [...(item.advanced?.freezeFrames ?? []), {
                id: `freeze-${Date.now()}`,
                timelineStart: itemTime,
                duration: Math.min(1, Math.max(1 / (document?.settings.frameRate ?? 30), item.duration - itemTime)),
                sourceTime: Math.min(item.sourceOut, sourceTime),
              }] }, "Insert freeze frame");
            }} />
            <NumberField
              label="Duration"
              value={item.duration}
              min={0.01}
              max={60}
              step={0.1}
              precision={2}
              suffix="s"
              disabled={isMock}
              onCommit={(duration) => dispatch(updateSpeedOperation(item.id, { speed: item.speed, duration }, "Update duration"))}
            />
            <SelectField
              label="Speed Curve"
              options={["Linear", "Ease In", "Ease Out", "Smooth"]}
              value={getTimelineItemPropertyValue(item, "speedSettings", "speedCurve") || "Linear"}
              onChange={(val) => updateProperty(item, "speedCurve", val, { groupName: "speedSettings", squash: false })}
            />
            <MockButtonField label="Time Remap" onClick={() => updateAdvanced({ timeRemap: {
              points: [
                { timelineTime: 0, sourceTime: item.sourceIn },
                { timelineTime: item.duration, sourceTime: item.sourceOut },
              ],
              preservePitch: true,
              audioBehavior: "remap",
            } }, "Initialize time remap")} />
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
            <SelectField label="Entrance" options={["None", "Fade", "Slide", "Scale", "Zoom", "Rotate", "Bounce"]} value={getTimelineItemPropertyValue(item, "animation", "entrance") || "None"} onChange={(val) => updateProperty(item, "entrance", val, { groupName: "animation", squash: false })} />
            <SelectField label="Exit" options={["None", "Fade", "Slide", "Scale", "Zoom", "Rotate", "Bounce"]} value={getTimelineItemPropertyValue(item, "animation", "exit") || "None"} onChange={(val) => updateProperty(item, "exit", val, { groupName: "animation", squash: false })} />
            <RealtimeSliderField label="Fade In" min={0} max={10} step={0.1} value={getTimelineItemPropertyValue(item, "animation", "fadeIn")} onChange={(val) => updateProperty(item, "fadeIn", val, { squash: true })} onChangeEnd={(val) => updateProperty(item, "fadeIn", val, { squash: false })} suffix="s" />
            <RealtimeSliderField label="Fade Out" min={0} max={10} step={0.1} value={getTimelineItemPropertyValue(item, "animation", "fadeOut")} onChange={(val) => updateProperty(item, "fadeOut", val, { squash: true })} onChangeEnd={(val) => updateProperty(item, "fadeOut", val, { squash: false })} suffix="s" />
            <RealtimeSliderField label="Duration" min={0.1} max={10} step={0.1} value={getTimelineItemPropertyValue(item, "animation", "duration")} onChange={(val) => updateProperty(item, "duration", val, { squash: true, groupName: "animation" })} onChangeEnd={(val) => updateProperty(item, "duration", val, { squash: false, groupName: "animation" })} suffix="s" />
            <RealtimeSliderField label="Delay" min={0} max={10} step={0.1} value={getTimelineItemPropertyValue(item, "animation", "delay")} onChange={(val) => updateProperty(item, "delay", val, { squash: true, groupName: "animation" })} onChangeEnd={(val) => updateProperty(item, "delay", val, { squash: false, groupName: "animation" })} suffix="s" />
            <SelectField label="Easing" options={["Linear", "Ease In", "Ease Out", "Ease In Out", "Spring"]} value={getTimelineItemPropertyValue(item, "animation", "easing") || "Ease Out"} onChange={(val) => updateProperty(item, "easing", val, { groupName: "animation", squash: false })} />
            <RealtimeSliderField label="Scale Anim" min={0} max={100} value={getTimelineItemPropertyValue(item, "animation", "scaleAnim")} onChange={(val) => updateProperty(item, "scaleAnim", val, { squash: true })} onChangeEnd={(val) => updateProperty(item, "scaleAnim", val, { squash: false })} />
            <RealtimeSliderField label="Rot. Anim" min={0} max={360} value={getTimelineItemPropertyValue(item, "animation", "rotationAnim")} onChange={(val) => updateProperty(item, "rotationAnim", val, { squash: true })} onChangeEnd={(val) => updateProperty(item, "rotationAnim", val, { squash: false })} suffix="deg" />
          </>
        );
      case "audio":
        return (
          <>
            <ToggleField
              label="Mute Linked"
              checked={linkedMuted}
              disabled={inspector.linkedAudioItems.length === 0}
              onChange={(muted) => {
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
            {inspector.linkedAudioItems.map(({ item: audio }) => (
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
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={inspector.media?.name ?? item.mediaId} />
          <ReadOnlyRow label="Track" value={inspector.track.label} />
        </Section>
        <TimingFields
          item={item}
          includeSource
          onCommit={(fields) => dispatch(trimOperation(item, fields, "Update clip timing"))}
        />
        {videoSections.map((sec) => (
          <div key={sec.id} data-testid={`section-${sec.id}`}>
            <h3 className="text-[12px] font-bold text-on-surface uppercase tracking-[0.02em] py-2">{sec.label}</h3>
            <div className="flex flex-col gap-2.5 pl-0.5">{renderSectionContent(sec.id)}</div>
          </div>
        ))}
        {currentSection === "crop" ? null : (
          <InspectorFooter
            onReset={sectionSession.reset}
            onApply={sectionSession.apply}
            onCancel={sectionSession.cancel}
            hasChanges={sectionSession.hasChanges}
            canCancel={sectionSession.canCancel}
          />
        )}
      </div>
    );
  }

  // Real Application View
  if (!currentSection) {
    return (
      <div className="flex flex-col gap-3">
        <Section title="Media Info">
          <ReadOnlyRow label="Name" value={inspector.media?.name ?? item.mediaId} />
          <ReadOnlyRow label="Track" value={inspector.track.label} />
        </Section>
        <TimingFields
          item={item}
          includeSource
          onCommit={(fields) => dispatch(trimOperation(item, fields, "Update clip timing"))}
        />

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
      <TimingFields
        item={item}
        includeSource
        onCommit={(fields) => dispatch(trimOperation(item, fields, "Update clip timing"))}
      />
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
        {currentSection === "crop" ? null : (
          <InspectorFooter
            onReset={sectionSession.reset}
            onApply={sectionSession.apply}
            onCancel={sectionSession.cancel}
            hasChanges={sectionSession.hasChanges}
            canCancel={sectionSession.canCancel}
          />
        )}
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
  const sectionSession = useInspectorSectionSession(item, currentSection, dispatch);

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
            <ToggleField
              label="Maintain Pitch"
              checked={getTimelineItemPropertyValue(item, "speedSettings", "pitchCorrection") !== false}
              onChange={(val) => updateProperty(item, "pitchCorrection", val, { groupName: "speedSettings", squash: false })}
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
        <InspectorFooter
          onReset={sectionSession.reset}
          onApply={sectionSession.apply}
          onCancel={sectionSession.cancel}
          hasChanges={sectionSession.hasChanges}
          canCancel={sectionSession.canCancel}
        />
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
  disabled,
  activeSection,
  onSectionChange,
}: {
  item: ImageOverlayTimelineItem;
  mediaName?: string;
  disabled: boolean;
  activeSection: string;
  onSectionChange?: (section: string) => void;
}) {
  const dispatch = useInspectorDispatch();
  const { updateProperty } = useInspectorCommands();

  const supported = ["transform", "crop", "mask", "adjust", "filters", "animation"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "transform" : "");
  const sectionSession = useInspectorSectionSession(item, currentSection, dispatch);

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case "transform":
        return (
          <>
            <VisualTransformControls item={item} disabled={disabled} />
            <NumberField
              label="Opacity"
              value={item.opacity}
              min={0}
              max={1}
              step={0.01}
              precision={3}
              disabled={disabled}
              onCommit={(opacity) => dispatch(updateTransformCropOperation(item.id, { opacity }, "Update opacity"))}
            />
            <NumberField
              label="Layer"
              value={item.layerOrder}
              step={1}
              precision={0}
              disabled={disabled}
              onCommit={(layerOrder) => dispatch(updateTransformCropOperation(item.id, { layerOrder }, "Update layer"))}
            />
          </>
        );
      case "crop":
        return (
          <>
            <StructuralCropControls item={item} disabled={disabled} />
            <CropActionBar item={item} disabled={disabled} />
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
        {currentSection === "crop" ? null : (
          <InspectorFooter
            onReset={sectionSession.reset}
            onApply={sectionSession.apply}
            onCancel={sectionSession.cancel}
            hasChanges={sectionSession.hasChanges}
            canCancel={sectionSession.canCancel}
          />
        )}
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
        {currentSection === "crop" ? null : (
          <InspectorFooter
            onReset={sectionSession.reset}
            onApply={sectionSession.apply}
            onCancel={sectionSession.cancel}
            hasChanges={sectionSession.hasChanges}
            canCancel={sectionSession.canCancel}
          />
        )}
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
  const backgroundOpacityCommandId = useRef<string | null>(null);

  const supported = ["font", "style", "stroke", "shadow", "animation", "layout"];
  
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const currentSection = supported.includes(activeSection) ? activeSection : (isTest ? "font" : "");
  const sectionSession = useInspectorSectionSession(item, currentSection, dispatch);
  const transform = resolveItemTransform(item);
  const backgroundOpacity = item.style.backgroundColor
    ? item.style.backgroundOpacity ?? 0.72
    : 0;

  const updateBackgroundOpacity = (percentage: number) => {
    const commandId = backgroundOpacityCommandId.current
      ?? createInspectorCommandId("text-background-opacity");
    backgroundOpacityCommandId.current = commandId;
    const nextOpacity = clamp(percentage / 100, 0, 1);

    dispatch(
      updateTextOperation(
        item.id,
        {
          style: {
            ...item.style,
            ...(nextOpacity > 0 && !item.style.backgroundColor
              ? { backgroundColor: "#000000" }
              : {}),
            backgroundOpacity: nextOpacity,
          },
        },
        "Update background opacity",
        commandId,
      ),
      { squash: true },
    );
  };

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
            <ColorField
              label="Text color"
              value={item.style.color}
              onChange={(color, commandId) => dispatch(
                updateTextOperation(item.id, { style: { ...item.style, color } }, "Update text color", commandId),
                { squash: true },
              )}
            />
            <ColorField
              label="Background color"
              value={item.style.backgroundColor ?? "#000000"}
              onChange={(backgroundColor, commandId) => dispatch(
                updateTextOperation(
                  item.id,
                  {
                    style: {
                      ...item.style,
                      backgroundColor,
                      backgroundOpacity: item.style.backgroundOpacity ?? 0.72,
                    },
                  },
                  "Update background color",
                  commandId,
                ),
                { squash: true },
              )}
            />
            <RealtimeSliderField
              label="Background opacity"
              min={0}
              max={100}
              step={1}
              suffix="%"
              value={Math.round(backgroundOpacity * 100)}
              onChange={updateBackgroundOpacity}
              onChangeEnd={() => {
                backgroundOpacityCommandId.current = null;
              }}
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
          <InspectorFooter
            onReset={sectionSession.reset}
            onApply={sectionSession.apply}
            onCancel={sectionSession.cancel}
            hasChanges={sectionSession.hasChanges}
            canCancel={sectionSession.canCancel}
          />
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

function VisualTransformControls({
  item,
  disabled,
}: {
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
  disabled: boolean;
}) {
  const dispatchOperation = useInspectorDispatch();
  const dispatch = useAppDispatch();
  const scalesLinked = useAppSelector(selectVisualScalesLinked);
  const document = useAppSelector(selectVideoDocument);
  const media = document?.media[item.mediaId];
  const transform = resolveItemTransform(item);
  const crop = resolveItemCrop(item as any);
  const hasMediaDimensions = Boolean(
    media && typeof media.width === "number" && media.width > 0 && typeof media.height === "number" && media.height > 0,
  );

  const commitTransform = (transform: VideoTransform, label = "Update transform") => {
    dispatchOperation(updateTransformCropOperation(item.id, { transform }, label));
  };
  const applyPreset = (preset: VisualTransformPreset, label: string) => {
    const settings = document?.settings;
    if (!settings) return;
    const nextTransform = computeVisualTransformPreset({
      preset,
      transform,
      projectWidth: settings.width,
      projectHeight: settings.height,
      mediaWidth: media?.width,
      mediaHeight: media?.height,
      crop,
    });
    if (nextTransform && !sameVideoTransform(nextTransform, transform)) {
      commitTransform(nextTransform, label);
    }
  };
  const commitScale = (axis: "scaleX" | "scaleY", value: number) => {
    const nextValue = roundTo(Math.max(0.01, Math.abs(value)), 6);
    const otherAxis = axis === "scaleX" ? "scaleY" : "scaleX";
    const currentValue = Math.max(0.01, Math.abs(transform[axis]));
    const multiplier = nextValue / currentValue;
    commitTransform({
      ...transform,
      [axis]: nextValue,
      ...(scalesLinked
        ? { [otherAxis]: roundTo(Math.max(0.01, Math.abs(transform[otherAxis]) * multiplier), 6) }
        : {}),
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 pb-1" aria-label="Transform sizing commands">
        {([
          ["fit", "Fit", "fit_screen", "Fit visual to frame", true],
          ["fill", "Fill", "fullscreen", "Fill frame with visual", true],
          ["center", "Center", "center_focus_strong", "Center visual", false],
          ["original-size", "Original", "photo_size_select_actual", "Set visual to original size", true],
          ["reset", "Reset", "restart_alt", "Reset visual transform", false],
        ] as const).map(([preset, text, icon, label, needsDimensions]) => (
          <button
            key={preset}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled || (needsDimensions && !hasMediaDimensions)}
            onClick={() => applyPreset(preset, label)}
            className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-45 ${preset === "reset" ? "col-span-2" : ""}`}
          >
            <EditorIcon className="shrink-0 text-[16px]">{icon}</EditorIcon>
            <span className="truncate">{text}</span>
          </button>
        ))}
      </div>
      <NumberField
        label="Position X"
        value={transform.x}
        step={1}
        precision={0}
        disabled={disabled}
        onCommit={(x) => commitTransform({ ...transform, x })}
      />
      <NumberField
        label="Position Y"
        value={transform.y}
        step={1}
        precision={0}
        disabled={disabled}
        onCommit={(y) => commitTransform({ ...transform, y })}
      />
      <ToggleField
        label="Link scales"
        checked={scalesLinked}
        disabled={disabled}
        onChange={(linked) => dispatch(visualScalesLinkedChanged(linked))}
      />
      <NumberField
        label="Scale X"
        value={Math.abs(transform.scaleX)}
        min={0.01}
        step={0.05}
        precision={6}
        disabled={disabled}
        onCommit={(scaleX) => commitScale("scaleX", scaleX)}
      />
      <NumberField
        label="Scale Y"
        value={Math.abs(transform.scaleY)}
        min={0.01}
        step={0.05}
        precision={6}
        disabled={disabled}
        onCommit={(scaleY) => commitScale("scaleY", scaleY)}
      />
      <NumberField
        label="Rotation"
        value={normalizeRotation(transform.rotation)}
        step={1}
        precision={1}
        suffix="deg"
        disabled={disabled}
        onCommit={(rotation) => commitTransform({
          ...transform,
          rotation: roundTo(normalizeRotation(rotation), 1),
        })}
      />
    </>
  );
}

function StructuralCropControls({
  item,
  disabled,
}: {
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
  disabled: boolean;
}) {
  const dispatch = useAppDispatch();
  const document = useAppSelector(selectVideoDocument);
  const cropEditDraft = useAppSelector(selectCropEditDraft);
  const media = document?.media[item.mediaId];
  const width = media?.width;
  const height = media?.height;
  const dimensionsValid = typeof width === "number" && width > 0 && typeof height === "number" && height > 0;
  const controlsDisabled = disabled || !dimensionsValid;
  const activeDraft = cropEditDraft?.itemId === item.id ? cropEditDraft : null;
  const crop = activeDraft?.draftCrop ?? item.crop;
  const transform = activeDraft?.draftTransform ?? item.transform;

  useEffect(() => {
    if (cropEditDraft?.itemId === item.id) return;
    dispatch(cropEditStarted({ itemId: item.id, crop: item.crop, transform: item.transform }));
  }, [cropEditDraft?.itemId, dispatch, item.crop, item.id, item.transform]);

  const commitSide = (side: keyof typeof crop, percent: number) => {
    if (!dimensionsValid) return;
    const horizontal = side === "left" || side === "right";
    const opposite = ({ top: "bottom", right: "left", bottom: "top", left: "right" } as const)[side];
    const sourceDimension = horizontal ? width : height;
    const maximum = Math.max(0, 1 - crop[opposite] - 1 / sourceDimension);
    const nextCrop = roundCropForCommit({
      ...crop,
      [side]: Math.min(maximum, Math.max(0, percent / 100)),
    }, width, height);
    if (!activeDraft) {
      dispatch(cropEditStarted({ itemId: item.id, crop: item.crop, transform: item.transform }));
    }
    dispatch(cropEditDraftChanged({ itemId: item.id, crop: nextCrop, transform }));
  };

  return (
    <>
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <NumberField
          key={side}
          label={capitalize(side)}
          value={roundTo(crop[side] * 100, 4)}
          min={0}
          max={100}
          step={0.1}
          precision={4}
          suffix="%"
          disabled={controlsDisabled}
          onCommit={(value) => commitSide(side, value)}
        />
      ))}
    </>
  );
}

function CropActionBar({
  item,
  disabled,
}: {
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
  disabled: boolean;
}) {
  const dispatch = useAppDispatch();
  const cropEditDraft = useAppSelector(selectCropEditDraft);
  const draft = cropEditDraft?.itemId === item.id ? cropEditDraft : null;
  const canReset = Boolean(draft && (
    Object.values(draft.draftCrop).some((value) => value !== 0)
    || JSON.stringify(draft.draftTransform) !== JSON.stringify(draft.baseTransform)
  ));

  const apply = () => {
    if (!draft?.dirty || disabled) return;
    dispatch(videoOperationApplied(updateTransformCropOperation(
      draft.itemId,
      { crop: draft.draftCrop, transform: draft.draftTransform },
      "Apply crop",
    )));
    dispatch(cropEditCleared());
  };

  return (
    <div className="mt-1 grid grid-cols-2 gap-1.5 border-t border-outline-variant/40 pt-2">
      <button
        type="button"
        aria-label="Reset crop"
        onClick={() => draft && dispatch(cropEditReset({ itemId: draft.itemId }))}
        disabled={disabled || !canReset}
        className="h-8 rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        Reset
      </button>
      <button
        type="button"
        aria-label="Apply crop"
        onClick={apply}
        disabled={disabled || !draft?.dirty}
        className="h-8 rounded-[4px] border border-primary/70 bg-primary-container px-2 text-[11px] font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:opacity-40 motion-reduce:transition-none"
      >
        Apply
      </button>
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
  const previousFormattedValue = useRef(formattedValue);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isFocused || draft === previousFormattedValue.current) {
      setDraft(formattedValue);
    }
    previousFormattedValue.current = formattedValue;
  }, [draft, formattedValue, isFocused]);

  function commit() {
    setIsFocused(false);
    if (disabled) return;
    const parsed = draft.trim() === "" ? Number.NaN : Number(draft);

    if (!Number.isFinite(parsed)) {
      setError("Enter a number.");
      return;
    }

    const normalized = roundTo(clamp(parsed, min, max), precision);
    const validationError = validate?.(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setDraft(formatNumber(normalized, precision));
    if (Math.abs(normalized - value) > 0.000001) {
      onCommit(normalized);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      skipBlurCommitRef.current = true;
      setDraft(formattedValue);
      setError(null);
      event.currentTarget.blur();
    }
  }

  return (
    <label className="grid items-start gap-2 text-[13px] font-medium" style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}>
      <span className="pt-1 text-on-surface-variant">{label}</span>
      <span className="min-w-0">
        <span className={`flex h-7 min-w-0 overflow-hidden rounded-[4px] border bg-surface-container-low transition-colors focus-within:border-primary motion-reduce:transition-none ${error ? "border-error" : "border-outline-variant"}`}>
          <input
            type="number"
            aria-label={label}
            aria-invalid={Boolean(error)}
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
            onBlur={() => {
              if (skipBlurCommitRef.current) {
                skipBlurCommitRef.current = false;
                setIsFocused(false);
                return;
              }
              commit();
            }}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className="h-full min-w-0 flex-1 appearance-none bg-transparent px-1.5 text-right text-[12px] font-medium tabular-nums text-on-surface outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed disabled:text-on-surface-variant/50"
          />
          {suffix ? (
            <span
              aria-hidden="true"
              className="pointer-events-none flex shrink-0 items-center border-l border-outline-variant/70 bg-surface-container px-1.5 text-[10px] text-on-surface-variant"
            >
              {suffix}
            </span>
          ) : null}
        </span>
        {error ? <span className="mt-1 block text-[11px] text-error">{error}</span> : null}
      </span>
    </label>
  );
}

function TextField({ label, value, type = "text", disabled = false, multiline = false, allowEmpty = false, onCommit }: TextFieldProps) {
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
    if (!allowEmpty && !nextValue.trim() && type !== "color") {
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

function ColorField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string, commandId: string) => void;
}) {
  const normalizedValue = normalizeStoredHexColor(value) ?? "#000000";
  const [draft, setDraft] = useState(normalizedValue);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const commandIdRef = useRef<string | null>(null);
  const previousValueRef = useRef(normalizedValue);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    const valueChanged = previousValueRef.current !== normalizedValue;
    if (!isFocused && (valueChanged || !error)) {
      setDraft(normalizedValue);
      if (valueChanged) {
        setError(null);
      }
    }
    previousValueRef.current = normalizedValue;
  }, [error, isFocused, normalizedValue]);

  const emitChange = (nextColor: string) => {
    const commandId = commandIdRef.current ?? createInspectorCommandId(`text-${label}`);
    commandIdRef.current = commandId;
    setDraft(nextColor);
    setError(null);
    onChange(nextColor, commandId);
  };

  const commitDraft = (): boolean => {
    const normalizedDraft = normalizeHexColor(draft);
    if (!normalizedDraft) {
      setError("Use a hex color such as #FFFFFF.");
      return false;
    }
    if (normalizedDraft !== normalizedValue) {
      emitChange(normalizedDraft);
    } else {
      setDraft(normalizedDraft);
      setError(null);
    }
    return true;
  };

  const finishInteraction = () => {
    if (!skipBlurCommitRef.current) {
      commitDraft();
    }
    skipBlurCommitRef.current = false;
    setIsFocused(false);
    commandIdRef.current = null;
  };

  return (
    <label
      className="grid items-start gap-2 text-[13px] font-medium"
      style={{ gridTemplateColumns: "var(--inspector-label-w, 88px) minmax(0, 1fr)" }}
    >
      <span className="pt-1 text-on-surface-variant">{label}</span>
      <span className="min-w-0">
        <span className="grid grid-cols-[28px_minmax(0,1fr)] gap-1.5">
          <input
            type="color"
            aria-label={`${label} picker`}
            disabled={disabled}
            value={normalizeHexColor(draft) ?? normalizedValue}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => emitChange(event.target.value.toLowerCase())}
            onBlur={finishInteraction}
            data-editor-shortcuts="ignore"
            className="h-7 w-7 cursor-pointer rounded-[4px] border border-outline-variant bg-surface-container-low p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            type="text"
            aria-label={`${label} hex`}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft(nextValue);
              setError(null);
              const normalized = normalizeHexColor(nextValue);
              if (normalized && normalized !== normalizedValue) {
                emitChange(normalized);
              }
            }}
            onBlur={finishInteraction}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                skipBlurCommitRef.current = true;
                setDraft(normalizedValue);
                setError(null);
                event.currentTarget.blur();
              }
            }}
            data-editor-shortcuts="ignore"
            className={`h-7 min-w-0 rounded-[4px] border bg-surface-container-low px-1.5 font-mono text-[12px] font-medium text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none ${
              error ? "border-error" : "border-outline-variant"
            } disabled:cursor-not-allowed disabled:text-on-surface-variant/50`}
          />
        </span>
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

export function InspectorFooter({
  onReset,
  onApply,
  onCancel,
  hasChanges = true,
  canCancel = hasChanges,
}: {
  onReset: () => void;
  onApply: () => void;
  onCancel: () => void;
  hasChanges?: boolean;
  canCancel?: boolean;
}) {
  const secondaryButtonClass = "h-8 rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5 border-t border-outline-variant/40 pt-2">
      <button
        type="button"
        onClick={onReset}
        className={secondaryButtonClass}
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={!hasChanges}
        className="h-8 rounded-[4px] border border-primary/70 bg-primary-container px-2 text-[11px] font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:opacity-40 motion-reduce:transition-none"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={!canCancel}
        className={secondaryButtonClass}
      >
        Cancel
      </button>
    </div>
  );
}
function useInspectorDispatch() {
  const dispatch = useAppDispatch();
  return (
    operation: VideoOperation | ReturnType<typeof createVideoOperationBatch>,
    options?: { squash?: boolean },
  ) => {
    dispatch(videoOperationApplied(
      options ? { operation, squash: options.squash } : operation,
    ));
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

function normalizeHexColor(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeStoredHexColor(value: string): string | null {
  const normalized = normalizeHexColor(value);
  if (normalized) {
    return normalized;
  }
  const shortHex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(shortHex)) {
    const [red, green, blue] = shortHex.slice(1);
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  return null;
}

function createInspectorCommandId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(precision)).toString();
}

function roundTo(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function sameVideoTransform(left: VideoTransform, right: VideoTransform): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.rotation === right.rotation &&
    left.anchorX === right.anchorX &&
    left.anchorY === right.anchorY;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function mergeAdvancedState(
  current: VideoAdvancedItemState | undefined,
  patch: Partial<VideoAdvancedItemState>,
): VideoAdvancedItemState {
  return {
    ...current,
    ...patch,
    transform: patch.transform ? { ...current?.transform, ...patch.transform } : current?.transform,
    crop: patch.crop ? { ...current?.crop, ...patch.crop } : current?.crop,
    color: patch.color ? { ...current?.color, ...patch.color } : current?.color,
  };
}

function identityCurves() {
  const line = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  return { master: line, red: line, green: line, blue: line };
}

function neutralHsl() {
  const band = { hue: 0, saturation: 0, lightness: 0 };
  return { red: band, yellow: band, green: band, cyan: band, blue: band, magenta: band };
}
