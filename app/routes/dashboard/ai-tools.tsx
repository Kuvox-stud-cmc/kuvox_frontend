import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

export function meta() {
  return [{ title: "AI Tools · Kuvox" }];
}

/* ── Mock Data ──────────────────────────────────────────────────────────── */

interface MockAiTool {
  id: string;
  name: string;
  description: string;
  category: "video" | "photo" | "audio";
  icon: string;
  iconTone: "primary" | "secondary" | "tertiary";
}

const MOCK_AI_TOOLS: MockAiTool[] = [
  // Video Tools
  {
    id: "ai-v1",
    name: "Auto Enhance",
    description: "Improve colors, contrast and sharpness automatically.",
    category: "video",
    icon: "auto_fix_high",
    iconTone: "primary",
  },
  {
    id: "ai-v2",
    name: "Remove Silence",
    description: "Detect and remove silent parts from your video.",
    category: "video",
    icon: "mic_off",
    iconTone: "secondary",
  },
  {
    id: "ai-v3",
    name: "Smart Cut",
    description: "Automatically find the best moments and create cuts.",
    category: "video",
    icon: "content_cut",
    iconTone: "tertiary",
  },
  {
    id: "ai-v4",
    name: "Auto Subtitle",
    description: "Generate accurate subtitles automatically.",
    category: "video",
    icon: "subtitles",
    iconTone: "primary",
  },
  {
    id: "ai-v5",
    name: "Scene Detection",
    description: "Detect scenes and split your video into clips.",
    category: "video",
    icon: "movie_filter",
    iconTone: "secondary",
  },

  // Photo Tools
  {
    id: "ai-p1",
    name: "AI Enhance",
    description: "Enhance photo quality, detail and resolution.",
    category: "photo",
    icon: "photo_filter",
    iconTone: "primary",
  },
  {
    id: "ai-p2",
    name: "Remove Background",
    description: "Remove background instantly and cleanly.",
    category: "photo",
    icon: "layers_clear",
    iconTone: "tertiary",
  },
  {
    id: "ai-p3",
    name: "Color Grade",
    description: "Apply cinematic color grades with AI.",
    category: "photo",
    icon: "palette",
    iconTone: "secondary",
  },
  {
    id: "ai-p4",
    name: "Upscale Image",
    description: "Increase image resolution without losing quality.",
    category: "photo",
    icon: "high_quality",
    iconTone: "primary",
  },

  // Audio Tools
  {
    id: "ai-a1",
    name: "Remove Noise",
    description: "Reduce background noise from your audio files.",
    category: "audio",
    icon: "noise_control_off",
    iconTone: "primary",
  },
  {
    id: "ai-a2",
    name: "Voice Clarity",
    description: "Enhance voice clarity and intelligibility with AI.",
    category: "audio",
    icon: "record_voice_over",
    iconTone: "secondary",
  },
  {
    id: "ai-a3",
    name: "Audio Enhance",
    description: "Improve overall audio quality automatically.",
    category: "audio",
    icon: "graphic_eq",
    iconTone: "tertiary",
  },
];

const CARD_GRADIENTS = [
  "from-primary/25 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
  "from-secondary/15 via-surface-container to-primary/15",
  "from-tertiary/15 via-surface-container-high to-secondary/15",
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function ToolCardVideoPhoto({
  tool,
  index,
  isPhoto = false,
}: {
  tool: MockAiTool;
  index: number;
  isPhoto?: boolean;
}) {
  const gradientIdx = index % CARD_GRADIENTS.length;

  return (
    <div className="bento-card group flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-primary/40">
      {/* Thumbnail area */}
      <div
        className={`relative flex ${isPhoto ? "h-32" : "h-28"} w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[gradientIdx]}`}
      >
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20">
          {tool.icon}
        </span>
        <span className="absolute left-2 top-2 rounded bg-surface-container-lowest/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface backdrop-blur-sm border border-outline-variant/50">
          AI
        </span>
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 text-label-md font-bold text-on-surface">
          {tool.name}
        </h3>
        <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
          {tool.description}
        </p>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-primary/10 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Open
          </button>
          <button
            type="button"
            className="rounded-lg border border-outline-variant p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              settings
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolCardAudio({ tool }: { tool: MockAiTool }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    tertiary: "bg-tertiary/10 text-tertiary border-tertiary/20",
  };

  return (
    <div className="bento-card flex items-start gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/40">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${toneMap[tool.iconTone]}`}
      >
        <span className="material-symbols-outlined text-[24px]">
          {tool.icon}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="mb-1 text-label-md font-bold text-on-surface">
          {tool.name}
        </h3>
        <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
          {tool.description}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-surface-container-high py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-outline-variant"
          >
            Open
          </button>
          <button
            type="button"
            className="rounded-lg border border-outline-variant p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              settings
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function AiTools() {
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const activeTab = ["video", "photo", "audio"].includes(viewParam || "")
    ? viewParam
    : "all";

  const sectionVideoRef = useRef<HTMLElement>(null);
  const sectionPhotoRef = useRef<HTMLElement>(null);
  const sectionAudioRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      video: sectionVideoRef,
      photo: sectionPhotoRef,
      audio: sectionAudioRef,
    };
    const target = viewParam ? refMap[viewParam] : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [viewParam]);

  const videoTools = MOCK_AI_TOOLS.filter((t) => t.category === "video");
  const photoTools = MOCK_AI_TOOLS.filter((t) => t.category === "photo");
  const audioTools = MOCK_AI_TOOLS.filter((t) => t.category === "audio");

  return (
    <section className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface">AI Tools</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Powerful AI tools to supercharge your creative workflow.
        </p>
      </div>

      {/* ── Category Tab Bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Tabs */}
        <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container p-1">
          {[
            { id: "all", label: "All Tools", icon: "widgets" },
            { id: "video", label: "Video", icon: "movie" },
            { id: "photo", label: "Photo", icon: "image" },
            { id: "audio", label: "Audio", icon: "music_note" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-label-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/20 text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Filters */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-label-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">
              auto_awesome
            </span>
            My Tools
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-label-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">
              favorite
            </span>
            Favorite
          </button>
        </div>
      </div>

      {/* ── Video Tools Section ────────────────────────────────────────────── */}
      <section
        id="section-video"
        ref={sectionVideoRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Video Tools
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View all
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {videoTools.map((tool, i) => (
            <ToolCardVideoPhoto key={tool.id} tool={tool} index={i} />
          ))}
        </div>
      </section>

      {/* ── Photo Tools Section ────────────────────────────────────────────── */}
      <section
        id="section-photo"
        ref={sectionPhotoRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Photo Tools
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View all
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {photoTools.map((tool, i) => (
            <ToolCardVideoPhoto
              key={tool.id}
              tool={tool}
              index={i + videoTools.length}
              isPhoto
            />
          ))}
        </div>
      </section>

      {/* ── Audio Tools Section ────────────────────────────────────────────── */}
      <section
        id="section-audio"
        ref={sectionAudioRef}
        style={{ scrollMarginTop: "6rem" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md font-bold text-on-surface">
            Audio Tools
          </h2>
          <button
            type="button"
            className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            View all
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {audioTools.map((tool) => (
            <ToolCardAudio key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      {/* ── Custom Preset Banner CTA ───────────────────────────────────────── */}
      <section className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
        <div className="relative z-10">
          <h2 className="mb-2 text-headline-md font-bold text-on-surface">
            Create your own AI Preset
          </h2>
          <p className="max-w-md text-body-sm text-on-surface-variant">
            Save your favorite settings as a custom preset and apply them to
            your projects with one click.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg border border-outline-variant bg-surface-container px-6 py-2 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Create Preset
          </button>
        </div>
        {/* Decorative elements */}
        <div className="relative z-10 hidden h-32 w-48 opacity-40 lg:block">
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-primary/30">
            <div className="h-12 w-12 rotate-45 rounded border-2 border-primary/80" />
            <div className="absolute h-8 w-8 rounded-full bg-primary/20 blur-md" />
          </div>
        </div>
      </section>
    </section>
  );
}
