import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const TOTAL_FRAMES = 7;
// Scroll distance per room viewport-heights — 7 rooms × 1.3 = 9.1 total
const SCROLL_PER_ROOM = 1.3;
export const TOTAL_EXTRA_VH = TOTAL_FRAMES * SCROLL_PER_ROOM;

// Within each room's scroll range:
// 0 → DWELL_RATIO: image is fully stable (no blend)
// DWELL_RATIO → 1.0: crossfade to next image
const DWELL_RATIO = 0.58;

export interface HeroSequenceProgress {
  progress: number;
  roomIndex: number;
  nextRoomIndex: number;
  sectionProgress: number;
  blend: number;
}

/**
 * Hero images — loaded from public/Landingpage/1.jpg … 7.jpg
 * If images are missing, gradient placeholders are generated automatically.
 */
const IMAGE_SRCS = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/Landingpage/${i + 1}.jpg`
);

/** Gradient colors for placeholder images when real images are not available */
const PLACEHOLDER_GRADIENTS: [string, string][] = [
  ["#2d2117", "#1a1612"],
  ["#1a2d1e", "#1a1612"],
  ["#17202d", "#1a1612"],
  ["#2d1722", "#1a1612"],
  ["#1a1a2d", "#1a1612"],
  ["#2d2517", "#1a1612"],
  ["#1a1412", "#0d0a08"],
];

interface HeroSequenceProps {
  onProgressChange: (state: HeroSequenceProgress) => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export function HeroSequence({
  onProgressChange,
  onVisibilityChange,
}: HeroSequenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const framesRef = useRef<(HTMLImageElement | null)[]>(Array(TOTAL_FRAMES).fill(null));
  const loadedRef = useRef<boolean[]>(Array(TOTAL_FRAMES).fill(false));
  const [loadedCount, setLoadedCount] = useState(0);

  const progressRef = useRef(0);
  const onProgressChangeRef = useRef(onProgressChange);
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  const reducedMotionRef = useRef(false);
  onProgressChangeRef.current = onProgressChange;
  onVisibilityChangeRef.current = onVisibilityChange;

  // ── Smoothstep easing ──────────────────────────────────────────────────
  const smoothstep = (t: number) => t * t * (3 - 2 * t);

  // ── Cover-fit draw ─────────────────────────────────────────────────────
  const drawCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cw: number,
    ch: number,
    zoom: number,
    alpha: number
  ) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const base = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const s = base * zoom;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      img,
      (cw - img.naturalWidth * s) / 2,
      (ch - img.naturalHeight * s) / 2,
      img.naturalWidth * s,
      img.naturalHeight * s
    );
    ctx.restore();
  };

  // ── Main render ────────────────────────────────────────────────────────
  const render = (progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Map progress (0→1) to rawFloat (0→TOTAL_FRAMES)
    const rawFloat = Math.min(progress * TOTAL_FRAMES, TOTAL_FRAMES - 0.001);
    const fi = Math.floor(rawFloat);
    const sectionProg = rawFloat - fi;

    // Blend only starts after DWELL_RATIO
    let blend = 0;
    if (fi < TOTAL_FRAMES - 1 && sectionProg > DWELL_RATIO) {
      const t = (sectionProg - DWELL_RATIO) / (1 - DWELL_RATIO);
      blend = reducedMotionRef.current ? (t >= 0.5 ? 1 : 0) : smoothstep(t);
    }

    const imgA = framesRef.current[fi];
    const imgB = fi < TOTAL_FRAMES - 1 ? framesRef.current[fi + 1] : null;
    const okA = !!(imgA && loadedRef.current[fi]);
    const okB = !!(imgB && loadedRef.current[fi + 1]);

    // Dark base
    ctx.fillStyle = "#1a1612";
    ctx.fillRect(0, 0, cw, ch);

    if (okA) {
      const zoomA = 1 + blend * 0.06;
      drawCover(ctx, imgA!, cw, ch, zoomA, 1.0);
    }

    if (okB && blend > 0) {
      const zoomB = 1.06 - blend * 0.06;
      drawCover(ctx, imgB!, cw, ch, zoomB, blend);
    }

    // Vignette at transition peak
    if (blend > 0 && blend < 1) {
      const vigStrength = Math.sin(blend * Math.PI) * 0.5;
      const grad = ctx.createRadialGradient(
        cw / 2, ch / 2, 0,
        cw / 2, ch / 2, Math.max(cw, ch) * 0.65
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.55, `rgba(0,0,0,${vigStrength * 0.25})`);
      grad.addColorStop(1, `rgba(0,0,0,${vigStrength})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }

    onProgressChangeRef.current({
      progress,
      roomIndex: fi,
      nextRoomIndex: Math.min(fi + 1, TOTAL_FRAMES - 1),
      sectionProgress: sectionProg,
      blend,
    });
  };

  // ── Canvas resize ──────────────────────────────────────────────────────
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };

  /**
   * Generate a gradient placeholder when the real image is missing.
   * Draws a subtle radial gradient + large room number so the page
   * still looks intentional without actual photos.
   */
  const createPlaceholder = (index: number) => {
    const c = document.createElement("canvas");
    c.width = 1920;
    c.height = 1080;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const [start, end] = PLACEHOLDER_GRADIENTS[index] ?? ["#1a1612", "#0d0a08"];
    const grad = ctx.createRadialGradient(960, 540, 0, 960, 540, 1200);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Subtle room number watermark
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.font = "600 160px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`0${index + 1}`, 960, 540);

    const placeholderImg = new Image();
    placeholderImg.src = c.toDataURL("image/jpeg", 0.85);
    placeholderImg.onload = () => {
      framesRef.current[index] = placeholderImg;
      loadedRef.current[index] = true;
      setLoadedCount((prev) => prev + 1);
      if (index === 0) render(0);
    };
  };

  // ── Image preload ──────────────────────────────────────────────────────
  useEffect(() => {
    IMAGE_SRCS.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.decoding = "async";
      framesRef.current[i] = img;
      img.onload = () => {
        loadedRef.current[i] = true;
        setLoadedCount((c) => c + 1);
        if (i === 0) render(0);
      };
      img.onerror = () => {
        // Image not found — generate gradient placeholder
        createPlaceholder(i);
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GSAP ScrollTrigger ─────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    resizeCanvas();
    render(0);

    const progress = { value: 0 };
    const scheduleRender = () => {
      progressRef.current = progress.value;
      // GSAP's ticker already runs on requestAnimationFrame.
      render(progress.value);
    };

    const onResize = () => {
      resizeCanvas();
      ScrollTrigger.refresh();
      scheduleRender();
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Drive a tweened proxy value so scrub smooths both image and copy.
    const tween = gsap.to(progress, {
      value: 1,
      ease: "none",
      onUpdate: scheduleRender,
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: () => `+=${window.innerHeight * TOTAL_EXTRA_VH}`,
        pin: true,
        pinSpacing: true,
        scrub: reducedMotionRef.current ? true : 0.85,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: () => onVisibilityChangeRef.current?.(true),
        onEnterBack: () => onVisibilityChangeRef.current?.(true),
        onLeave: () => onVisibilityChangeRef.current?.(false),
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#1a1612",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          opacity: loadedCount > 0 ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      />

      {loadedCount === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              border: "1.5px solid rgba(201,169,98,0.15)",
              borderTop: "1.5px solid rgba(201,169,98,0.85)",
              borderRadius: "50%",
              animation: "landing-spin 0.9s linear infinite",
            }}
          />
        </div>
      )}
    </div>
  );
}
