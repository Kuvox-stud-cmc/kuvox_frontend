import { Link } from "react-router";

import type { Route } from "./+types/rendering-export";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Rendering & Export · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Optimize your final output with Kuvox export presets for YouTube, social media, and broadcast. Learn about cloud rendering, alpha channels, and codec settings.",
    },
  ];
}

const ON_THIS_PAGE = [
  { id: "youtube", label: "Export presets for YouTube" },
  { id: "social", label: "Social media presets" },
  { id: "cloud", label: "Cloud rendering queue" },
  { id: "alpha", label: "Alpha channel exports" },
  { id: "codecs", label: "Codec reference" },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export default function RenderingExport() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">export_notes</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Rendering &amp; Export
                </h1>
                <p className="text-body-sm text-on-surface-variant"></p>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              Kuvox provides optimized export presets for every platform plus a cloud rendering queue for heavy projects. This guide covers presets, codec settings, alpha channel exports, and best practices for final delivery.
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

          {/* ── Section: YouTube presets ────────────────────────────────── */}
          <section id="youtube" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">smart_display</span>
              Export presets for YouTube
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                YouTube recommends specific settings for optimal quality and processing speed. Kuvox includes built-in presets that match YouTube&apos;s recommended specifications.
              </p>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Setting</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">1080p</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">4K</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {[
                      ["Codec", "H.264 (AVC)", "H.265 (HEVC)"],
                      ["Container", "MP4", "MP4"],
                      ["Bitrate", "16 Mbps (CBR)", "45 Mbps (CBR)"],
                      ["Frame Rate", "Match source", "Match source"],
                      ["Audio Codec", "AAC-LC, 384kbps", "AAC-LC, 384kbps"],
                      ["Color Space", "BT.709", "BT.2020 (HDR)"],
                    ].map(([setting, hd, uhd]) => (
                      <tr key={setting} className="hover:bg-surface-container-high/50 transition-colors">
                        <td className="px-4 py-3 text-on-surface font-medium">{setting}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{hd}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{uhd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5 shrink-0">lightbulb</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Pro Tip:</strong> Enable &ldquo;High Quality&rdquo; export to upload at a higher bitrate. YouTube re-encodes all uploads, so higher source quality yields better final results.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: Social media presets ───────────────────────────── */}
          <section id="social" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">phone_iphone</span>
              Social media presets
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox includes one-click presets for all major social platforms. Each preset handles resolution, aspect ratio, duration limits, and codec optimization.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { platform: "Instagram Reels", specs: "1080×1920, 9:16, ≤90s, H.264", icon: "photo_camera" },
                  { platform: "TikTok", specs: "1080×1920, 9:16, ≤10min, H.264", icon: "music_note" },
                  { platform: "Twitter/X", specs: "1280×720, 16:9, ≤140s, H.264", icon: "tag" },
                  { platform: "LinkedIn", specs: "1920×1080, 16:9, ≤10min, H.264", icon: "work" },
                ].map((item) => (
                  <div key={item.platform} className="glass rounded-xl p-4 flex items-start gap-3 group hover:border-primary/30 transition-colors duration-200">
                    <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">{item.icon}</span>
                    <div>
                      <h4 className="text-body-sm font-medium text-on-surface">{item.platform}</h4>
                      <p className="text-body-sm text-on-surface-variant mt-0.5 font-mono text-label-md">{item.specs}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section: Cloud rendering ────────────────────────────────── */}
          <section id="cloud" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">cloud_sync</span>
              Cloud rendering queue
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Offload heavy rendering to Kuvox&apos;s cloud infrastructure. Cloud rendering frees up your local machine and provides enterprise-grade processing power for complex projects.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Cloud rendering features</h4>
                <div className="space-y-3">
                  {[
                    { label: "Speed", desc: "Up to 10× faster than local rendering with distributed GPU clusters." },
                    { label: "Queue", desc: "Submit multiple projects. Jobs are processed in parallel across your plan's allocation." },
                    { label: "Notify", desc: "Receive email and push notifications when renders are complete." },
                    { label: "Versions", desc: "Each cloud render is saved as a version. Download or share directly from the cloud." },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-label-md font-bold rounded shrink-0 mt-0.5">{item.label}</span>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-xl p-5">
                <h4 className="text-body-sm font-semibold text-on-surface mb-3">Cloud credits usage</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">1080p export (1 min)</span>
                    <span className="text-body-sm text-primary font-medium">1 credit</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">4K export (1 min)</span>
                    <span className="text-body-sm text-primary font-medium">3 credits</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">8K export (1 min)</span>
                    <span className="text-body-sm text-primary font-medium">8 credits</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-body-sm text-on-surface">ProRes/DNxHR (1 min)</span>
                    <span className="text-body-sm text-primary font-medium">5 credits</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: Alpha channel ──────────────────────────────────── */}
          <section id="alpha" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">opacity</span>
              Alpha channel exports
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Export video with transparency for compositing in other software. Alpha channel exports are essential for motion graphics, lower thirds, and overlay elements.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">Supported alpha formats</h4>
                <div className="space-y-2">
                  {[
                    { format: "ProRes 4444", desc: "Industry standard for alpha video. Best quality, large file size." },
                    { format: "WebM VP9", desc: "Web-friendly alpha video. Smaller files, good for web overlays." },
                    { format: "PNG Sequence", desc: "Frame-by-frame PNG export with transparency. Maximum flexibility." },
                    { format: "EXR Sequence", desc: "HDR-capable image sequence with float-point alpha. For VFX pipelines." },
                  ].map((item) => (
                    <div key={item.format} className="flex items-start gap-3 py-2 border-b border-outline-variant/20 last:border-b-0">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-label-md font-bold rounded shrink-0 mt-0.5">{item.format}</span>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: Codec reference ────────────────────────────────── */}
          <section id="codecs" className="mb-8 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">settings_applications</span>
              Codec reference
            </h2>
            <div className="space-y-4">
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Codec</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Best For</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium hidden sm:table-cell">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {[
                      ["H.264", "Universal compatibility, web delivery", "Good"],
                      ["H.265 (HEVC)", "High-res with smaller files", "Excellent"],
                      ["ProRes 422", "Professional editing & archival", "Excellent"],
                      ["ProRes 4444", "Alpha channel, VFX compositing", "Reference"],
                      ["DNxHR", "Avid/broadcast workflows", "Excellent"],
                      ["AV1", "Next-gen web streaming", "Excellent"],
                    ].map(([codec, use, quality]) => (
                      <tr key={codec} className="hover:bg-surface-container-high/50 transition-colors">
                        <td className="px-4 py-3 text-on-surface font-medium">{codec}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{use}</td>
                        <td className="px-4 py-3 text-on-surface-variant hidden sm:table-cell">{quality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Next page navigation ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-outline-variant/40">
            <Link to="/help/ai-agent-guide" className="glass rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-all duration-200 flex-1">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
              <div>
                <p className="text-label-md text-on-surface-variant">Previous</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">AI Agent Guide</p>
              </div>
            </Link>
            <Link to="/help/faq" className="glass rounded-xl p-4 flex items-center justify-end gap-3 group hover:border-primary/30 transition-all duration-200 flex-1 text-right">
              <div>
                <p className="text-label-md text-on-surface-variant">Next</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">FAQ</p>
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
