import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const releases = [
  {
    title: "AI Scene Detection",
    description:
      "Automatically detects scene changes and organizes footage into editable segments.",
    tag: "Smart Timeline",
    image: "/Landingpage/WN1.png",
  },
  {
    title: "Smart Subtitle Studio",
    description:
      "Generate, edit, and style multilingual subtitles with one seamless workflow.",
    tag: "Captions",
    image: "/Landingpage/WN2.png",
  },
  {
    title: "AI Object Tracking",
    description:
      "Track people or objects automatically for masks, effects, and motion graphics.",
    tag: "Motion",
    image: "/Landingpage/WN4.png",
  },
  {
    title: "Brand Kit Sync",
    description:
      "Keep fonts, colors, logos, and templates consistent across every project.",
    tag: "Branding",
    image: "/Landingpage/WN3.png",
  },
  {
    title: "Collaborative Review",
    description:
      "Share projects, collect timestamped feedback, and approve edits in one place.",
    tag: "Teamwork",
    image: "/Landingpage/WN5.jpg",
  },
] as const;

const spring = { type: "spring" as const, stiffness: 220, damping: 26 };

/* ═══════════════════════════════════════════════════════════════════════════
   Feature detail widgets — one per release
   All widgets use the same outer shell for equal height
   ═══════════════════════════════════════════════════════════════════════════ */

function SceneDetectionWidget() {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          Detected <span className="text-[#F6C66A]">128 scenes</span>
        </h3>
        <div className="rounded-full border border-[#F6C66A]/20 bg-[#F6C66A]/10 px-3 py-1 text-xs text-[#F6C66A]">
          98% accuracy
        </div>
      </div>

      {/* Timeline visual */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
        <div className="flex h-[90px] items-end gap-[2px] px-3 py-2.5">
          {[38,62,28,55,72,40,85,30,68,50,35,78,45,60,25,70,48,58,33,65,42,75,52,44,67,36,80,46,55,39].map(
            (h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-300"
                style={{
                  height: `${h}%`,
                  backgroundColor:
                    i % 7 === 0
                      ? "rgba(246,198,106,0.8)"
                      : "rgba(255,255,255,0.12)",
                }}
              />
            )
          )}
        </div>
      </div>

      {/* Markers */}
      <div className="relative mt-2 h-7">
        <div className="absolute top-3 h-[2px] w-full bg-white/10" />
        {[0, 25, 50, 75, 100].map((v) => (
          <div key={v} className="absolute top-[6px]" style={{ left: `${v}%` }}>
            <div className="h-3 w-[2px] bg-[#F6C66A]" />
          </div>
        ))}
        <div className="mt-4 flex justify-between text-[10px] text-white/40">
          <span>00:00</span><span>00:24</span><span>00:48</span><span>01:12</span><span>01:36</span>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-4 flex flex-col justify-center space-y-4 border-t border-white/5 pt-5">
        <div>
          <p className="text-sm font-medium text-white">1. Instant scene cuts</p>
          <p className="mt-0.5 text-xs text-white/50">Find every change in a fraction of the time.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">2. Smart grouping</p>
          <p className="mt-0.5 text-xs text-white/50">Keep related shots together automatically.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">3. Fully editable</p>
          <p className="mt-0.5 text-xs text-white/50">Fine-tune every segment on your timeline.</p>
        </div>
      </div>

      {/* Callout */}
      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6C66A]/10 text-xs text-[#F6C66A]">✦</div>
            <div>
              <p className="text-sm font-medium text-[#F6C66A]">Save hours in your edit.</p>
              <p className="text-xs text-white/50">Focus on storytelling, not searching.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SubtitleStudioWidget() {
  const langs = [
    { flag: "🇺🇸", name: "English", progress: 100 },
    { flag: "🇻🇳", name: "Vietnamese", progress: 92 },
    { flag: "🇯🇵", name: "Japanese", progress: 87 },
    { flag: "🇰🇷", name: "Korean", progress: 78 },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          Subtitle <span className="text-[#73b7ff]">Studio</span>
        </h3>
        <div className="rounded-full border border-[#73b7ff]/20 bg-[#73b7ff]/10 px-3 py-1 text-xs text-[#73b7ff]">
          4 languages
        </div>
      </div>

      {/* Visuals: 2 columns */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Subtitle preview */}
        <div className="flex flex-col justify-center space-y-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="rounded-lg bg-[#73b7ff]/10 px-3.5 py-2.5">
            <p className="text-[11px] text-white/40">00:12 — 00:16</p>
            <p className="mt-0.5 text-sm text-white">&quot;The future of editing starts here.&quot;</p>
          </div>
          <div className="rounded-lg bg-white/[0.04] px-3.5 py-2.5">
            <p className="text-[11px] text-white/40">00:16 — 00:20</p>
            <p className="mt-0.5 text-sm text-white/70">&quot;Every frame tells a story.&quot;</p>
          </div>
        </div>

        {/* Language progress */}
        <div className="flex flex-col justify-center space-y-2.5">
          {langs.map((lang) => (
            <div key={lang.name} className="flex items-center gap-2">
              <span className="text-base">{lang.flag}</span>
              <span className="w-16 text-[11px] text-white/60">{lang.name}</span>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#73b7ff] transition-all duration-500" style={{ width: `${lang.progress}%` }} />
                </div>
              </div>
              <span className="text-[10px] text-white/40">{lang.progress}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features List */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
        <div>
          <p className="text-sm font-medium text-white">Auto-translation</p>
          <p className="mt-0.5 text-[11px] text-white/50">Translate to 40+ languages instantly.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Perfect sync</p>
          <p className="mt-0.5 text-[11px] text-white/50">AI aligns text to speech automatically.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Custom styling</p>
          <p className="mt-0.5 text-[11px] text-white/50">Match fonts and colors to your brand.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Export anywhere</p>
          <p className="mt-0.5 text-[11px] text-white/50">Burn-in or export as SRT/VTT.</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#73b7ff]/10 text-xs text-[#73b7ff]">✦</div>
            <div>
              <p className="text-sm font-medium text-[#73b7ff]">Reach every audience.</p>
              <p className="text-xs text-white/50">One workflow for global subtitle delivery.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ObjectTrackingWidget() {
  const tracks = [
    { label: "Person A", color: "#b89cff", x: 72, y: 35 },
    { label: "Person B", color: "#63d9a8", x: 28, y: 50 },
    { label: "Object", color: "#F6C66A", x: 55, y: 68 },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          Object <span className="text-[#b89cff]">Tracking</span>
        </h3>
        <div className="rounded-full border border-[#b89cff]/20 bg-[#b89cff]/10 px-3 py-1 text-xs text-[#b89cff]">
          3 targets locked
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Tracking visual */}
        <div className="relative h-full min-h-[130px] overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
          <div className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {tracks.map((track) => (
            <div key={track.label} className="absolute flex flex-col items-center" style={{ left: `${track.x}%`, top: `${track.y}%`, transform: "translate(-50%, -50%)" }}>
              <div className="h-6 w-6 rounded-full border-2 shadow-lg" style={{ borderColor: track.color, boxShadow: `0 0 12px ${track.color}44`, background: `${track.color}15` }} />
              <span className="mt-0.5 text-[9px] font-medium" style={{ color: track.color }}>{track.label}</span>
            </div>
          ))}
          <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.15 }}>
            <line x1="72%" y1="35%" x2="28%" y2="50%" stroke="#b89cff" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="28%" y1="50%" x2="55%" y2="68%" stroke="#63d9a8" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Tracks list */}
        <div className="flex flex-col justify-center space-y-2">
          {tracks.map((track) => (
            <div key={track.label} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
              <span className="flex-1 text-[11px] text-white/70">{track.label}</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: track.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Features List */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
        <div>
          <p className="text-sm font-medium text-white">Multi-target</p>
          <p className="mt-0.5 text-[11px] text-white/50">Track up to 10 objects simultaneously.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Sub-pixel precision</p>
          <p className="mt-0.5 text-[11px] text-white/50">Maintains lock even behind obstacles.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Text & Graphics</p>
          <p className="mt-0.5 text-[11px] text-white/50">Pin elements to tracked motion paths.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Auto-masking</p>
          <p className="mt-0.5 text-[11px] text-white/50">Generate dynamic masks in one click.</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b89cff]/10 text-xs text-[#b89cff]">✦</div>
            <div>
              <p className="text-sm font-medium text-[#b89cff]">Pin effects to motion.</p>
              <p className="text-xs text-white/50">Masks and graphics follow automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function BrandKitWidget() {
  const colors = ["#F6C66A", "#73b7ff", "#b89cff", "#63d9a8", "#ff7eb3", "#1a1a1a"];

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          Brand <span className="text-[#63d9a8]">Kit</span>
        </h3>
        <div className="rounded-full border border-[#63d9a8]/20 bg-[#63d9a8]/10 px-3 py-1 text-xs text-[#63d9a8]">
          Synced
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Color palette */}
        <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="mb-3 text-[11px] font-medium text-white/50">Color Palette</p>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((color) => (
              <div key={color} className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-full rounded-md border border-white/10" style={{ backgroundColor: color }} />
                <span className="text-[8px] uppercase text-white/30">{color}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="mb-3 text-[11px] font-medium text-white/50">Typography</p>
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-white">Heading</span>
              <span className="text-[9px] text-white/30">Inter Bold 32px</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-white/70">Body text</span>
              <span className="text-[9px] text-white/30">Inter Regular 16px</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-white/50">Caption</span>
              <span className="text-[9px] text-white/30">Inter Medium 12px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
        <div>
          <p className="text-sm font-medium text-white">Global sync</p>
          <p className="mt-0.5 text-[11px] text-white/50">Update once, apply everywhere.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Cloud assets</p>
          <p className="mt-0.5 text-[11px] text-white/50">All logos and templates in one place.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Team access</p>
          <p className="mt-0.5 text-[11px] text-white/50">Control who can edit brand rules.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Smart adapt</p>
          <p className="mt-0.5 text-[11px] text-white/50">Auto-adjusts for light/dark themes.</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#63d9a8]/10 text-xs text-[#63d9a8]">✦</div>
            <div>
              <p className="text-sm font-medium text-[#63d9a8]">Always on-brand.</p>
              <p className="text-xs text-white/50">Every project stays consistent, automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CollaborativeReviewWidget() {
  const reviewers = [
    { name: "Sarah", avatar: "S", status: "approved", time: "2m ago" },
    { name: "Mike", avatar: "M", status: "comment", time: "5m ago" },
    { name: "Lisa", avatar: "L", status: "pending", time: "—" },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          Team <span className="text-[#ff7eb3]">Review</span>
        </h3>
        <div className="rounded-full border border-[#ff7eb3]/20 bg-[#ff7eb3]/10 px-3 py-1 text-xs text-[#ff7eb3]">
          In progress
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Reviewers */}
        <div className="flex flex-col justify-center space-y-2">
          {reviewers.map((r) => (
            <div key={r.name} className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff7eb3]/15 text-[10px] font-medium text-[#ff7eb3]">{r.avatar}</div>
              <div className="flex-1">
                <p className="text-[11px] font-medium text-white/80">{r.name}</p>
                <p className="text-[9px] text-white/35">{r.time}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                r.status === "approved" ? "bg-[#63d9a8]/15 text-[#63d9a8]"
                  : r.status === "comment" ? "bg-[#F6C66A]/15 text-[#F6C66A]"
                    : "bg-white/10 text-white/40"
              }`}>
                {r.status === "approved" ? "✓" : r.status === "comment" ? "💬" : "..."}
              </span>
            </div>
          ))}
        </div>

        {/* Comment */}
        <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-start gap-2.5">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F6C66A]/15 text-[9px] font-medium text-[#F6C66A]">M</div>
            <div>
              <p className="text-[10px] leading-4 text-white/70">
                &quot;Love the color grading at 01:24 — can we extend that look to the outro?&quot;
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[9px] text-white/35">
                <span className="rounded bg-white/10 px-1 py-0.5 text-white/50">@ 01:24</span>
                5m ago
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
        <div>
          <p className="text-sm font-medium text-white">Timestamped</p>
          <p className="mt-0.5 text-[11px] text-white/50">Comments pinned to exact frames.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Draw on screen</p>
          <p className="mt-0.5 text-[11px] text-white/50">Visual feedback directly on the video.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Version control</p>
          <p className="mt-0.5 text-[11px] text-white/50">Compare edits side-by-side easily.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Instant notify</p>
          <p className="mt-0.5 text-[11px] text-white/50">Ping reviewers via email or Slack.</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff7eb3]/10 text-xs text-[#ff7eb3]">✦</div>
            <div>
              <p className="text-sm font-medium text-[#ff7eb3]">One place, every voice.</p>
              <p className="text-xs text-white/50">No more scattered email threads.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const DETAIL_WIDGETS = [
  SceneDetectionWidget,
  SubtitleStudioWidget,
  ObjectTrackingWidget,
  BrandKitWidget,
  CollaborativeReviewWidget,
];

/* ═══════════════════════════════════════════════════════════════════════════
   Main section
   ═══════════════════════════════════════════════════════════════════════════ */

export function WhatsNewSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const selectCard = useCallback((index: number) => {
    const nextIndex = (index + releases.length) % releases.length;
    setActiveIndex(nextIndex);
  }, []);

  // ── Scroll entrance animation ──────────────────────────────────────────
  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    const content = contentRef.current;
    const controls = controlsRef.current;
    if (!section || !header || !content || !controls) return;

    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Header slides up
        gsap.from(header, {
          y: 60,
          opacity: 0,
          duration: 1,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: section, start: "top 80%" },
        });

        // Main content (image + widget) slides up with slight delay
        gsap.from(content, {
          y: 80,
          opacity: 0,
          duration: 1.1,
          delay: 0.15,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: section, start: "top 80%" },
        });

        // Controls fade in
        gsap.from(controls, {
          y: 30,
          opacity: 0,
          duration: 0.9,
          delay: 0.3,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: section, start: "top 80%" },
        });
      });
    }, section);

    return () => {
      media.revert();
      ctx.revert();
    };
  }, []);

  const activeRelease = releases[activeIndex];
  const ActiveWidget = DETAIL_WIDGETS[activeIndex];

  return (
    <section
      ref={sectionRef}
      className="relative z-20 flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 py-10 lg:px-12"
      aria-labelledby="whats-new-title"
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* ── Header row ─────────────────────────────────────────── */}
        <div ref={headerRef} className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="whats-new-title" className="heading-md mb-3 text-white">
              What&apos;s new
            </h2>

          </div>

          {/* Numbered selectors and controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" aria-label="Choose an update">
              {releases.map((release, index) => (
                <button
                  key={release.title}
                  type="button"
                  onClick={() => selectCard(index)}
                  className="relative grid h-10 w-10 place-items-center rounded-full text-sm font-medium text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label={`Show ${release.title}`}
                  aria-pressed={activeIndex === index}
                >
                  {activeIndex === index && (
                    <motion.span
                      layoutId="whats-new-indicator"
                      className="absolute inset-0 rounded-full bg-white/15 backdrop-blur-md"
                      transition={reducedMotion ? { duration: 0 } : spring}
                    />
                  )}
                  <span className="relative">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-l border-white/15 pl-4">
              <button
                type="button"
                onClick={() => selectCard(activeIndex - 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Previous feature"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => selectCard(activeIndex + 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Next feature"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content: image + detail widget ────────────── */}
        <div ref={contentRef} className="grid items-stretch gap-6 lg:grid-cols-[360px_1fr] lg:gap-8">
          {/* Image panel — portrait */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#100e0c] sm:aspect-[9/14] lg:aspect-auto lg:self-stretch">
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={activeRelease.image}
                src={activeRelease.image}
                alt={`${activeRelease.title} feature preview`}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                }
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

            <div className="absolute left-5 top-5 flex items-center gap-3 text-xs font-medium text-white/80">
              <span>{String(activeIndex + 1).padStart(2, "0")}</span>
              <span className="h-px w-6 bg-white/45" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={activeRelease.tag}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                >
                  {activeRelease.tag}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeRelease.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h3 className="text-xl font-medium tracking-[-0.02em] text-white sm:text-2xl">
                    {activeRelease.title}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-white/60">
                    {activeRelease.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Detail widget panel — fixed height shell for equal sizing */}
          <div className="min-h-0 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col rounded-[24px] border border-white/10 bg-[#141414] p-6 shadow-2xl backdrop-blur-xl"
              >
                <ActiveWidget />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Bottom controls ────────────────────────────────── */}
        <div ref={controlsRef} className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {releases.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectCard(index)}
                className="group relative h-1.5 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/60"
                style={{ width: activeIndex === index ? 32 : 8 }}
                aria-label={`Go to slide ${index + 1}`}
              >
                <span
                  className="block h-full rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: activeIndex === index ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
