import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";

import type {
  ImageCompositionDocument,
  ImageCompositionLayer,
  ImageLayerTransform,
} from "~/lib/editor/image/document/types";

interface ImageCanvasProps {
  document: ImageCompositionDocument;
  zoom: number;
  pan: { x: number; y: number };
  onSelectLayer: (layerId: string) => void;
  onClearSelection: () => void;
  onTransformLayer: (
    layerId: string,
    transform: Partial<ImageLayerTransform>,
    label?: string,
  ) => void;
  onUpdateTextContent: (layerId: string, text: string) => void;
}

interface ViewportSize {
  width: number;
  height: number;
}

const VIEW_PADDING = 72;

export function ImageCanvas({
  document,
  zoom,
  pan,
  onSelectLayer,
  onClearSelection,
  onTransformLayer,
  onUpdateTextContent,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [editingText, setEditingText] = useState<{
    layerId: string;
    value: string;
    style: {
      left: number;
      top: number;
      width: number;
      height: number;
      transform: string;
      fontSize: number;
      fontFamily: string;
      fontWeight: number;
      color: string;
      textAlign: "left" | "center" | "right";
    };
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewport = () => {
      setViewport({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => {
    const availableWidth = Math.max(1, viewport.width - VIEW_PADDING * 2);
    const availableHeight = Math.max(1, viewport.height - VIEW_PADDING * 2);
    const fitScale = Math.min(
      availableWidth / document.canvas.width,
      availableHeight / document.canvas.height,
    );
    const scale = Math.max(0.01, fitScale * zoom);

    return {
      scale,
      x: viewport.width / 2 - (document.canvas.width * scale) / 2 + pan.x,
      y: viewport.height / 2 - (document.canvas.height * scale) / 2 + pan.y,
    };
  }, [document.canvas.height, document.canvas.width, pan.x, pan.y, viewport.height, viewport.width, zoom]);

  const selectedLayer =
    document.layers.find((layer) => layer.id === document.selectedLayerId && layer.visible && !layer.locked) ?? null;

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const selectedNode = selectedLayer ? nodeRefs.current.get(selectedLayer.id) ?? null : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedLayer]);

  const handleStagePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage()) {
      onClearSelection();
    }
  };

  const handleLayerPointerDown = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
    layerId: string,
  ) => {
    event.cancelBubble = true;
    onSelectLayer(layerId);
  };

  const handleTextDoubleClick = (layer: Extract<ImageCompositionLayer, { type: "text" }>) => {
    if (layer.locked || !layer.visible) return;
    setEditingText({
      layerId: layer.id,
      value: layer.text,
      style: {
        left: view.x + layer.transform.x * view.scale,
        top: view.y + layer.transform.y * view.scale,
        width: layer.transform.width * view.scale,
        height: layer.transform.height * view.scale,
        transform: `rotate(${layer.transform.rotation}deg)`,
        fontSize: layer.fontSize * view.scale,
        fontFamily: layer.fontFamily,
        fontWeight: layer.fontWeight,
        color: layer.fill,
        textAlign: layer.align,
      },
    });
  };

  const commitInlineText = () => {
    if (!editingText) return;
    onUpdateTextContent(editingText.layerId, editingText.value);
    setEditingText(null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background">
      <Stage
        width={viewport.width}
        height={viewport.height}
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
      >
        <KonvaLayer>
          <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
            <CanvasBackground document={document} onClearSelection={onClearSelection} />
            {document.layers.filter((layer) => layer.visible).map((layer) => (
              <DocumentLayer
                key={layer.id}
                layer={layer}
                selected={document.selectedLayerId === layer.id}
                refCallback={(node) => {
                  if (node) {
                    nodeRefs.current.set(layer.id, node);
                  } else {
                    nodeRefs.current.delete(layer.id);
                  }
                }}
                onPointerDown={(event) => handleLayerPointerDown(event, layer.id)}
                onDragEnd={(event) => {
                  onTransformLayer(
                    layer.id,
                    {
                      x: Math.round(event.target.x()),
                      y: Math.round(event.target.y()),
                    },
                    "Move layer",
                  );
                }}
                onTransformEnd={(event) => {
                  const node = event.target as Konva.Group;
                  const nextWidth = Math.max(1, layer.transform.width * node.scaleX());
                  const nextHeight = Math.max(1, layer.transform.height * node.scaleY());
                  node.scaleX(1);
                  node.scaleY(1);
                  onTransformLayer(
                    layer.id,
                    {
                      x: Math.round(node.x()),
                      y: Math.round(node.y()),
                      width: Math.round(nextWidth),
                      height: Math.round(nextHeight),
                      rotation: Math.round(node.rotation()),
                      scaleX: 1,
                      scaleY: 1,
                    },
                    "Transform layer",
                  );
                }}
                onTextDoubleClick={
                  layer.type === "text" ? () => handleTextDoubleClick(layer) : undefined
                }
              />
            ))}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
                "middle-left",
                "middle-right",
                "top-center",
                "bottom-center",
              ]}
              anchorFill="#23c7b7"
              anchorStroke="#062f2d"
              borderStroke="#23c7b7"
              anchorSize={10}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
              }
            />
          </Group>
        </KonvaLayer>
      </Stage>
      {editingText ? (
        <textarea
          autoFocus
          value={editingText.value}
          onChange={(event) =>
            setEditingText((current) =>
              current ? { ...current, value: event.target.value } : current,
            )
          }
          onBlur={commitInlineText}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditingText(null);
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              commitInlineText();
            }
          }}
          className="absolute z-10 resize-none overflow-hidden border border-[#23c7b7] bg-white/95 p-0 leading-tight outline-none"
          style={{
            left: editingText.style.left,
            top: editingText.style.top,
            width: editingText.style.width,
            height: editingText.style.height,
            transform: editingText.style.transform,
            transformOrigin: "top left",
            fontSize: editingText.style.fontSize,
            fontFamily: editingText.style.fontFamily,
            fontWeight: editingText.style.fontWeight,
            color: editingText.style.color,
            textAlign: editingText.style.textAlign,
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-[4px] border border-white/10 bg-black/35 px-2 py-1 text-label-sm text-white/55">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

function CanvasBackground({
  document,
  onClearSelection,
}: {
  document: ImageCompositionDocument;
  onClearSelection: () => void;
}) {
  const fill = document.background.type === "color" ? document.background.color : "rgba(255,255,255,0)";

  return (
    <Rect
      x={0}
      y={0}
      width={document.canvas.width}
      height={document.canvas.height}
      fill={fill}
      shadowColor="black"
      shadowOpacity={0.32}
      shadowBlur={42}
      shadowOffset={{ x: 0, y: 18 }}
      onMouseDown={onClearSelection}
      onTouchStart={onClearSelection}
    />
  );
}

function DocumentLayer({
  layer,
  selected,
  refCallback,
  onPointerDown,
  onDragEnd,
  onTransformEnd,
  onTextDoubleClick,
}: {
  layer: ImageCompositionLayer;
  selected: boolean;
  refCallback: (node: Konva.Group | null) => void;
  onPointerDown: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
  onTextDoubleClick?: () => void;
}) {
  const transform = layer.transform;

  return (
    <Group
      ref={refCallback}
      x={transform.x}
      y={transform.y}
      width={transform.width}
      height={transform.height}
      rotation={transform.rotation}
      scaleX={transform.scaleX}
      scaleY={transform.scaleY}
      opacity={transform.opacity}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      onDblClick={onTextDoubleClick}
      onDblTap={onTextDoubleClick}
      draggable={!layer.locked}
      listening={!layer.locked}
      name={selected ? "selected-layer" : undefined}
    >
      {layer.type === "text" ? <TextLayerNode layer={layer} /> : null}
      {layer.type === "image" ? <ImageLayerNode layer={layer} /> : null}
      {layer.type === "shape" ? <ShapeLayerNode layer={layer} /> : null}
    </Group>
  );
}

function TextLayerNode({ layer }: { layer: Extract<ImageCompositionLayer, { type: "text" }> }) {
  return (
    <Text
      text={layer.text}
      width={layer.transform.width}
      height={layer.transform.height}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={layer.fontWeight >= 700 ? "bold" : "normal"}
      fill={layer.fill}
      align={layer.align}
      verticalAlign="middle"
    />
  );
}

function ImageLayerNode({ layer }: { layer: Extract<ImageCompositionLayer, { type: "image" }> }) {
  const image = useKonvaImage(layer.source.url);

  if (image) {
    return (
      <KonvaImage
        image={image}
        width={layer.transform.width}
        height={layer.transform.height}
      />
    );
  }

  return (
    <Group>
      <Rect
        width={layer.transform.width}
        height={layer.transform.height}
        fill="#dbeafe"
        stroke="#86b7ff"
        strokeWidth={2}
      />
      <Text
        text={layer.source.alt || layer.name}
        width={layer.transform.width}
        height={layer.transform.height}
        align="center"
        verticalAlign="middle"
        fill="#1f2937"
        fontSize={28}
        fontStyle="bold"
      />
    </Group>
  );
}

function ShapeLayerNode({ layer }: { layer: Extract<ImageCompositionLayer, { type: "shape" }> }) {
  if (layer.shape === "ellipse") {
    return (
      <Ellipse
        x={layer.transform.width / 2}
        y={layer.transform.height / 2}
        radiusX={layer.transform.width / 2}
        radiusY={layer.transform.height / 2}
        fill={layer.fill}
        stroke={layer.stroke ?? undefined}
        strokeWidth={layer.strokeWidth}
      />
    );
  }

  return (
    <Rect
      width={layer.transform.width}
      height={layer.transform.height}
      fill={layer.fill}
      stroke={layer.stroke ?? undefined}
      strokeWidth={layer.strokeWidth}
      cornerRadius={layer.cornerRadius ?? 0}
    />
  );
}

function useKonvaImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      if (!cancelled) setImage(element);
    };
    element.onerror = () => {
      if (!cancelled) setImage(null);
    };
    element.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}
