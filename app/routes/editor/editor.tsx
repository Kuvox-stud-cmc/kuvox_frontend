import { useState } from "react";
import { Provider } from "react-redux";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { EditorWorkspace } from "~/components/editor/editor-workspace";
import { requireUser } from "~/lib/auth.server";
import { makeStore } from "~/store";

import type { Route } from "./+types/editor";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Editor · Kuvox" }];
}

/**
 * Thin server `loader` — runs the SSR-safe auth guard before hydration (redirects to
 * `/login` when unauthenticated) and returns the minimal data the client loader needs.
 * It deliberately does NOT render the editor: `HydrateFallback` + `clientLoader.hydrate`
 * keep the heavy editor tree and Redux store client-only.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  return { projectId: params.projectId };
}

/**
 * Client-only data loading. `hydrate = true` makes React Router render the
 * `HydrateFallback` on the server/initial load and only mount the component (and the
 * Redux store) in the browser, after this runs.
 */
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const { projectId } = await serverLoader();
  // TODO: fetch project + timeline from the API here (client-side).
  return { projectId };
}
clientLoader.hydrate = true as const;

/** Server-rendered (and initial-hydration) fallback for this client-only route. */
export function HydrateFallback() {
  return <EditorSkeleton />;
}

export default function EditorRoute({ loaderData }: Route.ComponentProps) {
  // Lazily create the store once per mount — this only ever runs on the client.
  const [store] = useState(() => makeStore());

  return (
    <Provider store={store}>
      <EditorWorkspace projectId={loaderData.projectId} />
    </Provider>
  );
}
