import type { Route } from "./+types/getting-started";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Getting started · Kuvox" }];
}

export default function GettingStarted() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Getting started</h1>
      <p className="mt-2 text-gray-600">Set up your first project (stub).</p>
    </section>
  );
}
