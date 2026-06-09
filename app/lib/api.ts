// Client-safe API contract: enums, label helpers, workspace types, and the DTO shapes the
// backend returns. Pure data only — no `fetch`, no secrets — so route components may import
// these by value. The server-only request helpers live in `api.server.ts`.

export type Workspace =
  | { kind: "personal" }
  | { kind: "studio"; studioId: string };

export type ResourceKind = "projects" | "media";

export const PERSONAL: Workspace = { kind: "personal" };

/** Mirrors `Projects.Enums.ProjectKind` (integers on the wire). */
export const ProjectKind = { Video: 0, Image: 1 } as const;

/** Mirrors `Media.Enums.MediaKind` (integers on the wire). */
export const MediaKind = { Video: 0, Image: 1, Audio: 2 } as const;

export function projectKindLabel(kind: number): string {
  return kind === ProjectKind.Image ? "Image" : "Video";
}

export function mediaKindLabel(kind: number): string {
  if (kind === MediaKind.Image) return "Image";
  if (kind === MediaKind.Audio) return "Audio";
  return "Video";
}

/** Builds `?studioId=...` (+ optional extras) for a Team workspace, or "" for Personal. */
export function workspaceQuery(
  ws: Workspace,
  extra?: Record<string, string | number>,
): string {
  const params = new URLSearchParams();
  if (ws.kind === "studio") params.set("studioId", ws.studioId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Mirrors the API's `PagedResult<T>`. */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Mirrors `Projects.Dtos.ProjectDto`. */
export interface ProjectDto {
  id: string;
  ownerId: string;
  ownerKind: number;
  kind: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `Media.Dtos.MediaDto`. */
export interface MediaDto {
  id: string;
  ownerId: string;
  ownerKind: number;
  kind: number;
  projectId: string | null;
  filename: string;
  storageKey: string;
  sizeBytes: number;
  status: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  createdAt: string;
}

/** Mirrors `Projects.Dtos.ProjectTrashItemDto`. */
export interface ProjectTrashItem {
  id: string;
  kind: number;
  name: string;
  description: string | null;
  deletedAt: string;
  purgesInDays: number;
}

/** Mirrors `Media.Dtos.MediaTrashItemDto`. */
export interface MediaTrashItem {
  id: string;
  kind: number;
  filename: string;
  deletedAt: string;
  purgesInDays: number;
}

/** Mirrors `Auth.Dtos.StudioDto`. */
export interface StudioDto {
  id: string;
  name: string;
  role: number;
}

/** Mirrors `Auth.Enums.UserStudioRole` (integers on the wire). */
export const UserStudioRole = { User: 0, Admin: 1 } as const;

export function studioRoleLabel(role: number): string {
  return role === UserStudioRole.Admin ? "Admin" : "Member";
}

export function isStudioAdmin(role: number): boolean {
  return role === UserStudioRole.Admin;
}

/** Mirrors `Auth.Dtos.StudioMemberDto`. */
export interface StudioMemberDto {
  userId: string;
  email: string;
  displayName: string;
  role: number;
}

/** A unified Trash row (project or media) for the shared Trash view. */
export interface TrashEntry {
  resource: ResourceKind;
  id: string;
  label: string;
  kindLabel: string;
  icon: string;
  purgesInDays: number;
}

/** Flattens project + media trash into a single display list. */
export function toTrashEntries(
  projects: ProjectTrashItem[],
  media: MediaTrashItem[],
): TrashEntry[] {
  const entries: TrashEntry[] = projects.map((project) => ({
    resource: "projects" as const,
    id: project.id,
    label: project.name,
    kindLabel: projectKindLabel(project.kind),
    icon: "movie",
    purgesInDays: project.purgesInDays,
  }));
  for (const item of media) {
    entries.push({
      resource: "media",
      id: item.id,
      label: item.filename,
      kindLabel: mediaKindLabel(item.kind),
      icon: "perm_media",
      purgesInDays: item.purgesInDays,
    });
  }
  return entries;
}

/** The active workspace as a discriminated value, used by the switcher. */
export type ActiveWorkspace = { kind: "personal" } | { kind: "studio"; studioId: string };
