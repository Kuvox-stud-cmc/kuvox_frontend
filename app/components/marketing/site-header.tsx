import { Link, NavLink } from "react-router";

const NAV = [
  { to: "/pricing", label: "Pricing" },
  { to: "/enterprise", label: "Enterprise" },
  { to: "/help", label: "Help" },
  { to: "/community", label: "Community" },
  { to: "/about", label: "About" },
];

/** Top navigation shared across the public marketing pages. */
export function SiteHeader() {
  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-bold">
          Kuvox
        </Link>
        <ul className="flex items-center gap-6 text-sm">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "font-semibold text-gray-900" : "text-gray-600"
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/login" className="text-gray-600">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded bg-gray-900 px-3 py-1.5 text-white"
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}
