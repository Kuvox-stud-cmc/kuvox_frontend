import type { Route } from "./+types/showcase";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Showcase & inspiration · Kuvox" }];
}

export default function Showcase() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Showcase & inspiration</h1>
      <p className="mt-2 text-gray-600">Projects shared by the community (stub).</p>
    </section>
  );
}
