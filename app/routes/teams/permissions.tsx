import { EmptyState, ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import { studioRoleLabel, type StudioPermissionDto } from "~/lib/api";
import { ApiError, listStudioPermissions } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAdminAccess } from "./access.server";
import type { Route } from "./+types/permissions";

function legacyMeta() {
  return [{ title: "Studio permissions · Kuvox" }];
}

function LegacyTeamPermissions() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio permissions - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      permissions: [] as StudioPermissionDto[],
      error: "Your session expired. Please sign in again.",
    };
  }

  try {
    await requireStudioAdminAccess(accessToken, params.studioId, reqLog);
    const permissions = await listStudioPermissions(accessToken, params.studioId, reqLog);
    return { permissions, error: null as string | null };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = error instanceof ApiError ? error.message : "Couldn't load permissions.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio permissions");
    return { permissions: [] as StudioPermissionDto[], error: message };
  }
}

export default function TeamPermissions({ loaderData }: Route.ComponentProps) {
  const { permissions, error } = loaderData;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Permissions"
        subtitle="The backend-enforced permission matrix for fixed Studio roles."
      />
      {error && <ErrorBanner message={error} />}
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
  );
}
