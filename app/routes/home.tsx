import React, { useCallback, useRef, useState, useEffect } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";

import { SiteHeader } from "~/components/marketing/site-header";
import { SiteFooter } from "~/components/marketing/site-footer";
import {
  HeroSequence,
  TOTAL_EXTRA_VH,
  type HeroSequenceProgress,
} from "~/components/landing/hero-sequence";
import {
  RoomContent,
  type RoomContentHandle,
} from "~/components/landing/room-content";
import { ScrollIndicator } from "~/components/landing/scroll-indicator";
import { FeatureOverview } from "~/components/landing/feature-cards";
import { ComparisonSection } from "~/components/landing/comparison-section";
import { LotusPond } from "~/components/landing/lotus-pond";
import { WhatsNewSection } from "~/components/landing/whats-new-section";
import { FinalCTA } from "~/components/landing/final-cta";

import { getOptionalUser } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";
import type { SessionUser } from "~/lib/session.server";

import "~/styles/landing.css";

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await getOptionalUser(request, log);
  return { user };
}

// Must match TOTAL_EXTRA_VH in hero-sequence (7 frames × 1.3 = 9.1)
export function meta(_: Route.MetaArgs) {
  return [
    { title: "Kuvox — AI-Driven Video Editing" },
    {
      name: "description",
      content:
        "Edit video by describing what you want, in plain language. Kuvox understands your footage and lets you create precision edits automatically.",
    },
    {
      property: "og:title",
      content: "Kuvox — AI-Driven Video Editing",
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
      content: "Kuvox — AI-Driven Video Editing",
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

function Preloader() {
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fading out after 1.5s
    const fadeTimer = setTimeout(() => setFading(true), 1500);
    // Remove from DOM after transition completes (1.5s + 0.5s)
    const removeTimer = setTimeout(() => setLoading(false), 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!loading) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1612] transition-opacity duration-500 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <img src="/logo.svg" alt="Kuvox" className="h-8 animate-pulse brightness-150" />
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full w-1/3 bg-white/80 rounded-full animate-[progress_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes progress {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const { user } = useLoaderData() as { user: SessionUser | null };
  const [heroSequenceVisible, setHeroSequenceVisible] = useState(true);
  const [pondPortalActive, setPondPortalActive] = useState(false);
  const roomContentRef = useRef<RoomContentHandle>(null);

  const handleSequenceProgress = useCallback((state: HeroSequenceProgress) => {
    roomContentRef.current?.updateSequence(state);
  }, []);

  return (
    <main className="landing-demo relative overflow-x-hidden bg-[#1a1612] text-white">
      <Preloader />
      
      {/* Floating glass navigation */}
      <SiteHeader user={user} />

      {/* Scroll-driven museum image sequence */}
      <HeroSequence
        onProgressChange={handleSequenceProgress}
        onVisibilityChange={setHeroSequenceVisible}
      />

      {/* Room text overlay — only visible during hero scroll */}
      <RoomContent ref={roomContentRef} visible={heroSequenceVisible && !pondPortalActive} />

      {/* Scroll progress hint */}
      <ScrollIndicator heroVh={TOTAL_EXTRA_VH} />

      {/* Below-the-fold content */}
      <div className="lotus-pond-stage relative z-20 overflow-hidden">
        <LotusPond
          transitionImageSrc="/Landingpage/7.jpg"
          onPortalActiveChange={setPondPortalActive}
        >
          <FeatureOverview />
          <ComparisonSection />
        </LotusPond>
        {/* Gradient bridge — smooths the visual transition into What's New */}
        <div
          className="relative z-20 h-12 bg-gradient-to-b from-transparent to-[#0c0c0e]"
          aria-hidden="true"
        />
        <div className="relative z-20 bg-[#0c0c0e]">
          <WhatsNewSection />
        </div>
      </div>
      <FinalCTA />
      
      {/* 
        Wrap footer in a div that applies the dark theme properly 
        because SiteFooter uses surface-container-lowest which might be light
      */}
      <div className="bg-[#0a0a0a]">
        <SiteFooter />
      </div>
    </main>
  );
}
