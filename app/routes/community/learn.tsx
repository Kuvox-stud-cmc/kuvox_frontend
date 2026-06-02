import type { Route } from "./+types/learn";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Learning & tutorials · Kuvox" }];
}

export default function Learn() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Learning & tutorials</h1>
      <p className="mt-2 text-gray-600">Tutorials and learning resources (stub).</p>
    </section>
  );
}
