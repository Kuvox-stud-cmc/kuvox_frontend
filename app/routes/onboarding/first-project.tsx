import { Form, Link, redirect, useNavigation } from "react-router";

import { apiFetch } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/first-project";

export function meta(_: Route.MetaArgs) {
  return [{ title: "First project setup · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { error: "Give your project a name to continue." };
  }

  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  try {
    // Owner is derived from the JWT by the API; the body carries kind/name/description only.
    const response = await apiFetch(accessToken, "/api/projects", {
      method: "POST",
      body: JSON.stringify({
        kind: 0, // ProjectKind.Video
        name,
        description: description || null,
      }),
    });

    if (response.ok) {
      let projectId: string | undefined;
      try {
        const body = (await response.json()) as { id?: string };
        projectId = body?.id;
      } catch {
        // No JSON body — fall back to the dashboard below.
      }
      return redirect(projectId ? `/editor/${projectId}` : "/dashboard");
    }

    return {
      error:
        "Project creation is coming soon — you can finish setup and create projects later.",
    };
  } catch {
    return {
      error:
        "Project creation is coming soon — you can finish setup and create projects later.",
    };
  }
}

export default function FirstProject({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">
        Create your first project
      </h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Projects keep your footage, edits, and exports together. Name it
        anything — you can change it later.
      </p>

      {actionData?.error && (
        <div className="mt-4 rounded-lg bg-error-container px-4 py-3 text-on-error-container">
          <p className="text-body-sm">{actionData.error}</p>
          <Link
            to="/dashboard"
            className="mt-2 inline-flex items-center gap-1 text-label-md font-medium underline-offset-2 hover:underline"
          >
            Go to dashboard
            <span className="material-symbols-outlined text-[18px]">
              arrow_forward
            </span>
          </Link>
        </div>
      )}

      <Form method="post" className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-label-md text-on-surface-variant"
          >
            Project name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="My first edit"
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-label-md text-on-surface-variant"
          >
            Description <span className="text-on-surface-variant">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="What's this project about?"
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <Link
            to="/onboarding/import-media"
            className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            Back
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-5 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
          >
            {isSubmitting ? "Creating…" : "Create project"}
          </button>
        </div>
      </Form>
    </section>
  );
}
