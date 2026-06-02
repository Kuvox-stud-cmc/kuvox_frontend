import { useState } from "react";
import { Provider } from "react-redux";

import { EditorSkeleton } from "~/components/editor/editor-skeleton";
import { EditorWorkspace } from "~/components/editor/editor-workspace";
import { makeStore } from "~/store";

import type { Route } from "./+types/editor";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Editor · Kuvox" }];
}

/**
 * `clientLoader` with NO server `loader` makes this route client-only: React
 * Router renders the `HydrateFallback` on the server and runs this loader (and
 * mounts the component below) only in the browser. The heavy editor tree and the
 * Redux store therefore never render on the server.
 */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // TODO: fetch project + timeline from the API here (client-side).
  return { projectId: params.projectId };
}

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
