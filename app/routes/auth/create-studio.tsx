import { redirect } from "react-router";

import { createStudio, refreshRequest } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/create-studio";

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  if (!accessToken || !refreshToken) {
    return { error: "Not authenticated" };
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  
  if (!name) {
    return { error: "Team name is required." };
  }

  try {
    // 1. Create the studio using the current token
    const studio = await createStudio(accessToken, name);
    
    // 2. Token Staleness Caveat (Task 2)
    // The current access token doesn't have the new studio's claim.
    // We must refresh the token before redirecting so the user can access the new team.
    try {
      const newTokens = await refreshRequest(refreshToken);
      session.set("accessToken", newTokens.accessToken);
      session.set("refreshToken", newTokens.refreshToken);
      session.set("expiresAt", newTokens.expiresAt);
    } catch (refreshErr) {
      console.error("Token refresh failed after studio creation", refreshErr);
      // Even if refresh fails, we still redirect. They might get a 401 and be forced to login.
    }

    return redirect(`/teams/${studio.id}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (error: any) {
    return { error: error.message || "Failed to create team." };
  }
}
