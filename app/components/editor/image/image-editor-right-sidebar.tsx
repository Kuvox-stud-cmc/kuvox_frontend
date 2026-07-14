import { useState } from "react";

import { EditorIcon } from "../editor-ui";
import type {
  ImageAdjustmentSettings,
  ImageCompositionLayer,
  ImageLayerStylePatch,
  ImageLayerTransform,
} from "~/lib/editor/image/document/types";
import type { ImageEditorMode } from "~/store/slices/image-editor-slice";

type SidebarTab = "adjustments" | "layers" | "properties";

export interface ImageEditorRightSidebarProps {
  open: boolean;
  onClose: () => void;
  documentLayers: ImageCompositionLayer[];
  selectedLayer: ImageCompositionLayer | null;
  selectedLayerId: string | null;
  canvasLabel: string;
  backgroundLabel: string;
  adjustments: ImageAdjustmentSettings;
  previewAdjustments: ImageAdjustmentSettings | null;
  mediaCount: number;
  uploadCount: number;
  mediaError: string | null;
  history: Array<{ id: string; label: string }>;
  aiHistory: Array<{ id: string; label: string; summary: string; prompt: string | null; createdAt: string }>;
  editorMode: ImageEditorMode;
  onModeChange: (mode: ImageEditorMode) => void;
  onAddImage: () => void;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleVisible: (layerId: string, visible: boolean) => void;
  onToggleLocked: (layerId: string, locked: boolean) => void;
  onMoveLayer: (layerId: string, direction: "up" | "down") => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onUpdateTransform: (layerId: string, transform: Partial<ImageLayerTransform>, label?: string) => void;
  onUpdateStyle: (layerId: string, patch: ImageLayerStylePatch, label?: string) => void;
  onUpdateTextContent: (layerId: string, text: string) => void;
  onPreviewAdjustments: (adjustments: ImageAdjustmentSettings | null) => void;
  onCommitAdjustments: (adjustments: Partial<ImageAdjustmentSettings>, label?: string) => void;
  onCopyAdjustments: () => void;
}

const ADJUSTMENT_PRESETS: Array<{ label: string; adjustments: ImageAdjustmentSettings }> = [
  { label: "Clean", adjustments: { exposure: 0, contrast: 0, saturation: 0 } },
  { label: "Studio", adjustments: { exposure: 8, contrast: 14, saturation: 6 } },
  { label: "Punch", adjustments: { exposure: 4, contrast: 24, saturation: 18 } },
  { label: "Mute", adjustments: { exposure: -4, contrast: -10, saturation: -28 } },
];

export function ImageEditorRightSidebar(props: ImageEditorRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("adjustments");

  return (
    <>
      {props.open ? (
        <button
          type="button"
          aria-label="Close image editor sidebar"
          onClick={props.onClose}
          className="fixed inset-0 z-[80] bg-black/45 min-[1024px]:hidden"
        />
      ) : null}
      <aside
        className={`image-pro-right-sidebar fixed inset-y-0 right-0 z-[90] flex w-[min(320px,88vw)] shrink-0 flex-col overflow-hidden border-l border-[#484555] bg-[#211e28] transition-transform duration-200 min-[1024px]:static min-[1024px]:z-auto min-[1024px]:h-full min-[1024px]:w-[300px] min-[1024px]:translate-x-0 ${
          props.open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#484555] bg-[#0f0d16] px-2 min-[1024px]:hidden">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#c9c4d8]">Editor panels</span>
          <button
            type="button"
            title="Close panels"
            aria-label="Close panels"
            onClick={props.onClose}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#36333d]"
          >
            <EditorIcon className="text-[16px]">close</EditorIcon>
          </button>
        </div>
        <div className="grid h-10 shrink-0 grid-cols-3 border-b border-[#484555] bg-[#1c1a24]">
          {(["adjustments", "layers", "properties"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab ? "bg-[#2b2932] text-[#7c5cff]" : "text-[#c9c4d8]/55 hover:text-[#e6e0ed]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "adjustments" ? (
            <>
              <AdjustmentsPanel
                adjustments={props.adjustments}
                previewAdjustments={props.previewAdjustments}
                onPreviewAdjustments={props.onPreviewAdjustments}
                onCommitAdjustments={props.onCommitAdjustments}
                onCopyAdjustments={props.onCopyAdjustments}
              />
              <AiLabPanel
                editorMode={props.editorMode}
                mediaCount={props.mediaCount}
                uploadCount={props.uploadCount}
                mediaError={props.mediaError}
                onModeChange={props.onModeChange}
                onAddImage={props.onAddImage}
              />
            </>
          ) : null}
          {activeTab === "layers" ? (
            <LayersDock
              layers={props.documentLayers}
              selectedLayerId={props.selectedLayerId}
              onSelectLayer={props.onSelectLayer}
              onRenameLayer={props.onRenameLayer}
              onToggleVisible={props.onToggleVisible}
              onToggleLocked={props.onToggleLocked}
              onMoveLayer={props.onMoveLayer}
              onDuplicateLayer={props.onDuplicateLayer}
              onDeleteLayer={props.onDeleteLayer}
            />
          ) : null}
          {activeTab === "properties" ? (
            <InspectorStrip
              selectedLayer={props.selectedLayer}
              canvasLabel={props.canvasLabel}
              backgroundLabel={props.backgroundLabel}
              onUpdateTransform={props.onUpdateTransform}
              onUpdateStyle={props.onUpdateStyle}
              onUpdateTextContent={props.onUpdateTextContent}
            />
          ) : null}
        </div>
        <HistoryFooter history={props.history} aiHistory={props.aiHistory} />
      </aside>
    </>
  );
}

function AdjustmentsPanel({
  adjustments,
  previewAdjustments,
  onPreviewAdjustments,
  onCommitAdjustments,
  onCopyAdjustments,
}: {
  adjustments: ImageAdjustmentSettings;
  previewAdjustments: ImageAdjustmentSettings | null;
  onPreviewAdjustments: (adjustments: ImageAdjustmentSettings | null) => void;
  onCommitAdjustments: (adjustments: Partial<ImageAdjustmentSettings>, label?: string) => void;
  onCopyAdjustments: () => void;
}) {
  const activeAdjustments = previewAdjustments ?? adjustments;

  const preview = (patch: Partial<ImageAdjustmentSettings>) => {
    onPreviewAdjustments({ ...activeAdjustments, ...patch });
  };

  const commit = (label: string) => {
    if (!previewAdjustments) return;
    onCommitAdjustments(previewAdjustments, label);
  };

  return (
    <section className="border-b border-[#484555] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#c9c4d8]">Adjustments</span>
        <EditorIcon className="text-[16px]">tune</EditorIcon>
      </div>
      <div className="relative mb-4 h-32 w-full overflow-hidden rounded border border-[#484555] bg-[#0f0d16]">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M0,100 C20,90 40,50 60,30 C80,10 100,0" fill="none" stroke="#7c5cff" strokeWidth="2" />
          <line stroke="#484555" strokeDasharray="2,2" x1="0" x2="100" y1="0" y2="100" />
        </svg>
        <div className="absolute bottom-1 right-2 text-[9px] text-[#c9c4d8]/50">RGB CURVES</div>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {ADJUSTMENT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onCommitAdjustments(preset.adjustments, `Apply ${preset.label} preset`)}
            className="rounded border border-[#484555] bg-[#2b2932] px-1 py-1.5 text-[10px] font-semibold text-[#c9c4d8] hover:border-[#7c5cff] hover:text-[#e6e0ed]"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        <AdjustmentSlider
          label="Exposure"
          value={activeAdjustments.exposure}
          min={-100}
          max={100}
          display={formatSigned(activeAdjustments.exposure)}
          onChange={(value) => preview({ exposure: value })}
          onCommit={() => commit("Adjust exposure")}
        />
        <AdjustmentSlider
          label="Contrast"
          value={activeAdjustments.contrast}
          min={-100}
          max={100}
          display={formatSigned(activeAdjustments.contrast)}
          onChange={(value) => preview({ contrast: value })}
          onCommit={() => commit("Adjust contrast")}
        />
        <AdjustmentSlider
          label="Saturation"
          value={activeAdjustments.saturation}
          min={-100}
          max={100}
          display={formatSigned(activeAdjustments.saturation)}
          onChange={(value) => preview({ saturation: value })}
          onCommit={() => commit("Adjust saturation")}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCommitAdjustments({ exposure: 0, contrast: 0, saturation: 0 }, "Reset adjustments")}
          className="h-8 rounded border border-[#484555] bg-[#2b2932] text-[10px] font-bold uppercase tracking-wider text-[#c9c4d8] hover:border-[#7c5cff]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCopyAdjustments}
          className="h-8 rounded border border-[#484555] bg-[#2b2932] text-[10px] font-bold uppercase tracking-wider text-[#c9c4d8] hover:border-[#7c5cff]"
        >
          Copy
        </button>
      </div>
    </section>
  );
}

function AdjustmentSlider({
  label,
  value,
  min,
  max,
  display,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="text-[#7c5cff]">{display}</span>
      </div>
      <input
        className="image-pro-precision-slider w-full"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

function AiLabPanel({
  editorMode,
  mediaCount,
  uploadCount,
  mediaError,
  onModeChange,
  onAddImage,
}: {
  editorMode: ImageEditorMode;
  mediaCount: number;
  uploadCount: number;
  mediaError: string | null;
  onModeChange: (mode: ImageEditorMode) => void;
  onAddImage: () => void;
}) {
  const tools = [
    { icon: "person_remove", label: "Remove BG", action: () => onModeChange("ai") },
    { icon: "high_res", label: "AI Upscale", action: () => onModeChange("ai") },
    { icon: "face_retouching_natural", label: "Skin Smooth", action: () => onModeChange("ai") },
    { icon: "palette", label: "Colorizer", action: () => onModeChange("ai") },
  ];
  return (
    <section className="border-b border-[#484555] bg-[#1c1a24] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#7c5cff]">AI Lab Tools</span>
        <EditorIcon className="text-[16px] text-[#7c5cff]">bolt</EditorIcon>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.action}
            className="flex flex-col items-center justify-center rounded border border-[#484555] bg-[#2b2932] p-2 text-center transition-colors hover:border-[#7c5cff]"
          >
            <EditorIcon className="mb-1 text-[18px]">{tool.icon}</EditorIcon>
            <span className="text-[10px]">{tool.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddImage}
        className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded border border-[#484555] bg-[#2b2932] text-[10px] uppercase tracking-wider text-[#c9c4d8] hover:border-[#7c5cff]"
      >
        <EditorIcon className="text-[16px]">add_photo_alternate</EditorIcon>
        Place image
      </button>
      <div className="mt-2 flex justify-between text-[10px] text-[#c9c4d8]/45">
        <span>{editorMode === "ai" ? "AI ready" : "Manual mode"}</span>
        <span>{uploadCount > 0 ? `${uploadCount} uploading` : `${mediaCount} media`}</span>
      </div>
      {mediaError ? <p className="mt-1 truncate text-[10px] text-[#ffb4ab]">{mediaError}</p> : null}
    </section>
  );
}

function LayersDock(props: {
  layers: ImageCompositionLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleVisible: (layerId: string, visible: boolean) => void;
  onToggleLocked: (layerId: string, locked: boolean) => void;
  onMoveLayer: (layerId: string, direction: "up" | "down") => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
}) {
  const layers = [...props.layers].reverse();
  return (
    <section className="flex min-h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#484555] bg-[#2b2932] px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider">Layers</span>
        <div className="flex gap-2">
          <EditorIcon className="cursor-pointer text-[18px] hover:text-white">add_box</EditorIcon>
          <EditorIcon className="cursor-pointer text-[18px] hover:text-white">create_new_folder</EditorIcon>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-[#484555] bg-[#1c1a24] p-2">
        <select className="min-w-0 flex-1 rounded border border-[#484555] bg-[#36333d] px-2 py-1 text-[11px] outline-none">
          <option>Normal</option>
          <option>Soft Light</option>
          <option>Overlay</option>
          <option>Multiply</option>
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] opacity-60">Op:</span>
          <span className="w-8 text-[11px]">85%</span>
        </div>
      </div>
      <div className="bg-[#0f0d16]">
        {layers.length === 0 ? (
          <div className="m-2 rounded border border-dashed border-[#484555] px-3 py-6 text-center text-[#c9c4d8]/55">
            <EditorIcon className="text-[24px]">layers</EditorIcon>
            <p className="mt-2 text-[11px] font-semibold">No layers yet</p>
          </div>
        ) : (
          layers.map((layer) => (
            <LayerDockRow key={layer.id} layer={layer} layerIndex={props.layers.findIndex((item) => item.id === layer.id)} layerCount={props.layers.length} selected={props.selectedLayerId === layer.id} {...props} />
          ))
        )}
      </div>
    </section>
  );
}

function LayerDockRow({
  layer,
  layerIndex,
  layerCount,
  selected,
  onSelectLayer,
  onRenameLayer,
  onToggleVisible,
  onToggleLocked,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
}: {
  layer: ImageCompositionLayer;
  layerIndex: number;
  layerCount: number;
  selected: boolean;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleVisible: (layerId: string, visible: boolean) => void;
  onToggleLocked: (layerId: string, locked: boolean) => void;
  onMoveLayer: (layerId: string, direction: "up" | "down") => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
}) {
  const icon = layer.type === "text" ? "title" : layer.type === "shape" ? "category" : "image";
  const canMoveUp = !layer.locked && layerIndex < layerCount - 1;
  const canMoveDown = !layer.locked && layerIndex > 0;
  return (
    <div className={`border-b border-[#484555]/30 transition-colors hover:bg-[#36333d] ${selected ? "border-l-4 border-l-[#7c5cff] bg-[#7c5cff]/10" : "border-l-4 border-l-transparent"}`}>
      <div className="flex items-center gap-3 p-2">
        <button type="button" onClick={() => onSelectLayer(layer.id)} className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-[#484555] bg-black">
          <EditorIcon className="text-[18px] text-[#c9c4d8]">{icon}</EditorIcon>
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={layer.name}
            onChange={(event) => onRenameLayer(layer.id, event.target.value)}
            onFocus={() => onSelectLayer(layer.id)}
            className={`w-full min-w-0 truncate bg-transparent text-[13px] outline-none ${selected ? "font-medium text-[#e6e0ed]" : "text-[#c9c4d8]"}`}
            aria-label="Layer name"
          />
          <div className="mt-1 flex items-center gap-2 text-[#c9c4d8]/45">
            <LayerMiniButton icon={layer.visible ? "visibility" : "visibility_off"} label={layer.visible ? "Hide layer" : "Show layer"} onClick={() => onToggleVisible(layer.id, !layer.visible)} />
            <LayerMiniButton icon={layer.locked ? "lock" : "lock_open"} label={layer.locked ? "Unlock layer" : "Lock layer"} onClick={() => onToggleLocked(layer.id, !layer.locked)} />
            {selected ? (
              <>
                <LayerMiniButton icon="arrow_upward" label="Move layer up" disabled={!canMoveUp} onClick={() => onMoveLayer(layer.id, "up")} />
                <LayerMiniButton icon="arrow_downward" label="Move layer down" disabled={!canMoveDown} onClick={() => onMoveLayer(layer.id, "down")} />
                <LayerMiniButton icon="content_copy" label="Duplicate layer" disabled={layer.locked} onClick={() => onDuplicateLayer(layer.id)} />
                <LayerMiniButton icon="delete" label="Delete layer" disabled={layer.locked} onClick={() => onDeleteLayer(layer.id)} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerMiniButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-4 w-4 items-center justify-center text-[#c9c4d8]/55 hover:text-[#e6e0ed] disabled:pointer-events-none disabled:opacity-25"
    >
      <EditorIcon className="text-[12px]">{icon}</EditorIcon>
    </button>
  );
}

function InspectorStrip({
  selectedLayer,
  canvasLabel,
  backgroundLabel,
  onUpdateTransform,
  onUpdateStyle,
  onUpdateTextContent,
}: {
  selectedLayer: ImageCompositionLayer | null;
  canvasLabel: string;
  backgroundLabel: string;
  onUpdateTransform: (layerId: string, transform: Partial<ImageLayerTransform>, label?: string) => void;
  onUpdateStyle: (layerId: string, patch: ImageLayerStylePatch, label?: string) => void;
  onUpdateTextContent: (layerId: string, text: string) => void;
}) {
  return (
    <section className="bg-[#1c1a24] p-2">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#c9c4d8]">
        <span>{selectedLayer ? "Transform" : "Canvas"}</span>
        <EditorIcon className="text-[14px]">manufacturing</EditorIcon>
      </div>
      {selectedLayer ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberControl label="X" value={selectedLayer.transform.x} disabled={selectedLayer.locked} onChange={(value) => onUpdateTransform(selectedLayer.id, { x: value }, "Move layer")} />
          <NumberControl label="Y" value={selectedLayer.transform.y} disabled={selectedLayer.locked} onChange={(value) => onUpdateTransform(selectedLayer.id, { y: value }, "Move layer")} />
          <NumberControl label="W" value={selectedLayer.transform.width} disabled={selectedLayer.locked} min={1} onChange={(value) => onUpdateTransform(selectedLayer.id, { width: value }, "Resize layer")} />
          <NumberControl label="H" value={selectedLayer.transform.height} disabled={selectedLayer.locked} min={1} onChange={(value) => onUpdateTransform(selectedLayer.id, { height: value }, "Resize layer")} />
          <NumberControl label="Rot" value={selectedLayer.transform.rotation} disabled={selectedLayer.locked} onChange={(value) => onUpdateTransform(selectedLayer.id, { rotation: value }, "Rotate layer")} />
          {selectedLayer.type === "text" ? (
            <label className="col-span-2">
              <span className="mb-1 block text-[10px] text-[#c9c4d8]/55">Text</span>
              <textarea
                value={selectedLayer.text}
                disabled={selectedLayer.locked || !selectedLayer.visible}
                onChange={(event) => onUpdateTextContent(selectedLayer.id, event.target.value)}
                className="h-16 w-full resize-none rounded border border-[#484555] bg-[#0f0d16] px-2 py-1 text-[11px] text-[#e6e0ed] outline-none disabled:opacity-40"
              />
            </label>
          ) : null}
          {"fill" in selectedLayer ? (
            <label>
              <span className="mb-1 block text-[10px] text-[#c9c4d8]/55">Fill</span>
              <input
                type="color"
                value={selectedLayer.fill}
                disabled={selectedLayer.locked}
                onChange={(event) => onUpdateStyle(selectedLayer.id, { fill: event.target.value }, "Change fill")}
                className="h-7 w-full rounded border border-[#484555] bg-[#0f0d16] p-1 disabled:opacity-40"
              />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 text-[11px] text-[#c9c4d8]/70">
          <span>Size</span>
          <span className="truncate text-right text-[#e6e0ed]">{canvasLabel}</span>
          <span>Background</span>
          <span className="truncate text-right text-[#e6e0ed]">{backgroundLabel}</span>
        </div>
      )}
    </section>
  );
}

function NumberControl({
  label,
  value,
  min,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-[10px] text-[#c9c4d8]/55">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-7 w-full rounded border border-[#484555] bg-[#0f0d16] px-2 text-right text-[11px] text-[#e6e0ed] outline-none disabled:opacity-40"
      />
    </label>
  );
}

function HistoryFooter({
  history,
  aiHistory,
}: {
  history: Array<{ id: string; label: string }>;
  aiHistory: Array<{ id: string; label: string; summary: string; prompt: string | null; createdAt: string }>;
}) {
  const recentHistory = [...history].slice(-2).reverse();
  const recentAi = [...aiHistory].slice(-1);
  return (
    <footer className="shrink-0 border-t border-[#484555] bg-[#0f0d16] p-2">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-tighter text-[#c9c4d8]">
        <span>History</span>
        <EditorIcon className="text-[14px]">history</EditorIcon>
      </div>
      <div className="space-y-1 text-[10px] text-[#c9c4d8]/50">
        {[...recentAi.map((entry) => ({ id: entry.id, label: entry.label })), ...recentHistory].slice(0, 3).map((entry, index) => (
          <div key={entry.id} className={`flex items-center gap-2 rounded px-1 ${index === 0 ? "bg-[#36333d] text-[#e6e0ed]" : ""}`}>
            <EditorIcon className="text-[12px]">{entry.label.toLowerCase().includes("ai") ? "auto_awesome" : "tune"}</EditorIcon>
            <span className="truncate">{entry.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#484555] pt-2 text-[9px] text-[#c9c4d8]">
        <span>RAM: 4.2GB / 32GB</span>
        <span className="flex items-center gap-1 text-[#44e2cd]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#44e2cd]" />
          GPU ACCELERATED
        </span>
      </div>
    </footer>
  );
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}
