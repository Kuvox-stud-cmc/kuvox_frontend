import type { Route } from "./+types/preferences";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Preferences · Kuvox" }];
}

export default function Preferences() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Preferences</h1>
      <p className="mt-2 text-gray-600">App preferences (stub).</p>
    </section>
  );
}
