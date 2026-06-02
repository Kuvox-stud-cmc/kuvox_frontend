import { Link, NavLink, Outlet } from "react-router";

const NAV = [
  { to: "/dashboard", label: "Home", end: true },
  { to: "/dashboard/projects", label: "Projects" },
  { to: "/dashboard/media", label: "Media" },
  { to: "/dashboard/shared", label: "Shared with me" },
  { to: "/dashboard/trash", label: "Trash" },
];

/** Authenticated app shell with a sidebar for the dashboard section. */
export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-gray-200 bg-white p-4">
        <Link to="/" className="text-lg font-bold">
          Kuvox
        </Link>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded px-3 py-2 ${
                  isActive ? "bg-gray-900 text-white" : "text-gray-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
