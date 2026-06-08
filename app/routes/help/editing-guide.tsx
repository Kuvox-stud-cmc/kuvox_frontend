import { Link } from "react-router";

import type { Route } from "./+types/editing-guide";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Editing Guide · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Master the Kuvox timeline: keyboard shortcuts, multi-track layering, mask layers, audio ducking, transitions, and more.",
    },
  ];
}

const ON_THIS_PAGE = [
  { id: "shortcuts", label: "Timeline shortcuts" },
  { id: "multi-track", label: "Multi-track editing" },
  { id: "masks", label: "Working with mask layers" },
  { id: "audio", label: "Audio ducking basics" },
  { id: "transitions", label: "Transitions & effects" },
  { id: "color", label: "Color correction" },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export default function EditingGuide() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">movie_edit</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Editing Guide
                </h1>
                <p className="text-body-sm text-on-surface-variant"></p>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              Kuvox provides a professional-grade editing experience with a multi-track timeline, magnetic snapping, keyframe animations, and AI-assisted tools. This guide covers the core editing techniques.
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

          {/* ── Section: Timeline shortcuts ─────────────────────────────── */}
          <section id="shortcuts" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">keyboard</span>
              Timeline shortcuts
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Speed up your editing workflow with these essential keyboard shortcuts. All shortcuts are customizable in Settings → Preferences → Keyboard.
              </p>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Action</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Shortcut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {[
                      ["Razor tool (split clip)", "C"],
                      ["Select tool", "V"],
                      ["Ripple delete", "Shift+Delete"],
                      ["Snap toggle", "N"],
                      ["Mark In point", "I"],
                      ["Mark Out point", "O"],
                      ["Insert edit", ","],
                      ["Overwrite edit", "."],
                      ["Nudge clip left (1 frame)", ","],
                      ["Nudge clip right (1 frame)", "."],
                    ].map(([action, shortcut]) => (
                      <tr key={action} className="hover:bg-surface-container-high/50 transition-colors">
                        <td className="px-4 py-3 text-on-surface">{action}</td>
                        <td className="px-4 py-3">
                          <kbd className="px-2 py-1 bg-surface-container-high rounded text-label-md font-mono text-on-surface border border-outline-variant/60">{shortcut}</kbd>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Section: Multi-track editing ────────────────────────────── */}
          <section id="multi-track" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">stacked_bar_chart</span>
              Multi-track editing
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox supports unlimited video and audio tracks. Tracks are composited from top to bottom (highest track renders on top), similar to layer-based compositing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: "add_circle", title: "Adding tracks", desc: "Right-click the track header area and select 'Add Video Track' or 'Add Audio Track'. Drag to reorder." },
                  { icon: "lock", title: "Locking tracks", desc: "Click the lock icon on any track header to prevent accidental edits. Locked tracks are still rendered." },
                  { icon: "visibility_off", title: "Muting & hiding", desc: "Toggle the eye icon to hide video tracks or the speaker icon to mute audio tracks during preview." },
                  { icon: "link", title: "Linked clips", desc: "Video and audio from the same source are linked by default. Option-click to select them independently." },
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

          {/* ── Section: Working with mask layers ──────────────────────── */}
          <section id="masks" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">layers</span>
              Working with mask layers
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Masks let you selectively show or hide parts of a video layer. Kuvox offers shape masks, pen-tool freeform masks, and AI-powered object masks.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Mask types</h4>
                <div className="space-y-3">
                  {[
                    { type: "Shape Mask", desc: "Rectangle, ellipse, and polygon shapes. Feather edges for smooth blending." },
                    { type: "Pen Tool Mask", desc: "Draw freeform Bezier paths for precise control. Supports multiple sub-paths." },
                    { type: "AI Object Mask", desc: "Automatically detect and mask any object in the frame. Uses Kuvox's AI segmentation model." },
                    { type: "Luminance Mask", desc: "Create masks based on brightness values. Useful for targeted color grading." },
                  ].map((item) => (
                    <div key={item.type} className="flex items-start gap-3">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-label-md font-bold rounded shrink-0 mt-0.5">{item.type}</span>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5 shrink-0">lightbulb</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Pro Tip:</strong> Combine AI Object Mask with keyframe tracking for masks that follow moving subjects across the entire clip automatically.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: Audio ducking ──────────────────────────────────── */}
          <section id="audio" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">graphic_eq</span>
              Audio ducking basics
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Audio ducking automatically lowers background music volume when dialogue is detected. This is essential for professional-sounding voiceovers and interviews.
              </p>
              <div className="glass rounded-xl p-5">
                <h4 className="text-body-sm font-semibold text-on-surface mb-3">Ducking settings</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Duck amount</span>
                    <span className="text-body-sm text-on-surface-variant">-12 dB (default)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Sensitivity</span>
                    <span className="text-body-sm text-on-surface-variant">Medium (adjustable)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Fade in/out</span>
                    <span className="text-body-sm text-on-surface-variant">300ms ease-in-out</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-body-sm text-on-surface">Detection source</span>
                    <span className="text-body-sm text-on-surface-variant">AI voice detection</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: Transitions & effects ─────────────────────────── */}
          <section id="transitions" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">transition_fade</span>
              Transitions &amp; effects
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox includes 50+ built-in transitions and an extensible effects pipeline. Apply transitions by dragging them between clips on the timeline.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {["Cross Dissolve", "Dip to Black", "Film Burn", "Glitch", "Zoom In", "Slide Left", "Whip Pan", "Morph Cut", "Iris Wipe"].map((t) => (
                  <div key={t} className="glass rounded-lg px-3 py-2.5 text-center text-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50 transition-colors cursor-pointer">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section: Color correction ───────────────────────────────── */}
          <section id="color" className="mb-8 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">palette</span>
              Color correction
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Color correction in Kuvox combines manual controls (color wheels, curves, HSL qualifiers) with AI-powered automatic color matching and LUT management.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: "tonality", title: "Color Wheels", desc: "Adjust lift, gamma, and gain with intuitive 3-way color wheels." },
                  { icon: "show_chart", title: "Curves", desc: "RGB and luminance curves for precise tonal control." },
                  { icon: "auto_fix_high", title: "AI Match", desc: "Automatically match color between shots from different cameras." },
                ].map((item) => (
                  <div key={item.title} className="glass rounded-xl p-4 text-center group hover:border-primary/30 transition-colors duration-200">
                    <span className="material-symbols-outlined text-primary text-[28px] mb-2 block group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
                    <h4 className="text-body-sm font-medium text-on-surface mb-1">{item.title}</h4>
                    <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Next page navigation ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-outline-variant/40">
            <Link to="/help/upload-processing" className="glass rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-all duration-200 flex-1">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
              <div>
                <p className="text-label-md text-on-surface-variant">Previous</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Upload &amp; Processing</p>
              </div>
            </Link>
            <Link to="/help/ai-agent-guide" className="glass rounded-xl p-4 flex items-center justify-end gap-3 group hover:border-primary/30 transition-all duration-200 flex-1 text-right">
              <div>
                <p className="text-label-md text-on-surface-variant">Next</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">AI Agent Guide</p>
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
