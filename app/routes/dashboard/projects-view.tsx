import { useEffect, useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";

import {
    EmptyState,
    ErrorBanner,
    Modal,
    primaryButtonClass,
} from "~/components/dashboard/section";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import {
    CardOverflowMenu,
    FilterTabs,
    FormActions,
    GradientThumbnail,
    MetricCard,
    QuickActionCard,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { TextArea, TextField } from "~/components/dashboard/shared/form";

import {
    ProjectKind,
    projectKindLabel,
    type MediaDto,
    type ProjectDto,
    type ProjectTrashItem,
} from "~/lib/api";
import { useLiveMedia } from "~/lib/media-realtime";

/* ── Mock data ──────────────────────────────────────────────────────────── */

interface ProjectsDashboardProps {
    projects: ProjectDto[];
    sharedProjects: ProjectDto[];
    archivedProjects: ProjectTrashItem[];
    media: MediaDto[];
    error: string | null;
}

interface ActionData {
    ok?: boolean;
    intent?: string;
    error?: string;
}

interface DashboardMetrics {
    total: number;
    video: number;
    image: number;
    inProgress: number;
    completed: number;
    shared: number;
    archived: number;
    storageLabel: string;
    mediaCount: number;
}

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

type TabFilter = "all" | "video" | "image" | "archived";

function buildTabs(metrics: DashboardMetrics): { id: TabFilter; label: string; count: number }[] {
    return [
        { id: "all", label: "All Projects", count: metrics.total },
        { id: "video", label: "Video", count: metrics.video },
        { id: "image", label: "Image", count: metrics.image },
        { id: "archived", label: "Archived", count: metrics.archived },
    ];
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

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
    const href = project.kind === ProjectKind.Video ? `/editor/${project.id}` : "/dashboard/projects";

    return (
        <div className="bento-card group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low transition-all hover:border-primary/50">
            <Link to={href} className="block cursor-pointer">
                <div className="relative aspect-video">
                    <GradientThumbnail index={index} icon={typeIcon} />
                    <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

                </div>

                <div className="p-4">
                    <h5 className="mb-1 truncate pr-8 text-body-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                        {project.name}
                    </h5>
                    <p className="mb-3 text-label-sm text-outline">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm capitalize text-on-surface-variant">
                            {typeLabel}
                        </span>
                        <span className="truncate text-label-sm text-outline">{project.status}</span>
                    </div>
                </div>
            </Link>
            <div className="absolute right-3 top-3">
                <CardOverflowMenu
                    id={project.id}
                    itemLabel={project.name}
                    buttonClassName="bg-surface-container-lowest/70 backdrop-blur-md hover:bg-surface-container-lowest/90"
                />
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
    const href = project.kind === ProjectKind.Video ? `/editor/${project.id}` : "/dashboard/projects";

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 transition-colors hover:border-primary/40">
            <Link to={href} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                    <GradientThumbnail
                        index={index}
                        icon={typeIcon}
                        iconClassName="text-[20px] text-on-surface-variant/20"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <h5 className="truncate text-body-sm font-bold text-on-surface">{project.name}</h5>
                    <p className="mt-0.5 text-label-sm text-outline">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                </div>
                <div className="hidden items-center gap-3 text-label-sm text-on-surface-variant sm:flex">
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm capitalize text-on-surface-variant">
                        {typeLabel}
                    </span>
                </div>
                <span className="text-label-sm text-outline">{project.status}</span>
            </Link>
            <CardOverflowMenu id={project.id} itemLabel={project.name} />
        </div>
    );
}

function ArchivedProjectCard({ project, index }: { project: ProjectTrashItem; index: number }) {
    return (
        <div className="bento-card overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low opacity-80">
            <div className="relative aspect-video">
                <GradientThumbnail index={index} icon="inventory_2" />
            </div>
            <div className="p-4">
                <h5 className="mb-1 truncate text-body-sm font-bold text-on-surface">
                    {project.name}
                </h5>
                <p className="text-label-sm text-outline">
                    Deleted {new Date(project.deletedAt).toLocaleDateString()}
                </p>
                <p className="mt-2 text-label-sm text-on-surface-variant">
                    Purges in {project.purgesInDays} days
                </p>
            </div>
        </div>
    );
}

function ArchivedProjectListRow({ project, index }: { project: ProjectTrashItem; index: number }) {
    return (
        <div className="group flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 opacity-80">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                <GradientThumbnail
                    index={index}
                    icon="inventory_2"
                    iconClassName="text-[20px] text-on-surface-variant/20"
                />
            </div>
            <div className="min-w-0 flex-1">
                <h5 className="truncate text-body-sm font-bold text-on-surface">{project.name}</h5>
                <p className="mt-0.5 text-label-sm text-outline">
                    Deleted {new Date(project.deletedAt).toLocaleDateString()}
                </p>
            </div>
            <span className="hidden text-label-sm text-on-surface-variant sm:inline">
                Purges in {project.purgesInDays} days
            </span>
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

function normalizeStatus(status: string): string {
    return status.replace(/\s|_/g, "").toLowerCase();
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
    return `${bytes.toLocaleString()} B`;
}

function getProjectMetrics(
    projects: ProjectDto[],
    sharedProjects: ProjectDto[],
    archivedProjects: ProjectTrashItem[],
    media: MediaDto[],
): DashboardMetrics {
    const storageBytes = media.reduce((total, item) => total + Number(item.sizeBytes), 0);
    return {
        total: projects.length,
        video: projects.filter((project) => project.kind === ProjectKind.Video).length,
        image: projects.filter((project) => project.kind === ProjectKind.Image).length,
        inProgress: projects.filter((project) => normalizeStatus(project.status) === "inprogress").length,
        completed: projects.filter((project) => normalizeStatus(project.status) === "completed").length,
        shared: sharedProjects.length,
        archived: archivedProjects.length,
        storageLabel: formatBytes(storageBytes),
        mediaCount: media.length,
    };
}

export default function ProjectsDashboard({
    projects,
    sharedProjects,
    archivedProjects,
    media,
    error,
}: ProjectsDashboardProps) {
    const [view, setView] = useState<"grid" | "list">("grid");
    const [sort, setSort] = useState<"latest" | "name">("latest");
    const [activeTab, setActiveTab] = useState<TabFilter>("all");
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const live = useLiveMedia(media);
    const metrics = getProjectMetrics(projects, sharedProjects, archivedProjects, live.media);
    const tabs = buildTabs(metrics);

    useEffect(() => {
        if (!actionData?.ok) return;
        if (actionData.intent === "create") setCreateOpen(false);
    }, [actionData]);

    const filteredProjects =
        activeTab === "all"
            ? projects
            : activeTab === "video"
                ? projects.filter((project) => project.kind === ProjectKind.Video)
                : activeTab === "image"
                    ? projects.filter((project) => project.kind === ProjectKind.Image)
                    : [];

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const sortedArchivedProjects = [...archivedProjects].sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
    });

    const visibleCount =
        activeTab === "archived" ? sortedArchivedProjects.length : sortedProjects.length;

    return (
        <section className="space-y-8">
            {error && <ErrorBanner message={error} />}
            {actionData?.error && <ErrorBanner message={actionData.error} />}
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
                <MetricCard
                    variant="stacked"
                    icon="folder"
                    label="Total Projects"
                    value={metrics.total}
                    detail={`${metrics.video} video, ${metrics.image} image`}
                    iconBgClassName="bg-primary-container/10"
                    iconClassName="text-primary"
                />
                <MetricCard
                    variant="stacked"
                    icon="schedule"
                    label="In Progress"
                    value={metrics.inProgress}
                    detail="Active project status"
                    iconBgClassName="bg-secondary-container/10"
                    iconClassName="text-secondary"
                />
                <MetricCard
                    variant="stacked"
                    icon="task_alt"
                    label="Completed"
                    value={metrics.completed}
                    detail="Completed status"
                    iconBgClassName="bg-secondary/10"
                    iconClassName="text-secondary"
                />
                <MetricCard
                    variant="stacked"
                    icon="share"
                    label="Shared Projects"
                    value={metrics.shared}
                    detail="Shared with you"
                    iconBgClassName="bg-primary/10"
                    iconClassName="text-primary"
                />
                <MetricCard
                    variant="stacked"
                    icon="inventory_2"
                    label="Archived"
                    value={metrics.archived}
                    detail="In trash"
                    iconBgClassName="bg-tertiary/10"
                    iconClassName="text-tertiary"
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
                            {metrics.storageLabel}
                        </span>
                        <span className="text-label-sm text-on-surface-variant">
                            {metrics.mediaCount} media file{metrics.mediaCount === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Content Grid: 9 + 3 ────────────────────────────────────────────── */}
            <div className="grid grid-cols-12 gap-6">
                {/* ── Left column (9 cols) ─────────────────────────────────────────── */}
                <div className="col-span-12 space-y-6 xl:col-span-9">
                    {/* Category Tabs */}
                    <FilterTabs
                        items={tabs.map((tab) => ({
                            value: tab.id,
                            label: tab.label,
                            count: tab.count,
                        }))}
                        value={activeTab}
                        onChange={setActiveTab}
                        className="[&_button:not(.bg-primary)]:bg-transparent [&_button:not(.bg-primary)]:px-5 [&_button:not(.bg-primary)]:py-2"
                    />

                    {/* Recent Projects */}
                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-headline-md font-bold text-on-surface">Recent Projects</h2>
                            <Link
                                to="/dashboard/projects"
                                className="flex items-center gap-1 text-label-md font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                {visibleCount} item{visibleCount === 1 ? "" : "s"}
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                        </div>

                        {visibleCount === 0 ? (
                            <EmptyState
                                icon={activeTab === "archived" ? "inventory_2" : "folder"}
                                title={
                                    activeTab === "archived"
                                        ? "No archived projects"
                                        : "No projects yet"
                                }
                                hint={
                                    activeTab === "archived"
                                        ? "Deleted projects will appear here until they are purged."
                                        : "Create a project to start editing."
                                }
                                action={
                                    activeTab === "archived" ? undefined : (
                                        <button
                                            type="button"
                                            onClick={() => setCreateOpen(true)}
                                            className={primaryButtonClass()}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">add</span>
                                            Create Project
                                        </button>
                                    )
                                }
                            />
                        ) : activeTab === "archived" && view === "list" ? (
                            <div className="space-y-3">
                                {sortedArchivedProjects.map((project, i) => (
                                    <ArchivedProjectListRow key={project.id} project={project} index={i} />
                                ))}
                            </div>
                        ) : activeTab === "archived" ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {sortedArchivedProjects.map((project, i) => (
                                    <ArchivedProjectCard key={project.id} project={project} index={i} />
                                ))}
                            </div>
                        ) : view === "list" ? (
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

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 gap-6">
                        {/* Quick Actions */}
                        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
                            <h3 className="mb-6 text-headline-md font-bold text-on-surface">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <QuickActionCard
                                    icon="cloud_upload"
                                    title="Import Media"
                                    description="Upload photos, videos, audio"
                                    onClick={() => setImportOpen(true)}
                                />
                                <QuickActionCard
                                    icon="add_box"
                                    title="Create Project"
                                    description="Start a new project"
                                    onClick={() => setCreateOpen(true)}
                                />
                                <QuickActionCard
                                    icon="collections"
                                    title="Create Album"
                                    description="Organize media assets"
                                    to="/dashboard/albums"
                                />
                                <QuickActionCard
                                    icon="auto_awesome"
                                    title="AI Assistant"
                                    description="Get AI suggestions"
                                    onClick={() => {
                                        window.location.href = "/dashboard/ai-tools";
                                    }}
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
                <Form method="post" className="space-y-4">
                    <input type="hidden" name="intent" value="create" />
                    <TextField
                        name="name"
                        label="Name"
                        placeholder="My new edit"
                        required
                        autoFocus
                    />
                    <div>
                        <label
                            htmlFor="project-kind"
                            className="block text-label-md text-on-surface-variant"
                        >
                            Kind
                        </label>
                        <select
                            id="project-kind"
                            name="kind"
                            defaultValue={ProjectKind.Video}
                            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                        >
                            <option value={ProjectKind.Video}>Video</option>
                            <option value={ProjectKind.Image}>Image</option>
                        </select>
                    </div>
                    <TextArea
                        name="description"
                        label="Description"
                        rows={2}
                        placeholder="Brief project description..."
                    />
                    <FormActions
                        onCancel={() => setCreateOpen(false)}
                        submitLabel={isSubmitting ? "Creating..." : "Create"}
                        isSubmitting={isSubmitting}
                    />
                </Form>
            </Modal>
            <MediaUploadModal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Import media"
                onUploaded={live.mergeMedia}
            />
        </section>
    );
}
