import { Link } from "react-router";

const LINKS = [
  { to: "/about", label: "About us" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/terms", label: "Terms of service" },
  { to: "/help", label: "Help Center" },
];

/** Footer shared across the public marketing pages. */
export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Kuvox</span>
        <ul className="flex gap-6">
          {LINKS.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
