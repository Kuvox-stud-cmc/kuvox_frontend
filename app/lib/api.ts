// Client-safe API contract: enums, label helpers, workspace types, and the DTO shapes the
// backend returns. Pure data only — no `fetch`, no secrets — so route components may import
// these by value. The server-only request helpers live in `api.server.ts`.
import type { components } from "./api/generated";

export type Workspace =
  | { kind: "personal" }
  | { kind: "studio"; studioId: string };

export type ResourceKind = "projects" | "media";

export const PERSONAL: Workspace = { kind: "personal" };

/** Mirrors `Projects.Enums.ProjectKind` (integers on the wire). */
export const ProjectKind = { Video: 0, Image: 1 } as const;

/** Mirrors `Media.Enums.MediaKind` (integers on the wire). */
export const MediaKind = { Video: 0, Image: 1, Audio: 2 } as const;

/** Mirrors workspace ownership enums that serialize as integers on the wire. */
export const OwnerKind = { User: 0, Studio: 1 } as const;

export const ProjectRole = { Owner: 0, Editor: 1, Viewer: 2 } as const;

export const Permission = { Owner: 0, Editor: 1, Viewer: 2 } as const;

/** Mirrors `Tasks.Contracts.TaskIssueKind` (integers on the wire). */
export const TaskIssueKind = { Task: 0, Review: 1 } as const;

/** Mirrors `Tasks.Contracts.TaskIssueStatus` (integers on the wire). */
export const TaskIssueStatus = {
  Open: 0,
  InProgress: 1,
  InReview: 2,
  ChangesRequested: 3,
  Approved: 4,
  Done: 5,
  Closed: 6,
} as const;

/** Mirrors `Tasks.Contracts.TaskMilestoneStatus` (integers on the wire). */
export const TaskMilestoneStatus = { Open: 0, Closed: 1 } as const;

export interface TaskAssigneeDto {
  userId: string;
  email: string;
  displayName: string;
}

export interface TaskMilestoneDto {
  id: string;
  studioId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLabelDto {
  id: string;
  studioId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskIssueDto {
  id: string;
  studioId: string;
  projectId: string | null;
  projectName: string | null;
  parentTaskIssueId: string | null;
  kind: number;
  status: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  milestone: TaskMilestoneDto | null;
  assignees: TaskAssigneeDto[];
  labels: TaskLabelDto[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  commentsCount: number;
  subtaskCount: number;
  completedSubtaskCount: number;
}

export interface TaskCommentDto {
  id: string;
  taskIssueId: string;
  authorUserId: string;
  authorEmail: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}

export interface TaskActivityDto {
  id: string;
  taskIssueId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorDisplayName: string | null;
  action: string;
  summary: string;
  metadataJson: string | null;
  createdAt: string;
}

export interface TaskIssueDetailDto extends TaskIssueDto {
  subtasks: TaskIssueDto[];
  comments: TaskCommentDto[];
  activity: TaskActivityDto[];
}

export interface TaskIssueFilters {
  studioId?: string;
  kind?: number | string;
  status?: number | string;
  assigneeId?: string;
  milestoneId?: string;
  labelId?: string;
  projectId?: string;
  dueBefore?: string;
}

export interface CreateTaskIssueRequest {
  kind: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  milestoneId: string | null;
  projectId: string | null;
  parentTaskIssueId: string | null;
  assigneeIds: string[] | null;
  labelIds: string[] | null;
}

export type UpdateTaskIssueRequest = CreateTaskIssueRequest;

export type UpdateTaskIssueStatusRequest = components["schemas"]["UpdateTaskIssueStatusRequest"];

export type CreateTaskMilestoneRequest = components["schemas"]["CreateTaskMilestoneRequest"];

export type UpdateTaskMilestoneRequest = components["schemas"]["UpdateTaskMilestoneRequest"];

export type CreateTaskLabelRequest = components["schemas"]["CreateTaskLabelRequest"];

export type UpdateTaskLabelRequest = components["schemas"]["UpdateTaskLabelRequest"];

export interface CreateTaskCommentRequest {
  body: string;
}

export interface UpdateTaskCommentRequest {
  body: string;
}

export function taskKindLabel(kind: number): string {
  return kind === TaskIssueKind.Review ? "Review" : "Task";
}

export function taskStatusLabel(status: number): string {
  if (status === TaskIssueStatus.InProgress) return "In progress";
  if (status === TaskIssueStatus.InReview) return "In review";
  if (status === TaskIssueStatus.ChangesRequested) return "Changes requested";
  if (status === TaskIssueStatus.Approved) return "Approved";
  if (status === TaskIssueStatus.Done) return "Done";
  if (status === TaskIssueStatus.Closed) return "Closed";
  return "Open";
}

export function isTaskOpen(status: number): boolean {
  return status !== TaskIssueStatus.Done && status !== TaskIssueStatus.Closed;
}

export function sharedRoleLabel(role: number): string {
  if (role === ProjectRole.Editor || role === Permission.Editor) return "Editor";
  if (role === ProjectRole.Owner || role === Permission.Owner) return "Owner";
  return "Viewer";
}

export interface ShareRequest {
  email: string;
  role: number;
}

export interface ItemAccessMemberDto {
  userId: string;
  email: string;
  displayName: string;
  studioRole: string;
  effectiveRole: number;
  overrideRole: number | null;
  isHidden: boolean;
  canManage: boolean;
}

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
export type ProjectDto = components["schemas"]["ProjectDto"];

/** Mirrors `Media.Dtos.MediaDto`. */
export type MediaDto = components["schemas"]["MediaDto"];

/** Mirrors `Projects.Dtos.ProjectTrashItemDto`. */
export type ProjectTrashItem = components["schemas"]["ProjectTrashItemDto"];

/** Mirrors `Media.Dtos.MediaTrashItemDto`. */
export type MediaTrashItem = components["schemas"]["MediaTrashItemDto"];

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

export function canManageStudioAccess(role: number): boolean {
  return isStudioAdmin(role);
}

export function canWriteStudioContent(role: number): boolean {
  return (
    role === UserStudioRole.Owner ||
    role === UserStudioRole.Admin ||
    role === UserStudioRole.Member
  );
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

export interface MediaStorageObjectBreakdownDto {
  rawBytes: number;
  canonicalBytes: number;
  proxyBytes: number;
  thumbnailBytes: number;
}

export interface MediaStorageUsageDto {
  plan: string;
  storageBytesUsed: number;
  storageBytesQuota: number;
  storagePercent: number;
  mediaCount: number;
  activeBytesUsed: number;
  trashBytesUsed: number;
  objectBreakdown: MediaStorageObjectBreakdownDto;
  trashObjectBreakdown: MediaStorageObjectBreakdownDto;
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

export type NotificationDto = components["schemas"]["NotificationDto"];

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
  if (type === 16 || type === 17) return "task_alt";
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
    purgesInDays: Number(project.purgesInDays),
  }));
  for (const item of media) {
    entries.push({
      resource: "media",
      id: item.id,
      label: item.filename,
      kindLabel: mediaKindLabel(item.kind),
      icon: "perm_media",
      purgesInDays: Number(item.purgesInDays),
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
  ownerId: string;
  ownerKind: number;
  ownerEmail?: string | null;
  ownerDisplayName?: string | null;
  name: string;
  description: string;
  kind: number;
  materialSymbol: string;
  isDeleteAble: boolean;
  mediaCount?: number;
  isFavorite: boolean;
}

/** Mirrors `Media.Dtos.CreateAlbumDto`. */
export interface CreateAlbumDto {
  name: string;
  description: string;
  kind: number;
  materialSymbol: string;
}

