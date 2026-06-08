import { Link } from "react-router";
import { useState } from "react";

import type { Route } from "./+types/faq";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "FAQ · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Frequently asked questions about Kuvox — AI video editing, pricing, account management, technical requirements, and more.",
    },
  ];
}

/* ── FAQ Data ──────────────────────────────────────────────────────────── */

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  icon: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "General",
    icon: "info",
    items: [
      {
        question: "What is Kuvox?",
        answer:
          "Kuvox is an AI-powered video editing platform that lets you edit video using natural language commands. Instead of manually manipulating clips on a timeline, you describe what you want and the AI executes it. It also includes a full professional editing suite for manual control.",
      },
      {
        question: "Do I need video editing experience to use Kuvox?",
        answer:
          "No. Kuvox is designed for both beginners and professionals. Beginners can use the AI agent to describe edits in plain language, while experienced editors can use the full timeline and keyboard shortcuts for manual precision. The AI adapts to your skill level.",
      },
      {
        question: "What platforms does Kuvox support?",
        answer:
          "Kuvox runs as a web application in Chrome, Firefox, Edge, and Safari. There is also a desktop app for macOS and Windows with GPU-accelerated rendering, and a companion mobile app for iOS and Android for reviewing and approving edits on the go.",
      },
    ],
  },
  {
    title: "AI Features",
    icon: "psychology",
    items: [
      {
        question: "How does the AI understand my editing instructions?",
        answer:
          "Kuvox uses a large language model fine-tuned specifically for video editing. When you type a command, the AI analyzes your footage's metadata (scene detection, object recognition, speech transcription) and maps your natural language instruction to precise timeline operations.",
      },
      {
        question: "Can the AI make mistakes?",
        answer:
          "Yes. The AI makes its best interpretation of your instructions, but complex or ambiguous prompts may produce unexpected results. Every AI edit creates a version checkpoint, so you can always undo or refine. We recommend reviewing all AI edits before exporting.",
      },
      {
        question: "What are AI Credits and how do they work?",
        answer:
          "AI Credits are consumed when you use AI-powered features like natural language editing, voice cloning, auto-scene detection, and cloud rendering. Each plan includes a monthly credit allocation. Unused credits do not roll over. You can purchase additional credit packs from Settings → Billing.",
      },
      {
        question: "Is my content used to train the AI?",
        answer:
          "No. Your video content, voice clones, and editing data are never used to train Kuvox's AI models. All processing happens in isolated, encrypted environments. Your creative work remains entirely yours.",
      },
    ],
  },
  {
    title: "Billing & Plans",
    icon: "payments",
    items: [
      {
        question: "What plans are available?",
        answer:
          "Kuvox offers a Free tier (5 GB storage, 30 AI credits/month), a Pro plan ($19/month — 100 GB storage, 500 credits), a Team plan ($49/seat/month — unlimited storage, 2000 credits), and Enterprise (custom pricing). All paid plans include priority cloud rendering and advanced AI features.",
      },
      {
        question: "Can I cancel or change my plan anytime?",
        answer:
          "Yes. You can upgrade, downgrade, or cancel your subscription at any time from Settings → Billing. When you cancel, your account continues to work until the end of the current billing period. After that, it reverts to the Free tier — your projects are preserved but some features are limited.",
      },
      {
        question: "Do you offer student or educator discounts?",
        answer:
          "Yes! Students and educators get 50% off Pro and Team plans. Verify your academic status through our partner SheerID at /pricing/student-verification. The discount applies for the duration of your enrollment.",
      },
    ],
  },
  {
    title: "Technical",
    icon: "build",
    items: [
      {
        question: "What are the minimum system requirements?",
        answer:
          "For the web app: a modern browser with WebGL 2.0 support and at least 8 GB RAM. For the desktop app: macOS 12+ or Windows 10+, 16 GB RAM recommended, and a dedicated GPU (NVIDIA GTX 1060 / AMD RX 580 or better) for GPU-accelerated playback and rendering.",
      },
      {
        question: "What video formats does Kuvox support?",
        answer:
          "Kuvox supports MP4, MOV, AVI, MKV, WebM, ProRes, DNxHR, H.264, H.265/HEVC, VP9, and AV1 for video. Audio: WAV, MP3, AAC, FLAC, OGG, AIFF. Images: PNG, JPEG, WebP, TIFF, EXR. Subtitles: SRT, VTT, ASS. See the Upload & Processing guide for full details.",
      },
      {
        question: "Can I use Kuvox offline?",
        answer:
          "The desktop app supports limited offline editing. You can work on locally cached projects without an internet connection. AI features, cloud rendering, and team collaboration require an active connection. Changes are synced automatically when you reconnect.",
      },
      {
        question: "How secure is my data?",
        answer:
          "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Your media is stored in isolated cloud storage buckets. Kuvox is SOC 2 Type II certified and GDPR compliant. Enterprise customers can choose regional data residency (US, EU, or APAC).",
      },
    ],
  },
];

/* ── Accordion Item ────────────────────────────────────────────────────── */

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-outline-variant/30 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-1 text-left group"
      >
        <span className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors duration-200 pr-4">
          {item.question}
        </span>
        <span
          className={`material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 transition-transform duration-300 ease-out ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? "500px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <p className="text-body-sm text-on-surface-variant leading-relaxed pb-4 px-1">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function Faq() {
  return (
    <>
        <article className="flex-grow min-w-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Hero */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">help</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Frequently Asked Questions
                </h1>
              </div>
            </div>
            <p className="text-body-lg text-on-surface-variant max-w-3xl">
              Quick answers to the most common questions about Kuvox. Can&apos;t find what you&apos;re looking for? Reach out to our support team.
            </p>
          </div>

          {/* FAQ Categories */}
          <div className="space-y-8">
            {FAQ_CATEGORIES.map((category) => (
              <section key={category.title} id={category.title.toLowerCase().replace(/\s+/g, "-")} className="scroll-mt-24">
                <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">{category.icon}</span>
                  {category.title}
                </h2>
                <div className="glass rounded-xl px-5">
                  {category.items.map((item) => (
                    <FaqAccordion key={item.question} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Contact support CTA */}
          <div className="mt-12 glass rounded-xl p-6 sm:p-8 text-center">
            <span className="material-symbols-outlined text-primary text-4xl mb-4 block">support_agent</span>
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">
              Still have questions?
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-6 max-w-lg mx-auto">
              Our support team is available 24/7 to help you with any issues. Typical response time is under 2 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#" className="bg-primary text-on-primary px-6 py-2.5 rounded-lg text-label-md font-medium hover:bg-primary-fixed transition-colors duration-200 inline-flex items-center gap-2 justify-center">
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Start Live Chat
              </a>
              <a href="#" className="border border-outline-variant text-on-surface px-6 py-2.5 rounded-lg text-label-md font-medium hover:bg-surface-container-high transition-colors duration-200 inline-flex items-center gap-2 justify-center">
                <span className="material-symbols-outlined text-[18px]">email</span>
                Email Support
              </a>
            </div>
          </div>

          {/* ── Prev page navigation ───────────────────────────────────── */}
          <div className="flex gap-3 pt-8 mt-8 border-t border-outline-variant/40">
            <Link to="/help/rendering-export" className="glass rounded-xl p-4 flex items-center gap-3 group hover:border-primary/30 transition-all duration-200 flex-1">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_back</span>
              <div>
                <p className="text-label-md text-on-surface-variant">Previous</p>
                <p className="text-body-sm font-medium text-on-surface group-hover:text-primary transition-colors">Rendering &amp; Export</p>
              </div>
            </Link>
          </div>
        </article>

        {/* ── Right rail: Category nav — desktop only ──────────────────── */}
        <aside className="hidden lg:block w-48 shrink-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="sticky top-24">
            <h4 className="text-label-md font-bold tracking-wider text-on-surface-variant mb-3 uppercase">Categories</h4>
            <nav className="space-y-2 border-l border-outline-variant/40 pl-3">
              {FAQ_CATEGORIES.map((cat) => (
                <a
                  key={cat.title}
                  href={`#${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200"
                >
                  {cat.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>
    </>
  );
}
