import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Community · Kuvox" }];
}

export default function Community() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Community</h1>
      <p className="mt-2 text-gray-600">Forums, showcases, tutorials and news (stub).</p>
    </section>
  );
}
