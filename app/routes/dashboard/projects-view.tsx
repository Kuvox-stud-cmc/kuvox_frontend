import { useEffect, useState } from "react";
import { Link, useActionData, useSearchParams } from "react-router";

import {
    EmptyState,
    ErrorBanner,
    primaryButtonClass,
} from "~/components/dashboard/section";
import { CreateProjectModal } from "~/components/dashboard/projects/create-project-modal";
import { MediaUploadModal } from "~/components/dashboard/workspace/media-upload-modal";
import { MediaThumbnail } from "~/components/dashboard/workspace/media-thumbnail";
import {
    AssetCardContextMenu,
    FilterTabs,
    GradientThumbnail,
    MetricCard,
    QuickActionCard,
} from "~/components/dashboard/layout/DashboardPageLayout";

import {
    ProjectKind,
    MediaKind,
    projectKindLabel,
    type MediaDto,
    type ProjectDto,
    type ProjectMediaDto,
} from "~/lib/api";
import { AUDIO_CATEGORY_OPTIONS } from "~/lib/audio-categories";
import { projectEditorHref } from "~/lib/project-routes";
import { useLiveMedia } from "~/lib/media-realtime";
import { IconToggleButton } from "~/components/dashboard/shared/IconToggleButton";

/* ── Mock data ──────────────────────────────────────────────────────────── */

interface ProjectsDashboardProps {
    projects: ProjectDto[];
    sharedProjects: ProjectDto[];
    media: MediaDto[];
    error: string | null;
    basePath?: string;
    studioId?: string;
    canWrite?: boolean;
    canManageAccess?: boolean;
    workspaceKind?: "personal" | "studio";
    title?: string;
    subtitle?: string;
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
    starred: number;
    storageLabel: string;
    mediaCount: number;
}

type TabFilter = "all" | "video" | "image" | "starred";

interface MockTeamProject {
    id: string;
    name: string;
    memberCount: number;
    projectCount: number;
    icon: string;
}

interface MockActivity {
    id: string;
    user: string;
    initials: string;
    action: string;
    project: string;
    timeAgo: string;
    online: boolean;
}

interface MockTask {
    id: string;
    title: string;
    project: string;
    priority: "high" | "medium" | "low";
}

interface MockTemplate {
    id: string;
    name: string;
    icon: string;
    tone: "primary" | "secondary" | "tertiary";
}

const TEAM_GRADIENTS = [
    "from-primary/25 via-surface-container-high to-secondary/10",
    "from-tertiary/20 via-surface-container-high to-primary/10",
    "from-secondary/25 via-surface-container-high to-tertiary/10",
];

function buildTabs(metrics: DashboardMetrics): { id: TabFilter; label: string; count: number }[] {
    return [
        { id: "all", label: "All Projects", count: metrics.total },
        { id: "video", label: "Video", count: metrics.video },
        { id: "image", label: "Image", count: metrics.image },
        { id: "starred", label: "Starred", count: metrics.starred },
    ];
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function projectHref(project: ProjectDto, basePath: string) {
    return projectEditorHref(project);
}

function projectToMedia(project: ProjectDto): MediaDto {
    return {
        id: project.id,
        filename: project.name,
        kind: project.kind === ProjectKind.Image ? MediaKind.Image : MediaKind.Video,
        sizeBytes: "0",
        createdAt: project.createdAt || project.updatedAt,
    } as unknown as MediaDto;
}

type ProjectPreviewShape = ProjectDto & {
    coverMedia?: MediaDto | null;
    previewMedia?: MediaDto | null;
    thumbnailMedia?: MediaDto | null;
    media?: MediaDto[] | ProjectMediaDto[] | null;
    projectMedia?: ProjectMediaDto[] | null;
    projectMediaItems?: ProjectMediaDto[] | null;
    mediaItems?: MediaDto[] | null;
    coverMediaId?: string | null;
    previewMediaId?: string | null;
    thumbnailMediaId?: string | null;
    coverMediaUrl?: string | null;
    coverUrl?: string | null;
    posterUrl?: string | null;
    previewImageUrl?: string | null;
    thumbnailImageUrl?: string | null;
    previewUrl?: string | null;
    thumbnailUrl?: string | null;
};

type MediaProjectLinkShape = MediaDto & {
    projectId?: string | null;
    projectIds?: string[] | null;
    projectIdsCsv?: string | null;
};

function projectPreviewMedia(project: ProjectDto, media: MediaDto[]): MediaDto | null {
    const previewProject = project as ProjectPreviewShape;
    const embedded = previewProject.thumbnailMedia ?? previewProject.previewMedia ?? previewProject.coverMedia;
    if (embedded) return embedded;

    const embeddedList = [
        ...(previewProject.mediaItems ?? []),
        ...(previewProject.media ?? []),
        ...(previewProject.projectMediaItems ?? []),
        ...(previewProject.projectMedia ?? []),
    ];
    for (const item of embeddedList) {
        const mediaItem = projectPreviewItemToMedia(item);
        if (mediaItem) return mediaItem;
    }

    const mediaId = previewProject.thumbnailMediaId ?? previewProject.previewMediaId ?? previewProject.coverMediaId;
    if (mediaId) {
        return media.find((item) => item.id === mediaId) ?? null;
    }

    return media.find((item) => {
        const linked = item as MediaProjectLinkShape;
        return (
            linked.projectId === project.id ||
            Boolean(linked.projectIds?.includes(project.id)) ||
            Boolean(linked.projectIdsCsv?.split(",").map((id) => id.trim()).includes(project.id))
        );
    }) ?? null;
}

function projectPreviewUrl(project: ProjectDto): string | null {
    const previewProject = project as ProjectPreviewShape;
    return (
        previewProject.thumbnailImageUrl ??
        previewProject.thumbnailUrl ??
        previewProject.previewImageUrl ??
        previewProject.previewUrl ??
        previewProject.posterUrl ??
        previewProject.coverMediaUrl ??
        previewProject.coverUrl ??
        null
    );
}

function projectPreviewItemToMedia(item: MediaDto | ProjectMediaDto): MediaDto | null {
    if ("id" in item && "filename" in item && "kind" in item && "createdAt" in item) {
        return item as MediaDto;
    }

    const row = item as ProjectMediaDto;
    if (!row.mediaId || row.kind === null || !row.filename || !row.storageKey || !row.status) {
        return null;
    }

    return {
        id: row.mediaId,
        ownerId: row.ownerId ?? "project-preview",
        ownerKind: row.ownerKind ?? 0,
        ownerEmail: null,
        ownerDisplayName: null,
        kind: row.kind,
        filename: row.filename,
        storageKey: row.storageKey,
        sizeBytes: row.sizeBytes ?? 0,
        status: row.status,
        canonicalStorageKey: row.canonicalStorageKey,
        proxyStorageKey: row.proxyStorageKey,
        thumbnailStorageKey: row.thumbnailStorageKey,
        errorMessage: row.errorMessage,
        durationSeconds: row.durationSeconds,
        width: row.width,
        height: row.height,
        codec: row.codec,
        frameRate: row.frameRate,
        createdAt: row.createdAt ?? new Date(0).toISOString(),
        isFavorite: false,
        pipeline: {
            stage: row.status,
            label: row.status,
            detail: row.status,
            step: 4,
            stepCount: 4,
            terminal: true,
        },
    };
}

function ProjectPreview({
    project,
    media,
    index,
    icon,
    compact = false,
}: {
    project: ProjectDto;
    media: MediaDto[];
    index: number;
    icon: string;
    compact?: boolean;
}) {
    const previewMedia = projectPreviewMedia(project, media);
    const previewUrl = projectPreviewUrl(project);
    const typeLabel = projectKindLabel(project.kind);
    const hasImagePreview = Boolean(previewMedia || previewUrl);

    return (
        <div className="relative h-full w-full overflow-hidden bg-surface-container-high">
            {previewMedia ? (
                <MediaThumbnail media={previewMedia} index={index} icon={icon} />
            ) : previewUrl ? (
                <img
                    src={previewUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                <GeneratedProjectPreview project={project} index={index} icon={icon} compact={compact} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/10 opacity-80 transition-opacity group-hover:opacity-60" />
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/85 backdrop-blur">
                <span className="material-symbols-outlined text-[13px]">{hasImagePreview ? "image" : icon}</span>
                {hasImagePreview ? "Preview" : typeLabel}
            </div>
        </div>
    );
}

function GeneratedProjectPreview({
    project,
    index,
    icon,
    compact,
}: {
    project: ProjectDto;
    index: number;
    icon: string;
    compact: boolean;
}) {
    const initials = project.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "KP";

    return (
        <GradientThumbnail index={index} icon={icon} className="relative">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0)_42%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.24),rgba(255,255,255,0)_30%)]" />
            <div className={`relative grid ${compact ? "h-10 w-16" : "h-20 w-32"} place-items-center rounded-md border border-white/18 bg-black/18 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-[1px]`}>
                <span className={`material-symbols-outlined absolute left-2 top-1.5 ${compact ? "text-[13px]" : "text-[17px]"} text-white/55`}>
                    {icon}
                </span>
                <span className={`${compact ? "text-[13px]" : "text-[22px]"} font-black tracking-wide text-white/85`}>
                    {initials}
                </span>
            </div>
        </GradientThumbnail>
    );
}

function ProjectCard({
    project,
    index,
    previewMediaItems,
    basePath,
    canWrite,
    canManageAccess,
    workspaceKind,
}: {
    project: ProjectDto;
    index: number;
    previewMediaItems: MediaDto[];
    basePath: string;
    canWrite: boolean;
    canManageAccess: boolean;
    workspaceKind: "personal" | "studio";
}) {
    const typeLabel = projectKindLabel(project.kind).toLowerCase();
    const typeIcon = {
        video: "movie",
        image: "image",
    }[typeLabel] || "movie";
    const href = projectHref(project, basePath);
    const menuMedia = projectToMedia(project);

    return (
        <div className="bento-card group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low transition-all hover:border-primary/50">
            <Link to={href} className="block cursor-pointer">
                <div className="relative aspect-video">
                    <ProjectPreview project={project} media={previewMediaItems} index={index} icon={typeIcon} />
                </div>

                <div className="p-4">
                    <div className="mb-1 flex items-center gap-3">
                        <h5 className="min-w-0 flex-1 truncate text-body-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                            {project.name}
                        </h5>
                        <span className="shrink-0 truncate text-label-sm text-outline">{project.status}</span>
                    </div>
                    <p className="mb-3 text-label-sm text-outline">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 pr-10">
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm capitalize text-on-surface-variant">
                            {typeLabel}
                        </span>
                    </div>
                </div>
            </Link>
            {canWrite ? (
                <div className="absolute right-3 top-3 z-10">
                    <AssetCardContextMenu
                        media={menuMedia}
                        workspaceKind={workspaceKind}
                        resourceType="projects"
                        copyUrl={href}
                        canManageAccess={canManageAccess}
                    />
                </div>
            ) : null}
            <div className="absolute bottom-3 right-3">
                <IconToggleButton
                    id={project.id}
                    active={project.isStarred}
                    intent="toggle-star"
                    activeIcon="star"
                    inactiveIcon="star_border"
                    activeClassName="text-yellow-500"
                    label={`${project.isStarred ? "Unstar" : "Star"} ${project.name}`}
                />
            </div>
        </div>
    );
}

function ProjectListRow({
    project,
    index,
    previewMediaItems,
    basePath,
    canWrite,
    canManageAccess,
    workspaceKind,
}: {
    project: ProjectDto;
    index: number;
    previewMediaItems: MediaDto[];
    basePath: string;
    canWrite: boolean;
    canManageAccess: boolean;
    workspaceKind: "personal" | "studio";
}) {
    const typeLabel = projectKindLabel(project.kind).toLowerCase();
    const typeIcon = {
        video: "movie",
        image: "image",
    }[typeLabel] || "movie";
    const href = projectHref(project, basePath);
    const menuMedia = projectToMedia(project);

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 transition-colors hover:border-primary/40">
            <Link to={href} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                    <ProjectPreview project={project} media={previewMediaItems} index={index} icon={typeIcon} compact />
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
            <IconToggleButton
                id={project.id}
                active={project.isStarred}
                intent="toggle-star"
                activeIcon="star"
                inactiveIcon="star_border"
                activeClassName="text-yellow-500"
                label={`${project.isStarred ? "Unstar" : "Star"} ${project.name}`}
            />
            {canWrite ? (
                <AssetCardContextMenu
                    media={menuMedia}
                    workspaceKind={workspaceKind}
                    resourceType="projects"
                    copyUrl={href}
                    canManageAccess={canManageAccess}
                />
            ) : null}
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

function ComingSoonPanel({
    title,
    icon,
    message,
}: {
    title: string;
    icon: string;
    message: string;
}) {
    return (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
            <div className="mb-4 flex items-center justify-between">
                <h4 className="text-body-sm font-bold text-on-surface">{title}</h4>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-sm font-bold text-primary">
                    Soon
                </span>
            </div>
            <div className="rounded-xl border border-dashed border-outline-variant/45 bg-surface-container-high/35 px-3 py-5 text-center">
                <span className="material-symbols-outlined text-[24px] text-on-surface-variant/35">{icon}</span>
                <p className="mt-2 text-label-md font-semibold text-on-surface-variant/70">{message}</p>
            </div>
        </div>
    );
}

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
        starred: projects.filter((project) => project.isStarred).length,
        storageLabel: formatBytes(storageBytes),
        mediaCount: media.length,
    };
}

export default function ProjectsDashboard({
    projects,
    sharedProjects,
    media,
    error,
    basePath = "/dashboard/projects",
    studioId,
    canWrite = true,
    canManageAccess = false,
    workspaceKind = studioId ? "studio" : "personal",
    title = "Projects",
    subtitle = "Manage all your projects and collaborate with your team.",
}: ProjectsDashboardProps) {
    const [view, setView] = useState<"grid" | "list">("grid");
    const [sort, setSort] = useState<"latest" | "name">("latest");
    const [activeTab, setActiveTab] = useState<TabFilter>("all");
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const actionData = useActionData<ActionData>();
    const live = useLiveMedia(media);
    const metrics = getProjectMetrics(projects, sharedProjects, live.media);
    const tabs = buildTabs(metrics);
    const workspaceRoot = basePath.replace(/\/projects$/, "");
    const aiToolsPath = workspaceRoot.startsWith("/teams/") ? "/dashboard/ai-tools" : `${workspaceRoot}/ai-tools`;
    const albumsPath = workspaceRoot.startsWith("/teams/") ? `${workspaceRoot}/media/albums` : "/dashboard/albums";

    const handleUploadedMedia = async (uploaded: MediaDto, context: { audioCategory?: string }) => {
        if (uploaded.kind === MediaKind.Audio) {
            if (!context.audioCategory) {
                throw new Error("Choose an audio type.");
            }

            const formData = new FormData();
            formData.append("intent", "assign-audio-category");
            formData.append("mediaId", uploaded.id);
            formData.append("category", context.audioCategory);

            const response = await fetch(studioId ? `/teams/${studioId}/media/audio` : "/dashboard/audio", {
                method: "POST",
                body: formData,
            });
            const body = await response.json().catch(() => null) as { error?: string } | null;

            if (!response.ok || body?.error) {
                throw new Error(body?.error || "Couldn't assign the audio type.");
            }
        }

        live.mergeMedia(uploaded);
    };

    useEffect(() => {
        if (!actionData?.ok) return;
        if (actionData.intent === "create") setCreateOpen(false);
    }, [actionData]);

    useEffect(() => {
        if (searchParams.get("create") !== "1") return;
        setCreateOpen(true);
        const next = new URLSearchParams(searchParams);
        next.delete("create");
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const filteredProjects =
        activeTab === "all"
            ? projects
            : activeTab === "video"
                ? projects.filter((project) => project.kind === ProjectKind.Video)
                : activeTab === "image"
                    ? projects.filter((project) => project.kind === ProjectKind.Image)
                    : activeTab === "starred"
                        ? projects.filter((project) => project.isStarred)
                    : [];

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const visibleCount = sortedProjects.length;

    return (
        <section className="space-y-8">
            {error && <ErrorBanner message={error} />}
            {actionData?.error && <ErrorBanner message={actionData.error} />}
            {/* ── Page Header + Toolbar ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-headline-lg font-bold text-on-surface">{title}</h1>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                        {subtitle}
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
                    {canWrite ? (
                        <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            New Project
                        </button>
                    ) : null}
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
                    icon="star"
                    label="Starred"
                    value={metrics.starred}
                    detail="Marked important"
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
                        Loaded Media Storage
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
                                to={basePath}
                                className="flex items-center gap-1 text-label-md font-bold text-primary transition-colors hover:text-primary-fixed"
                            >
                                {visibleCount} item{visibleCount === 1 ? "" : "s"}
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                        </div>

                        {visibleCount === 0 ? (
                            <EmptyState
                                icon={activeTab === "starred" ? "star_border" : "folder"}
                                title={activeTab === "starred" ? "No starred projects" : "No projects yet"}
                                hint={activeTab === "starred" ? "Star projects to find them quickly here." : "Create a project to start editing."}
                                action={
                                    activeTab === "starred" || !canWrite ? undefined : (
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
                        ) : view === "list" ? (
                            <div className="space-y-3">
                                {sortedProjects.map((project, i) => (
                                    <ProjectListRow key={project.id} project={project} index={i} previewMediaItems={live.media} basePath={basePath} canWrite={canWrite} canManageAccess={canManageAccess} workspaceKind={workspaceKind} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {sortedProjects.map((project, i) => (
                                    <ProjectCard key={project.id} project={project} index={i} previewMediaItems={live.media} basePath={basePath} canWrite={canWrite} canManageAccess={canManageAccess} workspaceKind={workspaceKind} />
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
                                {canWrite ? (
                                    <>
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
                                    </>
                                ) : null}
                                <QuickActionCard
                                    icon="collections"
                                    title="Create Album"
                                    description="Organize media assets"
                                    to={albumsPath}
                                />
                                <QuickActionCard
                                    icon="auto_awesome"
                                    title="AI Assistant"
                                    description="Get AI suggestions"
                                    onClick={() => {
                                        window.location.href = aiToolsPath;
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right sidebar (3 cols) ───────────────────────────────────────── */}
                <div className="col-span-12 space-y-6 xl:col-span-3">
                    <ComingSoonPanel
                        title="Project Activity"
                        icon="notifications"
                        message="Live activity will appear here when workspace events are connected."
                    />

                    <ComingSoonPanel
                        title="My Tasks"
                        icon="task_alt"
                        message="Assigned project tasks will appear here when task data is available."
                    />

                    <ComingSoonPanel
                        title="Project Templates"
                        icon="dashboard_customize"
                        message="Reusable project templates are being prepared for this workspace."
                    />
                </div>
            </div>

            <CreateProjectModal open={createOpen && canWrite} onClose={() => setCreateOpen(false)} />
            <MediaUploadModal
                open={importOpen && canWrite}
                onClose={() => setImportOpen(false)}
                title="Import media"
                studioId={studioId}
                audioCategoryOptions={AUDIO_CATEGORY_OPTIONS}
                onUploaded={handleUploadedMedia}
            />
        </section>
    );
}
