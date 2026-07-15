import React, { useEffect, useRef, useState } from "react";

const BACKGROUND_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

export function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative z-20 flex min-h-[80dvh] items-center justify-center overflow-hidden bg-[#002f42] px-6 py-24 text-center"
    >
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={BACKGROUND_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
        <h2
          className={`${isVisible ? "animate-fade-rise" : "final-cta-before-enter"} final-cinematic-heading mb-7 max-w-5xl text-5xl font-normal leading-[0.95] tracking-[-0.035em] text-white sm:text-7xl md:text-8xl`}
        >
          Ready to build your next project?
        </h2>

        <p
          className={`${isVisible ? "animate-fade-rise-delay" : "final-cta-before-enter"} mx-auto max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg`}
        >
          Start editing today with KUVOX. Professional tools, AI assistance, and
          complete creative control.
        </p>

        <div
          className={`${isVisible ? "animate-fade-rise-delay-2" : "final-cta-before-enter"} mt-12 flex flex-col justify-center gap-4 sm:flex-row`}
        >
          <a
            href="/signup"
            className="liquid-glass final-glass-button px-14 py-5 text-base font-medium text-white"
          >
            Start Free
          </a>
          <a
            href="/about"
            className="liquid-glass final-glass-button final-glass-button-muted px-14 py-5 text-base font-medium text-white/80"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
