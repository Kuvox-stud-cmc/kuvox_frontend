import { Link } from "react-router";

import type { Route } from "./+types/ai-agent-guide";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "AI Agent Guide · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Learn how to communicate with Kuvox's AI editor — prompt engineering, auto-scene detection, voice cloning, and automating complex editing workflows.",
    },
  ];
}

const ON_THIS_PAGE = [
  { id: "prompts", label: "Prompt engineering for video" },
  { id: "scene-detection", label: "Auto-scene detection" },
  { id: "voice-cloning", label: "AI Voice cloning setup" },
  { id: "automation", label: "Workflow automation" },
  { id: "best-practices", label: "Best practices" },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export default function AiAgentGuide() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">psychology</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  AI Agent Guide
                </h1>
                <p className="text-body-sm text-on-surface-variant"></p>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              The Kuvox AI agent is your creative partner. It understands natural language, interprets your creative intent, and executes complex edits that would take hours manually. This guide teaches you how to communicate effectively with the AI for maximum results.
            </p>
          </div>

          {/* On this page — mobile only */}
          <div className="lg:hidden mb-8 glass rounded-xl p-4">
            <h4 className="text-label-md font-bold tracking-wider text-on-surface-variant mb-3 uppercase">On this page</h4>
            <div className="space-y-2">
              {ON_THIS_PAGE.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block text-body-sm text-primary hover:underline">{item.label}</a>
              ))}
            </div>
          </div>

          {/* ── Section: Prompt engineering ─────────────────────────────── */}
          <section id="prompts" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">chat</span>
              Prompt engineering for video
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                The quality of your AI edits depends heavily on how you phrase your instructions. Here are the key principles for writing effective prompts.
              </p>

              {/* Good vs Bad prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="glass rounded-xl p-5 border-l-2 border-l-error">
                  <h4 className="text-body-sm font-semibold text-error mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Less effective
                  </h4>
                  <div className="space-y-2">
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Make it look cool&rdquo;</p>
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Fix the video&rdquo;</p>
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Add some effects&rdquo;</p>
                  </div>
                </div>
                <div className="glass rounded-xl p-5 border-l-2 border-l-secondary">
                  <h4 className="text-body-sm font-semibold text-secondary mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    More effective
                  </h4>
                  <div className="space-y-2">
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Apply a warm cinematic color grade with teal shadows&rdquo;</p>
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Remove the 3-second pause at 1:42 and add a crossfade&rdquo;</p>
                    <p className="text-body-sm text-on-surface-variant italic">&ldquo;Add subtle film grain and a letterbox at 2.39:1&rdquo;</p>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Prompt anatomy</h4>
                <div className="space-y-3">
                  {[
                    { label: "Action", desc: "Start with a clear verb: cut, trim, add, remove, replace, adjust, color grade.", color: "text-primary" },
                    { label: "Target", desc: "Specify what to act on: a timestamp, a scene, a person, an audio track, the entire clip.", color: "text-secondary" },
                    { label: "Style", desc: "Describe the desired result: cinematic, upbeat, minimal, vintage, dramatic.", color: "text-tertiary" },
                    { label: "Constraints", desc: "Add boundaries: duration limits, format requirements, quality targets.", color: "text-on-surface-variant" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <span className={`text-label-md font-bold shrink-0 mt-0.5 ${item.color} px-2 py-1 bg-surface-container-high rounded`}>{item.label}</span>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Example command */}
              <div className="bg-surface-container-high border border-outline-variant rounded-xl p-4 font-mono text-body-sm text-on-surface">
                <span className="text-primary">&gt;</span> Cut to the drone shot when the music drops, add a 0.5s zoom transition, and color grade the whole sequence in a warm sunset palette
              </div>
            </div>
          </section>

          {/* ── Section: Auto-scene detection ──────────────────────────── */}
          <section id="scene-detection" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">grid_view</span>
              Auto-scene detection
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox automatically detects scene boundaries in your footage using visual analysis and audio cues. This powers features like smart splitting, scene-based editing, and AI-generated summaries.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Detection methods</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "image_search", title: "Visual Analysis", desc: "Detects hard cuts, dissolves, and fade-to-black transitions by comparing frame similarity." },
                    { icon: "hearing", title: "Audio Analysis", desc: "Identifies silence gaps, music changes, and speech boundaries as potential scene breaks." },
                    { icon: "text_fields", title: "Content Tagging", desc: "Each detected scene is automatically tagged with descriptions, dominant colors, and detected objects." },
                    { icon: "tune", title: "Sensitivity Control", desc: "Adjust detection threshold from conservative (only hard cuts) to aggressive (subtle transitions)." },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">{item.icon}</span>
                      <div>
                        <h4 className="text-body-sm font-medium text-on-surface">{item.title}</h4>
                        <p className="text-body-sm text-on-surface-variant mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: AI Voice cloning ───────────────────────────────── */}
          <section id="voice-cloning" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">record_voice_over</span>
              AI Voice cloning setup
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Clone any voice from a 30-second audio sample and use it for voiceovers, narration corrections, or entirely new dialogue. Voice clones are private to your workspace.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Setup steps</h4>
                <ol className="space-y-3">
                  {[
                    { step: "01", text: "Navigate to Settings → AI Features → Voice Cloning and click 'Create Voice Clone'." },
                    { step: "02", text: "Upload a clean 30+ second audio sample of the target voice. Avoid background noise." },
                    { step: "03", text: "Name the voice profile and select the language. The AI takes 2-5 minutes to process." },
                    { step: "04", text: "Test the clone by typing sample text. Adjust pitch, speed, and emotion parameters." },
                    { step: "05", text: "Use the cloned voice in the timeline: select a clip → right-click → 'Replace Voice' → choose your clone." },
                  ].map((item) => (
                    <li key={item.step} className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                      <span className="text-primary font-bold shrink-0">{item.step}.</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 shrink-0">warning</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Important:</strong> Only clone voices you have explicit permission to use. Kuvox requires consent confirmation for all voice cloning operations.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: Workflow automation ────────────────────────────── */}
          <section id="automation" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">bolt</span>
              Workflow automation
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Chain multiple AI actions into reusable workflows. Automations run in sequence and can be triggered with a single command or shortcut.
              </p>
              <div className="glass rounded-xl p-5">
                <h4 className="text-body-sm font-semibold text-on-surface mb-3">Example automation: &ldquo;Social Media Package&rdquo;</h4>
                <div className="space-y-2">
                  {[
                    { step: 1, action: "Auto-detect the best 60s segment from a long-form video" },
                    { step: 2, action: "Crop to 9:16 vertical with smart framing (face tracking)" },
                    { step: 3, action: "Add auto-generated captions in bold sans-serif style" },
                    { step: 4, action: "Apply upbeat background music from the stock library" },
                    { step: 5, action: "Export as MP4 at 1080×1920, 30fps, optimized for Instagram" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-center gap-3 py-2 border-b border-outline-variant/20 last:border-b-0">
                      <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-md font-bold flex items-center justify-center shrink-0">{item.step}</span>
                      <span className="text-body-sm text-on-surface-variant">{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: Best practices ─────────────────────────────────── */}
          <section id="best-practices" className="mb-8 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">stars</span>
              Best practices
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: "edit_note", title: "Be specific", desc: "The more context you provide (timestamps, clip names, style references), the better the result." },
                  { icon: "undo", title: "Iterate quickly", desc: "Don't aim for perfection in one prompt. Make a rough edit, then refine with follow-up commands." },
                  { icon: "history", title: "Use version history", desc: "Every AI edit creates a checkpoint. You can always roll back if the result doesn't match your vision." },
                  { icon: "school", title: "Learn from AI choices", desc: "Review the AI's decisions in the timeline. Its approach often reveals efficient techniques you can reuse." },
                ].map((item) => (
                  <div key={item.title} className="glass rounded-xl p-4 flex items-start gap-3 group hover:border-primary/30 transition-colors duration-200">
                    <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">{item.icon}</span>
                    <div>
                      <h4 className="text-body-sm font-medium text-on-surface">{item.title}</h4>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Next page navigation ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-outline-variant/40">
            <Link to="/help/editing-guide" className="glass rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-all duration-200 flex-1">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
              <div>
                <p className="text-label-md text-on-surface-variant">Previous</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Editing Guide</p>
              </div>
            </Link>
            <Link to="/help/rendering-export" className="glass rounded-xl p-4 flex items-center justify-end gap-3 group hover:border-primary/30 transition-all duration-200 flex-1 text-right">
              <div>
                <p className="text-label-md text-on-surface-variant">Next</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Rendering &amp; Export</p>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
            </Link>
          </div>
        </article>

        {/* ── Right rail: On this page — desktop only ──────────────────── */}
        <aside className="hidden lg:block w-48 shrink-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="sticky top-24">
            <h4 className="text-label-md font-bold tracking-wider text-on-surface-variant mb-3 uppercase">On this page</h4>
            <nav className="space-y-2 border-l border-outline-variant/40 pl-3">
              {ON_THIS_PAGE.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200">{item.label}</a>
              ))}
            </nav>
          </div>
        </aside>
    </>
  );
}
