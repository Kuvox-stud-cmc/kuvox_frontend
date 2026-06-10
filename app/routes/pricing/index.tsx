
import { Link } from "react-router";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Pricing · Kuvox" },
    {
      name: "description",
      content:
        "Simple, transparent pricing for Kuvox AI video editing. Start free, upgrade when you need more processing power or volume.",
    },
  ];
}

/* ── Plan data ───────────────────────────────────────────────────────────── */

const PLANS = [
  {
    name: "Free",
    price: "$0",
    description: "For casual users and trying out Kuvox.",
    cta: "Start free",
    ctaStyle: "outlined" as const,
    highlighted: false,
    features: [
      "Basic video editing",
      "Short videos (up to 5 min)",
      "Limited AI commands",
      "Standard queue priority",
    ],
  },
  {
    name: "Creator",
    price: "$29",
    description: "For independent content creators needing advanced AI.",
    cta: "Choose Creator",
    ctaStyle: "filled" as const,
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Longer videos (up to 30 min)",
      "Deep AI structural analysis",
      "Generous AI command volume",
      "Faster priority processing",
      "Contextual edit suggestions",
    ],
  },
  {
    name: "Studio",
    price: "$25",
    description: "For teams and heavy users requiring maximum power.",
    cta: "Get Studio Plan",
    ctaStyle: "outlined" as const,
    highlighted: false,
    features: [
      "Unlimited video length",
      "Highest AI limits",
      "Top priority processing",
      "Team collaboration tools",
    ],
  },
] as const;

const COMPARISON_ROWS = [
  { feature: "Max Video Length", free: "5 Minutes", creator: "30 Minutes", studio: "Unlimited" },
  { feature: "AI Analysis Depth", free: "Basic Objects", creator: "Deep Semantic", studio: "Full Contextual" },
  { feature: "AI Command Volume", free: "100 / month", creator: "1,000 / month", studio: "Unlimited" },
  { feature: "Processing Priority", free: "Standard Queue", creator: "Accelerated", studio: "Dedicated Instance" },
  { feature: "Resolution Export", free: "1080p", creator: "4K", studio: "8K+" },
] as const;

const FAQS = [
  {
    question: 'What counts as an "AI command"?',
    answer:
      "An AI command is any action where you prompt the system to generate an edit, perform structural analysis, or create a contextual cut. Simple playback or manual trimming does not consume your AI command quota.",
  },
  {
    question: "How does billing work if I upgrade mid-month?",
    answer:
      "If you upgrade from Free to Creator, or Creator to Studio, your payment will be prorated based on the days remaining in your current billing cycle. You will get immediate access to the higher limits.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer:
      "Yes, you can cancel or downgrade your plan at any time from your account settings. Your current plan features will remain active until the end of your current billing period.",
  },
] as const;

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Pricing() {
  return (
    <div className="w-full self-start flex flex-col gap-16 sm:gap-20 lg:gap-24 max-w-7xl mx-auto">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="text-center flex flex-col items-center gap-3 sm:gap-4 mt-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-display font-semibold text-on-surface tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-body-lg sm:text-headline-md text-on-surface-variant max-w-2xl px-2">
          Scale your AI video processing exactly as you need it. Start free,
          upgrade when you require more processing power or volume.
        </p>
      </section>

      {/* ── Pricing Cards ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 place-content-center gap-4 sm:gap-6 items-stretch">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={[
              "rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col gap-6 sm:gap-8 relative overflow-hidden",
              plan.highlighted
                ? "bg-surface-container border border-primary lg:-translate-y-4 shadow-[0_0_40px_rgba(192,193,255,0.1)]"
                : "bg-surface-container border border-outline-variant group",
              plan.name === "Studio" && "md:col-span-2 lg:col-span-1", 
            ].join(" ")}
          >
            {/* Hover gradient for non-highlighted cards */}
            {!plan.highlighted && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-container-highest opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" />
            )}

            {/* Top accent bar for highlighted card */}
            {plan.highlighted && (
              <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
            )}

            {/* Plan header */}
            <div className="flex flex-col gap-1.5 sm:gap-2 relative">
              {plan.highlighted && "badge" in plan && (
                <span className="absolute right-0 top-0 bg-primary/20 text-primary px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-semibold border border-primary/30">
                  {plan.badge}
                </span>
              )}
              <h3
                className={[
                  "text-3xl sm:text-4xl font-bold",
                  plan.highlighted ? "text-primary" : "text-on-surface",
                ].join(" ")}
              >
                {plan.name}
              </h3>
              <p className="text-body-sm text-on-surface-variant h-auto">
                {plan.description}
              </p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-display font-semibold text-on-surface">
                {plan.price}
              </span>
              <span className="text-body-sm text-on-surface-variant">{plan.name !== "Studio" ? "/mo" : "/per-seat/mo"}</span>
            </div>

            {/* CTA */}
            <Link
              to={`/pricing/checkout?plan=${plan.name.toLowerCase()}`}
              className={[
                "w-full py-2.5 sm:py-3 rounded-sm text-center font-medium text-label-md transition-colors duration-200",
                plan.ctaStyle === "filled"
                  ? "bg-primary text-on-primary hover:bg-primary-fixed"
                  : "border border-outline-variant text-on-surface hover:border-primary hover:text-primary",
              ].join(" ")}
            >
              {plan.cta}
            </Link>

            {/* Features list */}
            <div className="flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-4 flex-grow">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5 sm:gap-3">
                  <span
                    className="material-symbols-outlined text-primary text-[18px] sm:text-[20px] shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Feature Comparison Table ───────────────────────────────────────── */}
      <section className="flex flex-col gap-6 sm:gap-8">
        <h2 className="text-headline-md sm:text-headline-lg font-semibold text-on-surface text-center">
          Compare Features
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="p-3 sm:p-4 text-label-md font-medium text-on-surface-variant uppercase tracking-wider">
                  Features
                </th>
                <th className="p-3 sm:p-4 text-label-md font-medium text-on-surface-variant uppercase tracking-wider">
                  Free
                </th>
                <th className="p-3 sm:p-4 text-label-md font-medium text-primary uppercase tracking-wider bg-surface-container-highest/50">
                  Creator
                </th>
                <th className="p-3 sm:p-4 text-label-md font-medium text-on-surface-variant uppercase tracking-wider">
                  Studio
                </th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-surface divide-y divide-outline-variant">
              {COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className="hover:bg-surface-container-highest/30 transition-colors"
                >
                  <td className="p-3 sm:p-4 py-4 sm:py-5 font-medium">
                    {row.feature}
                  </td>
                  <td className="p-3 sm:p-4 text-on-surface-variant">
                    {row.free}
                  </td>
                  <td className="p-3 sm:p-4 bg-surface-container-highest/50 font-medium">
                    {row.creator}
                  </td>
                  <td className="p-3 sm:p-4 text-on-surface-variant">
                    {row.studio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6 sm:gap-8 max-w-3xl mx-auto w-full">
        <h2 className="text-headline-md sm:text-headline-lg font-semibold text-on-surface text-center">
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col border border-outline-variant rounded-xl overflow-hidden bg-surface-container divide-y divide-outline-variant">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group p-4 sm:p-6 cursor-pointer bg-surface-container hover:bg-surface-container-highest/50 transition-colors"
            >
              <summary className="flex justify-between items-center text-body-sm sm:text-body-lg text-on-surface font-medium list-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span className="material-symbols-outlined text-outline text-[20px] sm:text-[24px] group-open:rotate-180 transition-transform duration-200 shrink-0 ml-4">
                  expand_more
                </span>
              </summary>
              <div className="mt-3 sm:mt-4 text-body-sm text-on-surface-variant leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
