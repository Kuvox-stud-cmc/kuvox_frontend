import { useParams } from "react-router";
import type { ReactNode } from "react";

import {
  FilterTabs,
  GradientThumbnail,
  MetricCard,
  QuickActionCard,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, primaryButtonClass } from "~/components/dashboard/section";

interface StudioRecord {
  id: string;
  title: string;
  description: string;
  icon: string;
  status?: string;
  tone?: Parameters<typeof StatusBadge>[0]["tone"];
}

const MOCK_TASKS: StudioRecord[] = [
  {
    id: "task-1",
    title: "Review hero cut",
    description: "Due today · assigned to Maya",
    icon: "rate_review",
    status: "In review",
    tone: "warning",
  },
  {
    id: "task-2",
    title: "Collect launch assets",
    description: "12 files requested for the campaign folder",
    icon: "folder_copy",
    status: "Open",
    tone: "primary",
  },
  {
    id: "task-3",
    title: "Approve final captions",
    description: "Waiting on studio owner approval",
    icon: "subtitles",
    status: "Blocked",
    tone: "danger",
  },
];

const MOCK_RENDERS: StudioRecord[] = [
  {
    id: "render-1",
    title: "Summer Campaign 4K",
    description: "Queued · estimated 18 minutes",
    icon: "movie",
    status: "Queued",
    tone: "warning",
  },
  {
    id: "render-2",
    title: "Social teaser pack",
    description: "Completed yesterday · 6 outputs",
    icon: "video_library",
    status: "Complete",
    tone: "success",
  },
];

const MOCK_ROLES: StudioRecord[] = [
  {
    id: "role-admin",
    title: "Admin",
    description: "Manage members, workspace settings, projects, and media.",
    icon: "admin_panel_settings",
    status: "System",
    tone: "neutral",
  },
  {
    id: "role-member",
    title: "Member",
    description: "Create and edit studio projects and media.",
    icon: "badge",
    status: "System",
    tone: "neutral",
  },
  {
    id: "role-reviewer",
    title: "Reviewer",
    description: "Mock role for review-only access planning.",
    icon: "rate_review",
    status: "Mock",
    tone: "info",
  },
];

const MOCK_PERMISSIONS: StudioRecord[] = [
  {
    id: "perm-projects",
    title: "Project management",
    description: "Create, edit, archive, and restore studio projects.",
    icon: "folder",
    status: "Admin / Member",
    tone: "primary",
  },
  {
    id: "perm-media",
    title: "Media library",
    description: "Upload, organize, and archive studio media assets.",
    icon: "perm_media",
    status: "Admin / Member",
    tone: "primary",
  },
  {
    id: "perm-settings",
    title: "Workspace settings",
    description: "Rename or delete the studio workspace.",
    icon: "settings",
    status: "Admin",
    tone: "warning",
  },
];

const MOCK_INVITATIONS: StudioRecord[] = [
  {
    id: "invite-1",
    title: "producer@example.com",
    description: "Invited as Member · expires in 5 days",
    icon: "outgoing_mail",
    status: "Pending",
    tone: "warning",
  },
  {
    id: "invite-2",
    title: "reviewer@example.com",
    description: "Invited as Reviewer · sent yesterday",
    icon: "outgoing_mail",
    status: "Sent",
    tone: "info",
  },
];

const MOCK_AUDIT: StudioRecord[] = [
  {
    id: "audit-1",
    title: "Workspace renamed",
    description: "Admin updated the Studio display name · 2h ago",
    icon: "edit",
    status: "Settings",
    tone: "neutral",
  },
  {
    id: "audit-2",
    title: "Project archived",
    description: "Summer Campaign moved to Trash · yesterday",
    icon: "delete",
    status: "Project",
    tone: "warning",
  },
  {
    id: "audit-3",
    title: "Member role changed",
    description: "Maya changed from Member to Admin · Jun 28",
    icon: "manage_accounts",
    status: "Access",
    tone: "primary",
  },
];

const MOCK_ALBUMS = [
  { id: "album-1", name: "Launch selects", type: "Mixed", icon: "collections", count: 42 },
  { id: "album-2", name: "B-roll library", type: "Videos", icon: "videocam", count: 18 },
  { id: "album-3", name: "Product stills", type: "Photos", icon: "photo_library", count: 64 },
];

const settingRows = {
  profile: [
    ["Studio profile URL", "kuvox.app/studios/acme-creative"],
    ["Public discovery", "Hidden"],
    ["Default editor mode", "Manual"],
  ],
  notifications: [
    ["Render completion", "Email and in-app"],
    ["Member invitations", "In-app only"],
    ["Weekly studio digest", "Enabled"],
  ],
  storage: [
    ["Studio storage quota", "500 GB pooled"],
    ["Storage add-ons", "$5 per 100 GB/month"],
    ["Retention policy", "Trash purges after 7 days"],
  ],
};

function StudioPageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">{title}</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RecordsList({ records }: { records: StudioRecord[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {records.map((record) => (
        <div
          key={record.id}
          className="rounded-2xl border border-outline-variant bg-surface-container-low p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[20px]">{record.icon}</span>
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-body-md font-bold text-on-surface">{record.title}</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">{record.description}</p>
              </div>
            </div>
            {record.status && (
              <StatusBadge label={record.status} tone={record.tone ?? "neutral"} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudioTasksPage() {
  return (
    <StudioPageShell
      title="Tasks"
      subtitle="Mock task planning for the Studio workspace until task APIs are added."
      action={
        <button type="button" className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          New task
        </button>
      }
    >
      <FilterTabs
        items={[
          { value: "open", label: "Open", count: 2 },
          { value: "review", label: "Review", count: 1 },
          { value: "done", label: "Done", count: 0 },
        ]}
        value="open"
        onChange={() => undefined}
      />
      <RecordsList records={MOCK_TASKS} />
    </StudioPageShell>
  );
}

export function StudioRendersPage() {
  return (
    <StudioPageShell
      title="Renders"
      subtitle="Render queue mock data for the Studio. Backend render jobs will replace this page later."
      action={
        <button type="button" className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Queue render
        </button>
      }
    >
      <RecordsList records={MOCK_RENDERS} />
    </StudioPageShell>
  );
}

export function StudioUsagePage() {
  return (
    <StudioPageShell
      title="Usage & Quotas"
      subtitle="Mock usage overview for the Studio plan. Project and media counts are API-backed on the Home page."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon="storage" label="Storage quota" value="500 GB" detail="Pooled workspace" />
        <MetricCard icon="movie" label="Render minutes" value="420" detail="2,000 quota" tone="secondary" />
        <MetricCard icon="group" label="Seats" value="6" detail="10 quota" tone="tertiary" />
      </div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <div className="mb-2 flex items-center justify-between text-label-md text-on-surface-variant">
          <span>Storage usage</span>
          <span>Shown in Studio storage settings</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full w-0 rounded-full bg-primary" />
        </div>
      </div>
    </StudioPageShell>
  );
}

export function StudioAccessMockPage({
  kind,
}: {
  kind: "roles" | "permissions" | "invitations" | "audit";
}) {
  const config = {
    roles: {
      title: "Roles",
      subtitle: "System roles and planned custom role UI for this Studio.",
      records: MOCK_ROLES,
    },
    permissions: {
      title: "Permissions",
      subtitle: "Permission matrix preview. Current backend enforces Admin and Member roles.",
      records: MOCK_PERMISSIONS,
    },
    invitations: {
      title: "Invitations",
      subtitle: "Mock invitation queue. Current member add flow is available on Members.",
      records: MOCK_INVITATIONS,
    },
    audit: {
      title: "Audit Log",
      subtitle: "Mock audit feed for Studio activity until audit APIs are added.",
      records: MOCK_AUDIT,
    },
  }[kind];

  return (
    <StudioPageShell title={config.title} subtitle={config.subtitle}>
      {config.records.length === 0 ? (
        <EmptyState icon="inbox" title="Nothing to show" />
      ) : (
        <RecordsList records={config.records} />
      )}
    </StudioPageShell>
  );
}

export function StudioAlbumsMockPage() {
  return (
    <StudioPageShell
      title="Albums"
      subtitle="Studio album UI mock. The current album backend is personal-user scoped and does not accept studioId yet."
      action={
        <button type="button" className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
          New album
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MOCK_ALBUMS.map((album, index) => (
          <div
            key={album.id}
            className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low"
          >
            <div className="relative h-36">
              <GradientThumbnail index={index} icon={album.icon} />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate text-body-md font-bold text-on-surface">{album.name}</h2>
                <StatusBadge label={album.type} tone="neutral" />
              </div>
              <p className="mt-2 text-label-md text-on-surface-variant">{album.count} assets</p>
            </div>
          </div>
        ))}
      </div>
    </StudioPageShell>
  );
}

export function StudioSettingsMockPage({
  kind,
}: {
  kind: "profile" | "notifications" | "storage";
}) {
  const title = {
    profile: "Profile Settings",
    notifications: "Notifications",
    storage: "Storage",
  }[kind];

  return (
    <StudioPageShell
      title={title}
      subtitle="Mock Studio settings panel. These controls are frontend-only until the matching backend APIs are added."
    >
      <div className="max-w-3xl rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <div className="space-y-4">
          {settingRows[kind].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-outline-variant/50 pb-4 last:border-b-0 last:pb-0">
              <span className="text-body-sm text-on-surface">{label}</span>
              <span className="text-body-sm text-on-surface-variant">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </StudioPageShell>
  );
}

export function StudioSettingsIndexPage() {
  const { studioId } = useParams();
  const base = `/teams/${studioId}/settings`;

  return (
    <StudioPageShell title="Settings" subtitle="Choose a Studio settings area to manage.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <QuickActionCard
          icon="settings"
          title="Workspace Settings"
          description="Rename or delete the Studio."
          to={`${base}/workspace`}
        />
        <QuickActionCard
          icon="badge"
          title="Profile Settings"
          description="Public Studio profile mock settings."
          to={`${base}/profile`}
        />
        <QuickActionCard
          icon="notifications"
          title="Notifications"
          description="Studio notification preferences."
          to={`${base}/notifications`}
        />
        <QuickActionCard
          icon="storage"
          title="Storage"
          description="Retention and storage settings."
          to={`${base}/storage`}
        />
      </div>
    </StudioPageShell>
  );
}

export function StudioMediaRedirectHint() {
  const { studioId } = useParams();
  return (
    <StudioPageShell title="Media Library" subtitle="Choose a Studio media category.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickActionCard icon="videocam" title="Videos" to={`/teams/${studioId}/media/videos`} />
        <QuickActionCard icon="photo_library" title="Photos" to={`/teams/${studioId}/media/photos`} />
        <QuickActionCard icon="music_note" title="Audio" to={`/teams/${studioId}/media/audio`} />
      </div>
    </StudioPageShell>
  );
}
