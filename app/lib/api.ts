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
export const UserStudioRole = { Owner: 0, Admin: 1, Member: 2, Viewer: 3 } as const;

export function studioRoleLabel(role: number): string {
  if (role === UserStudioRole.Owner) return "Owner";
  if (role === UserStudioRole.Admin) return "Admin";
  if (role === UserStudioRole.Viewer) return "Viewer";
  return "Member";
}

export function isStudioAdmin(role: number): boolean {
  return role === UserStudioRole.Owner || role === UserStudioRole.Admin;
}

/** Mirrors `Auth.Dtos.StudioMemberDto`. */
export interface StudioMemberDto {
  userId: string;
  email: string;
  displayName: string;
  role: number;
}

export interface StudioInvitationDto {
  id: string;
  studioId: string;
  email: string;
  role: number;
  invitedByUserId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export interface StudioRoleDto {
  role: number;
  label: string;
  description: string;
  permissions: string[];
}

export interface StudioPermissionDto {
  key: string;
  label: string;
  roles: number[];
}

export interface StudioWorkspaceSettingsDto {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  publicSlug: string | null;
}

export interface StudioNotificationSettingsDto {
  notifyOnInvites: boolean;
  notifyOnMembers: boolean;
  notifyOnProjects: boolean;
  notifyOnMedia: boolean;
}

export interface StudioUsageSummaryDto {
  memberCount: number;
  projectCount: number;
  mediaCount: number;
  storageBytesUsed: number;
  storageBytesQuota: number;
}

export interface StudioAuditLogEntryDto {
  id: string;
  actorUserId: string | null;
  category: string;
  action: string;
  targetKind: string;
  targetId: string | null;
  summary: string;
  metadataJson: string | null;
  createdAt: string;
}

export const NotificationStatus = { Unread: 0, Read: 1, Archived: 2, Deleted: 3 } as const;

export interface NotificationDto {
  id: string;
  userId: string;
  studioId: string | null;
  type: number;
  status: number;
  message: string;
  linkUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface UnreadCountDto {
  count: number;
}

export function notificationStatusLabel(status: number): string {
  if (status === NotificationStatus.Read) return "Read";
  if (status === NotificationStatus.Archived) return "Archived";
  if (status === NotificationStatus.Deleted) return "Deleted";
  return "Unread";
}

export function notificationTypeIcon(type: number): string {
  if ([5, 6, 7, 9, 10].includes(type)) return "group";
  if (type === 8) return "admin_panel_settings";
  if (type === 11) return "settings";
  if (type === 12) return "folder";
  if (type === 13 || [1, 2, 3, 4].includes(type)) return "perm_media";
  if (type === 14 || type === 15) return "storage";
  return "notifications";
}

export interface SettingsUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface UserPreferencesDto {
  emailNotificationsEnabled: boolean;
  productUpdatesEnabled: boolean;
  weeklyDigestEnabled: boolean;
  defaultEditorMode: "manual" | "ai" | string;
}

export interface PlanLimitsDto {
  plan: string;
  storageBytes: number;
  projects: number;
  teamSeats: number;
  prioritySupport: boolean;
}

export interface UserSettingsDto {
  user: SettingsUserDto;
  preferences: UserPreferencesDto;
  planLimits: PlanLimitsDto;
}

export interface UpdateProfileDto {
  displayName: string;
}

export interface UpdatePreferencesDto {
  emailNotificationsEnabled: boolean;
  productUpdatesEnabled: boolean;
  weeklyDigestEnabled: boolean;
  defaultEditorMode: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
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

/** Mirrors `Media.Enums.AlbumKind` (integers on the wire). */
export const AlbumKind = { Video: 0, Audio: 1, Photo: 2, Mixed: 3 } as const;

/** Mirrors `Media.Dtos.AlbumDto`. */
export interface AlbumDto {
  id: string;
  name: string;
  description: string;
  kind: number;
  materialSymbol: string;
  isDeleteAble: boolean;
}

/** Mirrors `Media.Dtos.CreateAlbumDto`. */
export interface CreateAlbumDto {
  name: string;
  description: string;
  kind: number;
  materialSymbol: string;
}

