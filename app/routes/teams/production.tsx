import { Link } from "react-router";

import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/production";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Production · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const TASKS = [
  {
    id: "1",
    title: "Edit Intro",
    assigned: "Nguyen A",
    due: "23/06",
    status: "In Progress",
    statusColor: "bg-tertiary/20 text-tertiary",
  },
  {
    id: "2",
    title: "Color Grade Scene 3",
    assigned: "Alice Tran",
    due: "24/06",
    status: "To Do",
    statusColor: "bg-surface-container-high text-on-surface-variant",
  },
  {
    id: "3",
    title: "Add Subtitles",
    assigned: "Bob Le",
    due: "25/06",
    status: "To Do",
    statusColor: "bg-surface-container-high text-on-surface-variant",
  },
  {
    id: "4",
    title: "Sound Design",
    assigned: "David Vo",
    due: "24/06",
    status: "In Progress",
    statusColor: "bg-tertiary/20 text-tertiary",
  },
  {
    id: "5",
    title: "Final Export",
    assigned: "Nguyen A",
    due: "26/06",
    status: "Blocked",
    statusColor: "bg-error/20 text-error",
  },
];

const TIMELINE = [
  { time: "09:00", user: "Alice", avatar: "A", action: "uploaded footage", color: "bg-primary" },
  { time: "10:15", user: "Bob", avatar: "B", action: "edited video", color: "bg-secondary" },
  { time: "11:30", user: "Emma", avatar: "E", action: "approved", color: "bg-secondary" },
  { time: "13:00", user: "System", avatar: "S", action: "Export completed", color: "bg-tertiary" },
];

const VERSIONS = [
  { id: "1", name: "Video_v1", date: "18/06", size: "245 MB", status: "archived" },
  { id: "2", name: "Video_v2", date: "19/06", size: "312 MB", status: "archived" },
  { id: "3", name: "Video_final", date: "20/06", size: "298 MB", status: "archived" },
  { id: "4", name: "Video_final_final", date: "21/06", size: "305 MB", status: "archived" },
  { id: "5", name: "Video_final_final_REAL", date: "22/06", size: "310 MB", status: "current" },
];

type ProdView = "tasks" | "timeline" | "versions";

const VIEW_CONFIG: Record<ProdView, { label: string; icon: string }> = {
  tasks: { label: "Tasks", icon: "task_alt" },
  timeline: { label: "Timeline", icon: "schedule" },
  versions: { label: "Versions", icon: "history" },
};

export default function TeamProduction({ params }: Route.ComponentProps) {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get("view") as ProdView) ?? "tasks";
  const studioId = params.studioId;

  return (
    <section>
      <SectionHeader title="Production" subtitle="Track tasks, timeline, and version history." />

      {/* View tabs */}
      <div className="mt-4 flex gap-2">
        {(Object.keys(VIEW_CONFIG) as ProdView[]).map((key) => (
          <Link
            key={key}
            to={`/teams/${studioId}/production?view=${key}`}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-body-sm transition-colors ${
              view === key
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{VIEW_CONFIG[key].icon}</span>
            {VIEW_CONFIG[key].label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {view === "tasks" && (
          <div className="space-y-3">
            {TASKS.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">{task.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {task.assigned}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {task.due}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-label-sm font-medium ${task.statusColor}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "timeline" && (
          <div className="relative ml-4 border-l-2 border-outline-variant/50 pl-6">
            {TIMELINE.map((event, i) => (
              <div key={i} className="relative mb-6 last:mb-0">
                {/* Dot */}
                <div className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface-container-low ${event.color}`} />
                {/* Content */}
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <span className="text-label-md font-mono font-medium text-primary">{event.time}</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-label-sm font-bold text-primary">
                      {event.avatar}
                    </div>
                    <span className="text-body-sm text-on-surface">
                      <span className="font-medium">{event.user}</span>{" "}
                      <span className="text-on-surface-variant">{event.action}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "versions" && (
          <div className="space-y-3">
            {VERSIONS.map((ver) => (
              <div
                key={ver.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  ver.status === "current"
                    ? "border-primary/40 bg-primary/5"
                    : "border-outline-variant bg-surface-container-low hover:border-primary/40"
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  ver.status === "current" ? "bg-primary/20" : "bg-surface-container"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${
                    ver.status === "current" ? "text-primary" : "text-on-surface-variant/60"
                  }`}>
                    {ver.status === "current" ? "check_circle" : "history"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-body-sm font-medium text-on-surface">{ver.name}</p>
                    {ver.status === "current" && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-label-sm text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-label-md text-on-surface-variant">
                    {ver.date} · {ver.size}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
