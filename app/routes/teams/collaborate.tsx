import { Link } from "react-router";

import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/collaborate";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Collaborate · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const TEAM_MEMBERS = [
  { id: "1", name: "Nguyen A", role: "Editor", status: "online", avatar: "N" },
  { id: "2", name: "Alice Tran", role: "Designer", status: "online", avatar: "A" },
  { id: "3", name: "Bob Le", role: "Producer", status: "away", avatar: "B" },
  { id: "4", name: "Emma Pham", role: "Reviewer", status: "offline", avatar: "E" },
  { id: "5", name: "David Vo", role: "Editor", status: "online", avatar: "D" },
];

const SHARED_ASSETS = [
  { id: "1", name: "Brand Logo Pack", sharedBy: "Alice Tran", date: "22/06", type: "Photos" },
  { id: "2", name: "Promo Video v2", sharedBy: "Bob Le", date: "21/06", type: "Video" },
  { id: "3", name: "Background Music", sharedBy: "Nguyen A", date: "20/06", type: "Audio" },
  { id: "4", name: "Social Templates", sharedBy: "Alice Tran", date: "19/06", type: "Templates" },
];

const COMMENTS = [
  {
    id: "1",
    author: "Alice Tran",
    avatar: "A",
    message: "The color grading on the intro looks great! Can we apply the same LUT to the outro?",
    project: "Travel Campaign",
    time: "2h ago",
  },
  {
    id: "2",
    author: "Bob Le",
    avatar: "B",
    message: "I've uploaded the new footage. Please review when you get a chance.",
    project: "Product Demo",
    time: "4h ago",
  },
  {
    id: "3",
    author: "Emma Pham",
    avatar: "E",
    message: "Approved! This version is ready for export.",
    project: "Travel Campaign",
    time: "6h ago",
  },
];

const MENTIONS = [
  {
    id: "1",
    from: "Alice Tran",
    avatar: "A",
    message: "mentioned you in Travel Campaign",
    context: "@you Can you check the audio levels on clip 3?",
    time: "1h ago",
    unread: true,
  },
  {
    id: "2",
    from: "Bob Le",
    avatar: "B",
    message: "mentioned you in Product Demo",
    context: "@you Ready for your review.",
    time: "3h ago",
    unread: true,
  },
  {
    id: "3",
    from: "Emma Pham",
    avatar: "E",
    message: "mentioned you in Brand Kit Update",
    context: "@you New logo files are uploaded.",
    time: "1d ago",
    unread: false,
  },
];

const STATUS_DOT: Record<string, string> = {
  online: "bg-secondary",
  away: "bg-tertiary",
  offline: "bg-outline-variant",
};

type CollabView = "team" | "shared" | "comments" | "mentions";

const VIEW_CONFIG: Record<CollabView, { label: string; icon: string }> = {
  team: { label: "Team Members", icon: "group" },
  shared: { label: "Shared Assets", icon: "share" },
  comments: { label: "Comments", icon: "chat_bubble" },
  mentions: { label: "Mentions", icon: "alternate_email" },
};

export default function TeamCollaborate({ params }: Route.ComponentProps) {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get("view") as CollabView) ?? "team";
  const studioId = params.studioId;

  return (
    <section>
      <SectionHeader title="Collaborate" subtitle="Work together with your team." />

      {/* View tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(VIEW_CONFIG) as CollabView[]).map((key) => (
          <Link
            key={key}
            to={`/teams/${studioId}/collaborate?view=${key}`}
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
        {view === "team" && (
          <div className="space-y-3">
            {TEAM_MEMBERS.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-body-sm font-bold text-primary">
                    {m.avatar}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-low ${STATUS_DOT[m.status]}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-on-surface">{m.name}</p>
                  <p className="text-label-md text-on-surface-variant">{m.role}</p>
                </div>
                <span className="text-label-sm capitalize text-on-surface-variant">{m.status}</span>
              </div>
            ))}
          </div>
        )}

        {view === "shared" && (
          <div className="space-y-3">
            {SHARED_ASSETS.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant/60">share</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-on-surface">{a.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    Shared by {a.sharedBy} · {a.date}
                  </p>
                </div>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                  {a.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {view === "comments" && (
          <div className="space-y-3">
            {COMMENTS.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-label-md font-bold text-primary">
                    {c.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-body-sm font-medium text-on-surface">{c.author}</span>
                    <span className="mx-2 text-label-md text-on-surface-variant">in</span>
                    <span className="text-body-sm text-primary">{c.project}</span>
                  </div>
                  <span className="text-label-sm text-on-surface-variant">{c.time}</span>
                </div>
                <p className="mt-2 pl-11 text-body-sm text-on-surface-variant">{c.message}</p>
              </div>
            ))}
          </div>
        )}

        {view === "mentions" && (
          <div className="space-y-3">
            {MENTIONS.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-4 transition-colors hover:border-primary/40 ${
                  m.unread
                    ? "border-primary/30 bg-primary/5"
                    : "border-outline-variant bg-surface-container-low"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-label-md font-bold text-primary">
                    {m.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-body-sm font-medium text-on-surface">{m.from}</span>
                    <span className="ml-1.5 text-body-sm text-on-surface-variant">{m.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.unread && <div className="h-2 w-2 rounded-full bg-primary" />}
                    <span className="text-label-sm text-on-surface-variant">{m.time}</span>
                  </div>
                </div>
                <p className="mt-2 rounded-lg bg-surface-container px-3 py-2 pl-11 text-body-sm text-on-surface-variant">
                  {m.context}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
