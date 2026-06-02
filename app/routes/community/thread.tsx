import type { Route } from "./+types/thread";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Thread · Kuvox" }];
}

export default function Thread({ params }: Route.ComponentProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Thread detail</h1>
      <p className="mt-2 text-gray-600">
        Discussion thread {params.threadId} (stub).
      </p>
    </section>
  );
}
