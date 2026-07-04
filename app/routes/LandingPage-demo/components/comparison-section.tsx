import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const traditional = [
  "Manual object removal, frame by frame",
  "Masks keyed by hand for every clip",
  "Preset-only export workflows",
  "Feedback scattered across tools",
];

const kuvox = [
  "One-click removal with intelligent fill",
  "AI masks generated in seconds",
  "Custom, reusable export presets",
  "Timestamped review in one workspace",
];

export function ComparisonSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    const leftCard = leftCardRef.current;
    const rightCard = rightCardRef.current;
    const bridge = bridgeRef.current;
    if (!section || !header || !leftCard || !rightCard || !bridge) return;

    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(header.querySelectorAll(".comparison-word"), {
          yPercent: 110,
          opacity: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: header, start: "top 78%" },
        });

        gsap.from(leftCard, {
          x: -70,
          y: 50,
          opacity: 0,
          rotate: -1.5,
          duration: 1.1,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: leftCard, start: "top 82%" },
        });

        gsap.from(rightCard, {
          x: 70,
          y: 50,
          opacity: 0,
          rotate: 1.5,
          duration: 1.1,
          delay: 0.12,
          ease: "power4.out",
          immediateRender: false,
          scrollTrigger: { trigger: rightCard, start: "top 82%" },
        });

        gsap.from(bridge, {
          scaleX: 0,
          opacity: 0,
          duration: 0.8,
          delay: 0.3,
          transformOrigin: "left center",
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: bridge, start: "top 82%" },
        });
      });
    }, section);

    return () => {
      media.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative z-20 overflow-hidden py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div ref={headerRef} className="mb-16 max-w-4xl">
          <p className="mb-5 text-sm font-medium text-[#63d9a8]">
            Creative control stays human.
          </p>
          <h2 className="heading-lg mb-5 overflow-hidden text-white">
            <span className="comparison-word inline-block">AI that&nbsp;</span>
            <span className="comparison-word inline-block text-[#63d9a8]">assists,</span>{" "}
            <span className="comparison-word inline-block">not replaces.</span>
          </h2>
          <p className="body-lg max-w-2xl">
            KUVOX handles the repetitive mechanics while every creative decision,
            adjustment, and final approval remains yours.
          </p>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_112px_1fr] lg:gap-0">
          <div
            ref={leftCardRef}
            className="rounded-2xl border border-red-300/10 bg-[#181313] p-7 sm:p-9"
          >
            <div className="mb-8 flex items-center justify-between gap-4">
              <h3 className="text-lg font-medium text-white/65">Traditional editing</h3>
              <span className="rounded-full bg-red-300/10 px-3 py-1 text-xs text-red-200/60">
                Manual
              </span>
            </div>
            <ul className="space-y-3">
              {traditional.map((item, index) => (
                <li key={item} className="flex items-center gap-4 rounded-xl bg-black/15 px-4 py-3 text-sm text-white/50">
                  <span className="text-xs text-red-200/45">0{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div ref={bridgeRef} className="relative hidden items-center px-5 lg:flex" aria-hidden="true">
            <div className="relative h-px w-full bg-white/15">
              <span className="ai-flow-orb absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#63d9a8]" />
            </div>
            <svg className="absolute right-3 h-4 w-4 text-[#63d9a8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>

          <div className="flex items-center justify-center py-1 lg:hidden" aria-hidden="true">
            <span className="rounded-full bg-[#63d9a8]/10 px-4 py-2 text-xs font-medium text-[#63d9a8]">
              Repetitive work, automated ↓
            </span>
          </div>

          <div
            ref={rightCardRef}
            className="relative overflow-hidden rounded-2xl border border-[#63d9a8]/20 bg-[#101813] p-7 sm:p-9"
          >
            <span className="ai-scan-line absolute inset-x-0 top-0 h-px bg-[#63d9a8]/60" aria-hidden="true" />
            <div className="mb-8 flex items-center justify-between gap-4">
              <h3 className="text-lg font-medium text-white">KUVOX workflow</h3>
              <span className="rounded-full bg-[#63d9a8]/12 px-3 py-1 text-xs text-[#8ae8bd]">
                Assisted
              </span>
            </div>
            <ul className="space-y-3">
              {kuvox.map((item, index) => (
                <li key={item} className="flex items-center gap-4 rounded-xl bg-[#63d9a8]/[0.055] px-4 py-3 text-sm text-white/85">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#63d9a8]/15 text-[10px] text-[#8ae8bd]">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
