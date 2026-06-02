import type { Route } from "./+types/overview";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Project overview · Kuvox" }];
}

export default function ProjectOverview({ params }: Route.ComponentProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Overview</h2>
      <p className="mt-2 text-gray-600">
        Summary and media for project {params.projectId} (stub).
      </p>
    </section>
  );
}
