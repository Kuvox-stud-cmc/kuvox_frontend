import type { Route } from "./+types/security";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Security · Kuvox" }];
}

export default function Security() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Security</h1>
      <p className="mt-2 text-gray-600">Password and security settings (stub).</p>
    </section>
  );
}
