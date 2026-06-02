import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Help Center · Kuvox" }];
}

export default function HelpCenter() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Help Center</h1>
      <p className="mt-2 text-gray-600">Guides and answers for using Kuvox (stub).</p>
    </section>
  );
}
