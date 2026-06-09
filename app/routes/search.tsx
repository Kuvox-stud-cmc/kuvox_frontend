import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/search";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Search results · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export default function Search() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Search results</h1>
      <p className="mt-2 text-gray-600">Search across Kuvox (stub).</p>
    </section>
  );
}
