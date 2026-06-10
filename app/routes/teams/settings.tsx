import { ErrorBanner, SectionHeader } from "~/components/dashboard/section";
import { isStudioAdmin, studioRoleLabel, UserStudioRole } from "~/lib/api";
import { listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/settings";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team settings · Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const studioId = params.studioId;

  if (!accessToken) {
    return { name: "", role: UserStudioRole.User, error: "Your session expired. Please sign in again." };
  }

  const studios = await listMyStudios(accessToken);
  const studio = studios.find((s) => s.id === studioId);
  return {
    name: studio?.name ?? "",
    role: studio?.role ?? UserStudioRole.User,
    error: null as string | null,
  };
}

export default function TeamSettings({ loaderData }: Route.ComponentProps) {
  const { name, role, error } = loaderData;
  const admin = isStudioAdmin(role);

  return (
    <section className="max-w-2xl">
      <SectionHeader title="Settings" subtitle="Manage this team." />

      {error && <ErrorBanner message={error} />}

      {!admin && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">lock</span>
          You are a {studioRoleLabel(role)} — team settings are read-only.
        </p>
      )}

      {/* General */}
      <div className="mt-6 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <h2 className="text-headline-md text-on-surface">General</h2>
        <label htmlFor="team-name" className="mt-4 block text-label-md text-on-surface-variant">
          Team name
        </label>
        <input
          id="team-name"
          type="text"
          value={name}
          readOnly
          disabled
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface disabled:opacity-70"
        />
        <p className="mt-2 text-label-md text-on-surface-variant">
          Renaming teams isn't available yet.
        </p>
      </div>

      {/* Billing placeholder */}
      <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <h2 className="text-headline-md text-on-surface">Plan &amp; billing</h2>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          This team is on the <span className="text-on-surface">Free</span> plan. Billing for
          teams is coming soon.
        </p>
        <button
          type="button"
          disabled
          className="mt-3 rounded-lg bg-surface-container-high px-4 py-2 text-label-md text-on-surface-variant opacity-60"
        >
          Manage billing
        </button>
      </div>

      {/* Danger zone (Admin-only) */}
      {admin && (
        <div className="mt-4 rounded-xl border border-error/40 bg-surface-container-low p-5">
          <h2 className="text-headline-md text-error">Danger zone</h2>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Deleting a team removes it for everyone. This isn't available yet.
          </p>
          <button
            type="button"
            disabled
            className="mt-3 rounded-lg border border-error/50 px-4 py-2 text-label-md text-error opacity-60"
          >
            Delete team
          </button>
        </div>
      )}
    </section>
  );
}
