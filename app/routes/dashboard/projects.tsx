import type { Route } from "./+types/projects";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Projects · Kuvox" }];
}

export default function Projects() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Projects library</h1>
      <p className="mt-2 text-gray-600">All your projects (stub).</p>
    </section>
  );
}
