import type { Route } from "./+types/share";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Share & collaborate · Kuvox" }];
}

export default function Share() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Share & collaborate</h1>
      <p className="mt-2 text-gray-600">Manage sharing for this project (stub).</p>
    </section>
  );
}
