import type { Route } from "./+types/rendering-export";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Rendering & export · Kuvox" }];
}

export default function RenderingExport() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Rendering & export</h1>
      <p className="mt-2 text-gray-600">Render and export your finished videos (stub).</p>
    </section>
  );
}
