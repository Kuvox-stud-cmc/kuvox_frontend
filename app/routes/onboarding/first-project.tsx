import type { Route } from "./+types/first-project";

export function meta(_: Route.MetaArgs) {
  return [{ title: "First project setup · Kuvox" }];
}

export default function FirstProject() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">First project setup</h1>
      <p className="mt-2 text-gray-600">Create your first project (stub).</p>
    </section>
  );
}
