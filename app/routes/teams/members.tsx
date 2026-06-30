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
  isStudioAdmin,
  studioRoleLabel,
  UserStudioRole,
  type StudioMemberDto,
} from "~/lib/api";
import {
  ApiError,
  createStudioInvitation,
  listMyStudios,
  listStudioMembers,
  removeStudioMember,
  updateStudioMember,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/members";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team members · Kuvox" }];
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
      isAdmin: false,
      currentUserId: user.id,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  const studios = await listMyStudios(accessToken, reqLog);
  const role = studios.find((s) => s.id === studioId)?.role ?? UserStudioRole.Member;

  try {
    const members = await listStudioMembers(accessToken, studioId, reqLog);
    return { members, isAdmin: isStudioAdmin(role), currentUserId: user.id, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load members.";
    reqLog.error({ err: error, studioId }, "failed to load studio members");
    return {
      members: [] as StudioMemberDto[],
      isAdmin: isStudioAdmin(role),
      currentUserId: user.id,
      error: message,
    };
  }
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
        await updateStudioMember(accessToken, studioId, userId, role, reqLog);
      }
      return { ok: true, intent };
    }

    if (intent === "remove") {
      const userId = String(formData.get("userId") ?? "");
      if (userId) {
        await removeStudioMember(accessToken, studioId, userId, reqLog);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent, studioId }, "team member action failed");
    return { error: message };
  }
}

export default function TeamMembers({ loaderData, actionData }: Route.ComponentProps) {
  const { members, isAdmin, currentUserId, error } = loaderData;
  const navigation = useNavigation();
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok && actionData.intent === "invite") {
      setInviteOpen(false);
    }
  }, [actionData]);

  return (
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

      {!isAdmin && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">lock</span>
          Only team Admins can invite, change roles, or remove members.
        </p>
      )}

      {error && <ErrorBanner message={error} />}
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
              {navigation.state === "submitting" ? "Inviting…" : "Invite"}
            </button>
          </div>
        </Form>
      </Modal>
    </section>
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
  const ownerSelf = isOwner && isSelf;

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
            {ownerSelf ? (
              <span
                title="Owners cannot remove their own account"
                aria-label="Owners cannot remove their own account"
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
