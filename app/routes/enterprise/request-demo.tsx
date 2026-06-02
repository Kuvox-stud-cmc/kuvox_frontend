import type { Route } from "./+types/request-demo";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Request a demo · Kuvox" }];
}

export default function RequestDemo() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Request a demo</h1>
      <p className="mt-2 text-gray-600">Book a guided product demo (stub).</p>
    </section>
  );
}
