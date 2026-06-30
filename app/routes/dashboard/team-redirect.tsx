import { redirect } from "react-router";

import { listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/team-redirect";

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    throw redirect("/dashboard");
  }

  try {
    const studios = await listMyStudios(accessToken, reqLog);
    const firstStudio = studios[0];
    throw redirect(firstStudio ? `/teams/${firstStudio.id}/members` : "/dashboard");
  } catch (error) {
    if (error instanceof Response) throw error;
    reqLog.warn({ err: error }, "failed to resolve dashboard team redirect");
    throw redirect("/dashboard");
  }
}

export default function DashboardTeamRedirect() {
  return null;
}
