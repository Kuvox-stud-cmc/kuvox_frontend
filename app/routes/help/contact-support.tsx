import type { Route } from "./+types/contact-support";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Contact Support · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Contact Kuvox support for help with accounts, billing, product issues, and legal or privacy questions.",
    },
  ];
}

const CONTACT_OPTIONS = [
  {
    icon: "support_agent",
    title: "Product Support",
    description: "Get help with projects, exports, uploads, and workspace issues.",
    href: "mailto:support@kuvox.ai",
    label: "support@kuvox.ai",
  },
  {
    icon: "payments",
    title: "Billing",
    description: "Questions about subscriptions, invoices, renewals, and refunds.",
    href: "mailto:billing@kuvox.ai",
    label: "billing@kuvox.ai",
  },
  {
    icon: "balance",
    title: "Legal",
    description: "Reach us about terms, policy requests, or compliance questions.",
    href: "mailto:legal@kuvox.ai",
    label: "legal@kuvox.ai",
  },
] as const;

export default function ContactSupport() {
  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in-up px-6 lg:px-8">
      <section className="text-center mb-10 sm:mb-14">
        <div className="w-14 h-14 rounded-xl bg-primary-container/20 flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-primary text-[32px]">
            headset_mic
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight mb-4">
          Contact Support
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Send your question to the right team and we will help you get back to
          creating with Kuvox.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CONTACT_OPTIONS.map((option) => (
          <a
            key={option.title}
            href={option.href}
            className="glass rounded-xl p-6 border border-outline-variant/30 hover:border-primary/40 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">
              {option.icon}
            </span>
            <h2 className="text-headline-md font-semibold text-on-surface mb-2">
              {option.title}
            </h2>
            <p className="text-body-sm text-on-surface-variant mb-5">
              {option.description}
            </p>
            <span className="inline-flex items-center gap-2 text-primary text-body-sm font-bold">
              {option.label}
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </span>
          </a>
        ))}
      </section>
    </div>
  );
}
