import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

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
} from "~/lib/editor/video-operations";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  selectVideoInspectorState,
  videoOperationApplied,
  type InspectorSubject,
} from "~/store/slices/editor-slice";

import { EditorIcon } from "./editor-ui";

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

export function VideoInspectorPanel() {
  const inspector = useAppSelector(selectVideoInspectorState);

  return (
    <aside className="z-30 hidden h-full w-video-inspector-width min-w-video-inspector-width max-w-[336px] shrink-0 flex-col border-l border-outline-variant bg-surface-container-lowest lg:flex 2xl:w-[336px]">
      <div className="flex h-14 items-center gap-3 border-b border-outline-variant px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-outline-variant bg-surface text-on-surface-variant">
          <EditorIcon className="text-[18px]">tune</EditorIcon>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-body-sm font-semibold text-on-surface">Inspector</h2>
          <p className="truncate text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
            {inspectorTitle(inspector)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {inspector.selectedCount > 1 ? (
          <div className="rounded-[6px] border border-outline-variant bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant">
            {inspector.selectedCount} selected. Editing the active item.
          </div>
        ) : null}
        <InspectorBody inspector={inspector} />
      </div>
    </aside>
  );
}

function InspectorBody({ inspector }: { inspector: InspectorSubject }) {
  if (inspector.kind === "transition") {
    return <TransitionInspector inspector={inspector} />;
  }

  if (inspector.kind === "project") {
    return <ProjectInspector inspector={inspector} />;
  }

  if (inspector.item.type === "video") {
    return <VideoClipInspector inspector={inspector as Extract<InspectorSubject, { kind: "item" }> & { item: VideoClipTimelineItem }} />;
  }

  if (inspector.item.type === "audio") {
    return <AudioInspector item={inspector.item} mediaName={inspector.media?.name} />;
  }

  if (inspector.item.type === "text") {
    return <TextInspector item={inspector.item} />;
  }

  return <ImageOverlayInspector item={inspector.item} mediaName={inspector.media?.name} />;
}

function VideoClipInspector({
  inspector,
}: {
  inspector: Extract<InspectorSubject, { kind: "item" }> & { item: VideoClipTimelineItem };
}) {
  const dispatch = useInspectorDispatch();
  const item = inspector.item;
  const linkedMuted = inspector.linkedAudioItems.length > 0
    ? inspector.linkedAudioItems.every(({ item: audio }) => audio.muted)
    : false;

  return (
    <>
      <Section title="Media">
        <ReadOnlyRow label="Name" value={inspector.media?.name ?? item.mediaId} />
        <ReadOnlyRow label="Status" value={inspector.media ? `${inspector.media.kind.toUpperCase()} ready` : "Missing media"} />
        <ReadOnlyRow label="Track" value={inspector.track.label} />
      </Section>

      <TimingFields
        item={item}
        includeSource
        onCommit={(fields) => dispatch(trimOperation(item, fields, "Update clip timing"))}
      />

      <Section title="Playback">
        <NumberField
          label="Speed"
          value={item.speed}
          min={0.01}
          step={0.05}
          suffix="x"
          precision={3}
          onCommit={(speed) => dispatch(updateSpeedOperation(item.id, { speed }, "Update clip speed"))}
        />
        <ToggleField
          label="Linked audio mute"
          checked={linkedMuted}
          disabled={inspector.linkedAudioItems.length === 0}
          onChange={(muted) => {
            const operations = inspector.linkedAudioItems.map(({ item: audio }) =>
              updateAudioOperation(audio.id, { muted }, "Update linked audio mute"),
            );
            if (operations.length === 1) {
              dispatch(operations[0]);
            } else if (operations.length > 1) {
              dispatch(createVideoOperationBatch({
                source: "manual",
                label: "Update linked audio mute",
                operations,
              }));
            }
          }}
        />
      </Section>

      <TransformSection
        transform={item.transform}
        onCommit={(transform) =>
          dispatch(updateTransformCropOperation(item.id, { transform }, "Update clip transform"))
        }
      />

      <Section title="Crop">
        {(["top", "right", "bottom", "left"] as const).map((key) => (
          <NumberField
            key={key}
            label={capitalize(key)}
            value={item.crop[key]}
            min={0}
            max={1}
            step={0.01}
            precision={3}
            onCommit={(value) =>
              dispatch(updateTransformCropOperation(item.id, { crop: { ...item.crop, [key]: value } }, "Update clip crop"))
            }
          />
        ))}
      </Section>

      <Section title="Compositing">
        <NumberField
          label="Opacity"
          value={item.opacity}
          min={0}
          max={1}
          step={0.01}
          precision={3}
          onCommit={(opacity) => dispatch(updateTransformCropOperation(item.id, { opacity }, "Update clip opacity"))}
        />
      </Section>
    </>
  );
}

function TextInspector({ item }: { item: TextTimelineItem }) {
  const dispatch = useInspectorDispatch();

  return (
    <>
      <Section title="Text">
        <TextField
          label="Content"
          value={item.text}
          multiline
          onCommit={(text) => dispatch(updateTextOperation(item.id, { text }, "Update text content"))}
        />
      </Section>

      <TimingFields
        item={item}
        onCommit={(fields) => dispatch(updateTextOperation(item.id, fields, "Update text timing"))}
      />

      <TransformSection
        transform={item.transform}
        onCommit={(transform) => dispatch(updateTextOperation(item.id, { transform }, "Update text transform"))}
      />

      <Section title="Style">
        <TextField
          label="Font"
          value={item.style.fontFamily}
          onCommit={(fontFamily) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontFamily } }, "Update text font"))}
        />
        <NumberField
          label="Size"
          value={item.style.fontSize}
          min={1}
          step={1}
          precision={0}
          onCommit={(fontSize) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontSize } }, "Update text size"))}
        />
        <SelectField
          label="Weight"
          value={item.style.fontWeight ?? "normal"}
          options={fontWeights}
          onChange={(fontWeight) => dispatch(updateTextOperation(item.id, { style: { ...item.style, fontWeight } }, "Update text weight"))}
        />
        <SelectField
          label="Align"
          value={item.style.textAlign ?? "center"}
          options={textAlignments}
          onChange={(textAlign) => dispatch(updateTextOperation(item.id, { style: { ...item.style, textAlign } }, "Update text alignment"))}
        />
        <TextField
          label="Color"
          value={item.style.color}
          type="color"
          onCommit={(color) => dispatch(updateTextOperation(item.id, { style: { ...item.style, color } }, "Update text color"))}
        />
        <TextField
          label="Background"
          value={item.style.backgroundColor ?? "#000000"}
          type="color"
          onCommit={(backgroundColor) =>
            dispatch(updateTextOperation(item.id, { style: { ...item.style, backgroundColor } }, "Update text background"))
          }
        />
        <NumberField
          label="Layer"
          value={item.layerOrder}
          step={1}
          precision={0}
          onCommit={(layerOrder) => dispatch(updateTextOperation(item.id, { layerOrder }, "Update text layer"))}
        />
      </Section>
    </>
  );
}

function AudioInspector({ item, mediaName }: { item: AudioTimelineItem; mediaName?: string }) {
  const dispatch = useInspectorDispatch();

  return (
    <>
      <Section title="Media">
        <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
        <ReadOnlyRow label="Role" value={item.linkedGroupId ? "Linked clip audio" : "Standalone audio"} />
        <ReadOnlyRow label="Linked group" value={item.linkedGroupId ?? "Unlinked"} />
      </Section>

      <TimingFields
        item={item}
        includeSource
        onCommit={(fields) => dispatch(trimOperation(item, fields, "Update audio timing"))}
      />

      <Section title="Audio">
        <NumberField
          label="Volume"
          value={item.volume}
          min={0}
          max={1}
          step={0.01}
          precision={3}
          onCommit={(volume) => dispatch(updateAudioOperation(item.id, { volume }, "Update audio volume"))}
        />
        <ToggleField
          label="Mute"
          checked={item.muted}
          onChange={(muted) => dispatch(updateAudioOperation(item.id, { muted }, "Update audio mute"))}
        />
        <NumberField
          label="Fade in"
          value={item.fades.fadeInDuration}
          min={0}
          max={Math.max(0, item.duration - item.fades.fadeOutDuration)}
          step={0.1}
          precision={2}
          suffix="s"
          validate={(fadeInDuration) =>
            fadeInDuration + item.fades.fadeOutDuration > item.duration ? "Fades must fit duration." : undefined
          }
          onCommit={(fadeInDuration) =>
            dispatch(updateAudioOperation(item.id, { fades: { ...item.fades, fadeInDuration } }, "Update audio fades"))
          }
        />
        <NumberField
          label="Fade out"
          value={item.fades.fadeOutDuration}
          min={0}
          max={Math.max(0, item.duration - item.fades.fadeInDuration)}
          step={0.1}
          precision={2}
          suffix="s"
          validate={(fadeOutDuration) =>
            item.fades.fadeInDuration + fadeOutDuration > item.duration ? "Fades must fit duration." : undefined
          }
          onCommit={(fadeOutDuration) =>
            dispatch(updateAudioOperation(item.id, { fades: { ...item.fades, fadeOutDuration } }, "Update audio fades"))
          }
        />
      </Section>
    </>
  );
}

function ImageOverlayInspector({ item, mediaName }: { item: ImageOverlayTimelineItem; mediaName?: string }) {
  const dispatch = useInspectorDispatch();

  return (
    <>
      <Section title="Media">
        <ReadOnlyRow label="Name" value={mediaName ?? item.mediaId} />
        <ReadOnlyRow label="Type" value={item.type} />
      </Section>

      <TimingFields
        item={item}
        onCommit={(fields) => dispatch(trimOperation(item, fields, "Update visual timing"))}
      />

      <TransformSection
        transform={item.transform}
        onCommit={(transform) =>
          dispatch(updateTransformCropOperation(item.id, { transform }, "Update visual transform"))
        }
      />

      <Section title="Compositing">
        <NumberField
          label="Opacity"
          value={item.opacity}
          min={0}
          max={1}
          step={0.01}
          precision={3}
          onCommit={(opacity) => dispatch(updateTransformCropOperation(item.id, { opacity }, "Update visual opacity"))}
        />
        <NumberField
          label="Layer"
          value={item.layerOrder}
          step={1}
          precision={0}
          onCommit={(layerOrder) =>
            dispatch(updateTransformCropOperation(item.id, { layerOrder }, "Update visual layer"))
          }
        />
      </Section>
    </>
  );
}

function ProjectInspector({ inspector }: { inspector: Extract<InspectorSubject, { kind: "project" }> }) {
  const dispatch = useInspectorDispatch();
  const settings = inspector.document?.settings;

  if (!settings) {
    return (
      <Section title="Project">
        <div className="rounded-[4px] border border-dashed border-outline-variant bg-surface-container-low px-3 py-4 text-center text-body-sm text-on-surface-variant">
          No selection. Project settings appear when a video document is loaded.
        </div>
        <ReadOnlyRow label="Document" value="No active video document" />
      </Section>
    );
  }

  return (
    <>
      <Section title="Canvas">
        <NumberField
          label="Width"
          value={settings.width}
          min={1}
          step={1}
          precision={0}
          onCommit={(width) => dispatch(setProjectSettingsOperation({ width }, "Update project width"))}
        />
        <NumberField
          label="Height"
          value={settings.height}
          min={1}
          step={1}
          precision={0}
          onCommit={(height) => dispatch(setProjectSettingsOperation({ height }, "Update project height"))}
        />
        <TextField
          label="Aspect"
          value={settings.aspectRatio}
          onCommit={(aspectRatio) => dispatch(setProjectSettingsOperation({ aspectRatio }, "Update project aspect ratio"))}
        />
      </Section>

      <Section title="Playback">
        <NumberField
          label="Frame rate"
          value={settings.frameRate}
          min={1}
          step={1}
          precision={2}
          onCommit={(frameRate) => dispatch(setProjectSettingsOperation({ frameRate }, "Update project frame rate"))}
        />
        <SelectField
          label="Preview"
          value={settings.previewQuality}
          options={previewQualities}
          onChange={(previewQuality) =>
            dispatch(setProjectSettingsOperation({ previewQuality }, "Update project preview quality"))
          }
        />
        <NumberField
          label="Transition"
          value={settings.defaultTransitionDuration}
          min={0}
          step={0.1}
          precision={2}
          suffix="s"
          onCommit={(defaultTransitionDuration) =>
            dispatch(setProjectSettingsOperation({ defaultTransitionDuration }, "Update default transition"))
          }
        />
      </Section>

      <Section title="Export">
        <SelectField
          label="Preset"
          value={settings.exportPreset}
          options={exportPresets}
          onChange={(exportPreset) => dispatch(setProjectSettingsOperation({ exportPreset }, "Update export preset"))}
        />
      </Section>
    </>
  );
}

function TransitionInspector({ inspector }: { inspector: Extract<InspectorSubject, { kind: "transition" }> }) {
  return (
    <Section title="Transition">
      <ReadOnlyRow label="Type" value={inspector.transition.type} />
      <ReadOnlyRow label="Duration" value={`${formatNumber(inspector.transition.duration, 2)}s`} />
      <ReadOnlyRow label="Targets" value={inspector.transition.targetItemIds.join(", ")} />
      <ReadOnlyRow label="Easing" value={inspector.transition.easing ?? "Default"} />
      <div className="rounded-[6px] border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-body-sm text-on-surface-variant">
        Transition property editing is coming in a later video slice.
      </div>
    </Section>
  );
}

function TimingFields({
  item,
  includeSource = false,
  onCommit,
}: {
  item: VideoTimelineItem;
  includeSource?: boolean;
  onCommit: (fields: Partial<Pick<TrimItemOperation, "timelineStart" | "duration" | "sourceIn" | "sourceOut">>) => void;
}) {
  const sourceItem = item.type === "video" || item.type === "audio" ? item : undefined;

  return (
    <Section title="Timing">
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
    </Section>
  );
}

function TransformSection({
  transform,
  onCommit,
}: {
  transform: VideoTransform;
  onCommit: (transform: VideoTransform) => void;
}) {
  return (
    <Section title="Transform">
      <NumberField
        label="X"
        value={transform.x}
        step={1}
        precision={2}
        onCommit={(x) => onCommit({ ...transform, x })}
      />
      <NumberField
        label="Y"
        value={transform.y}
        step={1}
        precision={2}
        onCommit={(y) => onCommit({ ...transform, y })}
      />
      <NumberField
        label="Scale X"
        value={transform.scaleX}
        min={0.01}
        step={0.05}
        precision={3}
        onCommit={(scaleX) => onCommit({ ...transform, scaleX })}
      />
      <NumberField
        label="Scale Y"
        value={transform.scaleY}
        min={0.01}
        step={0.05}
        precision={3}
        onCommit={(scaleY) => onCommit({ ...transform, scaleY })}
      />
      <NumberField
        label="Rotation"
        value={transform.rotation}
        step={1}
        precision={2}
        suffix="deg"
        onCommit={(rotation) => onCommit({ ...transform, rotation })}
      />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[6px] border border-outline-variant bg-surface">
      <div className="border-b border-outline-variant px-3 py-2">
        <h3 className="text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 text-label-md">
      <span className="text-on-surface-variant">{label}</span>
      <span className="truncate text-on-surface">{value}</span>
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

  useEffect(() => {
    setDraft(formattedValue);
    setError(null);
  }, [formattedValue]);

  function commit() {
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
    <label className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2 text-label-md">
      <span className="pt-2 text-on-surface-variant">{label}</span>
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
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`h-8 w-full rounded-[4px] border bg-surface-container-low px-2 text-label-md text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none ${
              error ? "border-error" : "border-outline-variant"
            } ${suffix ? "pr-9" : ""} disabled:cursor-not-allowed disabled:text-on-surface-variant/50`}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-2 top-1/2 text-label-sm text-on-surface-variant -translate-y-1/2">
              {suffix}
            </span>
          ) : null}
        </span>
        {error ? <span className="mt-1 block text-label-sm text-error">{error}</span> : null}
      </span>
    </label>
  );
}

function TextField({ label, value, type = "text", disabled = false, multiline = false, onCommit }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  function commit(nextValue = draft) {
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

  const commonClassName = `w-full rounded-[4px] border bg-surface-container-low px-2 text-label-md text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none ${
    error ? "border-error" : "border-outline-variant"
  } disabled:cursor-not-allowed disabled:text-on-surface-variant/50`;

  return (
    <label className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2 text-label-md">
      <span className="pt-2 text-on-surface-variant">{label}</span>
      <span className="min-w-0">
        {multiline ? (
          <textarea
            aria-label={label}
            rows={3}
            disabled={disabled}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`${commonClassName} min-h-20 resize-none py-2`}
          />
        ) : (
          <input
            type={type}
            aria-label={label}
            disabled={disabled}
            value={draft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft(nextValue);
              setError(null);
              if (type === "color") commit(nextValue);
            }}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
            data-editor-shortcuts="ignore"
            className={`${commonClassName} h-8 ${type === "color" ? "p-1" : ""}`}
          />
        )}
        {error ? <span className="mt-1 block text-label-sm text-error">{error}</span> : null}
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
    <label className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 text-label-md">
      <span className="text-on-surface-variant">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value as T;
          if (nextValue !== value) onChange(nextValue);
        }}
        data-editor-shortcuts="ignore"
        className="h-8 min-w-0 rounded-[4px] border border-outline-variant bg-surface-container-low px-2 text-label-md text-on-surface outline-none transition-colors focus:border-primary motion-reduce:transition-none"
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
    <label className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 text-label-md">
      <span className="text-on-surface-variant">{label}</span>
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-8 w-14 items-center rounded-full border px-1 transition-colors motion-reduce:transition-none ${
          checked
            ? "justify-end border-primary/40 bg-primary/25 text-primary"
            : "justify-start border-outline-variant bg-surface-container-low text-on-surface-variant"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="h-5 w-5 rounded-full bg-current" />
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

function trimOperation(
  item: VideoTimelineItem,
  fields: Partial<Pick<TrimItemOperation, "timelineStart" | "duration" | "sourceIn" | "sourceOut">>,
  label: string,
): TrimItemOperation {
  const baseFields = {
    timelineStart: item.timelineStart,
    duration: item.duration,
  };

  if (item.type === "video" || item.type === "audio") {
    return {
      ...operationMetadata(label, [item.id]),
      type: "trimItem",
      itemId: item.id,
      ...baseFields,
      sourceIn: item.sourceIn,
      sourceOut: item.sourceOut,
      ...fields,
    };
  }

  return {
    ...operationMetadata(label, [item.id]),
    type: "trimItem",
    itemId: item.id,
    ...baseFields,
    ...fields,
  };
}

function updateTextOperation(
  itemId: string,
  fields: Omit<Partial<UpdateTextOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateTextOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateText",
    itemId,
    ...fields,
  };
}

function updateAudioOperation(
  itemId: string,
  fields: Omit<Partial<UpdateAudioOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateAudioOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateAudio",
    itemId,
    ...fields,
  };
}

function updateSpeedOperation(
  itemId: string,
  fields: Omit<UpdateSpeedOperation, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateSpeedOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateSpeed",
    itemId,
    ...fields,
  };
}

function updateTransformCropOperation(
  itemId: string,
  fields: Omit<Partial<UpdateTransformCropOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateTransformCropOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateTransformCrop",
    itemId,
    ...fields,
  };
}

function setProjectSettingsOperation(
  settings: Partial<VideoProjectSettings>,
  label: string,
): SetProjectSettingsOperation {
  return {
    ...operationMetadata(label, ["settings"]),
    type: "setProjectSettings",
    settings,
  };
}

function operationMetadata(label: string, affectedEntityIds: string[]): VideoOperationMetadata {
  const timestamp = new Date().toISOString();
  return {
    id: `inspector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "manual",
    timestamp,
    label,
    affectedEntityIds,
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
