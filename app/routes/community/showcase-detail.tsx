import type { Route } from "./+types/showcase-detail";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Showcase · Kuvox" }];
}

export default function ShowcaseDetail({ params }: Route.ComponentProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Showcase detail</h1>
      <p className="mt-2 text-gray-600">
        Showcased project {params.showcaseId} (stub).
      </p>
    </section>
  );
}
