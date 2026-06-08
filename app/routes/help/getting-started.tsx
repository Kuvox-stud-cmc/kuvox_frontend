import { Link } from "react-router";

import type { Route } from "./+types/getting-started";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Getting Started · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Set up your Kuvox account, create your first AI-enhanced video project, and learn the interface in minutes.",
    },
  ];
}

const ON_THIS_PAGE = [
  { id: "workspace", label: "Create your workspace" },
  { id: "first-edit", label: "First AI edit walkthrough" },
  { id: "interface", label: "Interface overview" },
  { id: "keyboard-shortcuts", label: "Keyboard shortcuts" },
  { id: "next-steps", label: "Next steps" },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export default function GettingStarted() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">rocket_launch</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Getting Started
                </h1>
                <p className="text-body-sm text-on-surface-variant"></p>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              Welcome to Kuvox! This guide will walk you through creating your account, setting up your first project, and making your first AI-assisted edit. By the end, you&apos;ll be ready to harness the full power of AI-driven video production.
            </p>
          </div>

          {/* On this page — mobile only */}
          <div className="lg:hidden mb-8 glass rounded-xl p-4">
            <h4 className="text-label-md font-bold tracking-wider text-on-surface-variant mb-3 uppercase">On this page</h4>
            <div className="space-y-2">
              {ON_THIS_PAGE.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block text-body-sm text-primary hover:underline">
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* ── Section: Create your workspace ──────────────────────────── */}
          <section id="workspace" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">dashboard</span>
              Create your workspace
            </h2>
            <div className="prose-custom space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Your workspace is your creative home in Kuvox. It houses all your projects, media assets, and team collaborations. Here&apos;s how to get started:
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-md font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="text-body-sm font-medium text-on-surface">Sign up for a Kuvox account</h4>
                    <p className="text-body-sm text-on-surface-variant mt-1">Visit <strong className="text-primary">kuvox.ai/signup</strong> and create your account using email or SSO (Google, GitHub, Microsoft).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-md font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="text-body-sm font-medium text-on-surface">Name your workspace</h4>
                    <p className="text-body-sm text-on-surface-variant mt-1">Choose a descriptive name for your workspace. This is visible to all team members you invite later.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-md font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <h4 className="text-body-sm font-medium text-on-surface">Select your plan</h4>
                    <p className="text-body-sm text-on-surface-variant mt-1">Start with the free tier (5 GB storage, 30 AI credits/month) or choose a plan that fits your needs. You can upgrade anytime.</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5 shrink-0">lightbulb</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Pro Tip:</strong> Invite team members during setup to take advantage of collaborative AI suggestions. The AI learns from your team&apos;s collective editing style.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: First AI edit walkthrough ──────────────────────── */}
          <section id="first-edit" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">auto_awesome</span>
              First AI edit walkthrough
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Let&apos;s create your first AI-powered edit. Kuvox&apos;s AI agent understands natural language, so you can describe what you want instead of manually manipulating clips.
              </p>
              <div className="glass rounded-xl p-5 space-y-4">
                <h4 className="text-body-sm font-semibold text-on-surface">Quick Start Steps</h4>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                    <span className="text-primary font-bold shrink-0">01.</span>
                    <span><strong className="text-on-surface">Upload your footage</strong> — Drag and drop video files into your project. Kuvox automatically generates proxies and analyzes each scene.</span>
                  </li>
                  <li className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                    <span className="text-primary font-bold shrink-0">02.</span>
                    <span><strong className="text-on-surface">Open the command bar</strong> — Press <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-label-md font-mono text-on-surface border border-outline-variant/60">⌘K</kbd> (or <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-label-md font-mono text-on-surface border border-outline-variant/60">Ctrl+K</kbd>) to open the AI command bar.</span>
                  </li>
                  <li className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                    <span className="text-primary font-bold shrink-0">03.</span>
                    <span><strong className="text-on-surface">Describe your edit</strong> — Type something like &ldquo;Cut to the best 30 seconds and add upbeat background music&rdquo;.</span>
                  </li>
                  <li className="flex items-start gap-3 text-body-sm text-on-surface-variant">
                    <span className="text-primary font-bold shrink-0">04.</span>
                    <span><strong className="text-on-surface">Review and refine</strong> — The AI will generate a draft. Use the timeline to fine-tune, or give the AI more instructions.</span>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* ── Section: Interface overview ─────────────────────────────── */}
          <section id="interface" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">space_dashboard</span>
              Interface overview
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                The Kuvox interface is designed for speed and clarity. Here are the key areas you&apos;ll work with:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: "view_sidebar", title: "Media Panel", desc: "Browse, search, and organize all imported media assets." },
                  { icon: "view_timeline", title: "Timeline", desc: "Multi-track timeline with precision scrubbing and magnetic snapping." },
                  { icon: "smart_display", title: "Preview Monitor", desc: "Real-time preview with playback controls and frame-accurate seeking." },
                  { icon: "tune", title: "Inspector", desc: "Context-aware property panel for clips, effects, and transitions." },
                ].map((panel) => (
                  <div key={panel.title} className="glass rounded-xl p-4 flex items-start gap-3 group hover:border-primary/30 transition-colors duration-200">
                    <span className="material-symbols-outlined text-primary text-[22px] mt-0.5 group-hover:scale-110 transition-transform duration-200">{panel.icon}</span>
                    <div>
                      <h4 className="text-body-sm font-medium text-on-surface">{panel.title}</h4>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">{panel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section: Keyboard shortcuts ─────────────────────────────── */}
          <section id="keyboard-shortcuts" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">keyboard</span>
              Keyboard shortcuts
            </h2>
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
                    ["Open AI command bar", "⌘K / Ctrl+K"],
                    ["Play / Pause", "Space"],
                    ["Split clip at playhead", "S"],
                    ["Undo", "⌘Z / Ctrl+Z"],
                    ["Redo", "⌘⇧Z / Ctrl+Shift+Z"],
                    ["Delete selected", "Delete / Backspace"],
                    ["Zoom in timeline", "⌘+ / Ctrl++"],
                    ["Export project", "⌘E / Ctrl+E"],
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
          </section>

          {/* ── Section: Next steps ─────────────────────────────────────── */}
          <section id="next-steps" className="mb-8 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">arrow_forward</span>
              Next steps
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link to="/help/upload-processing" className="glass rounded-xl p-5 group hover:border-primary/30 transition-all duration-200 flex items-center gap-4">
                <span className="material-symbols-outlined text-primary text-[28px] group-hover:translate-x-1 transition-transform duration-200">cloud_upload</span>
                <div>
                  <h4 className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Upload & Processing</h4>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Learn about file formats, proxy workflows, and media management.</p>
                </div>
              </Link>
              <Link to="/help/ai-agent-guide" className="glass rounded-xl p-5 group hover:border-primary/30 transition-all duration-200 flex items-center gap-4">
                <span className="material-symbols-outlined text-primary text-[28px] group-hover:translate-x-1 transition-transform duration-200">psychology</span>
                <div>
                  <h4 className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">AI Agent Guide</h4>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Master prompt engineering and automate complex editing tasks.</p>
                </div>
              </Link>
            </div>
          </section>
        </article>

        {/* ── Right rail: On this page — desktop only ──────────────────── */}
        <aside className="hidden lg:block w-48 shrink-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="sticky top-24">
            <h4 className="text-label-md font-bold tracking-wider text-on-surface-variant mb-3 uppercase">On this page</h4>
            <nav className="space-y-2 border-l border-outline-variant/40 pl-3">
              {ON_THIS_PAGE.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>
    </>
  );
}
