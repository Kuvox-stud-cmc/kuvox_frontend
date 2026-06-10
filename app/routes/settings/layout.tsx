import { NavLink, Outlet } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

const NAV = [
  { to: "/settings/account", label: "Account profile" },
  { to: "/settings/billing", label: "Billing & subscription" },
  { to: "/settings/preferences", label: "Preferences" },
  { to: "/settings/security", label: "Security" },
  { to: "/settings/integrations", label: "Integrations" },
];

/** Settings section shell with a side nav. */
export default function SettingsLayout() {
  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
      <aside className="w-56 shrink-0">
        <h1 className="text-xl font-semibold">Settings</h1>
        <nav className="mt-4 flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
