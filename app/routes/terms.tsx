import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/terms";

/* -- Meta ------------------------------------------------------------------ */

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Terms of Service · Kuvox" },
    {
      name: "description",
      content:
        "Read the Kuvox Terms of Service governing access to and use of the Kuvox platform, plans, cloud space, content, and support services.",
    },
  ];
}

/* -- Data ------------------------------------------------------------------ */

const TOC_ITEMS = [
  { id: "relationship", label: "1. Relationship" },
  { id: "accepting", label: "2. Accepting Terms" },
  { id: "changes", label: "3. Changes" },
  { id: "account", label: "4. Your Account" },
  { id: "use", label: "5. Access & Use" },
  { id: "plans", label: "6. Service Plans" },
  { id: "cloud", label: "7. Cloud Space" },
  { id: "property", label: "8. Intellectual Property" },
  { id: "content", label: "9. Content" },
  { id: "indemnity", label: "10. Indemnity" },
  { id: "warranties", label: "11. Warranties" },
  { id: "liability", label: "12. Liability" },
  { id: "termination", label: "13. Termination" },
  { id: "dispute", label: "14. Dispute Resolution" },
  { id: "other", label: "15. Other Terms" },
  { id: "contact", label: "16. Contact" },
] as const;

const USE_RESTRICTIONS = [
  "Use the Services if you are under 18 years old.",
  "Reverse engineer, decompile, or create derivative works based on the Services.",
  "Modify or remove proprietary notices, logos, or attribution.",
  "Interfere with the proper working of the Services or bypass security measures.",
  "Use the Services to harass, bully, impersonate others, or distribute harmful content.",
] as const;

const OTHER_TERMS = [
  {
    title: "Survival",
    text: "Intellectual property, indemnity, warranty, liability, dispute, and payment provisions survive termination.",
  },
  {
    title: "Severability",
    text: "If a provision is found invalid, the remaining Terms remain in effect.",
  },
  {
    title: "No Waiver",
    text: "A failure to enforce a provision does not waive our right to enforce it later.",
  },
  {
    title: "Entire Agreement",
    text: "These Terms and incorporated policies supersede prior communications about the Services.",
  },
] as const;

const BLEED_OUT = "-mx-4 sm:-mx-6 lg:-mx-container-padding";
const BLEED_PAD = "px-4 sm:px-6 lg:px-container-padding";

/* -- Component ------------------------------------------------------------- */

export default function Terms() {
  const [activeId, setActiveId] = useState<string>("relationship");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          const best = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveId(best.target.id);
        }
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );

    for (const el of sectionRefs.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const registerSection = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  };

  const scrollToSection = useCallback((id: string) => {
    setMobileTocOpen(false);
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="w-full self-start flex flex-col">
      <section
        className={`${BLEED_OUT} relative flex flex-col items-center justify-center ${BLEED_PAD} py-10 sm:py-16 lg:py-24 border-b border-outline-variant`}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(128,131,255,0.08) 0%, transparent 70%)",
        }}
      >
        <div className="max-w-4xl text-center space-y-3 sm:space-y-6 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant">
            <span className="text-label-md text-primary uppercase tracking-widest">
              Legal Agreement
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-display font-semibold text-on-surface tracking-tight leading-tight">
            Kuvox Terms of Service
          </h1>

          <p className="max-w-2xl mx-auto text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
            These Terms govern your relationship with Lumina AI Systems LLC and
            your access to the Kuvox platform, applications, products, and
            related services.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-on-surface-variant text-body-sm">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                calendar_today
              </span>
              Last Updated: April 15, 2026
            </span>
            <span className="w-1 h-1 rounded-full bg-outline-variant hidden sm:block" />
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">
                schedule
              </span>
              14 min read
            </span>
          </div>
        </div>
      </section>

      <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/40">
        <button
          onClick={() => setMobileTocOpen(!mobileTocOpen)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3 text-body-sm font-medium text-on-surface"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
              list
            </span>
            <span className="truncate">
              {TOC_ITEMS.find((item) => item.id === activeId)?.label ??
                "Contents"}
            </span>
          </span>
          <span
            className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-300 shrink-0 ${mobileTocOpen ? "rotate-180" : ""
              }`}
          >
            expand_more
          </span>
        </button>

        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: mobileTocOpen
              ? `${TOC_ITEMS.length * 44 + 16}px`
              : "0px",
            opacity: mobileTocOpen ? 1 : 0,
          }}
        >
          <nav className="flex flex-col gap-0.5 px-4 sm:px-6 pb-3 max-h-[60vh] overflow-y-auto">
            {TOC_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left text-body-sm py-2 px-3 rounded-lg transition-colors duration-200 ${isActive
                      ? "text-primary bg-primary/10 font-medium"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="md:hidden h-12" />

      <div className="max-w-7xl mx-auto w-full py-8 sm:py-12 lg:py-20 flex flex-col md:flex-row gap-8 lg:gap-16">
        <aside className="hidden md:block w-sidebar-width shrink-0 self-start sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="flex flex-col gap-1 border-l border-outline-variant/30 pl-6 py-2">
            <h2 className="text-label-md text-outline uppercase tracking-widest mb-4">
              Contents
            </h2>
            <nav className="space-y-2.5">
              {TOC_ITEMS.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block text-body-sm transition-all duration-200 ${isActive
                        ? "text-primary border-l-2 border-primary -ml-[25px] pl-6 font-medium"
                        : "text-on-surface-variant hover:text-primary"
                      }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="mt-10 p-6 rounded-xl bg-surface-container-low border border-outline-variant/50 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-label-md text-secondary font-semibold mb-2">
                Questions?
              </p>
              <p className="text-body-sm text-on-surface-variant mb-4">
                Our support team can help clarify account, billing, or policy
                questions.
              </p>
              <Link
                to="/help/contact-support"
                className="flex items-center gap-2 text-primary font-bold text-body-sm hover:gap-3 transition-all duration-200"
              >
                Contact Support
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </Link>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
              <span
                className="material-symbols-outlined text-[100px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                balance
              </span>
            </div>
          </div>
        </aside>

        <article className="flex-1 min-w-0 max-w-3xl space-y-10 sm:space-y-12 lg:space-y-16">
          <section
            id="relationship"
            ref={registerSection("relationship")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              1. Your Relationship With Us
            </h2>
            <div className="space-y-4 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <p>
                Welcome to Kuvox (the &ldquo;Platform&rdquo;). These Terms of
                Service (these &ldquo;Terms&rdquo;), as may be amended from time
                to time, apply to United States users and govern the
                relationship and agreement between you and Lumina AI Systems LLC
                (&ldquo;Lumina AI Systems&rdquo;, &ldquo;we&rdquo;, or
                &ldquo;us&rdquo;).
              </p>
              <p>
                These Terms set forth the conditions by which you may access and
                use the Platform and our related services, applications,
                websites, products, and content (collectively, the
                &ldquo;Services&rdquo;).
              </p>
              <div className="bg-error-container/20 border-l-4 border-error p-5 sm:p-6 my-6 rounded-r-xl">
                <p className="m-0 text-on-surface font-semibold text-body-sm sm:text-body-lg">
                  The Services are only intended for individuals 18 years old and
                  older. If you are under 18 years old, you may not access or use
                  the Services.
                </p>
              </div>
            </div>
          </section>

          <section
            id="accepting"
            ref={registerSection("accepting")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              2. Accepting These Terms
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              By accessing or using our Services, you confirm that you can form
              a binding contract with Lumina AI Systems, accept these Terms, and
              agree to comply with them. Your access to and use of the Services
              is also subject to our Privacy Policy, Community Guidelines, and
              Materials License Agreement.
            </p>
          </section>

          <section
            id="changes"
            ref={registerSection("changes")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              3. Changes to These Terms
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              We may amend or update these Terms from time to time to reflect
              changes to the Platform, regulatory requirements, or our business.
              We will notify you of material changes by updating the
              &ldquo;Last Updated&rdquo; date or by providing other notice where
              required. Continued use of the Services constitutes acceptance of
              the updated Terms.
            </p>
          </section>

          <section
            id="account"
            ref={registerSection("account")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              4. Your Account With Us
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-6">
              To access some Services, you must create an account using accurate
              information. You are solely responsible for activity under your
              account and must notify us immediately of unauthorized use.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: "verified_user",
                  title: "Security",
                  text: "Maintain the confidentiality of your credentials and account access.",
                },
                {
                  icon: "block",
                  title: "Termination",
                  text: "We may suspend or terminate accounts for non-compliance or inactivity.",
                },
              ].map((card) => (
                <div
                  key={card.icon}
                  className="p-5 rounded-xl bg-surface-container-high border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-secondary mb-2">
                    {card.icon}
                  </span>
                  <h3 className="text-on-surface font-semibold text-body-lg mb-1">
                    {card.title}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {card.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="use"
            ref={registerSection("use")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              5. Your Access to and Use of Our Services
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-5">
              Your use must comply with these Terms and applicable laws. You may
              not:
            </p>
            <ul className="space-y-4 list-none pl-0">
              {USE_RESTRICTIONS.map((item) => (
                <li key={item} className="flex gap-3 text-body-sm text-on-surface-variant">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="plans"
            ref={registerSection("plans")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              6. Service Plans, Renewal, Cancellation, and Refund
            </h2>
            <div className="space-y-4 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <p>
                We provide Free Services and Premium Services, including Kuvox
                Pro. Pricing, eligibility, and features are subject to change at
                our discretion.
              </p>
              <div className="bg-surface-container-high p-5 sm:p-8 rounded-xl border border-outline-variant">
                <h3 className="text-on-surface font-semibold mb-2">
                  Automatic Renewal
                </h3>
                <p>
                  Subscriptions under an automatic renewal arrangement will be
                  charged at the start of each new term unless cancelled before
                  the end of the then-current period.
                </p>
                <h3 className="text-on-surface font-semibold mt-6 mb-2">
                  Refund Policy
                </h3>
                <p>
                  You may cancel with a full refund within 14 calendar days of
                  the start if no usage has occurred. Contact support@kuvox.ai
                  for refund requests.
                </p>
              </div>
            </div>
          </section>

          <section
            id="cloud"
            ref={registerSection("cloud")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              7. Cloud Space Services
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 bg-surface-container-high rounded-xl border border-outline-variant p-6 sm:p-8 relative overflow-hidden">
                <span className="material-symbols-outlined absolute right-4 top-4 text-primary text-6xl opacity-20">
                  cloud
                </span>
                <h3 className="text-on-surface text-body-lg sm:text-headline-md font-semibold mb-3">
                  Secure Storage
                </h3>
                <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed max-w-md">
                  You may access allocated cloud storage based on your plan. You
                  are responsible for staying within your storage capacity and
                  maintaining copies of important content.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-4">
                <div className="bg-surface-container-low rounded-xl border border-outline-variant p-5 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-secondary text-3xl mb-2">
                    verified_user
                  </span>
                  <p className="text-label-md font-bold text-on-surface uppercase tracking-wider">
                    Data Protection
                  </p>
                </div>
                <div className="bg-primary-container rounded-xl p-5 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-on-primary-container text-3xl mb-2">
                    backup
                  </span>
                  <p className="text-label-md font-bold text-on-primary-container uppercase tracking-wider">
                    Backup Ready
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            id="property"
            ref={registerSection("property")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              8. Intellectual Property Rights
            </h2>
            <div className="space-y-4 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <p>
                All intellectual property rights in the Services are owned by
                us, our affiliates, or our licensors. You may not exploit any
                part of the Services without written consent.
              </p>
              <div className="bg-surface-container-highest/50 border-l-4 border-primary p-5 sm:p-6 my-6 rounded-r-xl">
                <p className="italic text-on-surface">
                  We respect intellectual property rights and require you to do
                  the same. Infringement may result in account termination.
                </p>
              </div>
            </div>
          </section>

          <section
            id="content"
            ref={registerSection("content")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              9. Content
            </h2>
            <div className="space-y-6 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <div>
                <h3 className="text-on-surface font-semibold mb-2">
                  Company Content
                </h3>
                <p>
                  Creative materials provided directly by Kuvox are made
                  available under a limited, revocable license for projects that
                  comply with the Materials License Agreement.
                </p>
              </div>
              <div>
                <h3 className="text-on-surface font-semibold mb-2">
                  Third-Party AI Services
                </h3>
                <p>
                  Integrated services are subject to their respective terms. You
                  must ensure you have all necessary rights and permissions for
                  inputs and content.
                </p>
              </div>
              <div>
                <h3 className="text-on-surface font-semibold mb-2">
                  User Content
                </h3>
                <p>
                  You own your User Content, but grant Kuvox the rights needed
                  to host, process, modify, display, and distribute it for
                  operating and improving the Services.
                </p>
              </div>
              <div className="p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant">
                <h3 className="text-on-surface font-semibold mb-2">
                  DMCA Policy
                </h3>
                <p className="text-body-sm">
                  Report copyright infringement to ip-reports@kuvox.ai with the
                  required documentation described in these Terms.
                </p>
              </div>
            </div>
          </section>

          <section
            id="indemnity"
            ref={registerSection("indemnity")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              10. Indemnity
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed uppercase">
              You shall defend, indemnify, and hold harmless Lumina AI Systems
              and its affiliates from claims, damages, or expenses arising out of
              your breach of these Terms or applicable laws.
            </p>
          </section>

          <section
            id="warranties"
            ref={registerSection("warranties")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              11. Exclusion of Warranties
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed uppercase">
              The Services are provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo;. We make no warranties regarding uninterrupted
              access, data accuracy, or correction of defects.
            </p>
          </section>

          <section
            id="liability"
            ref={registerSection("liability")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              12. Limitation of Liability
            </h2>
            <div className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed bg-surface-container-low p-5 sm:p-8 rounded-xl border border-outline-variant">
              <p className="mb-4 font-semibold text-on-surface">
                To the maximum extent permitted by law:
              </p>
              <p>
                Lumina AI Systems shall not be liable for indirect, special,
                incidental, or punitive damages, or loss of profits, data, or
                goodwill. Our aggregate liability is limited to the higher of
                amounts paid by you in the last 12 months or USD $50.
              </p>
            </div>
          </section>

          <section
            id="termination"
            ref={registerSection("termination")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              13. Interruption and Termination of Services
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              We do not guarantee availability of any Services. Services may be
              interrupted for maintenance or terminated permanently at our
              discretion without liability.
            </p>
          </section>

          <section
            id="dispute"
            ref={registerSection("dispute")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              14. Dispute Resolution
            </h2>
            <div className="space-y-4 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <p>
                <strong className="text-on-surface">Informal Resolution:</strong>{" "}
                The parties agree to attempt amicable resolution for 60 days
                before filing legal action.
              </p>
              <p>
                <strong className="text-on-surface">Exclusive Venue:</strong>{" "}
                Claims shall be governed by California law and resolved
                exclusively in the U.S. District Court for the Central District
                of California or Superior Court of Los Angeles County.
              </p>
              <p>
                <strong className="text-on-surface">Limitation:</strong> Actions
                must be initiated within one year of the event giving rise to the
                claim.
              </p>
            </div>
          </section>

          <section
            id="other"
            ref={registerSection("other")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              15. Other Terms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {OTHER_TERMS.map((term) => (
                <div
                  key={term.title}
                  className="p-5 rounded-xl border border-outline-variant bg-surface-container-lowest"
                >
                  <h3 className="text-on-surface font-semibold mb-2">
                    {term.title}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {term.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="contact"
            ref={registerSection("contact")}
            className="policy-section animate-fade-in-section pt-10 sm:pt-16 border-t border-outline-variant"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              16. Contact Us
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-6">
              Questions about these Terms of Service should be sent to us at:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="mailto:legal@kuvox.ai"
                className="p-5 sm:p-6 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary/40 transition-colors"
              >
                <p className="text-label-md text-on-surface-variant uppercase tracking-widest mb-2">
                  Legal Department
                </p>
                <p className="text-on-surface text-body-lg font-semibold">
                  legal@kuvox.ai
                </p>
              </a>
              <a
                href="mailto:support@kuvox.ai"
                className="p-5 sm:p-6 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary/40 transition-colors"
              >
                <p className="text-label-md text-on-surface-variant uppercase tracking-widest mb-2">
                  General Support
                </p>
                <p className="text-on-surface text-body-lg font-semibold">
                  support@kuvox.ai
                </p>
              </a>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
