import { StudioSettingsIndexPage } from "~/components/dashboard/workspace/studio-mock-pages";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import { requireStudioAdminAccess } from "./access.server";
import type { Route } from "./+types/settings-index";

export function meta() {
  return [{ title: "Studio settings · Kuvox" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." as string | null };
  }

  await requireStudioAdminAccess(accessToken, params.studioId, reqLog);
  return { error: null as string | null };
}

export default function TeamSettingsIndex() {
  return <StudioSettingsIndexPage />;
}
