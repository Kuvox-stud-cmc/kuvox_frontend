import type { Route } from "./+types/shared";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Shared with me · Kuvox" }];
}

export default function Shared() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Shared with me</h1>
      <p className="mt-2 text-gray-600">Projects others shared with you (stub).</p>
    </section>
  );
}
