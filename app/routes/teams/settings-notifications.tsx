import { Form, useNavigation } from "react-router";

import { FormActions, PageHeader } from "~/components/dashboard/layout/DashboardPageLayout";
import { ErrorBanner } from "~/components/dashboard/section";
import type { StudioNotificationSettingsDto } from "~/lib/api";
import {
  ApiError,
  getNotificationSettings,
  updateNotificationSettings,
} from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/settings-notifications";

function legacyMeta() {
  return [{ title: "Studio notification settings · Kuvox" }];
}

function LegacyTeamNotificationSettings() {
  return null;
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio notification settings - Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return {
      settings: null as StudioNotificationSettingsDto | null,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const settings = await getNotificationSettings(accessToken, params.studioId, reqLog);
    return { settings, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load notification settings.";
    reqLog.error({ err: error, studioId: params.studioId }, "failed to load studio notification settings");
    return { settings: null as StudioNotificationSettingsDto | null, error: message };
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
  const settings: StudioNotificationSettingsDto = {
    notifyOnInvites: formData.has("notifyOnInvites"),
    notifyOnMembers: formData.has("notifyOnMembers"),
    notifyOnProjects: formData.has("notifyOnProjects"),
    notifyOnMedia: formData.has("notifyOnMedia"),
  };

  try {
    await updateNotificationSettings(accessToken, params.studioId, settings, reqLog);
    return { ok: true };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    reqLog.error({ err: error, studioId: params.studioId }, "studio notification settings action failed");
    return { error: message };
  }
}

export default function TeamNotificationSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings, error } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Studio-level defaults for access and content events."
      />
      {error && <ErrorBanner message={error} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}
      {actionData?.ok && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-sm text-primary">
          Notification settings saved.
        </div>
      )}
      {settings && (
        <Form method="post" className="max-w-3xl rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <div className="space-y-4">
            <Toggle name="notifyOnInvites" label="Invitation events" defaultChecked={settings.notifyOnInvites} />
            <Toggle name="notifyOnMembers" label="Member events" defaultChecked={settings.notifyOnMembers} />
            <Toggle name="notifyOnProjects" label="Project events" defaultChecked={settings.notifyOnProjects} />
            <Toggle name="notifyOnMedia" label="Media events" defaultChecked={settings.notifyOnMedia} />
          </div>
          <div className="mt-6">
            <FormActions
              onCancel={() => undefined}
              cancelLabel="Reset"
              submitLabel={isSubmitting ? "Saving..." : "Save settings"}
              disabled={isSubmitting}
              isSubmitting={isSubmitting}
            />
          </div>
        </Form>
      )}
    </section>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: keyof StudioNotificationSettingsDto;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-outline-variant/50 pb-4 last:border-b-0 last:pb-0">
      <span className="text-body-sm text-on-surface">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 accent-primary"
      />
    </label>
  );
}
