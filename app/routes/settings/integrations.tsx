import type { Route } from "./+types/integrations";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Integrations · Kuvox" }];
}

export default function Integrations() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <p className="mt-2 text-gray-600">Connect external services (stub).</p>
    </section>
  );
}
