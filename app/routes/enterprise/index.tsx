import { Link } from "react-router";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Enterprise · Kuvox" },
    {
      name: "description",
      content:
        "Empower your entire workforce with secure, scalable, and manageable AI media processing. Built to handle enterprise demands with zero compromise on precision.",
    },
  ];
}

/* ── Feature card data ───────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: "speed",
    title: "Scalable Processing",
    description:
      "Designed to handle massive media libraries with parallel processing architecture. Render, transcode, and analyze petabytes of data without throttling.",
    span: "sm:col-span-2",
  },
  {
    icon: "groups",
    title: "Team Management",
    description:
      "Granular role-based access control (RBAC), SSO integration, and unified billing across departments.",
    span: "",
  },
  {
    icon: "shield",
    title: "Security & Compliance",
    description:
      "SOC2 Type II certified. End-to-end encryption for data in transit and at rest. Dedicated VPC options available.",
    span: "",
  },
  {
    icon: "dns",
    title: "Flexible Deployment",
    description:
      "Deploy Kuvox where your data lives. Choose from multi-tenant SaaS, dedicated cloud infrastructure, or on-premises deployments for strict regulatory environments.",
    span: "sm:col-span-2",
  },
] as const;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Enterprise() {
  return (
    <div className="w-full self-start flex flex-col gap-10 sm:gap-16 md:gap-20 lg:gap-24 max-w-7xl mx-auto">
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="text-center flex flex-col items-center gap-3 sm:gap-4 md:gap-6 mt-2 sm:mt-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-display font-semibold text-on-surface tracking-tight max-w-3xl px-2 sm:px-0">
          Kuvox for teams and organizations
        </h1>
        <p className="text-body-sm sm:text-body-lg md:text-headline-md text-on-surface-variant max-w-2xl px-4 sm:px-2">
          Empower your entire workforce with secure, scalable, and manageable AI
          media processing. Built to handle enterprise demands with zero
          compromise on precision.
        </p>

        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0">
          <Link
            to="/enterprise/contact-sales"
            className="bg-primary text-on-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-primary-fixed transition-all hover:scale-105 shadow-[0_0_20px_rgba(192,193,255,0.2)] text-center"
          >
            Contact Sales
          </Link>
          <Link
            to="/enterprise/request-demo"
            className="border border-outline-variant text-on-surface px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-surface-container-high transition-colors text-center"
          >
            Request a demo
          </Link>
        </div>
      </section>

      {/* ── Bento Grid Features ──────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-element-gap w-full">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className={[
              "bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col gap-3 sm:gap-4 group hover:border-primary/50 transition-colors",
              feature.span,
            ].join(" ")}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-1 sm:mb-2">
              <span
                className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {feature.icon}
              </span>
            </div>
            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface">
              {feature.title}
            </h3>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      {/* ── Bottom CTA Section ───────────────────────────────────────────── */}
      <section className="w-full bg-surface-container border border-outline-variant rounded-xl p-5 sm:p-6 md:p-8 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 md:gap-8">
        <div className="flex flex-col gap-1.5 sm:gap-2 max-w-xl text-center md:text-left">
          <h2 className="text-xl sm:text-headline-lg-mobile md:text-headline-lg font-semibold text-on-surface">
            Ready to scale your media pipeline?
          </h2>
          <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
            Speak with our engineering team to architect the perfect solution for
            your organization.
          </p>
        </div>
        <Link
          to="/enterprise/contact-sales"
          className="w-full sm:w-auto bg-primary text-on-primary px-6 sm:px-8 py-3 sm:py-3.5 rounded-sm font-medium text-label-md hover:bg-primary-fixed transition-colors duration-200 whitespace-nowrap shrink-0 text-center"
        >
          Contact Enterprise Sales
        </Link>
      </section>
    </div>
  );
}
