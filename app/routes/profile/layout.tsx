import { NavLink, Outlet } from "react-router";

import type { Route } from "./+types/layout";

export default function ProfileLayout({ params }: Route.ComponentProps) {
  const { username } = params;
  const tabs = [
    { to: `/u/${username}`, label: "Profile", end: true },
    { to: `/u/${username}/followers`, label: "Followers" },
    { to: `/u/${username}/following`, label: "Following" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">@{username}</h1>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 text-sm">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-1 pb-2 ${
                isActive
                  ? "border-gray-900 font-semibold text-gray-900"
                  : "border-transparent text-gray-500"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
