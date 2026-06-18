import { requireUser } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";

import type { Route } from "./+types/notifications";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notifications · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  await requireUser(request, log);
  return null;
}

export default function Notifications() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <p className="mt-2 text-gray-600">Your recent notifications (stub).</p>
    </section>
  );
}
