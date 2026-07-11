import { useState } from "react";
import { Provider } from "react-redux";
import { Link, isRouteErrorResponse, redirect, useRevalidator } from "react-router";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { VideoEditorWorkspace } from "~/components/editor/video-editor-workspace";
import type { HeaderNotifications } from "~/routes/dashboard/header-bar";
import { OwnerKind, ProjectKind, type MediaDto, type NotificationDto, type ProjectMediaDto, type Workspace } from "~/lib/api";
import {
  ApiError,
  getProject,
  getStudioClaims,
  getUnreadNotificationCount,
  listAllMedia,
  listNotifications,
  listProjectMedia,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { classifyEditorRecoveryError } from "~/lib/editor/editor-recovery";
import { getEditorBootstrap } from "~/lib/editor/editor-cache";
import { getSession } from "~/lib/session.server";
import { makeStore } from "~/store";

import type { Route } from "./+types/video";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Video Editor - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (process.env.KUVOX_E2E_FIXTURES === "1" && params.projectId === "e2e-video-project") {
    const media = [e2eMediaFixture()];
    return {
      projectId: params.projectId,
      project: e2eProjectFixture(params.projectId),
      user: { id: "user-e2e", email: "e2e@kuvox.local", displayName: "E2E User", plan: "Free" },
      media,
      projectMedia: [e2eProjectMediaFixture(media[0])],
      notifications: { unreadCount: 0, items: [], error: null } satisfies HeaderNotifications,
      mediaLoadError: null,
      canWrite: true,
      loadSource: "server" as const,
    };
  }

  const user = await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    throw redirect("/login");
  }

  let project: import("~/lib/api").ProjectDto;
  try {
    project = await getProject(accessToken, params.projectId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw error;
    return {
      projectId: params.projectId,
      project: null,
      user,
      media: [] as MediaDto[],
      projectMedia: [] as ProjectMediaDto[],
      notifications: { unreadCount: 0, items: [], error: "Couldn't load notifications." } satisfies HeaderNotifications,
      mediaLoadError: error instanceof Error ? error.message : "Project APIs are unavailable.",
      canWrite: false,
      loadSource: "unavailable" as const,
    };
  }
  if (project.kind === ProjectKind.Image) {
    throw redirect(`/editor/image/${project.id}`);
  }

  let media: MediaDto[] = [];
  let projectMedia: ProjectMediaDto[] = [];
  let mediaLoadError: string | null = null;
  const notifications: HeaderNotifications = {
    unreadCount: 0,
    items: [] as NotificationDto[],
    error: null,
  };
  try {
    const [mediaResult, projectMediaResult, notificationsResult, unreadResult] = await Promise.allSettled([
      listAllMedia(accessToken, workspaceForProject(project)),
      listProjectMedia(accessToken, project.id).then((result) => result.items),
      listNotifications(accessToken, { page: 1, pageSize: 5 }),
      getUnreadNotificationCount(accessToken),
    ] as const);

    if (mediaResult.status === "fulfilled") {
      media = mediaResult.value;
    } else {
      mediaLoadError = mediaResult.reason instanceof Error ? mediaResult.reason.message : String(mediaResult.reason);
    }

    if (projectMediaResult.status === "fulfilled") {
      projectMedia = projectMediaResult.value;
    } else {
      mediaLoadError = projectMediaResult.reason instanceof Error ? projectMediaResult.reason.message : String(projectMediaResult.reason);
    }

    if (notificationsResult.status === "fulfilled") {
      notifications.items = notificationsResult.value.items.slice(0, 5);
    } else {
      notifications.error = "Couldn't load notifications.";
    }

    if (unreadResult.status === "fulfilled") {
      notifications.unreadCount = unreadResult.value.count;
    } else {
      notifications.error ??= "Couldn't load notification count.";
    }
  } catch (error) {
    mediaLoadError = error instanceof Error ? error.message : String(error);
  }

  return {
    projectId: params.projectId,
    project,
    user,
    media,
    projectMedia,
    notifications,
    mediaLoadError,
    canWrite: canWriteProject(project, getStudioClaims(accessToken)),
    loadSource: "server" as const,
  };
}

function e2eProjectFixture(projectId: string) {
  return {
    id: projectId,
    ownerId: "user-e2e",
    ownerKind: OwnerKind.User,
    ownerEmail: "e2e@kuvox.local",
    ownerDisplayName: "E2E User",
    kind: ProjectKind.Video,
    name: "E2E Video Project",
    description: null,
    durationSeconds: 20,
    status: "Active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    mediaCount: 1,
    isStarred: false,
  };
}

function e2eMediaFixture(): MediaDto {
  return {
    id: "media-ready",
    ownerId: "user-e2e",
    ownerKind: OwnerKind.User,
    ownerEmail: "e2e@kuvox.local",
    ownerDisplayName: "E2E User",
    kind: 0,
    filename: "Beach ready.mp4",
    storageKey: "raw",
    sizeBytes: 100,
    status: "Ready",
    canonicalStorageKey: "canonical",
    proxyStorageKey: "proxy",
    thumbnailStorageKey: "thumb",
    errorMessage: null,
    durationSeconds: 20,
    width: 1920,
    height: 1080,
    codec: "h264",
    frameRate: 30,
    createdAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    pipeline: { stage: "ready", label: "Ready", detail: "Ready for editing.", step: 4, stepCount: 4, terminal: true },
  };
}

function e2eProjectMediaFixture(media: MediaDto): ProjectMediaDto {
  return {
    mediaId: media.id,
    kind: media.kind,
    availability: "available",
    filename: media.filename,
    ownerId: media.ownerId,
    ownerKind: media.ownerKind,
    status: media.status,
    storageKey: media.storageKey,
    sizeBytes: Number(media.sizeBytes),
    canonicalStorageKey: media.canonicalStorageKey,
    proxyStorageKey: media.proxyStorageKey,
    thumbnailStorageKey: media.thumbnailStorageKey,
    errorMessage: media.errorMessage,
    durationSeconds: Number(media.durationSeconds ?? 0),
    width: Number(media.width ?? 0),
    height: Number(media.height ?? 0),
    codec: media.codec,
    frameRate: Number(media.frameRate ?? 0),
    shotCount: 2,
    createdAt: media.createdAt,
  };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const serverData = await serverLoader();
  if (serverData.project) return serverData;

  const cached = await getEditorBootstrap(serverData.user.id, serverData.projectId);
  if (!cached.ok) {
    throw new Error(serverData.mediaLoadError || "Project APIs are unavailable and this project has not been cached.");
  }

  return {
    ...serverData,
    project: cached.value.project,
    media: cached.value.media,
    projectMedia: cached.value.projectMedia,
    canWrite: cached.value.canWrite,
    mediaLoadError: [serverData.mediaLoadError, ...cached.value.warnings].filter(Boolean).join(" ") || null,
    loadSource: "cache" as const,
  };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return <EditorSkeleton />;
}

export default function VideoEditorRoute({ loaderData }: Route.ComponentProps) {
  if (!loaderData.project) throw new Error("Video project metadata is unavailable.");
  const [store] = useState(() => makeStore());
  const revalidator = useRevalidator();

  return (
    <Provider store={store}>
      <VideoEditorWorkspace
        project={loaderData.project}
        userId={loaderData.user.id}
        user={loaderData.user}
        notifications={loaderData.notifications}
        media={loaderData.media}
        projectMedia={loaderData.projectMedia}
        mediaLoadError={loaderData.mediaLoadError}
        mediaRetrying={revalidator.state !== "idle"}
        onRetryMediaLoad={() => revalidator.revalidate()}
        canWrite={loaderData.canWrite}
      />
    </Provider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const revalidator = useRevalidator();
  const status = isRouteErrorResponse(error) ? error.status : statusFromUnknown(error);
  const recovery = classifyEditorRecoveryError({ status, statusText: statusText(error) }, "route");
  const title = status === 401 || status === 403
    ? "Editor session expired"
    : status && status >= 500
      ? "Editor backend unavailable"
      : "Video editor could not open";

  return (
    <main
      data-editor-video-route-error-boundary
      className="flex min-h-screen flex-col bg-background text-on-background"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-4">
        <Link to="/dashboard/projects" className="text-label-md font-semibold text-primary">
          Kuvox
        </Link>
        <span className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          Video Editor
        </span>
      </header>
      <section className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[8px] border border-outline-variant bg-surface p-5 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
          <p className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            {status ? `Status ${status}` : recovery.kind}
          </p>
          <h1 className="mt-2 text-title-lg font-semibold text-on-surface">{title}</h1>
          <p className="mt-2 text-body-sm leading-6 text-on-surface-variant">{recovery.message}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {status === 401 || status === 403 ? (
              <Link
                to="/login"
                className="inline-flex h-9 items-center rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90"
              >
                Go to login
              </Link>
            ) : (
              <button
                type="button"
                disabled={revalidator.state !== "idle"}
                onClick={() => revalidator.revalidate()}
                className="inline-flex h-9 items-center rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
              >
                {revalidator.state === "idle" ? "Retry" : "Retrying"}
              </button>
            )}
            <Link
              to="/dashboard/projects"
              className="inline-flex h-9 items-center rounded-[4px] border border-outline-variant px-3 text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
            >
              Projects
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function statusFromUnknown(error: unknown): number | null {
  return error && typeof error === "object" && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
}

function statusText(error: unknown): string {
  if (isRouteErrorResponse(error)) return error.statusText;
  if (error instanceof Error) return error.message;
  return "";
}

function canWriteProject(
  project: { ownerKind: number; ownerId: string },
  studioClaims: Array<{ studioId: string; role: string }>,
): boolean {
  if (project.ownerKind === OwnerKind.User) {
    return true;
  }

  const role = studioClaims.find((claim) => claim.studioId === project.ownerId)?.role;
  return role === "Owner" || role === "Admin" || role === "Member" || role === "User";
}

function workspaceForProject(project: { ownerKind: number; ownerId: string }): Workspace {
  return project.ownerKind === OwnerKind.Studio
    ? { kind: "studio", studioId: project.ownerId }
    : { kind: "personal" };
}
