import { Link } from "react-router";

import type { Route } from "./+types/about";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "About Us · Kuvox" },
    {
      name: "description",
      content:
        "Kuvox by Lumina AI empowers creators with surgical precision. Learn about our mission, team, and commitment to democratizing high-fidelity creative computation.",
    },
  ];
}

/* ── Data ────────────────────────────────────────────────────────────────── */

const TEAM_MEMBERS = [
  {
    name: "Nghiem Gia Bao",
    role: "Team Lead",
    bio: "In charge of overall vision, strategy, architecture, and execution.",
  },
  {
    name: "Nguyen Hoang Dieu Chau",
    role: "AI Engineer & Full Stack Developer",
    bio: "Responsible for AI development and end-to-end system integration, ensuring seamless user experiences.",
  },
  {
    name: "Nguyen Lan Huong",
    role: "AI Engineer & Frontend Developer",
    bio: "Focuses on AI model development and crafting intuitive user interfaces for our creative tools.",
  },
  {
    name: "Tran Anh Nguyet",
    role: "AI Engineer & Backend Developer",
    bio: "Specializes in AI model optimization and building scalable backend infrastructure to support our services.",
  },
] as const;

const STATUS_ITEMS = [
  { label: "AI Processing Core", status: "Operational" },
  { label: "Media Asset Delivery", status: "Operational" },
  { label: "API Gateway", status: "Operational" },
] as const;

const SOCIAL_LINKS = [
  { icon: "terminal", label: "Twitter / X", href: "#" },
  { icon: "work", label: "LinkedIn", href: "#" },
  { icon: "forum", label: "Discord", href: "#" },
] as const;

const CHANGELOG = [
  {
    version: "v2.4.0",
    date: "Oct 24, 2024",
    title: "Neural Frame Interpolation Engine",
    description:
      "Introduced a new AI model for 4x slower motion with zero artifacts. Optimized for 8K RED and ARRI footage formats.",
    changes: [
      "Reduced render times by 45% on M-series chips",
      "Added support for ProRes RAW metadata preservation",
      "Fixed color drift in Rec.2020 exports",
    ],
    isLatest: true,
  },
  {
    version: "v2.3.8",
    date: "Oct 12, 2024",
    title: "Batch Proxy Generation",
    description:
      "Cloud-native proxy workflow for collaborative teams. Sync project states across timezones instantly.",
    changes: [],
    isLatest: false,
  },
] as const;

const CONTACTS = [
  {
    icon: "mail",
    title: "General Inquiries",
    email: "hello@lumina-ai.com",
  },
  {
    icon: "support_agent",
    title: "Technical Support",
    email: "support@lumina-ai.com",
  },
  {
    icon: "business_center",
    title: "Enterprise Sales",
    email: "enterprise@lumina-ai.com",
  },
] as const;

const OFFICES = [
  {
    city: "San Francisco",
    lines: [
      "100 Innovation Way",
      "Suite 400",
      "San Francisco, CA 94105",
      "United States",
    ],
  },
  {
    city: "London",
    lines: [
      "The AI Hub",
      "15 Silicon Roundabout",
      "London, EC1V 1AB",
      "United Kingdom",
    ],
  },
  {
    city: "Ho Chi Minh City",
    lines: [
      "Yersin",
      "District 1",
      "Ho Chi Minh City",
      "Vietnam",
    ],
  },
  {
    city: "Dubai",
    lines: [
      "Burj Khalifa",
      "Downtown Dubai",
      "Dubai, UAE",
    ],
  },
] as const;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

// The marketing layout applies px-4 sm:px-6 lg:px-container-padding.
// These classes break out of that padding for edge-to-edge sections.
const BLEED_OUT = "-mx-4 sm:-mx-6 lg:-mx-container-padding";
const BLEED_PAD = "px-4 sm:px-6 lg:px-container-padding";

/* ── Component ───────────────────────────────────────────────────────────── */

export default function About() {
  return (
    <div className="w-full self-start flex flex-col">
      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section
        className={`${BLEED_OUT} relative min-h-[400px] sm:min-h-[500px] lg:min-h-[500px] flex flex-col items-center justify-center ${BLEED_PAD} py-16 sm:py-20 lg:py-24 border-b border-outline-variant`}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(128,131,255,0.08) 0%, transparent 70%)",
        }}
      >
        <div className="max-w-4xl text-center space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant">
            <span className="text-label-md text-primary uppercase tracking-widest">
              Our Mission
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-display font-semibold text-on-surface tracking-tight leading-tight">
            The standard for AI media precision.
          </h1>
          <p className="text-body-sm sm:text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Kuvox by Lumina AI empowers creators with surgical precision. We
            build professional tools that recede into the background, allowing
            your creative vision to take the foreground. Our mission is to
            democratize high-fidelity creative computation through advanced
            artificial intelligence, ensuring that every artist has access to the
            tools they need to realize their vision without compromise.
          </p>
        </div>
      </section>

      {/* ── Team / Founder Section ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto w-full border-b border-outline-variant">
        <div className="mb-10 sm:mb-16 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-3 sm:mb-4 tracking-tight">
            Founders
          </h2>
          <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
            Founded by a team of passionate creators and technologists.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {TEAM_MEMBERS.map((member) => (
            <div
              key={member.name}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-5 sm:p-6 text-center group hover:border-primary/50 transition-colors"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-surface-container-highest rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl sm:text-4xl">
                  person
                </span>
              </div>
              <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-1">
                {member.name}
              </h3>
              <p className="text-label-md text-primary mb-3 sm:mb-4">
                {member.role}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bento Grid: Status & Social ───────────────────────────────── */}
      <section className="py-10 sm:py-12 lg:py-16 max-w-7xl mx-auto w-full border-b border-outline-variant">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-element-gap">
          {/* System Status */}
          <div className="lg:col-span-8 p-5 sm:p-6 lg:p-8 bg-surface-container-low border border-outline-variant rounded-xl flex flex-col justify-between group hover:bg-surface-container-high transition-colors">
            <div>
              <div className="flex justify-between items-start mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-on-surface tracking-tight">
                  System Status
                </h2>
                <span className="material-symbols-outlined text-primary">
                  analytics
                </span>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {STATUS_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-3 sm:p-4 bg-surface-container border border-outline-variant rounded-sm"
                  >
                    <span className="text-body-sm">{item.label}</span>
                    <span className="text-secondary text-label-sm font-semibold">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 sm:mt-8 pt-4 border-t border-outline-variant flex items-center gap-2 text-on-surface-variant text-label-md">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              99.99% Uptime last 30 days
            </div>
          </div>

          {/* Connect / Social */}
          <div className="lg:col-span-4 p-5 sm:p-6 lg:p-8 bg-surface-container-low border border-outline-variant rounded-xl flex flex-col justify-between">
            <div>
              <h2 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-6 sm:mb-8">
                Connect
              </h2>
              <div className="flex flex-col gap-3 sm:gap-4">
                {SOCIAL_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between p-3 sm:p-4 bg-surface-container border border-outline-variant rounded-sm hover:bg-primary-container hover:text-on-primary-container transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined">
                        {link.icon}
                      </span>
                      <span className="text-label-md">{link.label}</span>
                    </div>
                    <span className="material-symbols-outlined text-sm">
                      north_east
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-6 sm:mt-8">
              <p className="text-label-sm text-on-surface-variant leading-relaxed">
                Join our community of over 50,000 professional creators and
                developers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Changelog Section ─────────────────────────────────────────── */}
      <section
        className={`${BLEED_OUT} py-16 sm:py-20 lg:py-24 border-b border-outline-variant bg-surface-container-lowest`}
      >
        <div className={`${BLEED_PAD} max-w-7xl mx-auto`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 sm:mb-16 gap-6 sm:gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-3 sm:mb-4 tracking-tight">
                Continuous Iteration
              </h2>
              <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
                We ship updates weekly. Our focus is on increasing the speed and
                reliability of your creative workflow.
              </p>
            </div>
            <button className="flex items-center gap-2 text-label-md text-primary border border-primary px-4 sm:px-6 py-2.5 sm:py-3 rounded-sm hover:bg-primary/10 transition-colors whitespace-nowrap">
              View Full Changelog
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>

          <div className="space-y-px bg-outline-variant border border-outline-variant rounded-sm overflow-hidden">
            {CHANGELOG.map((entry) => (
              <div
                key={entry.version}
                className="grid grid-cols-1 md:grid-cols-4 bg-surface p-5 sm:p-6 lg:p-8 gap-4 sm:gap-6 lg:gap-8 group"
              >
                <div className="md:col-span-1">
                  <span
                    className={`text-label-md px-3 py-1 rounded-sm ${entry.isLatest
                      ? "text-primary bg-primary/10"
                      : "text-on-surface-variant bg-surface-container-highest"
                      }`}
                  >
                    {entry.version}
                  </span>
                  <div className="mt-3 sm:mt-4 text-label-sm text-on-surface-variant uppercase tracking-widest">
                    {entry.date}
                  </div>
                </div>
                <div className="md:col-span-3 space-y-3 sm:space-y-4">
                  <h3 className="text-body-lg sm:text-headline-md font-medium group-hover:text-primary transition-colors">
                    {entry.title}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {entry.description}
                  </p>
                  {entry.changes.length > 0 && (
                    <ul className="space-y-1.5 sm:space-y-2 text-on-surface-variant text-body-sm list-disc list-inside">
                      {entry.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy & Terms ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto w-full border-b border-outline-variant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12 lg:gap-16">
          <div className="space-y-6 sm:space-y-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">shield</span>
            </div>
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold">
              Privacy First
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              Your data is your IP. Lumina AI never uses customer media to train
              our public models. All processing occurs in sandboxed environments
              with military-grade encryption (AES-256) at rest and in transit.
            </p>
            <Link
              to="/privacy"
              className="inline-block text-label-md text-primary underline underline-offset-4 hover:text-primary-container transition-colors"
            >
              Read Privacy Policy
            </Link>
          </div>
          <div className="space-y-6 sm:space-y-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">gavel</span>
            </div>
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold">
              Fair Usage
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              Our terms are designed for professional clarity. We provide clear
              throughput limits on Enterprise plans and maintain a strict
              anti-abuse policy to ensure high performance for all creators.
            </p>
            <Link
              to="/terms"
              className="inline-block text-label-md text-tertiary underline underline-offset-4 hover:text-tertiary-container transition-colors"
            >
              Read Terms of Service
            </Link>
          </div>
        </div>
      </section>

      {/* ── Contact Section ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 max-w-7xl mx-auto w-full border-b border-outline-variant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12 lg:gap-16">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4 sm:mb-6 tracking-tight">
              Get in Touch
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant mb-6 sm:mb-8">
              Whether you&apos;re looking for enterprise solutions, need
              technical support, or want to explore partnership opportunities,
              our team is here to help.
            </p>
            <div className="space-y-5 sm:space-y-6">
              {CONTACTS.map((contact) => (
                <div
                  key={contact.email}
                  className="flex items-start gap-3 sm:gap-4"
                >
                  <span className="material-symbols-outlined text-primary mt-0.5 sm:mt-1">
                    {contact.icon}
                  </span>
                  <div>
                    <h4 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-1">
                      {contact.title}
                    </h4>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4 sm:mb-6 tracking-tight">
              Global Offices
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {OFFICES.map((office) => (
                <div
                  key={office.city}
                  className="bg-surface-container-low p-5 sm:p-6 rounded-xl border border-outline-variant hover:border-primary/50 transition-colors"
                >
                  <h4 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-2">
                    {office.city}
                  </h4>
                  <p className="text-body-sm text-on-surface-variant leading-relaxed">
                    {office.lines.map((line, i) => (
                      <span key={line}>
                        {line}
                        {i < office.lines.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Visual Anchor / CTA ───────────────────────────────────────── */}
      <section className={`${BLEED_OUT} ${BLEED_PAD} py-16 sm:py-20 lg:py-24`}>
        <div className="relative w-full h-[280px] sm:h-[340px] lg:h-[400px] rounded-xl overflow-hidden border border-outline-variant">
          <img
            alt="Abstract data visualization"
            className="w-full h-full object-cover grayscale opacity-40"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyDbo5yjJa6O7xFq_-jbeE_nHdvfhh_DIcI7EOXvMv4PQnh05fPop7tZkELNrxc8I16l2MpX067gOrPi8-O0VWDVD1c0JqDdRDh3EWnDFMUbgJTjYg03lpf6gsRM4ZgVPNz0yGV1L_Vj6LqWlXZ4d0cXhcNh4Bgk8n5IXJ_viGpuW5MntJZOwQEHHknepQWeVZwwShtZm0PwotbNlcH0YFsKp3PvGwmTwl22HJ18NxO9f4xxfDB7ldML2lXI1HASAycXzOIhNncP0"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 sm:p-8 bg-gradient-to-t from-background via-transparent to-transparent">
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold max-w-2xl">
              Building the future of high-fidelity creative computation.
            </h2>
            <div className="mt-6 sm:mt-8 flex gap-4">
              <button className="bg-on-surface text-surface px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-label-md font-bold hover:bg-primary transition-colors">
                Join the Team
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
