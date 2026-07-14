import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { EditorIcon } from "./editor-ui";

export type GuidedTourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  placement?: "top" | "right" | "bottom" | "left";
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOUR_STORAGE_KEY = "kuvox.editor.onboardingTour.completed.v1";
const HIGHLIGHT_PADDING = 8;
const TOOLTIP_GAP = 14;
const TOOLTIP_WIDTH = 320;

export const editorTourSteps: GuidedTourStep[] = [
  {
    id: "mode",
    target: '[data-tour="editor-mode"]',
    title: "Choose how you edit",
    body: "Switch between hands-on editing and the AI agent whenever the project needs a different pace.",
    placement: "bottom",
  },
  {
    id: "categories",
    target: '[data-tour="category-rail"], [data-responsive-manual-controls]',
    title: "Open your creative panels",
    body: "Use the category rail for media, text, effects, transitions, brand kits, elements, and AI tools.",
    placement: "right",
  },
  {
    id: "media",
    target: '[data-tour="media-library"]',
    title: "Bring in project media",
    body: "Import files, filter your library, then click or drag ready assets into the edit.",
    placement: "right",
  },
  {
    id: "preview",
    target: '[data-tour="preview-panel"]',
    title: "Preview the composition",
    body: "This canvas shows the current frame. Drop media here to place it at the playhead.",
    placement: "top",
  },
  {
    id: "inspector",
    target: '[data-tour="inspector-tools"], [aria-label="Open inspector"]',
    title: "Adjust selected layers",
    body: "Open inspector tools for transform, color, crop, speed, audio, and animation controls.",
    placement: "left",
  },
  {
    id: "timeline",
    target: '[data-tour="timeline-panel"]',
    title: "Build the timeline",
    body: "Arrange clips, trim edges, split items, zoom, and control track visibility from here.",
    placement: "top",
  },
  {
    id: "export",
    target: '[data-tour="export-video"]',
    title: "Finish with export",
    body: "When the edit is ready, export the project with the current timeline and media.",
    placement: "bottom",
  },
];

export function GuidedTour({
  steps = editorTourSteps,
  storageKey = TOUR_STORAGE_KEY,
  storageScope,
}: {
  steps?: GuidedTourStep[];
  storageKey?: string;
  storageScope?: string;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const scopedKey = scopedStorageKey(storageKey, storageScope);
    const forceTour = new URLSearchParams(window.location.search).get("tour") === "1";
    if (forceTour) {
      localStorage.removeItem(scopedKey);
    }
    setOpen(steps.length > 0 && (forceTour || localStorage.getItem(scopedKey) !== "true"));
  }, [steps.length, storageKey, storageScope]);

  const activeStep = steps[stepIndex];

  const findVisibleStepIndex = useCallback((start: number, direction: 1 | -1) => {
    if (typeof document === "undefined") return -1;

    for (
      let candidateIndex = start;
      candidateIndex >= 0 && candidateIndex < steps.length;
      candidateIndex += direction
    ) {
      const target = findVisibleTarget(steps[candidateIndex].target);
      if (target) return candidateIndex;
    }

    return -1;
  }, [steps]);

  const completeTour = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(scopedStorageKey(storageKey, storageScope), "true");
    }
    setOpen(false);
  }, [storageKey, storageScope]);

  const moveToStep = useCallback((direction: 1 | -1) => {
    setStepIndex((current) => {
      const next = current + direction;
      if (next < 0) return current;
      if (next >= steps.length) return current;
      const visible = findVisibleStepIndex(next, direction);
      return visible === -1 ? current : visible;
    });
  }, [findVisibleStepIndex, steps.length]);

  useEffect(() => {
    if (!open) return;
    const visibleIndex = findVisibleStepIndex(stepIndex, 1);
    if (visibleIndex === -1) {
      completeTour();
      return;
    }
    if (visibleIndex !== stepIndex) {
      setStepIndex(visibleIndex);
    }
  }, [completeTour, findVisibleStepIndex, open, stepIndex]);

  useEffect(() => {
    if (!open || !activeStep || typeof window === "undefined") return;

    let frame = 0;
    const updateRect = () => {
      const target = findVisibleTarget(activeStep.target);
      if (!target) {
        const visibleIndex = findVisibleStepIndex(stepIndex + 1, 1);
        if (visibleIndex !== -1 && visibleIndex !== stepIndex) {
          setStepIndex(visibleIndex);
        }
        return;
      }

      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      frame = window.requestAnimationFrame(() => {
        const rect = paddedRect(target.getBoundingClientRect(), HIGHLIGHT_PADDING);
        setTargetRect(rect);
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };

    updateRect();
    const handleUpdate = () => updateRect();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [activeStep, findVisibleStepIndex, open, stepIndex]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect || !activeStep) return undefined;
    return tooltipPosition(targetRect, viewport, activeStep.placement ?? "bottom");
  }, [activeStep, targetRect, viewport]);

  if (!open || !activeStep || !targetRect || !tooltipStyle) {
    return null;
  }

  const isFirst = findVisibleStepIndex(stepIndex - 1, -1) === -1;
  const isLast = findVisibleStepIndex(stepIndex + 1, 1) === -1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
      <Overlay rect={targetRect} viewport={viewport} onClose={completeTour} />
      <div
        className="pointer-events-none fixed rounded-[8px] border border-primary/70 shadow-[0_0_0_1px_rgba(139,124,255,0.18),0_0_34px_rgba(139,124,255,0.35)] transition-all duration-200 ease-out motion-reduce:transition-none"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />
      <section
        className="fixed w-[min(320px,calc(100vw-24px))] rounded-[8px] border border-outline-variant bg-surface-container-high p-4 text-on-surface shadow-2xl transition-all duration-200 ease-out animate-tour-pop motion-reduce:animate-none motion-reduce:transition-none"
        style={tooltipStyle}
      >
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-surface-container-lowest">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-sm font-semibold uppercase text-primary">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 id="guided-tour-title" className="mt-1 text-body-sm font-bold text-on-surface">
              {activeStep.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={completeTour}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            aria-label="Close tutorial"
          >
            <EditorIcon className="text-[17px]">close</EditorIcon>
          </button>
        </div>
        <p className="mt-2 text-label-md leading-5 text-on-surface-variant">{activeStep.body}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-hidden="true">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                  index === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-on-surface-variant/35"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={completeTour}
              className="h-8 rounded-[4px] px-2 text-label-md font-semibold whitespace-nowrap text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              Skip
            </button>
            <button
              type="button"
              disabled={isFirst}
              onClick={() => moveToStep(-1)}
              className="h-8 rounded-[4px] border border-outline-variant px-2 text-label-md font-semibold whitespace-nowrap text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={isLast ? completeTour : () => moveToStep(1)}
              className="h-8 min-w-[72px] rounded-[4px] bg-primary px-3 text-label-md font-bold whitespace-nowrap text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-high motion-reduce:transition-none"
            >
              {isLast ? "Got It" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Overlay({
  rect,
  viewport,
  onClose,
}: {
  rect: Rect;
  viewport: { width: number; height: number };
  onClose: () => void;
}) {
  const dimClass = "fixed bg-black/70 backdrop-blur-[1px] transition-all duration-200 motion-reduce:transition-none";

  return (
    <>
      <button
        type="button"
        aria-label="Close tutorial"
        onClick={onClose}
        className={dimClass}
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }}
      />
      <button
        type="button"
        aria-label="Close tutorial"
        onClick={onClose}
        className={dimClass}
        style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
      />
      <button
        type="button"
        aria-label="Close tutorial"
        onClick={onClose}
        className={dimClass}
        style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
      />
      <button
        type="button"
        aria-label="Close tutorial"
        onClick={onClose}
        className={dimClass}
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          width: Math.max(0, viewport.width - rect.left - rect.width),
          height: rect.height,
        }}
      />
    </>
  );
}

function findVisibleTarget(selector: string): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));

  return candidates.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }) ?? null;
}

function paddedRect(rect: DOMRect, padding: number): Rect {
  const left = Math.max(8, rect.left - padding);
  const top = Math.max(8, rect.top - padding);

  return {
    top,
    left,
    width: Math.min(Math.max(1, window.innerWidth - left - 8), rect.width + padding * 2),
    height: Math.min(Math.max(1, window.innerHeight - top - 8), rect.height + padding * 2),
  };
}

function tooltipPosition(
  rect: Rect,
  viewport: { width: number; height: number },
  preferredPlacement: NonNullable<GuidedTourStep["placement"]>,
): CSSProperties {
  const width = Math.min(TOOLTIP_WIDTH, viewport.width - 24);
  const space = {
    top: rect.top,
    right: viewport.width - rect.left - rect.width,
    bottom: viewport.height - rect.top - rect.height,
    left: rect.left,
  };
  const placement = space[preferredPlacement] >= 180
    ? preferredPlacement
    : (Object.entries(space).sort((a, b) => b[1] - a[1])[0]?.[0] as NonNullable<GuidedTourStep["placement"]>) ?? "bottom";

  if (placement === "left" || placement === "right") {
    const top = clamp(rect.top + rect.height / 2 - 120, 12, viewport.height - 240);
    const left = placement === "left"
      ? clamp(rect.left - width - TOOLTIP_GAP, 12, viewport.width - width - 12)
      : clamp(rect.left + rect.width + TOOLTIP_GAP, 12, viewport.width - width - 12);
    return { top, left, width };
  }

  const left = clamp(rect.left + rect.width / 2 - width / 2, 12, viewport.width - width - 12);
  const top = placement === "top"
    ? clamp(rect.top - 220 - TOOLTIP_GAP, 12, viewport.height - 240)
    : clamp(rect.top + rect.height + TOOLTIP_GAP, 12, viewport.height - 240);
  return { top, left, width };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function scopedStorageKey(storageKey: string, scope: string | undefined): string {
  return scope ? `${storageKey}:${scope}` : storageKey;
}
