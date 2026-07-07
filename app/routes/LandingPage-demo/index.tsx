import React, { useCallback, useRef, useState } from "react";
import { GlassNav } from "./components/glass-nav";
import {
  HeroSequence,
  TOTAL_EXTRA_VH,
  type HeroSequenceProgress,
} from "./components/hero-sequence";
import {
  RoomContent,
  type RoomContentHandle,
} from "./components/room-content";
import { ScrollIndicator } from "./components/scroll-indicator";
import { FeatureOverview } from "./components/feature-cards";
import { ComparisonSection } from "./components/comparison-section";
import { CursorParallaxDots } from "./components/cursor-parallax-dots";
import { WhatsNewSection } from "./components/whats-new-section";
import { FinalCTA } from "./components/final-cta";
import { Footer } from "./components/footer";
import "./landing.css";

// Must match TOTAL_EXTRA_VH in hero-sequence (7 frames × 1.3 = 9.1)
export function meta() {
  return [
    { title: "KUVOX — AI-Powered Video & Image Editing" },
    {
      name: "description",
      content:
        "Professional editing workspace for creators, teams and studios. Edit video and images with AI assistance while keeping every creative decision in your hands.",
    },
    {
      property: "og:title",
      content: "KUVOX — AI-Powered Video & Image Editing",
    },
    {
      property: "og:description",
      content:
        "Professional editing workspace for creators, teams and studios.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "KUVOX — AI-Powered Video & Image Editing",
    },
    {
      name: "twitter:description",
      content:
        "Professional editing workspace for creators, teams and studios.",
    },
  ];
}

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap",
  },
];

export default function LandingPageDemo() {
  const [heroVisible, setHeroVisible] = useState(true);
  const roomContentRef = useRef<RoomContentHandle>(null);

  const handleSequenceProgress = useCallback((state: HeroSequenceProgress) => {
    roomContentRef.current?.updateSequence(state);
  }, []);

  return (
    <main className="landing-demo relative overflow-x-hidden">
      {/* Floating glass navigation */}
      <GlassNav />

      {/* Scroll-driven museum image sequence */}
      <HeroSequence
        onProgressChange={handleSequenceProgress}
        onVisibilityChange={setHeroVisible}
      />

      {/* Room text overlay — only visible during hero scroll */}
      <RoomContent ref={roomContentRef} visible={heroVisible} />

      {/* Scroll progress hint */}
      <ScrollIndicator heroVh={TOTAL_EXTRA_VH} />

      {/* Below-the-fold content */}
      <div className="post-museum-stage relative z-20 -mt-20 overflow-hidden sm:-mt-28">
        <div className="relative overflow-hidden">
          <CursorParallaxDots />
          <div className="relative z-10">
            <FeatureOverview />
            <ComparisonSection />
          </div>
        </div>
        <div className="relative z-20 bg-[#0c0c0e]">
          <WhatsNewSection />
        </div>
      </div>
      <FinalCTA />
      <Footer />
    </main>
  );
}
