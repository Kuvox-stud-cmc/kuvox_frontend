import type { Route } from "./+types/followers";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Followers · Kuvox" }];
}

export default function Followers() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Followers</h1>
      <p className="mt-2 text-gray-600">People following this user (stub).</p>
    </section>
  );
}
