import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/privacy";

/* ── Meta ────────────────────────────────────────────────────────────────── */

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy Policy · Kuvox" },
    {
      name: "description",
      content:
        "Learn how Kuvox collects, uses, shares, and protects your personal information. Read our full US Privacy Policy.",
    },
  ];
}

/* ── Data ────────────────────────────────────────────────────────────────── */

const TOC_ITEMS = [
  { id: "intro", label: "Introduction" },
  { id: "collection", label: "1. Information Collection" },
  { id: "use", label: "2. How We Use Data" },
  { id: "sharing", label: "3. How We Share Data" },
  { id: "rights", label: "4. Your Rights & Choices" },
  { id: "security", label: "5. Data Security" },
  { id: "retention", label: "6. Data Retention" },
  { id: "children", label: "7. Information Relating to Children" },
  { id: "updates", label: "8. Policy Updates" },
  { id: "contact", label: "9. Contact Us" },
] as const;

const USAGE_ITEMS = [
  {
    num: "01",
    text: "Operate, customize, and administer the Services, enabling you to create and modify AI-driven content.",
  },
  {
    num: "02",
    text: "Train, test, and improve machine learning models and algorithms to enhance creative tools.",
  },
  {
    num: "03",
    text: "Protect the safety of our community and integrity of the Services through content scanning and fraud detection.",
  },
] as const;

const SHARING_TABLE = [
  {
    partner: "Service Providers",
    data: "Cloud hosting, Technical support, Marketing",
  },
  {
    partner: "Payment Partners",
    data: "Purchase Info, Technical Identifiers",
  },
  {
    partner: "Legal Entities",
    data: "To comply with legal obligations or protect safety",
  },
] as const;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const BLEED_OUT = "-mx-4 sm:-mx-6 lg:-mx-container-padding";
const BLEED_PAD = "px-4 sm:px-6 lg:px-container-padding";

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Privacy() {
  const [activeId, setActiveId] = useState<string>("intro");
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  /* Scroll-spy via IntersectionObserver */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        /* Pick the entry closest to the top of the viewport */
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          /* When multiple sections are visible, choose the one nearest the top */
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

  /** Helper to register section refs */
  const registerSection = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  };

  /* ── Mobile TOC state ──────────────────────────────────────────────── */
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const scrollToSection = useCallback((id: string) => {
    setMobileTocOpen(false);
    setActiveId(id); // Update immediately for instant visual feedback
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="w-full self-start flex flex-col">
      {/* ── Hero Header ──────────────────────────────────────────────── */}
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
              Privacy Commitment
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-display font-semibold text-on-surface tracking-tight leading-tight">
            Kuvox US Privacy Policy
          </h1>

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
              12 min read
            </span>
          </div>
        </div>
      </section>

      {/* ── Mobile TOC (visible below md) ──────────────────────────── */}
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
              {TOC_ITEMS.find((t) => t.id === activeId)?.label ?? "Contents"}
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

      {/* Spacer for the fixed mobile TOC bar */}
      <div className="md:hidden h-12" />

      {/* ── Content Area: Sidebar + Article ────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full py-8 sm:py-12 lg:py-20 flex flex-col md:flex-row gap-8 lg:gap-16">
        {/* ── Sidebar TOC ──────────────────────────────────────────── */}
        <aside className="hidden md:block w-sidebar-width shrink-0 self-start sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="flex flex-col gap-1 border-l border-outline-variant/30 pl-6 py-2">
            <h3 className="text-label-md text-outline uppercase tracking-widest mb-4">
              Contents
            </h3>
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

          {/* Need Help CTA */}
          <div className="mt-10 p-6 rounded-xl bg-surface-container-low border border-outline-variant/50 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-label-md text-secondary font-semibold mb-2">
                Need Help?
              </p>
              <p className="text-body-sm text-on-surface-variant mb-4">
                Our legal team is available for any clarification regarding your
                data.
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
                gavel
              </span>
            </div>
          </div>
        </aside>

        {/* ── Article ──────────────────────────────────────────────── */}
        <article className="flex-1 min-w-0 max-w-3xl space-y-10 sm:space-y-12 lg:space-y-16">
          {/* ── Introduction ────────────────────────────────────────── */}
          <section
            id="intro"
            ref={registerSection("intro")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              Introduction
            </h2>
            <div className="space-y-4 text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              <p>
                Welcome to Kuvox. This Privacy Policy explains how we collect,
                use, share, and otherwise process the personal information of US
                users and other US individuals in connection with the Kuvox
                mobile software application (&ldquo;Kuvox APP&rdquo;), Kuvox
                desktop software applications (&ldquo;Kuvox Desktop
                version&rdquo;), and the official Kuvox website (&ldquo;Kuvox
                Web&rdquo;), the Kuvox Commerce Pro and Pippit web platforms and
                mobile applications (&ldquo;Pippit&rdquo;), and any other
                website, app, or platform that links to this Privacy Policy
                (collectively, the &ldquo;Services&rdquo;).
              </p>
              <p>
                The Services are operated by Lumina AI (through TikTok USDS
                Joint Venture LLC, &ldquo;we&rdquo;, &ldquo;us&rdquo; or
                &ldquo;our&rdquo;).
              </p>
              <div className="bg-surface-container-low border-l-4 border-primary p-5 sm:p-6 my-6 rounded-r-xl">
                <p className="m-0 text-on-surface italic text-body-sm sm:text-body-lg">
                  If you are a teen, please see the{" "}
                  <Link
                    to="#"
                    className="text-primary underline decoration-primary/30 hover:decoration-primary transition-colors"
                  >
                    Privacy Policy – Teen Summary
                  </Link>{" "}
                  for a summary of what information we collect and how we use it.
                </p>
              </div>
            </div>
          </section>

          {/* ── 1. Information Collection ───────────────────────────── */}
          <section
            id="collection"
            ref={registerSection("collection")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              1. Information We Collect
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-4 sm:mb-6">
              We may collect your information in three ways: Information You
              Provide, Automatically Collected Information, and Information From
              Other Sources.
            </p>

            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mt-8 mb-4">
              Information You Provide
            </h3>
            <ul className="space-y-5 list-none pl-0">
              {[
                {
                  icon: "account_circle",
                  title: "Account Information",
                  desc: "Such information may include, for example, your date of birth, login credentials, your phone number, and other information you choose to disclose in your user profile.",
                },
                {
                  icon: "video_library",
                  title: "User Content",
                  desc: "We may collect the content you create, import, upload, or generate through the Services, including associated metadata. This includes photographs, audio recordings, videos, and prompts submitted to our AI-powered interfaces.",
                },
                {
                  icon: "payments",
                  title: "Purchase Information",
                  desc: "If you use features that involve payment, we collect information such as what you purchased and your payment details through our secure service providers.",
                },
              ].map((item) => (
                <li key={item.icon} className="flex gap-3 sm:gap-4">
                  <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">
                    {item.icon}
                  </span>
                  <div>
                    <strong className="text-on-surface block mb-1 text-body-sm sm:text-body-lg">
                      {item.title}
                    </strong>
                    <span className="text-body-sm text-on-surface-variant">
                      {item.desc}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mt-8 sm:mt-12 mb-3 sm:mb-4">
              Automatically Collected Information
            </h3>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-4 sm:mb-6">
              We automatically collect certain device, browser, and network
              information when you use the Services, including IP address,
              unique device identifiers, and performance logs.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: "devices",
                  title: "Technical Data",
                  desc: "Device model, OS, and battery information.",
                },
                {
                  icon: "location_on",
                  title: "Location Data",
                  desc: "Approximate location via SIM card and IP address.",
                },
              ].map((card) => (
                <div
                  key={card.icon}
                  className="p-4 sm:p-5 rounded-xl bg-surface-container-high border border-outline-variant/30 hover:border-primary/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-secondary mb-2">
                    {card.icon}
                  </span>
                  <h4 className="text-on-surface font-semibold text-body-sm mb-1">
                    {card.title}
                  </h4>
                  <p className="text-label-md text-on-surface-variant">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 2. How We Use Data ──────────────────────────────────── */}
          <section
            id="use"
            ref={registerSection("use")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              2. How We Use Your Information
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-4 sm:mb-6">
              We utilize the data we collect to maintain the high-performance
              standards of the Kuvox environment:
            </p>
            <div className="space-y-3">
              {USAGE_ITEMS.map((item) => (
                <div
                  key={item.num}
                  className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-surface-container transition-colors"
                >
                  <div className="w-8 h-8 rounded-sm bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
                    <span className="text-label-md font-bold">{item.num}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 3. How We Share Data ────────────────────────────────── */}
          <section
            id="sharing"
            ref={registerSection("sharing")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              3. How We Share Your Information
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-4 sm:mb-6">
              We share information with service providers and business partners
              as necessary to perform operations. This includes cloud hosting,
              AI content generation, and payment processing.
            </p>
            {/* Horizontal scroll wrapper for narrow screens */}
            <div className="border border-outline-variant rounded-xl overflow-hidden mt-4 sm:mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm min-w-[420px]">
                  <thead className="bg-surface-container-highest">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-on-surface whitespace-nowrap">
                        Partner Type
                      </th>
                      <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-on-surface">
                        Data Shared
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {SHARING_TABLE.map((row) => (
                      <tr
                        key={row.partner}
                        className="hover:bg-surface-container-high/40 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-primary font-medium whitespace-nowrap">
                          {row.partner}
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-on-surface-variant">
                          {row.data}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── 4. Your Rights & Choices ────────────────────────────── */}
          <section
            id="rights"
            ref={registerSection("rights")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              4. Your Rights and Choices
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed mb-4 sm:mb-6">
              You have the right to know, access, correct, or delete
              information. We provide multiple methods for exercising these
              rights without retaliation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-5 sm:p-6 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/40 transition-colors">
                <h4 className="text-on-surface font-semibold mb-2 text-body-lg">
                  Digital Request
                </h4>
                <p className="text-body-sm mb-4 text-on-surface-variant">
                  Submit via our encrypted portal.
                </p>
                <a
                  href="#"
                  className="text-primary font-bold text-body-sm inline-flex items-center gap-1.5"
                >
                  Online Portal
                  <span className="material-symbols-outlined text-[14px]">
                    open_in_new
                  </span>
                </a>
              </div>
              <div className="p-5 sm:p-6 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/40 transition-colors">
                <h4 className="text-on-surface font-semibold mb-2 text-body-lg">
                  Privacy Signal
                </h4>
                <p className="text-body-sm mb-4 text-on-surface-variant">
                  We support Global Privacy Control (GPC).
                </p>
                <span className="text-secondary font-bold text-body-sm flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  Active Support
                </span>
              </div>
            </div>
          </section>

          {/* ── 5. Data Security ────────────────────────────────────── */}
          <section
            id="security"
            ref={registerSection("security")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              5. Data Security
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              We maintain technical, administrative, and organizational measures
              designed to protect your information from unauthorized access,
              theft, or loss. Our architecture leverages zero-trust principles
              and enterprise-grade encryption for all stored media and metadata.
            </p>
          </section>

          {/* ── 6. Data Retention ───────────────────────────────────── */}
          <section
            id="retention"
            ref={registerSection("retention")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              6. Data Retention
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              Retention periods vary based on data type. For instance, Cloud
              Space content is retained until deleted by the user or required by
              law. Operational logs are purged periodically to ensure data
              minimization.
            </p>
          </section>

          {/* ── 7. Children ─────────────────────────────────────────── */}
          <section
            id="children"
            ref={registerSection("children")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              7. Information Relating to Children
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              Kuvox is not directed at and is not intended for children under the
              age of 13. If you believe that we have collected personal
              information from a child under the minimum age, please contact us
              using the contact information found in the &ldquo;Contact
              Us&rdquo; section below.
            </p>
          </section>

          {/* ── 8. Policy Updates ───────────────────────────────────── */}
          <section
            id="updates"
            ref={registerSection("updates")}
            className="policy-section animate-fade-in-section"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              8. Privacy Policy Updates
            </h2>
            <p className="text-body-sm sm:text-body-lg text-on-surface-variant leading-relaxed">
              We may amend or update this Privacy Policy from time to time. We
              will notify you of any material changes by updating the &ldquo;Last
              Updated&rdquo; date at the top of the new Privacy Policy, or
              providing other notice as required by applicable law. We recommend
              that you review this Privacy Policy regularly to stay informed of
              our privacy practices.
            </p>
          </section>

          {/* ── 9. Contact Us ──────────────────────────────────────── */}
          <section
            id="contact"
            ref={registerSection("contact")}
            className="policy-section animate-fade-in-section pt-10 sm:pt-16 border-t border-outline-variant"
          >
            <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface mb-4 sm:mb-6">
              9. Contact Us
            </h2>
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-center bg-surface-container-high p-5 sm:p-8 rounded-xl sm:rounded-2xl">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-on-primary text-3xl sm:text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  mail
                </span>
              </div>
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-on-surface font-semibold text-body-lg sm:text-headline-md">
                  Have specific questions?
                </p>
                <p className="text-on-surface-variant text-body-sm">
                  Our privacy office is ready to help you navigate your data
                  rights.
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 mt-3 sm:mt-4">
                  <a
                    href="mailto:privacy@us.pippit.ai"
                    className="text-primary font-bold text-body-sm hover:underline"
                  >
                    privacy@us.pippit.ai
                  </a>
                  <span className="text-outline hidden sm:inline">|</span>
                  <span className="text-on-surface-variant text-body-sm">
                    5800 Bristol Pkwy, Culver City, CA 90230
                  </span>
                </div>
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
