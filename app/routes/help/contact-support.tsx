import { useState } from "react";
import { Link } from "react-router";

import type { DragEvent, FormEvent } from "react";
import type { Route } from "./+types/contact-support";

type SubmitState = "idle" | "sending" | "sent";

const supportCategories = [
  "General Question",
  "Account & Login",
  "Billing & Subscription",
  "Feature Request",
  "Technical Assistance",
  "Partnership & Business",
  "Other",
];

const quickLinks = [
  { label: "Help Center", to: "/help", icon: "open_in_new" },
  { label: "FAQ", to: "/help/faq", icon: "quiz" },
  { label: "Report Issue", to: "/help/report-issue", icon: "bug_report" },
  { label: "Community Forum", to: "/community", icon: "groups" },
];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Contact Support | Kuvox" },
    {
      name: "description",
      content:
        "Contact the Kuvox support team for account, billing, technical, partnership, and product help.",
    },
  ];
}

const ContactSupport = () => {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitState !== "idle") {
      return;
    }

    const form = event.currentTarget;

    setSubmitState("sending");

    window.setTimeout(() => {
      setSubmitState("sent");
      form.reset();

      window.setTimeout(() => {
        setSubmitState("idle");
      }, 2500);
    }, 1200);
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setIsDragging(true);
    }

    if (event.type === "dragleave" || event.type === "drop") {
      setIsDragging(false);
    }
  };

  const buttonContent = {
    idle: { icon: "send", label: "Send Request" },
    sending: { icon: "progress_activity", label: "Sending..." },
    sent: { icon: "check_circle", label: "Message Sent" },
  }[submitState];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="mb-10 text-center md:text-left">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-md font-medium uppercase text-primary">
          <span className="material-symbols-outlined text-[16px]">
            support_agent
          </span>
          Kuvox Support
        </div>
        <h1 className="mx-auto max-w-3xl text-3xl font-semibold leading-tight text-on-surface sm:text-4xl md:mx-0 lg:text-display">
          Contact Support
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-body-lg text-on-surface-variant md:mx-0">
          Need help with Kuvox? Send us the details and our support team will
          help you get back to editing.
        </p>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="glass-panel rounded-xl p-5 sm:p-6 lg:col-span-8 lg:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                  Name *
                </span>
                <input
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
                  placeholder="Alex Mercer"
                  required
                  type="text"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                  Email *
                </span>
                <input
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
                  placeholder="alex@example.com"
                  required
                  type="email"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                Support Category
              </span>
              <select className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition-colors focus:border-primary">
                {supportCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                Subject *
              </span>
              <input
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
                placeholder="Quick summary of your request"
                required
                type="text"
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                How can we help you? *
              </span>
              <textarea
                className="min-h-40 w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
                placeholder="Please describe your issue or question in detail..."
                required
              />
            </label>

            <div className="space-y-2">
              <span className="block text-label-md font-semibold uppercase text-on-surface-variant">
                Attachment (Optional)
              </span>
              <div
                className={`group rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant bg-surface-container-lowest/60 hover:border-primary"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrag}
              >
                <input className="hidden" id="file-upload" type="file" />
                <label className="block cursor-pointer" htmlFor="file-upload">
                  <span className="material-symbols-outlined mb-2 block text-[40px] text-outline transition-colors group-hover:text-primary">
                    upload_file
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    Click to upload or drag and drop screenshots
                  </span>
                  <span className="mt-1 block text-label-md font-medium uppercase text-outline">
                    PNG, JPG or MP4 (Max 10MB)
                  </span>
                </label>
              </div>
            </div>

            <button
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-headline-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed md:w-auto ${
                submitState === "sent"
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-primary text-on-primary hover:shadow-[0_0_20px_rgba(192,193,255,0.35)]"
              }`}
              disabled={submitState !== "idle"}
              type="submit"
            >
              <span
                className={`material-symbols-outlined ${
                  submitState === "sending" ? "animate-spin" : ""
                }`}
              >
                {buttonContent.icon}
              </span>
              <span>{buttonContent.label}</span>
            </button>
          </form>
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <section className="glass-panel rounded-xl p-6">
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined">schedule</span>
                  <h2 className="text-headline-sm font-semibold">
                    Support Hours
                  </h2>
                </div>
                <p className="text-body-sm text-on-surface">Monday - Friday</p>
                <p className="text-body-sm text-on-surface-variant">
                  09:00 - 18:00 (GMT+7)
                </p>
              </div>

              <div className="border-t border-outline-variant pt-5">
                <div className="mb-2 flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined">bolt</span>
                  <h2 className="text-headline-sm font-semibold">
                    Response Time
                  </h2>
                </div>
                <p className="text-body-sm text-on-surface">
                  Average Response Time
                </p>
                <p className="text-body-sm font-bold text-secondary">
                  Less than 24 hours
                </p>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-xl p-6">
            <h2 className="mb-4 text-headline-sm font-semibold text-on-surface">
              Quick Links
            </h2>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    className="group flex items-center justify-between gap-4 text-body-sm text-on-surface-variant transition-colors hover:text-primary"
                    to={link.to}
                  >
                    <span>{link.label}</span>
                    <span className="material-symbols-outlined text-[20px] text-outline transition-colors group-hover:text-primary">
                      {link.icon}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-panel rounded-xl p-6">
            <h2 className="mb-4 text-headline-sm font-semibold text-on-surface">
              Contact Info
            </h2>
            <div className="space-y-4">
              <ContactItem
                href="mailto:support@kuvox.ai"
                hoverClassName="hover:text-primary"
                icon="mail"
                label="Support Email"
                tone="text-primary"
                value="support@kuvox.ai"
              />
              <ContactItem
                href="/community"
                hoverClassName="hover:text-secondary"
                icon="forum"
                label="Discord Community"
                tone="text-secondary"
                value="Join our Server"
              />
              <ContactItem
                href="mailto:business@kuvox.ai"
                hoverClassName="hover:text-tertiary"
                icon="business_center"
                label="Business Inquiries"
                tone="text-tertiary"
                value="business@kuvox.ai"
              />
            </div>
          </section>

        </aside>
      </div>
    </main>
  );
};

function ContactItem({
  href,
  hoverClassName,
  icon,
  label,
  tone,
  value,
}: {
  href: string;
  hoverClassName: string;
  icon: string;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`material-symbols-outlined ${tone}`}>{icon}</span>
      <div>
        <p className="text-label-md font-semibold uppercase text-outline">
          {label}
        </p>
        <a className={`text-body-sm text-on-surface ${hoverClassName}`} href={href}>
          {value}
        </a>
      </div>
    </div>
  );
}

export default ContactSupport;
