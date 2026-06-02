import type { Route } from "./+types/media";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Media · Kuvox" }];
}

export default function Media() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Media library</h1>
      <p className="mt-2 text-gray-600">Your uploaded media (stub).</p>
    </section>
  );
}
