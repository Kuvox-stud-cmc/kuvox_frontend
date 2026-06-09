import { Link, NavLink, Outlet } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export default function ProjectDetailLayout({ params }: Route.ComponentProps) {
  const { projectId } = params;
  const tabs = [
    { to: `/projects/${projectId}`, label: "Overview", end: true },
    { to: `/projects/${projectId}/versions`, label: "Version history" },
    { to: `/projects/${projectId}/share`, label: "Share & collaborate" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Project {projectId}</h1>
        <Link
          to={`/editor/${projectId}`}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Open editor
        </Link>
      </div>
      <nav className="mt-6 flex gap-4 border-b border-gray-200 text-sm">
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
