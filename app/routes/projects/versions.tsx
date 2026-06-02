import type { Route } from "./+types/versions";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Version history · Kuvox" }];
}

export default function Versions() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Version history</h1>
      <p className="mt-2 text-gray-600">Timeline revisions for this project (stub).</p>
    </section>
  );
}
