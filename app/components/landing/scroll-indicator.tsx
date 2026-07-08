import React, { useState, useEffect } from "react";

interface ScrollIndicatorProps {
  heroVh: number;
}

export function ScrollIndicator({ heroVh }: ScrollIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const heroHeight = window.innerHeight * heroVh;

    const onScroll = () => {
      const scrolled = window.scrollY;
      const heroScrollable = heroHeight - window.innerHeight;
      const p = Math.min(scrolled / heroScrollable, 1);
      setProgress(p * 100);
      setVisible(scrolled < heroScrollable * 0.98);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroVh]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(12,10,8,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "999px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Progress track */}
        <div
          style={{
            width: "64px",
            height: "2px",
            background: "rgba(255,255,255,0.12)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "rgba(255,255,255,0.7)",
              borderRadius: "2px",
              transition: "width 0.1s linear",
            }}
          />
        </div>

        {/* Scroll hint */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "scrollBounce 1.6s ease-in-out infinite" }}
          >
            <path d="m5 9 7 7 7-7" />
          </svg>
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Scroll
          </span>
        </div>
      </div>

      <style>{`
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
      `}</style>
    </div>
  );
}
