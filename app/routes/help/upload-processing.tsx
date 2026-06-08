import { Link } from "react-router";

import type { Route } from "./+types/upload-processing";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Upload & Processing · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Learn about supported file formats, proxy workflows, batch uploads, and how Kuvox processes your media with AI scene analysis.",
    },
  ];
}

const ON_THIS_PAGE = [
  { id: "formats", label: "Supported file formats" },
  { id: "8k", label: "Handling 8K resolutions" },
  { id: "batch", label: "Batch upload management" },
  { id: "proxy", label: "Proxy workflow" },
  { id: "scene-analysis", label: "AI scene analysis" },
] as const;

const FORMATS = [
  { category: "Video", formats: "MP4, MOV, AVI, MKV, WebM, ProRes, DNxHR, H.264, H.265/HEVC, VP9, AV1" },
  { category: "Audio", formats: "WAV, MP3, AAC, FLAC, OGG, AIFF, M4A" },
  { category: "Image", formats: "PNG, JPEG, WebP, TIFF, BMP, EXR (HDR), SVG" },
  { category: "Subtitles", formats: "SRT, VTT, ASS, SSA" },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export default function UploadProcessing() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">cloud_upload</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Upload &amp; Processing
                </h1>
                <p className="text-body-sm text-on-surface-variant"></p>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              Kuvox handles media ingestion intelligently — from automatic proxy generation for 8K footage to AI-powered scene analysis. This guide covers everything you need to know about getting your media into the platform.
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

          {/* ── Section: Supported file formats ────────────────────────── */}
          <section id="formats" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">description</span>
              Supported file formats
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox supports a wide range of professional and consumer media formats. Files are automatically transcoded on upload when necessary for optimal editing performance.
              </p>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium w-28">Category</th>
                      <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Supported Formats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {FORMATS.map((row) => (
                      <tr key={row.category} className="hover:bg-surface-container-high/50 transition-colors">
                        <td className="px-4 py-3 text-on-surface font-medium">{row.category}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{row.formats}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 shrink-0">warning</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Note:</strong> DRM-protected files cannot be imported. Ensure your media is free of copy protection before uploading.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: Handling 8K resolutions ───────────────────────── */}
          <section id="8k" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">8k</span>
              Handling 8K resolutions
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Kuvox natively supports 8K (7680×4320) and higher resolutions. To maintain smooth playback, the platform automatically generates lower-resolution proxies while preserving the original files for final export.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">How 8K processing works</h4>
                <div className="space-y-3">
                  {[
                    { step: "Upload", desc: "Your 8K files are uploaded to Kuvox's cloud storage with resumable multipart uploads." },
                    { step: "Analysis", desc: "The AI scene analyzer runs on the full-resolution source, detecting scenes, objects, and audio events." },
                    { step: "Proxy Gen", desc: "A 1080p proxy is generated for real-time timeline editing. The original file remains untouched." },
                    { step: "Conform", desc: "At export time, all edits are conformed back to the original 8K source for maximum quality." },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-label-md font-bold rounded shrink-0 mt-0.5">{item.step}</span>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: Batch upload ───────────────────────────────────── */}
          <section id="batch" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">upload_file</span>
              Batch upload management
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Upload hundreds of files at once with Kuvox&apos;s batch uploader. Files are queued, deduplicated, and processed in parallel to minimize wait time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: "folder_open", title: "Drag & Drop Folders", desc: "Drag entire folders into the upload zone. Directory structure is preserved as bins in your project." },
                  { icon: "content_copy", title: "Deduplication", desc: "Kuvox automatically detects duplicate files and prompts you before re-uploading." },
                  { icon: "speed", title: "Parallel Processing", desc: "Up to 8 files are processed simultaneously. Large files use multipart chunked uploads." },
                  { icon: "cloud_done", title: "Resume Uploads", desc: "If your connection drops, uploads automatically resume from where they left off." },
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

          {/* ── Section: Proxy workflow ─────────────────────────────────── */}
          <section id="proxy" className="mb-12 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">swap_horiz</span>
              Proxy workflow
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Proxies are lightweight copies of your media used for editing. They allow smooth playback on any device while preserving the original quality for export.
              </p>
              <div className="glass rounded-xl p-5">
                <h4 className="text-body-sm font-semibold text-on-surface mb-3">Proxy Settings</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Resolution</span>
                    <span className="text-body-sm text-on-surface-variant">1080p (default), 720p, 540p</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Codec</span>
                    <span className="text-body-sm text-on-surface-variant">H.264 (fast decode)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="text-body-sm text-on-surface">Auto-generate</span>
                    <span className="text-body-sm text-on-surface-variant">On (for files &gt; 4K)</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-body-sm text-on-surface">Storage location</span>
                    <span className="text-body-sm text-on-surface-variant">Cloud (default) or local cache</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section: AI scene analysis ──────────────────────────────── */}
          <section id="scene-analysis" className="mb-8 scroll-mt-24">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">visibility</span>
              AI scene analysis
            </h2>
            <div className="space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                When you upload media, Kuvox&apos;s AI automatically analyzes each file to detect scenes, identify objects and people, transcribe speech, and classify audio events. This metadata powers features like smart search, auto-editing, and scene detection.
              </p>
              <div className="glass rounded-xl p-5 space-y-3">
                <h4 className="text-body-sm font-semibold text-on-surface">What the AI detects</h4>
                <div className="flex flex-wrap gap-2">
                  {["Scene boundaries", "Object detection", "Face recognition", "Speech transcription", "Music vs. dialogue", "Camera motion", "Color palette", "Emotion analysis"].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary text-label-md font-medium rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5 shrink-0">lightbulb</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Pro Tip:</strong> Scene analysis results power the AI command bar. The more footage you upload, the smarter the AI becomes at understanding your project context.
                </p>
              </div>
            </div>
          </section>

          {/* ── Next page navigation ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-8 border-t border-outline-variant/40">
            <Link to="/help/getting-started" className="glass rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-all duration-200 flex-1">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
              <div>
                <p className="text-label-md text-on-surface-variant">Previous</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Getting Started</p>
              </div>
            </Link>
            <Link to="/help/editing-guide" className="glass rounded-xl p-4 flex items-center justify-end gap-3 group hover:border-primary/30 transition-all duration-200 flex-1 text-right">
              <div>
                <p className="text-label-md text-on-surface-variant">Next</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Editing Guide</p>
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
