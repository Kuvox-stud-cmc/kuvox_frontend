import { EmptyState, ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import { studioRoleLabel, type StudioRoleDto } from "~/lib/api";
import { ApiError, listStudioRoles } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/roles";

function legacyMeta() {
  return [{ title: "Studio roles · Kuvox" }];
}

function LegacyTeamRoles() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio roles - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { roles: [] as StudioRoleDto[], error: "Your session expired. Please sign in again." };
  }

  try {
    const roles = await listStudioRoles(accessToken, params.studioId, reqLog);
    return { roles, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load roles.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio roles");
    return { roles: [] as StudioRoleDto[], error: message };
  }
}

export default function TeamRoles({ loaderData }: Route.ComponentProps) {
  const { roles, error } = loaderData;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Roles"
        subtitle="Fixed system roles enforced by the Studio backend."
      />
      {error && <ErrorBanner message={error} />}
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
  );
}
