import { useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";

import { PERSONAL, type ProjectDto, projectKindLabel } from "~/lib/api";

function formatDuration(sec: number | null): string {
    if (!sec) return "";
    const min = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const MOCK_STATS = {
    total: 48,
    totalTrend: 16,
    inProgress: 23,
    inProgressTrend: 12,
    completed: 15,
    completedTrend: 8,
    shared: 10,
    sharedTrend: 20,
    archived: 8,
    archivedTrend: -5,
    storageUsedGb: 128,
    storageTotalTb: 1,
    storagePercent: 12.8,
};

// Mock data removed in favor of real API data

interface MockTeamProject {
    id: string;
    name: string;
    memberCount: number;
    projectCount: number;
    icon: string;
}

const MOCK_TEAM_PROJECTS: MockTeamProject[] = [
    { id: "tp1", name: "Brand Campaign 2024", memberCount: 8, projectCount: 12, icon: "campaign" },
    { id: "tp2", name: "Marketing Assets", memberCount: 5, projectCount: 8, icon: "trending_up" },
    { id: "tp3", name: "Product Videos", memberCount: 6, projectCount: 15, icon: "videocam" },
];

interface MockActivity {
    id: string;
    user: string;
    initials: string;
    action: string;
    project: string;
    timeAgo: string;
    online: boolean;
}

const MOCK_ACTIVITY: MockActivity[] = [
    {
        id: "a1",
        user: "Sarah Chen",
        initials: "SC",
        action: "updated",
        project: "Summer Campaign 2024",
        timeAgo: "2m ago",
        online: true,
    },
    {
        id: "a2",
        user: "John Smith",
        initials: "JS",
        action: "uploaded 8 assets to",
        project: "TikTok Ads Pack",
        timeAgo: "15m ago",
        online: true,
    },
    {
        id: "a3",
        user: "Mike Johnson",
        initials: "MJ",
        action: "exported",
        project: "Product Launch Video",
        timeAgo: "1h ago",
        online: false,
    },
];

interface MockTask {
    id: string;
    title: string;
    project: string;
    priority: "high" | "medium" | "low";
}

const MOCK_TASKS: MockTask[] = [
    { id: "t1", title: "Review final cut", project: "Summer Campaign 2024", priority: "high" },
    { id: "t2", title: "Approve color grading", project: "Product Launch Video", priority: "medium" },
    { id: "t3", title: "Add subtitles", project: "Client Interview", priority: "low" },
];

interface MockTemplate {
    id: string;
    name: string;
    icon: string;
    tone: "primary" | "secondary" | "tertiary";
}

const MOCK_TEMPLATES: MockTemplate[] = [
    { id: "tpl1", name: "Video Production", icon: "movie", tone: "primary" },
    { id: "tpl2", name: "Social Media Ads", icon: "ads_click", tone: "secondary" },
    { id: "tpl3", name: "Product Promo", icon: "campaign", tone: "tertiary" },
    { id: "tpl4", name: "Event Recap", icon: "celebration", tone: "tertiary" },
];

const THUMBNAIL_GRADIENTS = [
    "from-primary/20 via-surface-container to-secondary/10",
    "from-tertiary/25 via-surface-container to-primary/10",
    "from-secondary/20 via-surface-container to-tertiary/10",
    "from-primary/15 via-surface-container-high to-tertiary/15",
    "from-secondary/15 via-surface-container to-primary/15",
    "from-tertiary/15 via-surface-container-high to-secondary/15",
    "from-primary/25 via-surface-container to-tertiary/15",
    "from-secondary/20 via-surface-container-high to-primary/10",
];

const AVATAR_COLORS = [
    "bg-primary/20 text-primary",
    "bg-secondary/20 text-secondary",
    "bg-tertiary/20 text-tertiary",
    "bg-primary-container/30 text-primary",
];

const TEAM_GRADIENTS = [
    "from-primary/25 via-surface-container-high to-secondary/10",
    "from-tertiary/20 via-surface-container-high to-primary/10",
    "from-secondary/25 via-surface-container-high to-tertiary/10",
];

type TabFilter = "all" | "video" | "photo" | "audio" | "template" | "team" | "archived";

const TABS: { id: TabFilter; label: string; count?: number }[] = [
    { id: "all", label: "All Projects" },
    { id: "video", label: "Video", count: 28 },
    { id: "photo", label: "Photo", count: 8 },
    { id: "audio", label: "Audio", count: 6 },
    { id: "template", label: "Template", count: 6 },
    { id: "team", label: "Team", count: 10 },
    { id: "archived", label: "Archived", count: 8 },
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function StatCard({
    icon,
    iconBg,
    iconColor,
    label,
    value,
    trend,
}: {
    icon: string;
    iconBg: string;
    iconColor: string;
    label: string;
    value: string | number;
    trend: number;
}) {
    const isPositive = trend >= 0;
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
            <div className="mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                    <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
                </div>
            </div>
            <p className="mb-1 truncate text-[14px] font-medium uppercase tracking-wider text-on-surface-variant">
                {label}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-headline-md font-bold leading-none text-on-surface">{value}</span>
                <span className={`text-label-sm font-bold ${isPositive ? "text-secondary" : "text-error"}`}>
                    {isPositive ? "↑" : "↓"} {Math.abs(trend)}%{" "}
                    <span className="font-normal text-on-surface-variant">vs last month</span>
                </span>
            </div>
        </div>
    );
}



function AvatarStack({ collaborators }: { collaborators: string[] }) {
    return (
        <div className="flex -space-x-2">
            {collaborators.map((c, i) => {
                const isOverflow = c.startsWith("+");
                return (
                    <div
                        key={i}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-low text-[8px] font-bold ${isOverflow
                                ? "bg-surface-container-highest text-on-surface-variant"
                                : AVATAR_COLORS[i % AVATAR_COLORS.length]
                            }`}
                    >
                        {c}
                    </div>
                );
            })}
        </div>
    );
}

function ProjectCard({ project, index }: { project: ProjectDto; index: number }) {
    const typeLabel = projectKindLabel(project.kind).toLowerCase();
    const typeIcon = {
        video: "movie",
        image: "image",
    }[typeLabel] || "movie";

    return (
        <div className="bento-card group cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low transition-all hover:border-primary/50">
            <div className="relative aspect-video">
                <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length]}`}
                >
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant/20">
                        {typeIcon}
                    </span>
                </div>
                <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

            </div>

            <div className="p-4">
                <h5 className="mb-1 truncate text-body-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                    {project.name}
                </h5>
                <p className="mb-3 text-label-sm text-outline">{new Date(project.updatedAt).toLocaleDateString()}</p>
                <div className="flex items-center justify-between">
                    <AvatarStack collaborators={["SC"]} />
                    <button
                        type="button"
                        className="text-outline transition-colors hover:text-on-surface"
                    >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProjectListRow({ project, index }: { project: ProjectDto; index: number }) {
    const typeLabel = projectKindLabel(project.kind).toLowerCase();
    const typeIcon = {
        video: "movie",
        image: "image",
    }[typeLabel] || "movie";

    return (
        <div className="group flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 transition-colors hover:border-primary/40">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${THUMBNAIL_GRADIENTS[index % THUMBNAIL_GRADIENTS.length]}`}
                >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20">
                        {typeIcon}
                    </span>
                </div>
                {/* project.starred support later */}
            </div>
            <div className="min-w-0 flex-1">
                <h5 className="truncate text-body-sm font-bold text-on-surface">{project.name}</h5>
                <p className="mt-0.5 text-label-sm text-outline">{new Date(project.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="hidden items-center gap-3 text-label-sm text-on-surface-variant sm:flex">
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm capitalize text-on-surface-variant">
                    {typeLabel}
                </span>
            </div>
            <AvatarStack collaborators={["SC"]} />
            <button
                type="button"
                className="text-outline transition-colors hover:text-on-surface"
            >
                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
            </button>
        </div>
    );
}

function TeamProjectRow({ team, index }: { team: MockTeamProject; index: number }) {
    return (
        <div className="group flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-surface-container-high">
            <div className="flex items-center gap-3">
                <div
                    className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${TEAM_GRADIENTS[index % TEAM_GRADIENTS.length]}`}
                >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                        {team.icon}
                    </span>
                </div>
                <div>
                    <h6 className="text-body-sm font-bold text-on-surface">{team.name}</h6>
                    <p className="text-label-sm text-outline">
                        {team.memberCount} members · {team.projectCount} projects
                    </p>
                </div>
            </div>
            <button
                type="button"
                className="rounded-lg bg-primary-container/20 px-4 py-1.5 text-label-sm font-bold text-primary transition-all hover:bg-primary-container hover:text-on-primary-container"
            >
                Open
            </button>
        </div>
    );
}

function QuickActionCard({
    icon,
    title,
    description,
}: {
    icon: string;
    title: string;
    description: string;
}) {
    return (
        <button
            type="button"
            className="group flex flex-col items-start gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-high p-4 text-left transition-all hover:border-primary/50"
        >
            <span className="material-symbols-outlined text-[24px] text-primary transition-transform group-hover:scale-110">
                {icon}
            </span>
            <div>
                <p className="text-body-sm font-bold text-on-surface">{title}</p>
                <p className="text-label-sm text-outline">{description}</p>
            </div>
        </button>
    );
}

function ActivityItem({ activity }: { activity: MockActivity }) {
    return (
        <div className="flex gap-3">
            <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {activity.initials}
                </div>
                <div
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-container-low ${activity.online ? "bg-secondary" : "bg-primary"}`}
                />
            </div>
            <div>
                <p className="text-label-md font-bold text-on-surface">
                    {activity.user}{" "}
                    <span className="font-normal text-outline">{activity.action}</span>
                </p>
                <p className="text-label-sm text-primary">{activity.project}</p>
                <p className="mt-0.5 text-label-sm text-outline">{activity.timeAgo}</p>
            </div>
        </div>
    );
}

function TaskItem({ task }: { task: MockTask }) {
    const priorityConfig = {
        high: { label: "High", cls: "bg-error-container/20 text-error" },
        medium: { label: "Medium", cls: "bg-tertiary/10 text-tertiary" },
        low: { label: "Low", cls: "bg-secondary/10 text-secondary" },
    }[task.priority];

    return (
        <div className="group flex cursor-pointer items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-outline-variant/30 transition-colors group-hover:border-primary">
                    <span className="material-symbols-outlined text-[14px] text-transparent transition-colors group-hover:text-primary/50">
                        check
                    </span>
                </div>
                <div>
                    <p className="text-label-md font-bold text-on-surface">{task.title}</p>
                    <p className="text-label-sm text-outline">{task.project}</p>
                </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-label-sm font-bold ${priorityConfig.cls}`}>
                {priorityConfig.label}
            </span>
        </div>
    );
}

function TemplateRow({ template }: { template: MockTemplate }) {
    const toneConfig = {
        primary: { bg: "bg-primary/10 group-hover:bg-primary/20", text: "text-primary" },
        secondary: { bg: "bg-secondary/10 group-hover:bg-secondary/20", text: "text-secondary" },
        tertiary: { bg: "bg-tertiary/10 group-hover:bg-tertiary/20", text: "text-tertiary" },
    }[template.tone];

    return (
        <div className="group flex cursor-pointer items-center justify-between rounded-xl p-2 transition-colors hover:bg-surface-container">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${toneConfig.bg}`}>
                    <span className={`material-symbols-outlined text-[18px] ${toneConfig.text}`}>
                        {template.icon}
                    </span>
                </div>
                <p className="text-label-md font-bold text-on-surface">{template.name}</p>
            </div>
            <span className={`text-label-sm font-bold opacity-0 transition-opacity group-hover:opacity-100 ${toneConfig.text}`}>
                Use
            </span>
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function ProjectsDashboard({ projects }: { projects: ProjectDto[] }) {
    const [view, setView] = useState<"grid" | "list">("grid");
    const [sort, setSort] = useState<"latest" | "name">("latest");
    const [activeTab, setActiveTab] = useState<TabFilter>("all");
    const [createOpen, setCreateOpen] = useState(false);

    const filteredProjects =
        activeTab === "all"
            ? projects
            : activeTab === "team" || activeTab === "archived"
                ? projects.slice(0, 3) 
                : projects.filter((p) => projectKindLabel(p.kind).toLowerCase() === activeTab);

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return (
        <section className="space-y-8">
            {/* ── Page Header + Toolbar ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-headline-lg font-bold text-on-surface">Projects</h1>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                        Manage all your projects and collaborate with your team.
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                    {/* Filters */}
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-body-sm font-bold text-on-surface transition-colors hover:bg-surface-bright"
                    >
                        <span className="material-symbols-outlined text-[18px]">filter_list</span>
                        Filters
                    </button>

                    {/* Sort */}
                    <label className="flex flex-col gap-1">
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as typeof sort)}
                            className="rounded-xl border-none bg-surface-container-high px-4 py-2.5 text-body-sm font-bold text-on-surface outline-none transition-colors hover:bg-surface-bright focus:ring-1 focus:ring-primary/50"
                        >
                            <option value="latest">Sort: Last edited</option>
                            <option value="name">Sort: Name</option>
                        </select>
                    </label>

                    {/* View toggle */}
                    <div className="flex items-center gap-0.5 rounded-xl bg-surface-container-high p-1">
                        <button
                            type="button"
                            aria-label="Grid view"
                            onClick={() => setView("grid")}
                            className={`rounded-lg p-1.5 transition-colors ${view === "grid"
                                ? "bg-primary-container/20 text-primary"
                                : "text-outline hover:text-on-surface"
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button
                            type="button"
                            aria-label="List view"
                            onClick={() => setView("list")}
                            className={`rounded-lg p-1.5 transition-colors ${view === "list"
                                ? "bg-primary-container/20 text-primary"
                                : "text-outline hover:text-on-surface"
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">list</span>
                        </button>
                    </div>

                    {/* New Project CTA */}
                    <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        New Project
                    </button>
                </div>
            </div>

            {/* ── Summary Stats ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                <StatCard
                    icon="folder"
                    label="Total Projects"
                    value={MOCK_STATS.total}
                    trend={MOCK_STATS.totalTrend}
                    iconBg="bg-primary-container/10"
                    iconColor="text-primary"
                />
                <StatCard
                    icon="schedule"
                    label="In Progress"
                    value={MOCK_STATS.inProgress}
                    trend={MOCK_STATS.inProgressTrend}
                    iconBg="bg-secondary-container/10"
                    iconColor="text-secondary"
                />
                <StatCard
                    icon="task_alt"
                    label="Completed"
                    value={MOCK_STATS.completed}
                    trend={MOCK_STATS.completedTrend}
                    iconBg="bg-secondary/10"
                    iconColor="text-secondary"
                />
                <StatCard
                    icon="share"
                    label="Shared Projects"
                    value={MOCK_STATS.shared}
                    trend={MOCK_STATS.sharedTrend}
                    iconBg="bg-primary/10"
                    iconColor="text-primary"
                />
                <StatCard
                    icon="inventory_2"
                    label="Archived"
                    value={MOCK_STATS.archived}
                    trend={MOCK_STATS.archivedTrend}
                    iconBg="bg-tertiary/10"
                    iconColor="text-tertiary"
                />
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
                    <div className="mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                            <span className="material-symbols-outlined text-[20px] text-secondary">inventory_2</span>
                        </div>
                    </div>
                    <p className="mb-1 truncate text-[14px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Storage Used
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-headline-md font-bold leading-none text-on-surface">
                            {MOCK_STATS.storageUsedGb} GB
                        </span>
                        <span className="text-label-sm text-on-surface-variant">
                            {MOCK_STATS.storagePercent}% of {MOCK_STATS.storageTotalTb} TB
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Content Grid: 9 + 3 ────────────────────────────────────────────── */}
            <div className="grid grid-cols-12 gap-6">
                {/* ── Left column (9 cols) ─────────────────────────────────────────── */}
                <div className="col-span-12 space-y-6 xl:col-span-9">
                    {/* Category Tabs */}
                    <div className="flex flex-wrap items-center gap-2">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 rounded-full px-5 py-2 text-body-sm font-medium transition-colors ${activeTab === tab.id
                                    ? "bg-primary text-on-primary font-bold"
                                    : "text-on-surface-variant hover:bg-surface-container"
                                    }`}
                            >
                                {tab.label}
                                {tab.count != null && (
                                    <span
                                        className={`rounded-lg px-2 py-0.5 text-label-sm ${activeTab === tab.id
                                            ? "bg-on-primary/20 text-on-primary"
                                            : "bg-surface-container-highest text-on-surface-variant"
                                            }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Recent Projects */}
                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-headline-md font-bold text-on-surface">Recent Projects</h2>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-label-md font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                View All
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </button>
                        </div>

                        {view === "list" ? (
                            <div className="space-y-3">
                                {sortedProjects.map((project, i) => (
                                    <ProjectListRow key={project.id} project={project} index={i} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {sortedProjects.map((project, i) => (
                                    <ProjectCard key={project.id} project={project} index={i} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Team Projects + Quick Actions */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Team Projects */}
                        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
                            <div className="mb-6 flex items-center justify-between">
                                <h3 className="text-headline-md font-bold text-on-surface">Team Projects</h3>
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-label-md font-bold text-primary transition-colors hover:text-primary-fixed"
                                >
                                    View All
                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                            </div>
                            <div className="space-y-3">
                                {MOCK_TEAM_PROJECTS.map((team, i) => (
                                    <TeamProjectRow key={team.id} team={team} index={i} />
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
                            <h3 className="mb-6 text-headline-md font-bold text-on-surface">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <QuickActionCard
                                    icon="cloud_upload"
                                    title="Import Media"
                                    description="Upload photos, videos, audio"
                                />
                                <QuickActionCard
                                    icon="add_box"
                                    title="Create Project"
                                    description="Start a new project"
                                />
                                <QuickActionCard
                                    icon="create_new_folder"
                                    title="New Folder"
                                    description="Organize your projects"
                                />
                                <QuickActionCard
                                    icon="auto_awesome"
                                    title="AI Assistant"
                                    description="Get AI suggestions"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right sidebar (3 cols) ───────────────────────────────────────── */}
                <div className="col-span-12 space-y-6 xl:col-span-3">
                    {/* Project Activity */}
                    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
                        <div className="mb-5 flex items-center justify-between">
                            <h4 className="text-body-sm font-bold text-on-surface">Project Activity</h4>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-label-sm font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                View All
                                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {MOCK_ACTIVITY.map((activity) => (
                                <ActivityItem key={activity.id} activity={activity} />
                            ))}
                        </div>
                    </div>

                    {/* My Tasks */}
                    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
                        <div className="mb-5 flex items-center justify-between">
                            <h4 className="text-body-sm font-bold text-on-surface">My Tasks</h4>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-label-sm font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                View All
                                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {MOCK_TASKS.map((task) => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                        </div>
                    </div>

                    {/* Project Templates */}
                    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
                        <div className="mb-5 flex items-center justify-between">
                            <h4 className="text-body-sm font-bold text-on-surface">Project Templates</h4>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-label-sm font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                View All
                                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </button>
                        </div>
                        <div className="space-y-2">
                            {MOCK_TEMPLATES.map((template) => (
                                <TemplateRow key={template.id} template={template} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── New Project Modal ──────────────────────────────────────────────── */}
            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="New project"
            >
                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="project-name"
                            className="block text-label-md text-on-surface-variant"
                        >
                            Name
                        </label>
                        <input
                            id="project-name"
                            type="text"
                            placeholder="My new edit"
                            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="project-kind"
                            className="block text-label-md text-on-surface-variant"
                        >
                            Kind
                        </label>
                        <select
                            id="project-kind"
                            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                        >
                            <option>Video</option>
                            <option>Image</option>
                            <option>Audio</option>
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="project-description"
                            className="block text-label-md text-on-surface-variant"
                        >
                            Description <span className="text-on-surface-variant">(optional)</span>
                        </label>
                        <textarea
                            id="project-description"
                            rows={2}
                            placeholder="Brief project description..."
                            className="mt-1 w-full resize-none rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setCreateOpen(false)}
                            className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreateOpen(false)}
                            className={primaryButtonClass()}
                        >
                            Create
                        </button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}
