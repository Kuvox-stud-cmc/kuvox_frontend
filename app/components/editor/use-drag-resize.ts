import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

interface DragResizeOptions {
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  direction?: "normal" | "reverse";
  onChange: (value: number) => void;
}

export function useDragResize({
  axis,
  value,
  min,
  max,
  direction = "normal",
  onChange,
}: DragResizeOptions) {
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      const startPosition = axis === "x" ? event.clientX : event.clientY;
      const startValue = value;
      const multiplier = direction === "reverse" ? -1 : 1;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextPosition = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const delta = (nextPosition - startPosition) * multiplier;
        const nextValue = Math.min(max, Math.max(min, startValue + delta));
        onChange(nextValue);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [axis, direction, max, min, onChange, value],
  );
}
