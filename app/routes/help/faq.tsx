import type { Route } from "./+types/faq";

export function meta(_: Route.MetaArgs) {
  return [{ title: "FAQ · Kuvox" }];
}

export default function Faq() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Frequently asked questions</h1>
      <p className="mt-2 text-gray-600">Common questions about Kuvox (stub).</p>
    </section>
  );
}
