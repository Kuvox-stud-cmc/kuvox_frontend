import type { Route } from "./+types/privacy";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Privacy policy · Kuvox" }];
}

export default function Privacy() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Privacy policy</h1>
      <p className="mt-2 text-gray-600">How we handle your data (stub).</p>
    </section>
  );
}
