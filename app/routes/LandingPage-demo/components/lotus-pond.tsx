import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════════════════
   Lotus Pond v2 — clear teal lotus pond with scroll-linked surge
   ─────────────────────────────────────────────────────────────────────────
   • Clear teal water surface with animated waves
   • Scroll-triggered water surge rising up from below
   • Dense lotus arrangement on both flanks
   • Mouse hover → ripple rings + movable lotus drift
   • lotus_bud & Lotus_pod are anchored (no drift)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Lotus element definitions ────────────────────────────────────────────
interface LotusItem {
  id: string;
  src: string;
  style: React.CSSProperties;
  anchored: boolean;
  size: number;
  z: number;
  rotation: number;
}

// Dense lotus arrangement — 36 elements total
const LOTUS_ITEMS: LotusItem[] = [
  // ══════════ LEFT SIDE ══════════

  // Back layer — large leaves
  {
    id: "leaf-L1",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "-6%", top: "2%" },
    anchored: false,
    size: 320,
    z: 1,
    rotation: -18,
  },
  {
    id: "leaf-L2",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "-3%", top: "30%" },
    anchored: false,
    size: 280,
    z: 1,
    rotation: 25,
  },
  {
    id: "leaf-L3",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "-7%", top: "55%" },
    anchored: false,
    size: 300,
    z: 1,
    rotation: -10,
  },
  {
    id: "leaf-L4",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "-4%", top: "78%" },
    anchored: false,
    size: 260,
    z: 1,
    rotation: 35,
  },

  // Mid layer — flowers
  {
    id: "lotus-L1",
    src: "/Landingpage/Lotus.png",
    style: { left: "-1%", top: "8%" },
    anchored: false,
    size: 155,
    z: 3,
    rotation: 12,
  },
  {
    id: "lotus-L2",
    src: "/Landingpage/Lotus.png",
    style: { left: "1%", top: "38%" },
    anchored: false,
    size: 130,
    z: 3,
    rotation: -8,
  },
  {
    id: "lotus-L3",
    src: "/Landingpage/Lotus.png",
    style: { left: "-2%", top: "68%" },
    anchored: false,
    size: 145,
    z: 3,
    rotation: 15,
  },
  {
    id: "lotus-L4",
    src: "/Landingpage/Lotus.png",
    style: { left: "0%", top: "88%" },
    anchored: false,
    size: 120,
    z: 3,
    rotation: -5,
  },

  // Anchored buds
  {
    id: "bud-L1",
    src: "/Landingpage/lotus_bud.png",
    style: { left: "5%", top: "22%" },
    anchored: true,
    size: 75,
    z: 4,
    rotation: -6,
  },
  {
    id: "bud-L2",
    src: "/Landingpage/lotus_bud.png",
    style: { left: "3%", top: "52%" },
    anchored: true,
    size: 65,
    z: 4,
    rotation: 8,
  },

  // Anchored pod
  {
    id: "pod-L1",
    src: "/Landingpage/Lotus_pod.png",
    style: { left: "6%", top: "82%" },
    anchored: true,
    size: 70,
    z: 4,
    rotation: -3,
  },

  // ══════════ RIGHT SIDE ══════════

  // Back layer — large leaves
  {
    id: "leaf-R1",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "-5%", top: "0%" },
    anchored: false,
    size: 310,
    z: 1,
    rotation: 22,
  },
  {
    id: "leaf-R2",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "-4%", top: "28%" },
    anchored: false,
    size: 270,
    z: 1,
    rotation: -20,
  },
  {
    id: "leaf-R3",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "-6%", top: "52%" },
    anchored: false,
    size: 290,
    z: 1,
    rotation: 15,
  },
  {
    id: "leaf-R4",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "-3%", top: "76%" },
    anchored: false,
    size: 250,
    z: 1,
    rotation: -30,
  },

  // Mid layer — flowers
  {
    id: "lotus-R1",
    src: "/Landingpage/Lotus.png",
    style: { right: "0%", top: "6%" },
    anchored: false,
    size: 150,
    z: 3,
    rotation: -14,
  },
  {
    id: "lotus-R2",
    src: "/Landingpage/Lotus.png",
    style: { right: "-1%", top: "35%" },
    anchored: false,
    size: 135,
    z: 3,
    rotation: 10,
  },
  {
    id: "lotus-R3",
    src: "/Landingpage/Lotus.png",
    style: { right: "0%", top: "64%" },
    anchored: false,
    size: 140,
    z: 3,
    rotation: -7,
  },
  {
    id: "lotus-R4",
    src: "/Landingpage/Lotus.png",
    style: { right: "1%", top: "90%" },
    anchored: false,
    size: 115,
    z: 3,
    rotation: 12,
  },

  // Anchored buds
  {
    id: "bud-R1",
    src: "/Landingpage/lotus_bud.png",
    style: { right: "4%", top: "18%" },
    anchored: true,
    size: 70,
    z: 4,
    rotation: 5,
  },
  {
    id: "bud-R2",
    src: "/Landingpage/lotus_bud.png",
    style: { right: "6%", top: "48%" },
    anchored: true,
    size: 60,
    z: 4,
    rotation: -9,
  },

  // Anchored pod
  {
    id: "pod-R1",
    src: "/Landingpage/Lotus_pod.png",
    style: { right: "5%", top: "78%" },
    anchored: true,
    size: 65,
    z: 4,
    rotation: 7,
  },

  // Inner banks — smaller pieces make the pond feel lush without covering copy
  {
    id: "leaf-L5",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "10%", top: "15%" },
    anchored: false,
    size: 190,
    z: 1,
    rotation: 38,
  },
  {
    id: "leaf-L6",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "8%", top: "44%" },
    anchored: false,
    size: 170,
    z: 1,
    rotation: -28,
  },
  {
    id: "leaf-L7",
    src: "/Landingpage/lotus_leaf.png",
    style: { left: "12%", top: "73%" },
    anchored: false,
    size: 185,
    z: 1,
    rotation: 17,
  },
  {
    id: "lotus-L5",
    src: "/Landingpage/Lotus.png",
    style: { left: "13%", top: "28%" },
    anchored: false,
    size: 96,
    z: 2,
    rotation: -12,
  },
  {
    id: "lotus-L6",
    src: "/Landingpage/Lotus.png",
    style: { left: "11%", top: "60%" },
    anchored: false,
    size: 105,
    z: 2,
    rotation: 19,
  },
  {
    id: "bud-L3",
    src: "/Landingpage/lotus_bud.png",
    style: { left: "17%", top: "86%" },
    anchored: true,
    size: 58,
    z: 3,
    rotation: 6,
  },
  {
    id: "pod-L2",
    src: "/Landingpage/Lotus_pod.png",
    style: { left: "16%", top: "7%" },
    anchored: true,
    size: 54,
    z: 3,
    rotation: -8,
  },
  {
    id: "leaf-R5",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "10%", top: "12%" },
    anchored: false,
    size: 185,
    z: 1,
    rotation: -34,
  },
  {
    id: "leaf-R6",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "8%", top: "42%" },
    anchored: false,
    size: 175,
    z: 1,
    rotation: 27,
  },
  {
    id: "leaf-R7",
    src: "/Landingpage/lotus_leaf.png",
    style: { right: "12%", top: "70%" },
    anchored: false,
    size: 190,
    z: 1,
    rotation: -16,
  },
  {
    id: "lotus-R5",
    src: "/Landingpage/Lotus.png",
    style: { right: "13%", top: "25%" },
    anchored: false,
    size: 100,
    z: 2,
    rotation: 13,
  },
  {
    id: "lotus-R6",
    src: "/Landingpage/Lotus.png",
    style: { right: "11%", top: "58%" },
    anchored: false,
    size: 92,
    z: 2,
    rotation: -18,
  },
  {
    id: "bud-R3",
    src: "/Landingpage/lotus_bud.png",
    style: { right: "17%", top: "84%" },
    anchored: true,
    size: 60,
    z: 3,
    rotation: -5,
  },
  {
    id: "pod-R2",
    src: "/Landingpage/Lotus_pod.png",
    style: { right: "16%", top: "5%" },
    anchored: true,
    size: 56,
    z: 3,
    rotation: 9,
  },
];

// ── Ripple ring data ─────────────────────────────────────────────────────
interface Ripple {
  x: number;
  y: number;
  birth: number;
  maxRadius: number;
}

// ── Pond water colors (clear teal) ───────────────────────────────────────
const POND_COLORS = {
  deep: "rgba(5, 42, 58, 0.96)",
  mid: "rgba(10, 78, 96, 0.9)",
  surface: "rgba(35, 126, 143, 0.82)",
  highlight: "rgba(76, 172, 181, 0.72)",
  shimmer: "rgba(148, 225, 218, 0.78)",
  wave1: "rgba(23, 104, 123, 0.42)",
  wave2: "rgba(35, 130, 143, 0.34)",
  wave3: "rgba(71, 157, 157, 0.28)",
  wave4: "rgba(120, 199, 188, 0.2)",
  ripple: "rgba(164, 232, 220, 0.46)",
};

// ── Water canvas ─────────────────────────────────────────────────────────
function useWaterCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  surgeProgress: number,
) {
  const ripplesRef = useRef<Ripple[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(0);
  const surgeRef = useRef(surgeProgress);

  // Keep surge value current without re-running effect
  surgeRef.current = surgeProgress;

  const addRipple = useCallback((x: number, y: number) => {
    ripplesRef.current.push({
      x,
      y,
      birth: performance.now(),
      maxRadius: 100 + Math.random() * 100,
    });
    if (ripplesRef.current.length > 14) {
      ripplesRef.current.shift();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d")!;
    let lastRippleTime = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;

      const now = performance.now();
      if (now - lastRippleTime > 150) {
        addRipple(mouseRef.current.x, mouseRef.current.y);
        lastRippleTime = now;
      }
    };

    container.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    const draw = (now: number) => {
      const t = now * 0.001;
      const { width, height } = container.getBoundingClientRect();
      const surge = surgeRef.current; // 0→1, how much the water has "risen"

      ctx.clearRect(0, 0, width, height);

      // ── Full pond water base fill ──
      // The water rises from the bottom as surge increases
      const waterTop = height * (1 - surge);

      if (surge > 0) {
        const crestHeight = 18 + (1 - surge) * 38;
        const surfaceY = (x: number) =>
          waterTop +
          Math.sin(x * 0.012 + t * 2.5) * crestHeight * 0.48 +
          Math.cos(x * 0.008 + t * 1.8 + 1) * crestHeight * 0.28 +
          Math.sin(x * 0.025 + t * 3.2) * crestHeight * 0.12;

        // Deep water gradient
        const baseGrad = ctx.createLinearGradient(0, waterTop, 0, height);
        baseGrad.addColorStop(0, POND_COLORS.surface);
        baseGrad.addColorStop(0.3, POND_COLORS.mid);
        baseGrad.addColorStop(1, POND_COLORS.deep);
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, surfaceY(0));
        for (let x = 3; x <= width; x += 3) {
          ctx.lineTo(x, surfaceY(x));
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // ── Surge wave crest at the top edge ──
        if (surge < 0.995) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, surfaceY(0));
          for (let x = 3; x <= width; x += 3) {
            ctx.lineTo(x, surfaceY(x));
          }
          ctx.strokeStyle = "rgba(173, 235, 226, 0.56)";
          ctx.lineWidth = 2.2;
          ctx.shadowColor = "rgba(115, 211, 204, 0.34)";
          ctx.shadowBlur = 16;
          ctx.stroke();
          ctx.restore();
        }

        // ── Ambient pond waves ──
        ctx.save();
        const waveColors = [
          POND_COLORS.wave1,
          POND_COLORS.wave2,
          POND_COLORS.wave3,
          POND_COLORS.wave4,
        ];

        for (let wave = 0; wave < 5; wave++) {
          const waveSpeed = 0.5 + wave * 0.2;
          const amplitude = (8 + wave * 5) * surge;
          const freq = 0.006 - wave * 0.0008;
          const baseY = waterTop + (height - waterTop) * (0.08 + wave * 0.18);

          ctx.beginPath();
          ctx.moveTo(0, height);

          for (let x = 0; x <= width; x += 3) {
            const y =
              baseY +
              Math.sin(x * freq + t * waveSpeed) * amplitude +
              Math.cos(x * freq * 1.4 + t * (waveSpeed * 0.7) + wave) *
                amplitude *
                0.5 +
              Math.sin(x * freq * 2.1 + t * (waveSpeed * 1.3) + wave * 2) *
                amplitude *
                0.2;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle =
            waveColors[wave] || `rgba(20, 60, 100, ${0.3 - wave * 0.05})`;
          ctx.globalAlpha = 0.5 + surge * 0.5;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // ── Surface light caustics ──
        ctx.save();
        ctx.globalAlpha = 0.06 * surge;
        for (let i = 0; i < 12; i++) {
          const cx =
            (width * (0.05 + i * 0.085) + Math.sin(t * 0.25 + i * 2.1) * 50) %
            width;
          const cy =
            waterTop +
            (height - waterTop) * (0.15 + Math.sin(t * 0.18 + i * 1.7) * 0.2) +
            Math.cos(t * 0.3 + i) * 25;
          const cr = 25 + Math.sin(t * 0.4 + i) * 18;

          const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
          cGrad.addColorStop(0, "rgba(100, 180, 220, 0.9)");
          cGrad.addColorStop(0.5, "rgba(70, 150, 200, 0.4)");
          cGrad.addColorStop(1, "rgba(50, 120, 170, 0)");
          ctx.fillStyle = cGrad;
          ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
        }
        ctx.restore();

        // ── Lily pad shadows (subtle dark ovals on water) ──
        ctx.save();
        ctx.globalAlpha = 0.04 * surge;
        for (let i = 0; i < 6; i++) {
          const px =
            width * (0.15 + i * 0.14) + Math.sin(t * 0.15 + i * 3) * 30;
          const py =
            waterTop +
            (height - waterTop) * (0.3 + i * 0.1) +
            Math.cos(t * 0.2 + i * 2) * 15;

          ctx.beginPath();
          ctx.ellipse(px, py, 35 + i * 5, 18 + i * 3, 0.3 + i * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(4, 15, 35, 0.8)";
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Ripple rings ──
      const alive: Ripple[] = [];
      for (const ripple of ripplesRef.current) {
        const age = (now - ripple.birth) / 1000;
        const lifetime = 2.8;
        if (age > lifetime) continue;
        alive.push(ripple);

        const progress = age / lifetime;
        const radius = ripple.maxRadius * progress;
        const alpha = (1 - progress) * 0.4;

        for (let ring = 0; ring < 3; ring++) {
          const r = radius - ring * 14;
          if (r < 0) continue;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 190, 230, ${alpha * (1 - ring * 0.3)})`;
          ctx.lineWidth = 2 - ring * 0.5;
          ctx.stroke();
        }
      }
      ripplesRef.current = alive;

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      container.removeEventListener("pointermove", handlePointerMove);
    };
  }, [canvasRef, containerRef, addRipple]);

  return { mouseRef, addRipple };
}

// ── Individual lotus element ─────────────────────────────────────────────
function LotusElement({
  item,
  mouseRef,
  surgeProgress,
}: {
  item: LotusItem;
  mouseRef: React.RefObject<{ x: number; y: number }>;
  surgeProgress: number;
}) {
  const elRef = useRef<HTMLImageElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const animRef = useRef(0);

  useEffect(() => {
    if (item.anchored) return;

    const el = elRef.current;
    if (!el) return;

    let prevTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      const parent = el.parentElement;
      if (!parent) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      const rect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      const cx = elRect.left - rect.left + elRect.width / 2;
      const cy = elRect.top - rect.top + elRect.height / 2;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      const dx = cx - mx;
      const dy = cy - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const maxInfluence = 220;
      const maxPush = 16;

      let targetX = 0;
      let targetY = 0;

      if (dist < maxInfluence && dist > 1) {
        const strength = (1 - dist / maxInfluence) * maxPush;
        targetX = (dx / dist) * strength;
        targetY = (dy / dist) * strength;
      }

      // ambient gentle sway
      const t = now * 0.001;
      const swayX =
        Math.sin(t * 0.35 + item.rotation) * 4 +
        Math.cos(t * 0.2 + item.size * 0.01) * 2.5;
      const swayY =
        Math.cos(t * 0.3 + item.rotation * 0.5) * 3 +
        Math.sin(t * 0.25 + item.size * 0.02) * 2;

      targetX += swayX;
      targetY += swayY;

      posRef.current.x += (targetX - posRef.current.x) * dt * 2.5;
      posRef.current.y += (targetY - posRef.current.y) * dt * 2.5;

      const rotSway = Math.sin(t * 0.3 + item.rotation) * 2.5;
      el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) rotate(${item.rotation + rotSway}deg)`;

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [item, mouseRef]);

  const anchoredStyle: React.CSSProperties = item.anchored
    ? {
        animation: `lotus-bob ${2.8 + Math.abs(item.rotation) * 0.08}s ease-in-out infinite alternate`,
      }
    : {};

  // Opacity tied to surge so lotus fades in with the water
  const surgeOpacity = Math.min(surgeProgress * 1.5, 1);
  const baseOpacity = item.z <= 1 ? 0.65 : item.z <= 3 ? 0.85 : 0.9;

  return (
    <img
      ref={elRef}
      src={item.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="lotus-pond-element"
      style={{
        position: "absolute",
        ...item.style,
        width: item.size,
        height: item.size,
        objectFit: "contain",
        zIndex: item.z,
        transform: `rotate(${item.rotation}deg)`,
        willChange: item.anchored ? "auto" : "transform",
        pointerEvents: "none",
        filter: `drop-shadow(0 6px 20px rgba(0,20,10,0.5)) ${
          item.z <= 1
            ? "brightness(0.6) saturate(0.75)"
            : item.z <= 3
              ? "brightness(0.85) saturate(0.9)"
              : "brightness(0.9)"
        }`,
        opacity: baseOpacity * surgeOpacity,
        ...anchoredStyle,
      }}
    />
  );
}

// ── Main component ───────────────────────────────────────────────────────
export function LotusPond({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [surgeProgress, setSurgeProgress] = useState(0);

  const { mouseRef } = useWaterCanvas(canvasRef, containerRef, surgeProgress);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSurgeProgress(1);
      return;
    }

    const progress = { value: 0 };
    const tween = gsap.to(progress, {
      value: 1,
      ease: "none",
      onUpdate: () => setSurgeProgress(progress.value),
      scrollTrigger: {
        trigger: container,
        start: "top bottom",
        end: "top top",
        scrub: 0.35,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="lotus-pond-container lotus-pond-visible"
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Clear pond base, clipped to the same scroll-linked waterline */}
      <div
        className="lotus-pond-base"
        style={{
          clipPath: `inset(calc(${(1 - surgeProgress) * 100}% + ${(1 - surgeProgress) * 46}px) 0 0)`,
        }}
        aria-hidden="true"
      />

      {/* Water canvas layer */}
      <canvas
        ref={canvasRef}
        className="lotus-pond-canvas"
        aria-hidden="true"
      />

      {/* Lotus elements */}
      <div className="lotus-pond-elements" aria-hidden="true">
        {LOTUS_ITEMS.map((item) => (
          <LotusElement
            key={item.id}
            item={item}
            mouseRef={mouseRef}
            surgeProgress={surgeProgress}
          />
        ))}
      </div>

      {/* Content — elevated above the pond */}
      <div className="lotus-pond-content">
        <div className="lotus-pond-rise" aria-hidden="true" />
        {children}
      </div>

      {/* Edge fade — blend into surrounding sections */}
      <div
        className="lotus-pond-edge-fade"
        style={{ opacity: surgeProgress }}
        aria-hidden="true"
      />
    </div>
  );
}
