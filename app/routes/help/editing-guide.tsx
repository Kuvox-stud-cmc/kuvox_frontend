import type { Route } from "./+types/editing-guide";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Editing guide · Kuvox" }];
}

export default function EditingGuide() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Editing guide</h1>
      <p className="mt-2 text-gray-600">Timeline editing operations explained (stub).</p>
    </section>
  );
}
