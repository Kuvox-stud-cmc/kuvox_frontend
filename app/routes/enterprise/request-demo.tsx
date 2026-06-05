import { Link } from "react-router";

import type { Route } from "./+types/request-demo";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Request a Demo · Kuvox" },
    {
      name: "description",
      content:
        "Book a 30-minute guided product demo with our engineering team. See Kuvox in action with your use case.",
    },
  ];
}

/* ── Team size options ───────────────────────────────────────────────────── */

const TEAM_SIZES = [
  "1–5 people",
  "6–20 people",
  "21–50 people",
  "51–200 people",
  "200+ people",
] as const;

/* ── Areas of interest ───────────────────────────────────────────────────── */

const INTERESTS = [
  { id: "scalable-processing", label: "Scalable Processing", icon: "speed" },
  { id: "team-management", label: "Team Management", icon: "groups" },
  {
    id: "security-compliance",
    label: "Security & Compliance",
    icon: "shield",
  },
  { id: "flexible-deployment", label: "Flexible Deployment", icon: "dns" },
] as const;

/* ── What to expect ──────────────────────────────────────────────────────── */

const EXPECTATIONS = [
  {
    icon: "schedule",
    text: "30-minute guided walkthrough",
  },
  {
    icon: "movie_edit",
    text: "See Kuvox in action with your use case",
  },
  {
    icon: "forum",
    text: "Q&A with our engineering team",
  },
  {
    icon: "tune",
    text: "Custom deployment recommendations",
  },
] as const;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function RequestDemo() {
  return (
    <div className="w-full self-start flex flex-col gap-6 sm:gap-8 md:gap-10 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        to="/enterprise"
        className="flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200 group w-fit"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform duration-200">
          arrow_back
        </span>
        Back to Enterprise
      </Link>

      {/* Page heading */}
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
          Book a guided product demo
        </h1>
        <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
          See how Kuvox can transform your team&apos;s media workflow in a
          personalized walkthrough.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 sm:gap-6 md:gap-8">
        {/* ── Left: Demo Request Form ─────────────────────────────────── */}
        <div className="md:col-span-3">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="bg-surface-container border border-outline-variant rounded-xl p-4 sm:p-5 md:p-6 lg:p-8 flex flex-col gap-4 sm:gap-5 md:gap-6"
          >
            <h2 className="text-headline-md font-semibold text-on-surface">
              Your Details
            </h2>

            {/* Name */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="demo-name"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Full name
              </label>
              <input
                id="demo-name"
                type="text"
                placeholder="Your name"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Work email */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="demo-email"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Work email
              </label>
              <input
                id="demo-email"
                type="email"
                placeholder="you@company.com"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Company + Team size row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="demo-company"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  Company
                </label>
                <input
                  id="demo-company"
                  type="text"
                  placeholder="Company name"
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="demo-team-size"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  Team size
                </label>
                <select
                  id="demo-team-size"
                  defaultValue=""
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors appearance-none"
                >
                  <option value="" disabled>
                    Select team size
                  </option>
                  {TEAM_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferred date/time */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="demo-datetime"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Preferred date & time{" "}
                <span className="text-on-surface-variant/50">(optional)</span>
              </label>
              <input
                id="demo-datetime"
                type="text"
                placeholder="e.g. Next Tuesday afternoon, or Jun 15 at 2pm EST"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Areas of interest */}
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <span className="text-label-md text-on-surface-variant font-medium">
                Areas of interest
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {INTERESTS.map((interest) => (
                  <label
                    key={interest.id}
                    htmlFor={`interest-${interest.id}`}
                    className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-outline-variant bg-surface-container-low hover:border-primary/40 transition-colors cursor-pointer group/check"
                  >
                    <input
                      id={`interest-${interest.id}`}
                      type="checkbox"
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/30 bg-surface-container-low accent-primary"
                    />
                    <span
                      className="material-symbols-outlined text-on-surface-variant/60 group-hover/check:text-primary text-[18px] transition-colors duration-200"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {interest.icon}
                    </span>
                    <span className="text-body-sm text-on-surface">
                      {interest.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 sm:py-3.5 rounded-sm font-medium text-label-md hover:bg-primary-fixed transition-colors duration-200 mt-2 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                play_circle
              </span>
              Request Demo
            </button>
          </form>
        </div>

        {/* ── Right: What to Expect ───────────────────────────────────── */}
        <div className="md:col-span-2 order-first md:order-last">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6 md:sticky md:top-20 lg:top-24">
            <h2 className="text-headline-md font-semibold text-on-surface">
              What to Expect
            </h2>

            <div className="flex flex-col gap-4 sm:gap-5">
              {EXPECTATIONS.map((item) => (
                <div key={item.icon} className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-primary text-[18px] sm:text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {item.icon}
                    </span>
                  </div>
                  <span className="text-body-sm text-on-surface">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-outline-variant" />

            {/* Cross-link */}
            <Link
              to="/enterprise/contact-sales"
              className="flex items-center justify-center gap-2 text-body-sm text-primary hover:text-primary-fixed transition-colors duration-200 font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">
                mail
              </span>
              Or contact sales directly
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
