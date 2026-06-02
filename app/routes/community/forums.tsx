import type { Route } from "./+types/forums";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Discussion forums · Kuvox" }];
}

export default function Forums() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Discussion forums</h1>
      <p className="mt-2 text-gray-600">Browse and start discussions (stub).</p>
    </section>
  );
}
