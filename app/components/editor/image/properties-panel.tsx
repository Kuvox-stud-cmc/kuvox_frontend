import type { ReactNode } from "react";

import { ImageAiCommandPanel } from "./image-ai-command-panel";
import type {
  ImageCompositionDocument,
  ImageCompositionLayer,
  ImageLayerStylePatch,
  ImageLayerTransform,
} from "./document/types";
import type { ImageEditorMode } from "~/store/slices/image-editor-slice";

interface PropertiesPanelProps {
  document: ImageCompositionDocument;
  editorMode: ImageEditorMode;
  onUpdateTransform: (
    layerId: string,
    transform: Partial<ImageLayerTransform>,
    label?: string,
  ) => void;
  onUpdateStyle: (layerId: string, patch: ImageLayerStylePatch, label?: string) => void;
  onUpdateTextContent: (layerId: string, text: string) => void;
}

export function PropertiesPanel({
  document,
  editorMode,
  onUpdateTransform,
  onUpdateStyle,
  onUpdateTextContent,
}: PropertiesPanelProps) {
  const selectedLayer = document.layers.find((layer) => layer.id === document.selectedLayerId) ?? null;

  return (
    <section className="min-h-0 overflow-y-auto p-3">
      {editorMode === "ai" ? <ImageAiCommandPanel document={document} /> : null}
      {selectedLayer ? (
        <SelectedLayerProperties
          layer={selectedLayer}
          onUpdateTransform={onUpdateTransform}
          onUpdateStyle={onUpdateStyle}
          onUpdateTextContent={onUpdateTextContent}
        />
      ) : (
        <CanvasProperties document={document} afterAiPanel={editorMode === "ai"} />
      )}
    </section>
  );
}

function CanvasProperties({
  document,
  afterAiPanel,
}: {
  document: ImageCompositionDocument;
  afterAiPanel: boolean;
}) {
  return (
    <div className={afterAiPanel ? "mt-4 space-y-4" : "space-y-4"}>
      <PropertyGroup title="Canvas">
        <PropertyRow label="Preset" value={document.canvas.presetName} />
        <PropertyRow label="Size" value={`${document.canvas.width} x ${document.canvas.height}`} />
        <PropertyRow
          label="Background"
          value={document.background.type === "color" ? document.background.color : "Transparent"}
        />
      </PropertyGroup>
    </div>
  );
}

function SelectedLayerProperties({
  layer,
  onUpdateTransform,
  onUpdateStyle,
  onUpdateTextContent,
}: {
  layer: ImageCompositionLayer;
  onUpdateTransform: (
    layerId: string,
    transform: Partial<ImageLayerTransform>,
    label?: string,
  ) => void;
  onUpdateStyle: (layerId: string, patch: ImageLayerStylePatch, label?: string) => void;
  onUpdateTextContent: (layerId: string, text: string) => void;
}) {
  const contentDisabled = layer.locked || !layer.visible;

  return (
    <div className="mt-4 space-y-4">
      <PropertyGroup title="Layer">
        <TextInputRow
          label="Name"
          value={layer.name}
          onChange={(value) => onUpdateStyle(layer.id, { name: value }, "Rename layer")}
        />
        <PropertyRow label="Type" value={layer.type} />
        <ToggleRow
          label="Visible"
          checked={layer.visible}
          onChange={(checked) => onUpdateStyle(layer.id, { visible: checked }, checked ? "Show layer" : "Hide layer")}
        />
        <ToggleRow
          label="Locked"
          checked={layer.locked}
          onChange={(checked) => onUpdateStyle(layer.id, { locked: checked }, checked ? "Lock layer" : "Unlock layer")}
        />
      </PropertyGroup>
      <PropertyGroup title="Transform">
        <NumberInputRow
          label="X"
          value={layer.transform.x}
          disabled={contentDisabled}
          onChange={(value) => onUpdateTransform(layer.id, { x: value }, "Move layer")}
        />
        <NumberInputRow
          label="Y"
          value={layer.transform.y}
          disabled={contentDisabled}
          onChange={(value) => onUpdateTransform(layer.id, { y: value }, "Move layer")}
        />
        <NumberInputRow
          label="Width"
          value={layer.transform.width}
          min={1}
          disabled={contentDisabled}
          onChange={(value) => onUpdateTransform(layer.id, { width: value }, "Resize layer")}
        />
        <NumberInputRow
          label="Height"
          value={layer.transform.height}
          min={1}
          disabled={contentDisabled}
          onChange={(value) => onUpdateTransform(layer.id, { height: value }, "Resize layer")}
        />
        <NumberInputRow
          label="Rotate"
          value={layer.transform.rotation}
          disabled={contentDisabled}
          onChange={(value) => onUpdateTransform(layer.id, { rotation: value }, "Rotate layer")}
        />
        <RangeInputRow
          label="Opacity"
          value={Math.round(layer.transform.opacity * 100)}
          disabled={layer.locked}
          onChange={(value) => onUpdateStyle(layer.id, { opacity: value / 100 }, "Change opacity")}
        />
      </PropertyGroup>
      {layer.type === "text" ? (
        <PropertyGroup title="Text">
          <textarea
            value={layer.text}
            disabled={contentDisabled}
            onChange={(event) => onUpdateTextContent(layer.id, event.target.value)}
            className="min-h-24 w-full resize-y rounded-[4px] border border-white/10 bg-black/20 px-2 py-2 text-body-sm text-white outline-none disabled:text-white/35"
            aria-label="Text content"
          />
          <TextInputRow
            label="Family"
            value={layer.fontFamily}
            disabled={contentDisabled}
            onChange={(value) => onUpdateStyle(layer.id, { fontFamily: value }, "Change font")}
          />
          <NumberInputRow
            label="Size"
            value={layer.fontSize}
            min={8}
            max={300}
            disabled={contentDisabled}
            onChange={(value) => onUpdateStyle(layer.id, { fontSize: value }, "Change font size")}
          />
          <SelectRow
            label="Align"
            value={layer.align}
            disabled={contentDisabled}
            options={["left", "center", "right"]}
            onChange={(value) => onUpdateStyle(layer.id, { align: value }, "Change text align")}
          />
          <ColorRow
            label="Fill"
            value={layer.fill}
            disabled={contentDisabled}
            onChange={(value) => onUpdateStyle(layer.id, { fill: value }, "Change text color")}
          />
        </PropertyGroup>
      ) : null}
    </div>
  );
}

function PropertyGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-white/45">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <span className="truncate rounded-[4px] border border-white/10 bg-black/20 px-2 py-1 text-right text-label-md text-white/80">
        {value}
      </span>
    </div>
  );
}

function TextInputRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-[4px] border border-white/10 bg-black/20 px-2 py-1 text-right text-label-md text-white/80 outline-none disabled:text-white/35"
      />
    </div>
  );
}

function NumberInputRow({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="min-w-0 rounded-[4px] border border-white/10 bg-black/20 px-2 py-1 text-right text-label-md text-white/80 outline-none disabled:text-white/35"
      />
    </div>
  );
}

function RangeInputRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1"
        />
        <span className="w-10 text-right text-label-sm text-white/55">{value}%</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="ml-auto h-4 w-4 accent-[#8fd6c8]"
      />
    </label>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-w-0 rounded-[4px] border border-white/10 bg-black/20 px-2 py-1 text-label-md text-white/80 outline-none disabled:text-white/35"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-label-md text-white/50">{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="ml-auto h-8 w-14 rounded-[4px] border border-white/10 bg-black/20 p-1 disabled:opacity-40"
      />
    </div>
  );
}
