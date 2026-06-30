import { Form, useNavigation } from "react-router";

import { StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import {
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import {
  isStudioAdmin,
  studioRoleLabel,
  UserStudioRole,
  type StudioInvitationDto,
} from "~/lib/api";
import {
  ApiError,
  createStudioInvitation,
  listMyStudios,
  listStudioInvitations,
  resendStudioInvitation,
  revokeStudioInvitation,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/invitations";

function legacyMeta() {
  return [{ title: "Studio invitations · Kuvox" }];
}

function LegacyTeamInvitations() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio invitations - Kuvox" }];
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
      invitations: [] as StudioInvitationDto[],
      isAdmin: false,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const studios = await listMyStudios(accessToken, reqLog);
    const role = studios.find((studio) => studio.id === studioId)?.role ?? UserStudioRole.Member;
    const invitations = isStudioAdmin(role)
      ? await listStudioInvitations(accessToken, studioId, reqLog)
      : [];
    return { invitations, isAdmin: isStudioAdmin(role), error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load invitations.";
    reqLog.error({ err: error, studioId }, "failed to load studio invitations");
    return { invitations: [] as StudioInvitationDto[], isAdmin: false, error: message };
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

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const studioId = params.studioId;

  try {
    if (intent === "create") {
      const email = String(formData.get("email") ?? "").trim();
      const role = Number(formData.get("role") ?? UserStudioRole.Member);
      if (!email) return { error: "Enter an email address." };
      await createStudioInvitation(accessToken, studioId, { email, role }, reqLog);
      return { ok: true, intent };
    }

    const invitationId = String(formData.get("invitationId") ?? "");
    if (!invitationId) return { error: "Missing invitation id." };

    if (intent === "resend") {
      await resendStudioInvitation(accessToken, studioId, invitationId, reqLog);
      return { ok: true, intent };
    }

    if (intent === "revoke") {
      await revokeStudioInvitation(accessToken, studioId, invitationId, reqLog);
      return { ok: true, intent };
    }

    return { error: "Unknown action." };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, intent, studioId }, "studio invitation action failed");
    return { error: message };
  }
}

export default function TeamInvitations({ loaderData, actionData }: Route.ComponentProps) {
  const { invitations, isAdmin, error } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Invitations"
        subtitle="Pending and historical email invitations for this Studio."
      />

      {!isAdmin && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
          Only Studio Owners and Admins can manage invitations.
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}
      {actionData?.ok && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-sm text-primary">
          Invitation updated.
        </div>
      )}

      {isAdmin && (
        <Form method="post" className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 md:grid-cols-[1fr_180px_auto]">
          <input type="hidden" name="intent" value="create" />
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@example.com"
            className="rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
          <select
            name="role"
            defaultValue={UserStudioRole.Member}
            className="rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          >
            <option value={UserStudioRole.Member}>Member</option>
            <option value={UserStudioRole.Viewer}>Viewer</option>
            <option value={UserStudioRole.Admin}>Admin</option>
          </select>
          <button type="submit" disabled={busy} className={primaryButtonClass()}>
            <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
            Invite
          </button>
        </Form>
      )}

      {invitations.length === 0 ? (
        <EmptyState icon="mail" title="No invitations" hint="New invitations will appear here." />
      ) : (
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              isAdmin={isAdmin}
              busy={busy}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InvitationRow({
  invitation,
  isAdmin,
  busy,
}: {
  invitation: StudioInvitationDto;
  isAdmin: boolean;
  busy: boolean;
}) {
  const status = invitation.status;
  const pending = status.toLowerCase() === "pending";

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-body-md font-bold text-on-surface">{invitation.email}</h2>
            <StatusBadge label={status} tone={pending ? "warning" : "neutral"} />
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Invited as {studioRoleLabel(invitation.role)}. Expires {formatDate(invitation.expiresAt)}.
          </p>
        </div>
        {isAdmin && pending && (
          <div className="flex shrink-0 gap-2">
            <Form method="post">
              <input type="hidden" name="intent" value="resend" />
              <input type="hidden" name="invitationId" value={invitation.id} />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                Resend
              </button>
            </Form>
            <ConfirmSubmitButton
              fields={{ intent: "revoke", invitationId: invitation.id }}
              title="Revoke invitation?"
              message={
                <>
                  Revoke the invitation for{" "}
                  <span className="font-medium text-on-surface">{invitation.email}</span>?
                </>
              }
              confirmLabel="Revoke invitation"
              label="Revoke"
              disabled={busy}
              buttonClassName="rounded-lg px-3 py-2 text-label-md text-error transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
