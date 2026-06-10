import { Link } from "react-router";

/* ── SVG Brand Icons ─────────────────────────────────────────────────────── */

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Footer Data ─────────────────────────────────────────────────────────── */

const SOCIAL_LINKS = [
  { href: "https://discord.gg/kuvox", label: "Discord", Icon: DiscordIcon },
  { href: "https://youtube.com/@kuvox", label: "YouTube", Icon: YouTubeIcon },
  { href: "https://x.com/kuvox", label: "X", Icon: XIcon },
];

const FOOTER_COLUMNS = [
  {
    title: "Support",
    links: [
      { to: "/help/contact-support", label: "Contact Support" },
      { to: "/help/report-issue", label: "Report Issue" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms of Service" },
    ],
  },
  {
    title: "Follow Us",
    links: [
      { to: "https://discord.gg/kuvox", label: "Discord", external: true },
      { to: "https://youtube.com/@kuvox", label: "YouTube", external: true },
      { to: "https://x.com/kuvox", label: "X", external: true },
    ],
  },
];

/* ── Footer Component ────────────────────────────────────────────────────── */

/** Footer shared across the public marketing pages. */
export function SiteFooter() {
  return (
    <footer className="w-full mt-16 bg-surface-container-lowest border-t border-outline-variant/30">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 px-4 sm:px-6 lg:px-container-padding py-10 sm:py-12 lg:py-16 max-w-7xl mx-auto">

        {/* ── Logo + Social ──────────────────────────────────────────── */}
        <div className="col-span-2">
          <Link
            to="/"
            className="flex items-center gap-2 text-headline-md font-bold tracking-tight text-on-surface mb-3"
          >
            <img src="/logo.svg" alt="Kuvox" className="h-6" />
          </Link>

          <p className="text-body-sm mb-6 max-w-xs text-on-surface-variant">
            AI video editing, reimagined. For creators, by creators.
          </p>

          <div className="flex gap-4">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="opacity-70 hover:opacity-100 text-on-surface-variant hover:text-primary transition-all duration-200"
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>

        {/* ── Link Columns (Support · Legal · Follow Us) ─────────────── */}
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="text-on-surface font-semibold text-body-sm mb-3 uppercase tracking-wider">
              {col.title}
            </h4>

            <ul className="flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {"external" in link && link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-body-sm"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-on-surface-variant hover:text-primary transition-colors duration-200 text-body-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* ── Newsletter ─────────────────────────────────────────────── */}
        <div className="col-span-2 lg:col-span-1">
          <h4 className="text-on-surface font-semibold text-body-sm mb-3 uppercase tracking-wider">
            Stay in the loop
          </h4>

          <p className="text-body-sm mb-3 text-on-surface-variant">
            Get the latest updates and tips delivered to your inbox.
          </p>

          <form className="flex" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Your email"
              className="bg-surface-container border border-outline-variant/30 rounded-l-lg px-3 py-2 text-body-sm w-full text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors duration-200"
            />
            <button
              type="submit"
              className="bg-primary-container text-on-primary-container rounded-r-lg px-3 flex items-center justify-center transition-all duration-200 hover:brightness-110"
            >
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>
          </form>
        </div>

      </div>

      {/* ── Copyright ──────────────────────────────────────────────────── */}
      <div className="border-t border-outline-variant/30 py-6 text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-container-padding">
        <p className="text-body-sm text-on-surface-variant">
          © {new Date().getFullYear()} Kuvox Media AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
