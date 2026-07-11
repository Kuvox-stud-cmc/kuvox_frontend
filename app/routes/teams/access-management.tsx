import { actionErrorMessage } from "~/lib/action-error.server";
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import {
  studioRoleLabel,
  UserStudioRole,
  type StudioMemberDto,
  type StudioPermissionDto,
  type StudioRoleDto,
} from "~/lib/api";
import {
  ApiError,
  createStudioInvitation,
  listStudioMembers,
  listStudioPermissions,
  listStudioRoles,
  removeStudioMember,
  updateStudioMember,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAccess, requireStudioAdminAccess } from "./access.server";
import type { Route } from "./+types/access-management";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Access Management · Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  if (!accessToken) {
    return {
      members: [] as StudioMemberDto[],
      roles: [] as StudioRoleDto[],
      permissions: [] as StudioPermissionDto[],
      isAdmin: false,
      currentUserId: user.id,
      membersError: "Your session expired. Please sign in again." as string | null,
      rolesError: null as string | null,
      permissionsError: null as string | null,
    };
  }

  const base = {
    members: [] as StudioMemberDto[],
    roles: [] as StudioRoleDto[],
    permissions: [] as StudioPermissionDto[],
    isAdmin: false,
    currentUserId: user.id,
    membersError: null as string | null,
    rolesError: null as string | null,
    permissionsError: null as string | null,
  };

  try {
    const access = await requireStudioAccess(accessToken, studioId, reqLog);
    base.isAdmin = access.canManageAccess;
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = error instanceof ApiError ? error.message : "Couldn't load members.";
    reqLog.error({ err: error, studioId }, "failed to load studio access management");
    return { ...base, membersError: message };
  }

  try {
    base.members = await listStudioMembers(accessToken, studioId, reqLog);
  } catch (error) {
    if (error instanceof Response) throw error;
    base.membersError = error instanceof ApiError ? error.message : "Couldn't load members.";
    reqLog.error({ err: error, studioId }, "failed to load studio members");
  }

  if (base.isAdmin) {
    try {
      base.roles = await listStudioRoles(accessToken, studioId, reqLog);
    } catch (error) {
      if (error instanceof Response) throw error;
      base.rolesError = error instanceof ApiError ? error.message : "Couldn't load roles.";
      reqLog.error({ err: error, studioId }, "failed to load studio roles");
    }

    try {
      base.permissions = await listStudioPermissions(accessToken, studioId, reqLog);
    } catch (error) {
      if (error instanceof Response) throw error;
      base.permissionsError = error instanceof ApiError ? error.message : "Couldn't load permissions.";
      reqLog.error({ err: error, studioId }, "failed to load studio permissions");
    }
  }

  return base;
}

export async function action({ request, params }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const studioId = params.studioId;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    await requireStudioAdminAccess(accessToken, studioId, reqLog);

    if (intent === "invite") {
      const email = String(formData.get("email") ?? "").trim();
      const role = Number(formData.get("role") ?? UserStudioRole.Member);
      if (!email) {
        return { error: "Enter an email to invite." };
      }
      await createStudioInvitation(accessToken, studioId, { email, role }, reqLog);
      return { ok: true, intent };
    }

    if (intent === "role") {
      const userId = String(formData.get("userId") ?? "");
      const role = Number(formData.get("role") ?? UserStudioRole.Member);
      if (userId) {
        const members = await listStudioMembers(accessToken, studioId, reqLog);
        const target = members.find((member) => member.userId === userId);
        if (target?.role === UserStudioRole.Owner) {
          return { error: "Owners cannot be changed from member management." };
        }
        await updateStudioMember(accessToken, studioId, userId, role, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "remove") {
      const userId = String(formData.get("userId") ?? "");
      if (userId) {
        const members = await listStudioMembers(accessToken, studioId, reqLog);
        const target = members.find((member) => member.userId === userId);
        if (target?.role === UserStudioRole.Owner) {
          return { error: "Owners cannot be removed from this Studio." };
        }
        await removeStudioMember(accessToken, studioId, userId, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent, studioId }, "team member action failed");
    return { error: message };
  }
}

export default function AccessManagement({ loaderData, actionData }: Route.ComponentProps) {
  const {
    members,
    roles,
    permissions,
    isAdmin,
    currentUserId,
    membersError,
    rolesError,
    permissionsError,
  } = loaderData;
  const navigation = useNavigation();
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok && actionData.intent === "invite") {
      setInviteOpen(false);
    }
  }, [actionData]);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          title="Members"
          subtitle="People in this team and their roles."
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className={primaryButtonClass()}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Invite member
              </button>
            ) : undefined
          }
        />

        {membersError && <ErrorBanner message={membersError} />}
        {actionData && "error" in actionData && actionData.error && (
          <ErrorBanner message={actionData.error} />
        )}

        {members.length === 0 ? (
          <EmptyState icon="group" title="No members to show" />
        ) : (
          <ul className="mt-6 space-y-3">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isAdmin={isAdmin}
                isSelf={member.userId === currentUserId}
                busy={navigation.state === "submitting"}
              />
            ))}
          </ul>
        )}

        <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite member">
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Send a pending email invitation. New users can accept after signing up and verifying email.
          </p>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="invite" />
            <div>
              <label htmlFor="email" className="block text-label-md text-on-surface-variant">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-label-md text-on-surface-variant">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={UserStudioRole.Member}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              >
                <option value={UserStudioRole.Member}>Member</option>
                <option value={UserStudioRole.Viewer}>Viewer</option>
                <option value={UserStudioRole.Admin}>Admin</option>
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
              <button
                type="submit"
                disabled={navigation.state === "submitting"}
                className={primaryButtonClass()}
              >
                {navigation.state === "submitting" ? "Inviting" : "Invite"}
              </button>
            </div>
          </Form>
        </Modal>
      </section>

      {isAdmin && (
        <>
          <section className="space-y-6">
            <SectionHeader
              title="Roles"
              subtitle="Fixed system roles enforced by the Studio backend."
            />
            {rolesError && <ErrorBanner message={rolesError} />}
            {roles.length === 0 ? (
              <EmptyState icon="admin_panel_settings" title="No roles to show" />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {roles.map((role) => (
                  <div key={role.role} className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                      </div>
                      <div>
                        <h2 className="text-body-lg font-bold text-on-surface">{role.label || studioRoleLabel(role.role)}</h2>
                        <p className="mt-1 text-body-sm text-on-surface-variant">{role.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {role.permissions.map((permission) => (
                            <span key={permission} className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <SectionHeader
              title="Permissions"
              subtitle="The backend-enforced permission matrix for fixed Studio roles."
            />
            {permissionsError && <ErrorBanner message={permissionsError} />}
            {permissions.length === 0 ? (
              <EmptyState icon="lock" title="No permissions to show" />
            ) : (
              <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
                <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(220px,2fr)_minmax(180px,1fr)] border-b border-outline-variant bg-surface-container-high px-4 py-3 text-label-md text-on-surface-variant">
                  <span>Permission</span>
                  <span>Description</span>
                  <span>Roles</span>
                </div>
                {permissions.map((permission) => (
                  <div
                    key={permission.key}
                    className="grid grid-cols-[minmax(180px,1.4fr)_minmax(220px,2fr)_minmax(180px,1fr)] gap-4 border-b border-outline-variant/50 px-4 py-4 last:border-b-0"
                  >
                    <span className="text-body-sm font-semibold text-on-surface">{permission.key}</span>
                    <span className="text-body-sm text-on-surface-variant">{permission.label}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {permission.roles.map((role) => (
                        <span key={role} className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                          {studioRoleLabel(role)}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isAdmin,
  isSelf,
  busy,
}: {
  member: StudioMemberDto;
  isAdmin: boolean;
  isSelf: boolean;
  busy: boolean;
}) {
  const roleFormRef = useRef<HTMLFormElement>(null);
  const isOwner = member.role === UserStudioRole.Owner;

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
        <div className="min-w-0">
          <p className="truncate text-body-md text-on-surface">
            {member.displayName}
            {isSelf && <span className="ml-1 text-on-surface-variant">(you)</span>}
          </p>
          <p className="truncate text-label-md text-on-surface-variant">{member.email}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isAdmin ? (
          <>
            {isOwner ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-sm font-semibold uppercase tracking-wide text-primary">
                Owner
              </span>
            ) : (
              <Form method="post" ref={roleFormRef}>
                <input type="hidden" name="intent" value="role" />
                <input type="hidden" name="userId" value={member.userId} />
                <select
                  name="role"
                  defaultValue={member.role}
                  disabled={busy}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1.5 text-label-md text-on-surface focus:border-primary focus:outline-none"
                  aria-label={`Role for ${member.displayName}`}
                >
                  <option value={UserStudioRole.Member}>Member</option>
                  <option value={UserStudioRole.Viewer}>Viewer</option>
                  <option value={UserStudioRole.Admin}>Admin</option>
                </select>
              </Form>
            )}
            {isOwner ? (
              <span
                title="Owners cannot be removed"
                aria-label="Owners cannot be removed"
                className="rounded-lg p-1.5 text-on-surface-variant/60"
              >
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </span>
            ) : (
              <ConfirmSubmitButton
                fields={{ intent: "remove", userId: member.userId }}
                title="Remove member?"
                message={
                  <>
                    Remove <span className="font-medium text-on-surface">{member.displayName}</span> from this Studio?
                  </>
                }
                confirmLabel="Remove member"
                disabled={busy}
                ariaLabel={`Remove ${member.displayName}`}
                buttonClassName="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">person_remove</span>
              </ConfirmSubmitButton>
            )}
          </>
        ) : (
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm uppercase tracking-wide text-on-surface-variant">
            {studioRoleLabel(member.role)}
          </span>
        )}
      </div>
    </li>
  );
}
