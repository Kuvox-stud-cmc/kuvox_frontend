import { useState } from "react";
import { Link } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

type MemberRole = "owner" | "admin" | "editor" | "viewer";
type MemberStatus = "active" | "invited" | "offline";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  initials: string;
  lastActive: string;
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: "m1",
    name: "You",
    email: "you@kuvox.app",
    role: "owner",
    status: "active",
    initials: "Y",
    lastActive: "Now",
  },
  {
    id: "m2",
    name: "Sarah Chen",
    email: "sarah@studio.co",
    role: "admin",
    status: "active",
    initials: "S",
    lastActive: "12 min ago",
  },
  {
    id: "m3",
    name: "John Smith",
    email: "john@studio.co",
    role: "editor",
    status: "active",
    initials: "J",
    lastActive: "1 hour ago",
  },
  {
    id: "m4",
    name: "Emma Davis",
    email: "emma@studio.co",
    role: "editor",
    status: "offline",
    initials: "E",
    lastActive: "Yesterday",
  },
  {
    id: "m5",
    name: "Alex Rivera",
    email: "alex@studio.co",
    role: "viewer",
    status: "invited",
    initials: "A",
    lastActive: "Pending",
  },
];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_TONES: Record<MemberRole, string> = {
  owner: "bg-primary/15 text-primary",
  admin: "bg-tertiary/15 text-tertiary",
  editor: "bg-secondary/15 text-secondary",
  viewer: "bg-surface-container-high text-on-surface-variant",
};

/* ── Sub-components ─────────────────────────────────────────────────────── */

function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: "primary" | "secondary" | "tertiary";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <p className="mb-1 text-label-sm text-on-surface-variant">{label}</p>
      <span className="text-headline-md font-bold text-on-surface">{value}</span>
    </div>
  );
}

function MemberRow({ member }: { member: TeamMember }) {
  const statusDot =
    member.status === "active"
      ? "bg-secondary"
      : member.status === "invited"
        ? "bg-tertiary"
        : "bg-outline-variant";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/30">
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-label-md font-bold text-on-surface">
          {member.initials}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-low ${statusDot}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-body-sm font-bold text-on-surface">{member.name}</h3>
          {member.role === "owner" && (
            <span className="text-label-sm text-on-surface-variant">(you)</span>
          )}
        </div>
        <p className="truncate text-label-md text-on-surface-variant">{member.email}</p>
      </div>
      <span
        className={`hidden rounded-full px-2.5 py-1 text-label-sm font-bold sm:inline-flex ${ROLE_TONES[member.role]}`}
      >
        {ROLE_LABELS[member.role]}
      </span>
      <span className="hidden text-label-sm text-on-surface-variant md:block">
        {member.lastActive}
      </span>
      {member.role !== "owner" && (
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-on-surface group-hover:opacity-100"
        >
          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
        </button>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Team() {
  const [inviteOpen, setInviteOpen] = useState(false);

  const activeCount = MOCK_MEMBERS.filter((m) => m.status === "active").length;
  const invitedCount = MOCK_MEMBERS.filter((m) => m.status === "invited").length;

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">Team</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Manage members, roles, and collaboration for your personal workspace.
          </p>
        </div>
        <button type="button" onClick={() => setInviteOpen(true)} className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Invite member
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="group" label="Total Members" value={MOCK_MEMBERS.length} />
        <MetricCard
          icon="bolt"
          label="Active Today"
          value={`${activeCount} / ${MOCK_MEMBERS.length}`}
          tone="secondary"
        />
        <MetricCard
          icon="mail"
          label="Pending Invites"
          value={invitedCount}
          tone="tertiary"
        />
        <MetricCard icon="assignment" label="Projects Shared" value={12} tone="secondary" />
      </div>

      {/* Team overview card */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {MOCK_MEMBERS.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-label-sm font-bold text-on-surface ring-2 ring-surface"
                >
                  {member.initials}
                </div>
              ))}
            </div>
            <div>
              <p className="text-body-sm font-bold text-on-surface">Personal workspace team</p>
              <p className="text-label-md text-on-surface-variant">
                {activeCount} members active today
              </p>
            </div>
          </div>
          <p className="text-label-md text-on-surface-variant">
            Need a full studio?{" "}
            <Link to="/enterprise" className="font-medium text-primary hover:underline">
              Upgrade to Teams
            </Link>
          </p>
        </div>
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Members</h2>
          <span className="text-label-md text-on-surface-variant">
            {MOCK_MEMBERS.length} people
          </span>
        </div>
        <div className="space-y-3">
          {MOCK_MEMBERS.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      </section>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite member">
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Send an invite to collaborate on your personal workspace projects.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-label-md text-on-surface-variant">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="colleague@studio.co"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-label-md text-on-surface-variant">
              Role
            </label>
            <select
              id="invite-role"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button type="button" onClick={() => setInviteOpen(false)} className={primaryButtonClass()}>
              Send invite
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
