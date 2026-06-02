import type { Route } from "./+types/following";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Following · Kuvox" }];
}

export default function Following() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Following</h1>
      <p className="mt-2 text-gray-600">People this user follows (stub).</p>
    </section>
  );
}
