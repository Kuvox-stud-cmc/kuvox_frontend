import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    title: "Timeline Editing",
    description:
      "Multi-track editing with ripple edits, precision trimming, and instant preview.",
    detail: "60fps real-time playback",
    visual: "timeline",
    span: "lg:col-span-5",
    accent: "#e4c77f",
  },
  {
    title: "Color Grading",
    description:
      "HDR support, curves, LUTs, scopes, and professional color matching tools.",
    detail: "10-bit color depth",
    visual: "color",
    span: "lg:col-span-7",
    accent: "#73b7ff",
  },
  {
    title: "Audio Suite",
    description:
      "Noise reduction, voice isolation, EQ, compressor, and multi-track mixing.",
    detail: "48kHz studio audio",
    visual: "audio",
    span: "lg:col-span-7",
    accent: "#b89cff",
  },
  {
    title: "AI Assistance",
    description:
      "Object removal, smart masking, auto reframing, and content-aware fill.",
    detail: "Up to 10× faster",
    visual: "ai",
    span: "lg:col-span-5",
    accent: "#63d9a8",
  },
] as const;

function FeatureVisual({ type, accent }: { type: string; accent: string }) {
  if (type === "timeline") {
    return (
      <div className="mt-10 space-y-2" aria-hidden="true">
        {[82, 64, 92].map((width, row) => (
          <div key={width} className="flex h-3 gap-1.5" style={{ width: `${width}%` }}>
            {Array.from({ length: row + 4 }).map((_, index) => (
              <span
                key={index}
                className="h-full flex-1 rounded-[3px]"
                style={{
                  backgroundColor:
                    index === row + 1 ? accent : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === "color") {
    return (
      <div className="mt-8 flex items-end justify-between gap-5" aria-hidden="true">
        <div className="flex -space-x-3">
          {["#e4c77f", "#73b7ff", "#b89cff", "#63d9a8"].map((color) => (
            <span
              key={color}
              className="h-14 w-14 rounded-full ring-4 ring-[#121214]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <svg className="h-16 w-36 text-white/35" viewBox="0 0 140 64" fill="none">
          <path d="M2 58C28 58 26 7 58 22C83 34 92 6 138 5" stroke="currentColor" strokeWidth="2" />
          <path d="M2 45C25 38 37 50 57 40C82 27 105 47 138 19" stroke={accent} strokeWidth="2" />
        </svg>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-9 flex h-16 items-center gap-1" aria-hidden="true">
        {[18, 34, 52, 28, 62, 44, 24, 55, 36, 16, 48, 30, 58, 22, 40, 27, 50, 20].map(
          (height, index) => (
            <span
              key={`${height}-${index}`}
              className="w-1.5 rounded-full"
              style={{
                height,
                backgroundColor: index % 4 === 1 ? accent : "rgba(255,255,255,0.15)",
              }}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className="relative mt-8 h-20" aria-hidden="true">
      <div className="absolute left-0 top-4 h-14 w-28 rounded-[45%_55%_62%_38%] bg-white/8" />
      <div
        className="feature-ai-mask absolute left-10 top-0 h-16 w-32 rounded-[58%_42%_36%_64%]"
        style={{ backgroundColor: accent }}
      />
      <div className="absolute bottom-0 right-0 flex items-center gap-2 text-xs text-white/55">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
        Mask ready
      </div>
    </div>
  );
}

export function FeatureOverview() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    const cards = cardsRef.current;
    if (!section || !header || !cards) return;

    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(header.children, {
          y: 54,
          opacity: 0,
          duration: 1,
          stagger: 0.1,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: section, start: "top 72%" },
        });

        cards.querySelectorAll(".feature-card").forEach((card, index) => {
          gsap.from(card, {
            y: 90 + index * 12,
            rotate: index % 2 === 0 ? -1.5 : 1.5,
            scale: 0.94,
            opacity: 0,
            filter: "blur(10px)",
            duration: 1.1,
            delay: index * 0.08,
            ease: "power4.out",
            immediateRender: false,
            scrollTrigger: { trigger: cards, start: "top 78%" },
          });
        });
      });
    }, section);

    return () => {
      media.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} id="features" className="relative z-20 overflow-hidden py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div ref={headerRef} className="mb-16 max-w-3xl">
          <h2 className="heading-lg mb-5 text-white">
            Professional tools for <span className="text-[#e4c77f]">every stage.</span>
          </h2>
          <p className="body-lg max-w-2xl">
            Move from first cut to final delivery in one focused workspace—built
            for precision when you need it and speed when you do not.
          </p>
        </div>

        <div ref={cardsRef} className="grid gap-5 lg:grid-cols-12">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`feature-card group relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-7 transition-[transform,background-color,border-color] duration-500 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075] sm:p-8 ${feature.span}`}
            >
              <div
                className="absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
                style={{ backgroundColor: feature.accent }}
              />
              <div className="relative flex items-start justify-between gap-6">
                <div>
                  <h3 className="mb-3 text-xl font-medium text-white sm:text-2xl">
                    {feature.title}
                  </h3>
                  <p className="max-w-md text-sm leading-6 text-white/65">
                    {feature.description}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ color: feature.accent, backgroundColor: `${feature.accent}14` }}
                >
                  {feature.detail}
                </span>
              </div>
              <FeatureVisual type={feature.visual} accent={feature.accent} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
