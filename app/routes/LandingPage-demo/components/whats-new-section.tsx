import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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

export function WhatsNewSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const reducedMotion = useReducedMotion();

  const selectCard = (index: number, scroll = true) => {
    const nextIndex = (index + releases.length) % releases.length;
    setActiveIndex(nextIndex);

    if (scroll) {
      cardRefs.current[nextIndex]?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  const syncActiveCard = () => {
    const track = trackRef.current;
    if (!track) return;

    const center = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  return (
    <section
      className="relative z-20 overflow-hidden py-28 sm:py-32"
      aria-labelledby="whats-new-title"
    >
      <div className="mx-auto mb-8 max-w-7xl px-6 lg:px-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="whats-new-title" className="heading-md mb-3 text-white">
              What&apos;s new
            </h2>
            <p className="body-md max-w-xl">
              Five new ways to move from raw footage to a finished story with
              less repetitive work.
            </p>
          </div>

          <div className="flex items-center gap-2" aria-label="Choose an update">
            {releases.map((release, index) => (
              <button
                key={release.title}
                type="button"
                onClick={() => selectCard(index)}
                className="relative grid h-9 w-9 place-items-center rounded-full text-xs font-medium text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/80"
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
                <span className="relative">{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={syncActiveCard}
        className="whats-new-track flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 py-12 lg:px-[calc((100vw-420px)/2)]"
        role="region"
        aria-label="Latest KUVOX features"
      >
        {releases.map((release, index) => {
          const isActive = activeIndex === index;

          return (
            <motion.article
              key={release.title}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              tabIndex={0}
              aria-current={isActive ? "true" : undefined}
              onClick={() => selectCard(index, false)}
              onFocus={() => selectCard(index)}
              onMouseEnter={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") selectCard(activeIndex - 1);
                if (event.key === "ArrowRight") selectCard(activeIndex + 1);
              }}
              animate={
                reducedMotion
                  ? { opacity: isActive ? 1 : 0.55 }
                  : {
                      opacity: isActive ? 1 : 0.38,
                      scale: isActive ? 1.04 : 0.92,
                      y: isActive ? 0 : 18,
                      filter: isActive
                        ? "brightness(1) saturate(1)"
                        : "brightness(0.58) saturate(0.6)",
                    }
              }
              transition={reducedMotion ? { duration: 0 } : spring}
              className="group relative h-[560px] min-w-[78vw] snap-center cursor-pointer overflow-hidden rounded-2xl bg-[#100e0c] outline-none sm:min-w-[420px] lg:h-[620px] lg:min-w-[420px] focus-visible:ring-2 focus-visible:ring-[#c9a962]"
            >
              <img
                src={release.image}
                alt={`${release.title} feature preview`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/90" />

              <div className="absolute left-6 top-6 flex items-center gap-3 text-xs font-medium text-white/80">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="h-px w-7 bg-white/45" />
                <span>{release.tag}</span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6 pb-24 sm:p-8 sm:pb-24">
                <motion.h3
                  layout="position"
                  className="mb-3 text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl"
                  transition={reducedMotion ? { duration: 0 } : spring}
                >
                  {release.title}
                </motion.h3>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
                      }
                      className="max-w-sm text-sm leading-6 text-white/75"
                    >
                      {release.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="whats-new-toolbar"
                    initial={{ opacity: 0, scale: 0.94, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 6 }}
                    transition={reducedMotion ? { duration: 0 } : spring}
                    className="absolute bottom-5 left-1/2 flex h-12 -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/45 p-1.5 text-white shadow-[0_6px_8px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                    aria-label="Carousel controls"
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCard(activeIndex - 1);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      aria-label="Previous feature"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="min-w-24 px-3 text-center text-xs font-medium text-white/85">
                      {release.tag}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCard(activeIndex + 1);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      aria-label="Next feature"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
