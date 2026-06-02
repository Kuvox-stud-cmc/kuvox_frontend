import type { Route } from "./+types/trash";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Trash · Kuvox" }];
}

export default function Trash() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Trash</h1>
      <p className="mt-2 text-gray-600">Recently deleted items (stub).</p>
    </section>
  );
}
