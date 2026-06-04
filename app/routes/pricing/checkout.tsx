import { Link, useSearchParams } from "react-router";

import type { Route } from "./+types/checkout";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Checkout · Kuvox" },
    {
      name: "description",
      content: "Complete your Kuvox subscription purchase.",
    },
  ];
}

/* ── Plan details lookup ─────────────────────────────────────────────────── */

const PLAN_DETAILS: Record<
  string,
  { name: string; price: string; period: string; features: string[] }
> = {
  free: {
    name: "Free",
    price: "$0",
    period: "/mo",
    features: [
      "Basic video editing",
      "Short videos (up to 5 min)",
      "Limited AI commands",
      "Standard queue priority",
    ],
  },
  creator: {
    name: "Creator",
    price: "$29",
    period: "/mo",
    features: [
      "Longer videos (up to 30 min)",
      "Deep AI structural analysis",
      "Generous AI command volume",
      "Faster priority processing",
      "Contextual edit suggestions",
    ],
  },
  studio: {
    name: "Studio",
    price: "$99",
    period: "/mo",
    features: [
      "Unlimited video length",
      "Highest AI limits",
      "Top priority processing",
      "Team collaboration tools",
    ],
  },
};

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const planKey = searchParams.get("plan") ?? "creator";
  const plan = PLAN_DETAILS[planKey] ?? PLAN_DETAILS.creator;

  return (
    <div className="w-full self-start flex flex-col gap-8 sm:gap-10 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/pricing"
        className="flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200 group w-fit"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform duration-200">
          arrow_back
        </span>
        Back to pricing
      </Link>

      {/* Page heading */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
          Complete your subscription
        </h1>
        <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
          You&apos;re subscribing to the{" "}
          <span className="text-primary font-medium">{plan.name}</span> plan.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8">
        {/* ── Left: Order Summary ──────────────────────────────────────── */}
        <div className="md:col-span-2 order-2 md:order-1">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-5 sm:p-6 flex flex-col gap-5 sm:gap-6 sticky top-24">
            <h2 className="text-headline-md font-semibold text-on-surface">
              Order Summary
            </h2>

            {/* Plan name + price */}
            <div className="flex justify-between items-baseline">
              <div className="flex flex-col gap-0.5">
                <span className="text-body-lg font-medium text-on-surface">
                  {plan.name} Plan
                </span>
                <span className="text-label-md text-on-surface-variant">
                  Billed monthly
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-headline-md font-semibold text-on-surface">
                  {plan.price}
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  {plan.period}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-outline-variant" />

            {/* Features */}
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-medium">
                Includes
              </span>
              {plan.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className="material-symbols-outlined text-primary text-[16px] sm:text-[18px] shrink-0"
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

            {/* Divider */}
            <div className="border-t border-outline-variant" />

            {/* Total */}
            <div className="flex justify-between items-baseline">
              <span className="text-body-lg font-medium text-on-surface">
                Total today
              </span>
              <span className="text-headline-md font-semibold text-primary">
                {plan.price}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Payment Form ──────────────────────────────────────── */}
        <div className="md:col-span-3 order-1 md:order-2">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="bg-surface-container border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-6"
          >
            <h2 className="text-headline-md font-semibold text-on-surface">
              Payment Details
            </h2>

            {/* Email */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="checkout-email"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Email address
              </label>
              <input
                id="checkout-email"
                type="email"
                placeholder="you@example.com"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Cardholder name */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="checkout-name"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Cardholder name
              </label>
              <input
                id="checkout-name"
                type="text"
                placeholder="Full name on card"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Card number */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label
                htmlFor="checkout-card"
                className="text-label-md text-on-surface-variant font-medium"
              >
                Card number
              </label>
              <div className="relative">
                <input
                  id="checkout-card"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors pr-12"
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px]">
                  credit_card
                </span>
              </div>
            </div>

            {/* Expiry + CVC row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="checkout-expiry"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  Expiry date
                </label>
                <input
                  id="checkout-expiry"
                  type="text"
                  placeholder="MM / YY"
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <label
                  htmlFor="checkout-cvc"
                  className="text-label-md text-on-surface-variant font-medium"
                >
                  CVC
                </label>
                <input
                  id="checkout-cvc"
                  type="text"
                  placeholder="123"
                  className="bg-surface-container-low border border-outline-variant rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 sm:py-3.5 rounded-sm font-medium text-label-md hover:bg-primary-fixed transition-colors duration-200 mt-2 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">
                lock
              </span>
              Subscribe — {plan.price}{plan.period}
            </button>

            {/* Security note */}
            <p className="text-label-sm text-on-surface-variant/60 text-center flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">
                verified_user
              </span>
              Payments are encrypted and securely processed
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
