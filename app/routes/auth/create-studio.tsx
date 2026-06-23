import { redirect } from "react-router";

import { createStudio } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/create-studio";

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { error: "Not authenticated" };
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  
  if (!name) {
    return { error: "Team name is required." };
  }

  try {
    // 1. Create the studio using the current token (Task 1)
    const studio = await createStudio(accessToken, name);
    
    // Return success to close the modal (Task 2 - redirect - will be implemented next)
    return { success: true, studio };
  } catch (error: any) {
    return { error: error.message || "Failed to create team." };
  }
}
