import { Link } from "react-router";

const LINKS = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "#", label: "Changelog" },
  { to: "#", label: "Status" },
  { to: "#", label: "Twitter" },
];

/** Footer shared across the public marketing pages. */
export function SiteFooter() {
  return (
    <footer className="bg-surface-container-lowest py-8 sm:py-10 lg:py-12 border-t border-outline-variant">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-container-padding flex flex-col gap-4 sm:gap-element-gap sm:flex-row sm:justify-between sm:items-center">
        <span className="text-on-surface text-body-sm text-center sm:text-left">
          © {new Date().getFullYear()} Kuvox AI. Precision-engineered for
          creators.
        </span>

        <div className="flex flex-wrap justify-center sm:justify-end gap-4 sm:gap-6">
          {LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 text-label-sm font-semibold"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
