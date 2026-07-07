import { EditorIcon } from "../editor-ui";
import type { ImageCompositionDocument, ImageCompositionLayer } from "~/lib/editor/image/document/types";

interface LayersPanelProps {
  document: ImageCompositionDocument;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleVisible: (layerId: string, visible: boolean) => void;
  onToggleLocked: (layerId: string, locked: boolean) => void;
  onMoveLayer: (layerId: string, direction: "up" | "down") => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
}

export function LayersPanel({
  document,
  onSelectLayer,
  onRenameLayer,
  onToggleVisible,
  onToggleLocked,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
}: LayersPanelProps) {
  const layers = [...document.layers].reverse();

  return (
    <section className="border-b border-white/10">
      <div className="flex h-10 items-center justify-between px-3">
        <h2 className="text-label-sm font-semibold uppercase tracking-wide text-white/45">Layers</h2>
        <span className="text-label-sm text-white/35">{document.layers.length}</span>
      </div>
      <div className="max-h-56 overflow-y-auto px-3 pb-3">
        {layers.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-white/12 bg-black/15 px-3 py-6 text-center">
            <EditorIcon className="text-[24px] text-white/25">layers</EditorIcon>
            <p className="mt-2 text-label-md font-semibold text-white/55">No layers yet</p>
            <p className="mt-1 text-label-sm text-white/35">The blank document is ready.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                layerIndex={document.layers.findIndex((item) => item.id === layer.id)}
                layerCount={document.layers.length}
                selected={document.selectedLayerId === layer.id}
                onSelect={() => onSelectLayer(layer.id)}
                onRename={(name) => onRenameLayer(layer.id, name)}
                onToggleVisible={() => onToggleVisible(layer.id, !layer.visible)}
                onToggleLocked={() => onToggleLocked(layer.id, !layer.locked)}
                onMoveUp={() => onMoveLayer(layer.id, "up")}
                onMoveDown={() => onMoveLayer(layer.id, "down")}
                onDuplicate={() => onDuplicateLayer(layer.id)}
                onDelete={() => onDeleteLayer(layer.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LayerRow({
  layer,
  layerIndex,
  layerCount,
  selected,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: {
  layer: ImageCompositionLayer;
  layerIndex: number;
  layerCount: number;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const icon = layer.type === "text" ? "title" : layer.type === "shape" ? "category" : "image";
  const locked = layer.locked;
  const canMoveUp = !locked && layerIndex < layerCount - 1;
  const canMoveDown = !locked && layerIndex > 0;

  return (
    <div
      className={`rounded-[4px] px-2 py-1 text-label-md ${
        selected
          ? "bg-[#8fd6c8]/16 text-white"
          : "text-white/65 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <div className="flex h-8 items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <EditorIcon className="shrink-0 text-[18px]">{icon}</EditorIcon>
          <input
            value={layer.name}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onRename(event.target.value)}
            className="min-w-0 flex-1 truncate bg-transparent text-label-md font-semibold outline-none"
            aria-label="Layer name"
          />
        </button>
        <LayerIconButton
          icon={layer.visible ? "visibility" : "visibility_off"}
          label={layer.visible ? "Hide layer" : "Show layer"}
          onClick={onToggleVisible}
        />
        <LayerIconButton
          icon={layer.locked ? "lock" : "lock_open"}
          label={layer.locked ? "Unlock layer" : "Lock layer"}
          onClick={onToggleLocked}
        />
      </div>
      {selected ? (
        <div className="mt-1 flex items-center justify-end gap-1">
          <LayerIconButton icon="arrow_upward" label="Move layer up" disabled={!canMoveUp} onClick={onMoveUp} />
          <LayerIconButton icon="arrow_downward" label="Move layer down" disabled={!canMoveDown} onClick={onMoveDown} />
          <LayerIconButton icon="content_copy" label="Duplicate layer" disabled={locked} onClick={onDuplicate} />
          <LayerIconButton icon="delete" label="Delete layer" disabled={locked} onClick={onDelete} />
        </div>
      ) : null}
    </div>
  );
}

function LayerIconButton({
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-white/45 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:text-white/15"
    >
      <EditorIcon className="text-[16px]">{icon}</EditorIcon>
    </button>
  );
}
