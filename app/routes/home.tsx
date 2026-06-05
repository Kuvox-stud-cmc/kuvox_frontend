import { Link } from "react-router";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Kuvox — AI-Driven Video Editing" },
    {
      name: "description",
      content:
        "Edit video by describing what you want, in plain language. Kuvox understands your footage and lets you create precision edits automatically.",
    },
  ];
}

export default function Home() {
  return (
    <>
      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-8 mb-16 sm:mb-24 lg:mb-32 relative z-10 w-full">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-display font-semibold text-on-surface max-w-3xl mx-auto tracking-tight leading-tight mt-4">
          Edit video by describing what you want, in plain language.
        </h1>

        <p className="text-body-lg sm:text-headline-md text-on-surface-variant max-w-2xl mx-auto font-normal px-2">
          Kuvox understands your footage. Skip the timeline and just type to
          create precision edits, automatically.
        </p>

        {/* CTAs */}
        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0">
          <Link
            to="/signup"
            className="bg-primary text-on-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-primary-fixed transition-all hover:scale-105 shadow-[0_0_20px_rgba(192,193,255,0.2)] text-center"
          >
            Get started
          </Link>
          <button className="border border-outline-variant text-on-surface px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-surface-container-high transition-colors">
            View Demo
          </button>
          <Link to="/mobile" className="border border-outline-variant text-on-surface px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-surface-container-high transition-colors text-center flex flex-col md:flex-row items-center gap-2">
            Download
            <span className="text-xs sm:text-sm text-on-surface-variant">
              Available on android
            </span>
          </Link>
        </div>

        {/* ── Interface Preview Mockup ──────────────────────────────────── */}
        <div className="mt-8 sm:mt-12 lg:mt-16 w-full max-w-5xl mx-auto aspect-video rounded-lg sm:rounded-xl border border-outline-variant bg-surface-container-low shadow-2xl overflow-hidden relative flex flex-col">
          {/* Mock Window Chrome */}
          <div className="h-7 sm:h-10 border-b border-outline-variant flex items-center px-2.5 sm:px-4 gap-1.5 sm:gap-2 bg-surface">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-surface-container-highest" />
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-surface-container-highest" />
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-surface-container-highest" />
          </div>

          {/* Mock Interface Body */}
          <div className="flex-grow flex relative">
            {/* Sidebar Skeleton — hidden below md */}
            <div className="w-40 lg:w-64 border-r border-outline-variant bg-surface-container-lowest p-3 lg:p-4 hidden md:block">
              <div className="h-3 lg:h-4 w-20 lg:w-24 bg-surface-variant rounded-sm mb-4 lg:mb-6" />
              <div className="space-y-2 lg:space-y-3">
                <div className="h-2.5 lg:h-3 w-full bg-surface-container rounded-sm" />
                <div className="h-2.5 lg:h-3 w-5/6 bg-surface-container rounded-sm" />
                <div className="h-2.5 lg:h-3 w-4/6 bg-surface-container rounded-sm" />
              </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-grow bg-surface relative flex flex-col">
              <div className="flex-grow bg-surface-container relative">
                <img
                  alt="Cinematic cyberpunk city preview"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
                  src="/hero-preview.png"
                />
              </div>

              {/* Command Bar Overlay — responsive sizing */}
              <div className="absolute bottom-2 sm:bottom-4 lg:bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-lg bg-surface-container-high/80 border border-outline-variant rounded-full px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 flex justify-between items-center gap-2 sm:gap-3 lg:gap-4 shadow-2xl backdrop-blur-md">
                <span className="material-symbols-outlined text-primary text-[18px] sm:text-[22px] lg:text-[24px] shrink-0">
                  magic_button
                </span>
                <span className="text-[10px] sm:text-label-md lg:text-body-sm text-on-surface truncate">
                  &ldquo;Remove the awkward silence and color grade for
                  dusk&rdquo;
                </span>
                <div className="w-px h-4 sm:h-5 lg:h-6 bg-outline-variant mx-0.5 sm:mx-1 lg:mx-2 shrink-0" />
                <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors text-[18px] sm:text-[22px] lg:text-[24px] shrink-0">
                  send
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid ────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto w-full z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-element-gap">
          {/* Feature 1: Semantic Understanding */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-4 sm:mb-6">
              <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]">
                visibility
              </span>
            </div>
            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-2 sm:mb-3">
              Semantic Understanding
            </h3>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant mb-4 sm:mb-6">
              The system analyzes and knows exactly what&apos;s in your footage.
              It recognizes objects, emotions, and pacing automatically.
            </p>

            {/* Visualization */}
            <div className="mt-auto pt-4 sm:pt-6 border-t border-outline-variant/50 relative">
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm bg-surface-container text-label-sm font-semibold text-on-surface-variant">
                  Person
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm bg-surface-container text-label-sm font-semibold text-on-surface-variant">
                  Running
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm bg-surface-container text-label-sm font-semibold text-on-surface-variant">
                  Golden Hour
                </span>
              </div>
              <div className="h-1 w-full bg-surface-container rounded-sm overflow-hidden">
                <div className="h-full bg-primary/30 w-1/3 ml-[25%]" />
              </div>
            </div>
          </div>

          {/* Feature 2: Natural Language Edits */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-4 sm:mb-6">
              <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]">
                chat
              </span>
            </div>
            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-2 sm:mb-3">
              Natural Language Edits
            </h3>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant mb-4 sm:mb-6">
              Just type what you want. &ldquo;Cut to the wide shot when she
              smiles&rdquo; or &ldquo;Make this look like an old film&rdquo;.
            </p>

            {/* Terminal Visualization */}
            <div className="mt-auto pt-4 sm:pt-6 border-t border-outline-variant/50">
              <div className="bg-surface-container-high border border-outline-variant rounded-sm p-2.5 sm:p-3 text-label-md sm:text-body-sm text-on-surface font-mono">
                &gt; Cut to the drone shot at 0:15
                <span className="inline-block w-1.5 sm:w-2 h-3.5 sm:h-4 bg-primary animate-cursor-blink align-middle ml-1" />
              </div>
            </div>
          </div>

          {/* Feature 3: Smart Suggestions */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors sm:col-span-2 lg:col-span-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-4 sm:mb-6">
              <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]">
                auto_awesome
              </span>
            </div>
            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-2 sm:mb-3">
              Smart Suggestions
            </h3>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant mb-4 sm:mb-6">
              Kuvox predicts your next move, offering automatic follow-up edits,
              audio sweetening, and pacing adjustments.
            </p>

            {/* Suggestions Visualization */}
            <div className="mt-auto pt-4 sm:pt-6 border-t border-outline-variant/50">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-sm bg-surface-container-high border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-[14px] sm:text-[16px] shrink-0">
                    check_circle
                  </span>
                  <span className="text-label-sm sm:text-label-md font-medium text-on-surface">
                    Normalize audio levels
                  </span>
                </div>
                <div className="flex items-center gap-2 p-1.5 sm:p-2 rounded-sm bg-surface border border-outline-variant opacity-50">
                  <span className="material-symbols-outlined text-on-surface-variant text-[14px] sm:text-[16px] shrink-0">
                    radio_button_unchecked
                  </span>
                  <span className="text-label-sm sm:text-label-md font-medium text-on-surface-variant">
                    Add cinematic letterbox
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
