import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/ai-tools";

export function meta(_: Route.MetaArgs) {
  return [{ title: "AI Tools · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const AI_TOOLS = [
  {
    id: "video",
    label: "Video",
    icon: "videocam",
    description: "AI-powered video editing, enhancement, and generation tools.",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    id: "photo",
    label: "Photo",
    icon: "photo_library",
    description: "Smart photo editing, upscaling, and style transfer.",
    gradient: "from-secondary/20 to-secondary/5",
  },
  {
    id: "audio",
    label: "Audio",
    icon: "music_note",
    description: "Audio enhancement, noise removal, and mixing tools.",
    gradient: "from-tertiary/20 to-tertiary/5",
  },
  {
    id: "generate",
    label: "Generate Assets",
    icon: "auto_awesome",
    description: "Create images, videos, and graphics from text prompts.",
    gradient: "from-primary/20 to-secondary/5",
  },
  {
    id: "bg-removal",
    label: "Background Removal",
    icon: "content_cut",
    description: "Remove and replace backgrounds from photos and videos instantly.",
    gradient: "from-secondary/20 to-tertiary/5",
  },
  {
    id: "subtitle",
    label: "Auto Subtitle",
    icon: "subtitles",
    description: "Automatic subtitle generation with multi-language support.",
    gradient: "from-tertiary/20 to-primary/5",
  },
  {
    id: "voice-clone",
    label: "Voice Clone",
    icon: "record_voice_over",
    description: "Clone voices for voiceovers, dubbing, and narration.",
    gradient: "from-primary/20 to-tertiary/5",
  },
];

export default function TeamAITools() {
  return (
    <section>
      <SectionHeader title="AI Tools" subtitle="Supercharge your workflow with AI-powered tools." />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="group rounded-xl border border-outline-variant bg-surface-container-low p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient}`}>
              <span className="material-symbols-outlined text-[24px] text-primary transition-transform group-hover:scale-110">
                {tool.icon}
              </span>
            </div>
            <h3 className="text-body-sm font-semibold text-on-surface">{tool.label}</h3>
            <p className="mt-1 text-label-md text-on-surface-variant">{tool.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
