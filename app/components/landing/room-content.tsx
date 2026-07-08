import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import type { HeroSequenceProgress } from "./hero-sequence";

interface Room {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  features?: string[];
  isHero?: boolean;
  accentColor: string;
}

const rooms: Room[] = [
  {
    id: "lobby",
    label: "01 — Welcome",
    title: "Edit with precision.\nNot prompts.",
    subtitle:
      "A professional workspace for video, image and audio — built for creators who think in craft, not clicks.",
    isHero: true,
    accentColor: "#C9A962",
  },
  {
    id: "editing",
    label: "02 — Timeline",
    title: "Timeline editing\nbuilt for speed.",
    subtitle:
      "Edit faster with a magnetic timeline, ripple-aware trimming, and GPU-powered playback—everything stays smooth from the first cut to the final export.",
    features: [
      "Multi-track editing",
      "Ripple & roll trim",
      "Proxy workflow",
      "GPU acceleration",
      "Magnetic timeline",
      "Instant preview",
      "Keyboard shortcuts",
    ],
    accentColor: "#C9A962",
  },
  {
    id: "color",
    label: "03 — Color",
    title: "Color grading\nwith full control.",
    subtitle:
      "Shape every frame with professional color tools, precise adjustments, and cinematic consistency across your entire project.",
    features: [
      "HDR support",
      "Curves & wheels",
      "LUT import",
      "Scopes",
      "Color matching",
      "Secondary grading",
      "Masking",
    ],
    accentColor: "#C48A3A",
  },
  {
    id: "audio",
    label: "04 — Audio",
    title: "Sound as precise\nas the picture.",
    subtitle:
      "Clean dialogue, reduce noise, balance levels, and edit waveforms without leaving your timeline.",
    features: [
      "Noise reduction",
      "Voice isolation",
      "Audio ducking",
      "EQ & Compressor",
      "Multi-track mixing",
      "Waveform editing",
      "Real-time monitor",
    ],
    accentColor: "#A68B5B",
  },
  {
    id: "ai",
    label: "05 — AI",
    title: "AI assists.\nYou decide.",
    subtitle:
      "Automate repetitive editing tasks while keeping every creative decision entirely in your hands.",
    features: [
      "Object removal",
      "Background removal",
      "Subtitle generation",
      "Smart masking",
      "Auto reframing",
      "Content-aware fill",
      "Scene detection",
      "Speech transcription",
    ],
    accentColor: "#4A90E2",
  },
  {
    id: "team",
    label: "06 — Team",
    title: "Create together,\neffortlessly.",
    subtitle:
      "Collaborate in real time with shared assets, version history, comments, and secure project management.",
    features: [
      "Shared projects",
      "Version history",
      "Review links",
      "Frame comments",
      "Asset libraries",
      "Roles & permissions",
      "Cloud sync",
      "Team workspaces",
    ],
    accentColor: "#C9A962",
  },
  {
    id: "exit",
    label: "07 — Start Creating",
    title: "The door\nis open.",
    subtitle:
      "Everything inside, ready to use. No learning curve imposed on you — just open a project and start.",
    isHero: true,
    accentColor: "#C9A962",
  },
];

interface RoomContentProps {
  visible: boolean;
}

export interface RoomContentHandle {
  updateSequence: (state: HeroSequenceProgress) => void;
}

export const RoomContent = forwardRef<RoomContentHandle, RoomContentProps>(
  function RoomContent({ visible }, ref) {
  const [currentRoom, setCurrentRoom] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const featuresRef = useRef<HTMLUListElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const currentRoomRef = useRef(0);
  const latestSequenceRef = useRef<HeroSequenceProgress>({
    progress: 0,
    roomIndex: 0,
    nextRoomIndex: 0,
    sectionProgress: 0,
    blend: 0,
  });

  const collectEls = () =>
    [
      labelRef.current,
      titleRef.current,
      subtitleRef.current,
      featuresRef.current,
      ctaRef.current,
    ].filter(Boolean);

  const applySequence = (state: HeroSequenceProgress) => {
    const els = collectEls();
    const hasNextRoom = state.nextRoomIndex !== state.roomIndex;
    const showingNext = hasNextRoom && state.blend >= 0.5;
    const targetRoom = showingNext ? state.nextRoomIndex : state.roomIndex;

    if (targetRoom !== currentRoomRef.current) {
      currentRoomRef.current = targetRoom;
      setCurrentRoom(targetRoom);
      return;
    }

    const phase = showingNext
      ? (state.blend - 0.5) * 2
      : hasNextRoom
        ? 1 - state.blend * 2
        : 1;

    gsap.set(els, {
      autoAlpha: phase,
      y: showingNext ? 24 * (1 - phase) : -16 * (1 - phase),
      force3D: true,
    });
  };

  useImperativeHandle(ref, () => ({
    updateSequence(state) {
      latestSequenceRef.current = state;
      applySequence(state);
    },
  }));

  useLayoutEffect(() => {
    applySequence(latestSequenceRef.current);
  }, [currentRoom]);

  const room = rooms[currentRoom] ?? rooms[0];

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-0 z-10 pointer-events-none"
      style={{
        display: "flex",
        alignItems: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Left-side gradient so text is always readable over bright museum images */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(100deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.38) 50%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="relative z-10 w-full max-w-7xl mx-auto px-8 lg:px-16"
        style={{ paddingTop: "80px" }}
      >
        <div style={{ maxWidth: "540px" }}>
          {/* Room label */}
          <span
            ref={labelRef}
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: room.accentColor,
              marginBottom: "18px",
              opacity: 0,
            }}
          >
            {room.label}
          </span>

          {/* Title */}
          <div
            ref={titleRef}
            style={{
              fontSize: "clamp(36px, 5.5vw, 72px)",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              color: "#ffffff",
              marginBottom: "18px",
              whiteSpace: "pre-line",
              opacity: 0,
              textShadow: "0 2px 24px rgba(0,0,0,0.35)",
            }}
          >
            {room.title}
          </div>

          {/* Subtitle */}
          <p
            ref={subtitleRef}
            style={{
              fontSize: "16px",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.78)",
              marginBottom: room.features ? "26px" : "32px",
              maxWidth: "420px",
              opacity: 0,
              textShadow: "0 1px 8px rgba(0,0,0,0.4)",
            }}
          >
            {room.subtitle}
          </p>

          {/* Feature pills */}
          <ul
            ref={featuresRef}
            style={{
              display: room.features ? "grid" : "none",
              gridTemplateColumns: "1fr 1fr",
              gap: "9px 20px",
              marginBottom: "32px",
              listStyle: "none",
              padding: 0,
              opacity: 0,
            }}
          >
            {(room.features ?? []).map((feat) => (
              <li
                key={feat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: room.accentColor,
                    flexShrink: 0,
                  }}
                />
                {feat}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div
            ref={ctaRef}
            style={{
              display: "flex",
              gap: "12px",
              opacity: 0,
              pointerEvents: "auto",
            }}
          >
            {room.id === "lobby" && (
              <>
                <a href="#" className="btn-primary">
                  Start Free
                </a>
                <a href="#" className="btn-secondary">
                  Watch Demo
                </a>
              </>
            )}
            {room.id === "exit" && (
              <a
                href="#"
                className="btn-primary"
                style={{ gap: "8px" }}
              >
                Open a Project
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            )}
            {!room.isHero && (
              <a
                href="#"
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.45)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  letterSpacing: "0.04em",
                }}
              >
                Learn more
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Right-side room progress indicator */}
      <RoomDots
        current={currentRoom}
        total={rooms.length}
        accent={room.accentColor}
      />
    </div>
  );
});

function RoomDots({
  current,
  total,
  accent,
}: {
  current: number;
  total: number;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "fixed",
        right: "28px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: current === i ? "20px" : "6px",
            height: "2px",
            borderRadius: "2px",
            background:
              current === i ? accent : "rgba(255,255,255,0.25)",
            transition:
              "width 0.45s cubic-bezier(0.4,0,0.2,1), background 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}
