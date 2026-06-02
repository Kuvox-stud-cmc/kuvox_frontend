import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Enterprise · Kuvox" }];
}

export default function Enterprise() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Enterprise</h1>
      <p className="mt-2 text-gray-600">Kuvox for teams and organizations (stub).</p>
    </section>
  );
}
