import type { Route } from "./+types/terms";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Terms of service · Kuvox" }];
}

export default function Terms() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Terms of service</h1>
      <p className="mt-2 text-gray-600">Terms governing use of Kuvox (stub).</p>
    </section>
  );
}
