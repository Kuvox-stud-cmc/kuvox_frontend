import { actionErrorMessage } from "~/lib/action-error.server";
import { Form, redirect, useNavigation } from "react-router";

import {
  FormActions,
  MetricCard,
  PageHeader,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { ConfirmSubmitButton, ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import {
  isStudioAdmin,
  studioRoleLabel,
  UserStudioRole,
  type StudioDto,
  type StudioWorkspaceSettingsDto,
} from "~/lib/api";
import {
  ApiError,
  deleteStudio,
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAdminAccess } from "./access.server";
import type { Route } from "./+types/settings-workspace";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio workspace settings Â· Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      studio: null as StudioDto | null,
      settings: null as StudioWorkspaceSettingsDto | null,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const access = await requireStudioAdminAccess(accessToken, params.studioId, reqLog);
    const settings = await getWorkspaceSettings(accessToken, params.studioId, reqLog);
    return { studio: access.studio, settings, error: null as string | null };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = error instanceof ApiError ? error.message : "Couldn't load Studio settings.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load Studio settings");
    return { studio: null as StudioDto | null, settings: null as StudioWorkspaceSettingsDto | null, error: message };
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
    await requireStudioAdminAccess(accessToken, studioId, reqLog);

    if (intent === "save") {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) {
        return { error: "Enter a Studio name." };
      }
      await updateWorkspaceSettings(
        accessToken,
        studioId,
        {
          name,
          description: String(formData.get("description") ?? "").trim() || null,
          avatarUrl: String(formData.get("avatarUrl") ?? "").trim() || null,
          publicSlug: String(formData.get("publicSlug") ?? "").trim() || null,
        },
        reqLog,
      );
      return { ok: true, intent };
    }

    if (intent === "delete") {
      await deleteStudio(accessToken, studioId, reqLog);
      throw redirect("/dashboard");
    }

    return { error: "Unknown action." };
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = actionErrorMessage(error);
    reqLog.error({ err: error, intent, studioId }, "Studio settings action failed");
    return { error: message };
  }
}

export default function TeamWorkspaceSettings({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { studio, settings, error } = loaderData;
  const isSubmitting = navigation.state === "submitting";
  const isAdmin = studio ? isStudioAdmin(studio.role) : false;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        subtitle="Manage this Studio workspace. Renaming and deleting use the live Studio API."
      />

      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}
      {actionData?.ok && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-sm text-primary">
          Studio settings saved.
        </div>
      )}

      {studio && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard icon="groups" label="Workspace" value={settings?.name ?? studio.name} />
            <MetricCard icon="admin_panel_settings" label="Your Role" value={studioRoleLabel(studio.role)} tone="secondary" />
            <MetricCard icon="cloud_done" label="API Status" value="Live" tone="tertiary" />
          </div>

          {!isAdmin && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
              Only Studio Admins can rename or delete this workspace.
            </div>
          )}

          <div className="max-w-3xl rounded-2xl border border-outline-variant bg-surface-container-low p-6">
            <h2 className="text-headline-md font-bold text-on-surface">General</h2>
            <Form method="post" className="mt-4 space-y-4">
              <input type="hidden" name="intent" value="save" />
              <div>
                <label htmlFor="studio-name" className="block text-label-md text-on-surface-variant">
                  Studio name
                </label>
                <input
                  id="studio-name"
                  name="name"
                  type="text"
                  defaultValue={settings?.name ?? studio.name}
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
                  defaultValue={settings?.description ?? ""}
                  disabled={!isAdmin || isSubmitting}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="studio-avatar" className="block text-label-md text-on-surface-variant">
                  Avatar URL
                </label>
                <input
                  id="studio-avatar"
                  name="avatarUrl"
                  type="url"
                  defaultValue={settings?.avatarUrl ?? ""}
                  disabled={!isAdmin || isSubmitting}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="studio-slug" className="block text-label-md text-on-surface-variant">
                  Public slug
                </label>
                <input
                  id="studio-slug"
                  name="publicSlug"
                  type="text"
                  defaultValue={settings?.publicSlug ?? ""}
                  disabled={!isAdmin || isSubmitting}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60"
                />
              </div>
              <FormActions
                onCancel={() => undefined}
                cancelLabel="Reset"
                submitLabel={isSubmitting ? "Saving..." : "Save changes"}
                disabled={!isAdmin || isSubmitting}
                isSubmitting={isSubmitting}
              />
            </Form>
          </div>

          <div className="max-w-3xl rounded-2xl border border-error/40 bg-surface-container-low p-6">
            <h2 className="text-headline-md font-bold text-error">Danger Zone</h2>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Deleting a Studio removes the workspace and publishes cleanup events for associated data.
            </p>
            <div className="mt-4">
              <ConfirmSubmitButton
                fields={{ intent: "delete" }}
                title="Delete Studio?"
                message={
                  <>
                    Delete <span className="font-medium text-on-surface">{studio.name}</span>? This removes the workspace and cannot be undone.
                  </>
                }
                confirmLabel="Delete Studio"
                label="Delete Studio"
                icon="delete_forever"
                disabled={!isAdmin || isSubmitting || studio.role === UserStudioRole.Member || studio.role === UserStudioRole.Viewer}
                buttonClassName={primaryButtonClass("!bg-error !text-on-error hover:!bg-error/90 disabled:opacity-50")}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
