import { Form, useNavigation } from "react-router";

import { FormActions, PageHeader } from "~/components/dashboard/layout/DashboardPageLayout";
import { ErrorBanner } from "~/components/dashboard/section";
import { isStudioAdmin, UserStudioRole, type StudioWorkspaceSettingsDto } from "~/lib/api";
import {
  ApiError,
  getWorkspaceSettings,
  listMyStudios,
  updateWorkspaceSettings,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/settings-profile";

function legacyMeta() {
  return [{ title: "Studio profile settings · Kuvox" }];
}

function LegacyTeamProfileSettings() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio profile settings - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      settings: null as StudioWorkspaceSettingsDto | null,
      isAdmin: false,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const [settings, studios] = await Promise.all([
      getWorkspaceSettings(accessToken, params.studioId, reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    const role = studios.find((studio) => studio.id === params.studioId)?.role ?? UserStudioRole.Member;
    return { settings, isAdmin: isStudioAdmin(role), error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load profile settings.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio profile settings");
    return { settings: null as StudioWorkspaceSettingsDto | null, isAdmin: false, error: message };
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Studio name is required." };

  try {
    await updateWorkspaceSettings(
      accessToken,
      params.studioId,
      {
        name,
        description: String(formData.get("description") ?? "").trim() || null,
        avatarUrl: String(formData.get("avatarUrl") ?? "").trim() || null,
        publicSlug: String(formData.get("publicSlug") ?? "").trim() || null,
      },
      reqLog,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, studioId: params.studioId }, "studio profile settings action failed");
    return { error: message };
  }
}

export default function TeamProfileSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings, isAdmin, error } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Profile Settings"
        subtitle="Manage public-facing Studio profile details backed by the Studio API."
      />
      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}
      {actionData?.ok && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-sm text-primary">
          Profile settings saved.
        </div>
      )}
      {settings && (
        <div className="max-w-3xl rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <Form method="post" className="space-y-4">
            <div>
              <label htmlFor="studio-name" className="block text-label-md text-on-surface-variant">
                Studio name
              </label>
              <input
                id="studio-name"
                name="name"
                defaultValue={settings.name}
                disabled={!isAdmin || isSubmitting}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="studio-description" className="block text-label-md text-on-surface-variant">
                Description
              </label>
              <textarea
                id="studio-description"
                name="description"
                defaultValue={settings.description ?? ""}
                rows={4}
                disabled={!isAdmin || isSubmitting}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="avatar-url" className="block text-label-md text-on-surface-variant">
                Avatar URL
              </label>
              <input
                id="avatar-url"
                name="avatarUrl"
                type="url"
                defaultValue={settings.avatarUrl ?? ""}
                disabled={!isAdmin || isSubmitting}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="public-slug" className="block text-label-md text-on-surface-variant">
                Public slug
              </label>
              <input
                id="public-slug"
                name="publicSlug"
                defaultValue={settings.publicSlug ?? ""}
                disabled={!isAdmin || isSubmitting}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </div>
            <FormActions
              onCancel={() => undefined}
              cancelLabel="Reset"
              submitLabel={isSubmitting ? "Saving..." : "Save profile"}
              disabled={!isAdmin || isSubmitting}
              isSubmitting={isSubmitting}
            />
          </Form>
        </div>
      )}
    </section>
  );
}
