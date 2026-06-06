import { Link } from "react-router";
import { useEffect, useRef } from "react";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Help Center · Kuvox" },
    {
      name: "description",
      content:
        "Master AI video production with Kuvox. Explore guides on automated workflows, troubleshooting, and creative techniques.",
    },
  ];
}

/* ── Data ──────────────────────────────────────────────────────────────────── */

const DOC_CARDS = [
  {
    icon: "rocket_launch",
    title: "Getting Started",
    count: 34,
    description:
      "Set up your account and create your first AI-enhanced project in minutes.",
    links: [
      { label: "Create your workspace", to: "/help/getting-started#workspace" },
      {
        label: "First AI edit walkthrough",
        to: "/help/getting-started#first-edit",
      },
      {
        label: "Interface overview",
        to: "/help/getting-started#interface",
      },
    ],
    to: "/help/getting-started",
  },
  {
    icon: "cloud_upload",
    title: "Upload & Processing",
    count: 21,
    description:
      "Managing media assets, proxy workflows, and high-speed ingestions.",
    links: [
      {
        label: "Supported file formats",
        to: "/help/upload-processing#formats",
      },
      {
        label: "Handling 8K resolutions",
        to: "/help/upload-processing#8k",
      },
      {
        label: "Batch upload management",
        to: "/help/upload-processing#batch",
      },
    ],
    to: "/help/upload-processing",
  },
  {
    icon: "movie_edit",
    title: "Editing Guide",
    count: 45,
    description:
      "Master the timeline, transitions, and multi-track layering techniques.",
    links: [
      { label: "Timeline shortcuts", to: "/help/editing-guide#shortcuts" },
      { label: "Working with mask layers", to: "/help/editing-guide#masks" },
      { label: "Audio ducking basics", to: "/help/editing-guide#audio" },
    ],
    to: "/help/editing-guide",
  },
  {
    icon: "export_notes",
    title: "Rendering & Export",
    count: 18,
    description:
      "Optimizing your final output for social media, broadcast, or web.",
    links: [
      {
        label: "Export presets for YouTube",
        to: "/help/rendering-export#youtube",
      },
      {
        label: "Cloud rendering queue",
        to: "/help/rendering-export#cloud",
      },
      {
        label: "Alpha channel exports",
        to: "/help/rendering-export#alpha",
      },
    ],
    to: "/help/rendering-export",
  },
  {
    icon: "psychology",
    title: "AI Agent Guide",
    count: 29,
    description:
      "How to communicate with your AI editor and automate complex tasks.",
    links: [
      {
        label: "Prompt engineering for video",
        to: "/help/ai-agent-guide#prompts",
      },
      {
        label: "Auto-scene detection",
        to: "/help/ai-agent-guide#scene-detection",
      },
      {
        label: "AI Voice cloning setup",
        to: "/help/ai-agent-guide#voice-cloning",
      },
    ],
    to: "/help/ai-agent-guide",
  },
  {
    icon: "payments",
    title: "Account & Billing",
    count: 12,
    description:
      "Manage subscriptions, team seats, and credit-based AI processing.",
    links: [
      { label: "Updating payment methods", to: "/help/faq#payments" },
      { label: "Understanding AI Credits", to: "/help/faq#credits" },
      { label: "Enterprise seat management", to: "/help/faq#enterprise" },
    ],
    to: "/help/faq",
  },
] as const;

const QUICK_TAGS = [
  "Getting Started",
  "Upload & Processing",
  "Editing",
  "AI Features",
  "Exporting",
  "Billing",
] as const;

const ACADEMY_CARDS = [
  {
    gradient: "from-primary/30 via-primary-container/20 to-surface-container",
    title: "AI Agent Guide",
    description:
      "Learn how to prompt the AI to edit full length social videos from raw b-roll.",
  },
  {
    gradient:
      "from-secondary/20 via-secondary-container/10 to-surface-container",
    title: "Video Editing Masterclass",
    description:
      "A comprehensive guide from pro editors on storytelling and pacing.",
  },
  {
    gradient: "from-tertiary/20 via-tertiary-container/10 to-surface-container",
    title: "Best Workflow Tutorials",
    description:
      "Expert tips on organizing assets and speeding up your review cycles.",
  },
] as const;

const AI_TOOLS = [
  { icon: "subtitles", label: "Auto Captioning" },
  { icon: "content_cut", label: "Smart Cut" },
  { icon: "palette", label: "AI Color Grade" },
  { icon: "grid_view", label: "Scene Detection" },
  { icon: "volume_up", label: "Voice Enhance" },
  { icon: "cleaning_services", label: "BG Cleanup" },
] as const;

const DEV_RESOURCES = [
  {
    icon: "menu_book",
    title: "API Reference",
    description: "Endpoints for programmatic video generation.",
  },
  {
    icon: "integration_instructions",
    title: "Integrations",
    description: "Connect with Adobe, Davinci, and more.",
  },
  {
    icon: "webhook",
    title: "Webhooks",
    description: "Real-time alerts for render completion.",
  },
  {
    icon: "code",
    title: "SDK",
    description: "Python and Node.js wrappers for our API.",
  },
] as const;

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function HelpCenter() {
  const gridRef = useRef<HTMLDivElement>(null);

  /* Mouse-tracking radial glow on bento cards */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = grid.querySelectorAll<HTMLDivElement>(".bento-card");

    function handleMouseMove(this: HTMLDivElement, e: MouseEvent) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(192, 193, 255, 0.05), transparent 80%), rgba(32, 31, 34, 0.7)`;
    }

    function handleMouseLeave(this: HTMLDivElement) {
      this.style.background = "rgba(32, 31, 34, 0.7)";
    }

    cards.forEach((card) => {
      card.addEventListener("mousemove", handleMouseMove);
      card.addEventListener("mouseleave", handleMouseLeave);
    });

    return () => {
      cards.forEach((card) => {
        card.removeEventListener("mousemove", handleMouseMove);
        card.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-16 sm:gap-20 lg:gap-24">
      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="text-center animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight mb-4">
          Help Center
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
          Master the art of AI video production. Explore our deep dives into
          automated workflows, troubleshooting, and creative techniques.
        </p>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto relative mb-6 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline">
              search
            </span>
          </div>
          <input
            type="text"
            placeholder="Search articles, guides, tutorials, and FAQs..."
            className="w-full bg-surface-container-high border border-outline-variant rounded-xl py-4 pl-12 pr-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-outline transition-all duration-300 focus:scale-[1.02] focus:shadow-xl"
          />
        </div>

        {/* Quick-filter tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_TAGS.map((tag) => (
            <span
              key={tag}
              className="text-label-md font-semibold tracking-wider px-3 py-1 bg-surface-container rounded-full text-on-surface-variant cursor-pointer hover:bg-surface-container-highest transition-colors duration-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── Popular Documentation Grid ─────────────────────────────────── */}
      <section
        className="animate-fade-in-up"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight">
            Popular Documentation
          </h2>
          <Link
            to="/help"
            className="text-primary text-body-sm hover:underline hidden sm:inline"
          >
            View all collections
          </Link>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {DOC_CARDS.map((card) => (
            <div
              key={card.title}
              className="glass bento-card p-6 rounded-xl flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <span className="material-symbols-outlined text-primary text-3xl">
                  {card.icon}
                </span>
                <span className="text-label-md font-semibold tracking-wider text-outline">
                  {card.count} articles
                </span>
              </div>
              <div>
                <h3 className="text-headline-md font-semibold mb-2">
                  {card.title}
                </h3>
                <p className="text-body-sm text-on-surface-variant mb-4">
                  {card.description}
                </p>
                <div className="space-y-2">
                  {card.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="block text-primary text-body-sm hover:underline decoration-primary/30"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kuvox Academy ──────────────────────────────────────────────── */}
      <section
        className="animate-fade-in-up -mx-4 sm:-mx-6 lg:-mx-container-padding"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="bg-surface-container-low py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-container-padding">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-primary text-label-md font-semibold uppercase tracking-widest mb-2 block">
                  Kuvox Academy
                </span>
                <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight">
                  Level up your editing skills
                </h2>
              </div>
              <button className="flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200">
                Explore Academy{" "}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {ACADEMY_CARDS.map((card) => (
                <div key={card.title} className="group cursor-pointer">
                  {/* Gradient placeholder thumbnail */}
                  <div className="aspect-video rounded-xl overflow-hidden mb-4 relative">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
                      <span className="material-symbols-outlined text-white text-5xl">
                        play_circle
                      </span>
                    </div>
                  </div>
                  <h3 className="text-headline-md font-semibold mb-2 group-hover:text-primary transition-colors duration-200">
                    {card.title}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mb-4">
                    {card.description}
                  </p>
                  <button className="text-body-sm text-primary font-bold">
                    Learn More
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Master AI-Driven Tools ──────────────────────────────────────── */}
      <section
        className="animate-fade-in-up"
        style={{ animationDelay: "0.3s" }}
      >
        <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight mb-12 text-center">
          Master AI-Driven Tools
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {AI_TOOLS.map((tool) => (
            <div
              key={tool.label}
              className="glass p-4 rounded-xl text-center group hover:bg-primary-container transition-all duration-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-primary group-hover:text-on-primary-container mb-3 text-3xl">
                {tool.icon}
              </span>
              <h4 className="text-label-md font-bold tracking-wider group-hover:text-on-primary-container transition-colors duration-200">
                {tool.label}
              </h4>
            </div>
          ))}
        </div>
      </section>

      {/* ── Developer Resources ─────────────────────────────────────────── */}
      <section
        className="border-t border-outline-variant pt-16 sm:pt-20 lg:pt-24 animate-fade-in-up"
        style={{ animationDelay: "0.4s" }}
      >
        <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight mb-8">
          Developer Resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {DEV_RESOURCES.map((resource) => (
            <a
              key={resource.title}
              href="#"
              className="glass p-6 rounded-xl hover:bg-surface-container transition-all duration-200 group"
            >
              <span className="material-symbols-outlined text-primary mb-3 block group-hover:scale-110 transition-transform duration-200">
                {resource.icon}
              </span>
              <h3 className="text-headline-md font-semibold mb-2">
                {resource.title}
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                {resource.description}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
