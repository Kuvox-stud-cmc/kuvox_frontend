import { Link } from "react-router";

import type { Route } from "./+types/contact-sales";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Contact Sales · Kuvox" },
    {
      name: "description",
      content:
        "Get in touch with our enterprise sales team. We'll help you architect the perfect Kuvox deployment for your organization.",
    },
  ];
}

/* ── Benefits sidebar data ───────────────────────────────────────────────── */

const BENEFITS = [
  {
    icon: "speed",
    title: "Scalable Processing",
    description: "Petabyte-scale parallel processing architecture.",
  },
  {
    icon: "groups",
    title: "RBAC & SSO",
    description: "Granular roles, single sign-on, unified billing.",
  },
  {
    icon: "shield",
    title: "SOC2 Compliance",
    description: "End-to-end encryption, dedicated VPC options.",
  },
  {
    icon: "dns",
    title: "Flexible Deployment",
    description: "SaaS, dedicated cloud, or on-premises.",
  },
] as const;

/* ── Company size options ────────────────────────────────────────────────── */

const COMPANY_SIZES = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–1,000 employees",
  "1,001–5,000 employees",
  "5,000+ employees",
] as const;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function ContactSales() {
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
          Get in touch with our sales team
        </h1>
        <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
          Tell us about your organization and we&apos;ll help you find the right
          solution.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 sm:gap-6 md:gap-8">
        {/* ── Left: Contact Form ──────────────────────────────────────── */}
        <div className="md:col-span-3">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="bg-surface-container border border-outline-variant rounded-xl p-4 sm:p-5 md:p-6 lg:p-8 flex flex-col gap-4 sm:gap-5 md:gap-6"
          >
            <h2 className="text-headline-md font-semibold text-on-surface">
              Contact Details
            </h2>

            {/* Name */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="contact-name"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Full name
              </label>
              <input
                id="contact-name"
                type="text"
                placeholder="Your name"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Work email */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="contact-email"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Work email
              </label>
              <input
                id="contact-email"
                type="email"
                placeholder="you@company.com"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Company + Job title row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="contact-company"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  Company
                </label>
                <input
                  id="contact-company"
                  type="text"
                  placeholder="Company name"
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="contact-title"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  Job title
                </label>
                <input
                  id="contact-title"
                  type="text"
                  placeholder="Your role"
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            {/* Company size */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="contact-size"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Company size
              </label>
              <select
                id="contact-size"
                defaultValue=""
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors appearance-none"
              >
                <option value="" disabled>
                  Select company size
                </option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="contact-message"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Message{" "}
                <span className="text-on-surface-variant/50">(optional)</span>
              </label>
              <textarea
                id="contact-message"
                rows={4}
                placeholder="Tell us about your use case and requirements…"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 sm:py-3.5 rounded-sm font-medium text-label-md hover:bg-primary-fixed transition-colors duration-200 mt-2 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                send
              </span>
              Contact Sales
            </button>
          </form>
        </div>

        {/* ── Right: Benefits Sidebar ─────────────────────────────────── */}
        <div className="md:col-span-2 order-first md:order-last">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 md:gap-6 md:sticky md:top-20 lg:top-24">
            <h2 className="text-headline-md font-semibold text-on-surface">
              Why Enterprise?
            </h2>

            <div className="flex flex-col gap-4 sm:gap-5">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 mt-0.5">
                    <span
                      className="material-symbols-outlined text-primary text-[18px] sm:text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {benefit.icon}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-body-sm font-medium text-on-surface">
                      {benefit.title}
                    </span>
                    <span className="text-label-md text-on-surface-variant">
                      {benefit.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-outline-variant" />

            {/* Cross-link */}
            <Link
              to="/enterprise/request-demo"
              className="flex items-center justify-center gap-2 text-body-sm text-primary hover:text-primary-fixed transition-colors duration-200 font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">
                play_circle
              </span>
              Or request a demo instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
