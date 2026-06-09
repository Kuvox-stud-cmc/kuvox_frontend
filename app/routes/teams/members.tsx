import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import {
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
  addStudioMember,
  ApiError,
  listMyStudios,
  listStudioMembers,
  removeStudioMember,
  updateStudioMember,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/members";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team members · Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
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

  const studios = await listMyStudios(accessToken);
  const role = studios.find((s) => s.id === studioId)?.role ?? UserStudioRole.User;

  try {
    const members = await listStudioMembers(accessToken, studioId);
    return { members, isAdmin: isStudioAdmin(role), currentUserId: user.id, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load members.";
    return {
      members: [] as StudioMemberDto[],
      isAdmin: isStudioAdmin(role),
      currentUserId: user.id,
      error: message,
    };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
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
      const role = Number(formData.get("role") ?? UserStudioRole.User);
      if (!email) {
        return { error: "Enter an email to invite." };
      }
      await addStudioMember(accessToken, studioId, { email, role });
      return { ok: true, intent };
    }

    if (intent === "role") {
      const userId = String(formData.get("userId") ?? "");
      const role = Number(formData.get("role") ?? UserStudioRole.User);
      if (userId) {
        await updateStudioMember(accessToken, studioId, userId, role);
      }
      return { ok: true, intent };
    }

    if (intent === "remove") {
      const userId = String(formData.get("userId") ?? "");
      if (userId) {
        await removeStudioMember(accessToken, studioId, userId);
      }
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
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
          The person must already have a Kuvox account; invite them by email.
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
              defaultValue={UserStudioRole.User}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value={UserStudioRole.User}>Member</option>
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
                <option value={UserStudioRole.User}>Member</option>
                <option value={UserStudioRole.Admin}>Admin</option>
              </select>
            </Form>
            <Form method="post">
              <input type="hidden" name="intent" value="remove" />
              <input type="hidden" name="userId" value={member.userId} />
              <button
                type="submit"
                disabled={busy}
                aria-label={`Remove ${member.displayName}`}
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">person_remove</span>
              </button>
            </Form>
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
