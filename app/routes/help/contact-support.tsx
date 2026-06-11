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
    description:
      "Get help with projects, exports, uploads, and workspace issues.",
    href: "mailto:support@kuvox.ai",
    label: "support@kuvox.ai",
  },
  {
    icon: "payments",
    title: "Billing",
    description:
      "Questions about subscriptions, invoices, renewals, and refunds.",
    href: "mailto:billing@kuvox.ai",
    label: "billing@kuvox.ai",
  },
  {
    icon: "balance",
    title: "Legal",
    description:
      "Reach us about terms, policy requests, or compliance questions.",
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

      <section className="mt-10 sm:mt-14 glass rounded-2xl p-6 border border-outline-variant/30 flex flex-col mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-[28px]">
              forum
            </span>
          </div>
          <div>
            <h2 className="text-headline-md font-semibold text-on-surface mb-1">
              Ask Kuvox AI Support
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Get instant answers to your questions powered by AI.
            </p>
          </div>
        </div>

        <div className="bg-surface/50 rounded-xl p-4 sm:p-6 h-[300px] overflow-y-auto mb-4 border border-outline-variant/20 flex flex-col gap-4">
          {/* Bot Message */}
          <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-1">
              <span className="material-symbols-outlined text-primary text-[18px]">
                smart_toy
              </span>
            </div>
            <div className="bg-surface rounded-2xl rounded-tl-sm px-4 py-3 text-body-sm text-on-surface border border-outline-variant/20 shadow-sm">
              Hi there! I'm the Kuvox AI assistant. How can I help you today?
            </div>
          </div>

          {/* User Message */}
          <div className="flex gap-3 max-w-[85%] sm:max-w-[75%] self-end flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-outline-variant/20 flex-shrink-0 flex items-center justify-center mt-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                person
              </span>
            </div>
            <div className="bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-3 text-body-sm text-on-surface border border-primary/20 shadow-sm">
              I have a question about setting up my environment.
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Ask a question..."
            className="w-full bg-surface rounded-full pl-5 pr-14 py-3 border border-outline-variant/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 text-body-sm text-on-surface placeholder:text-on-surface-variant"
          />
          <button
            type="button"
            className="absolute right-2 w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </section>
    </div>
  );
}
