import type { Route } from "./+types/about";

export function meta(_: Route.MetaArgs) {
  return [{ title: "About us · Kuvox" }];
}

export default function About() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">About us</h1>
      <p className="mt-2 text-gray-600">What Kuvox is and who builds it (stub).</p>
    </section>
  );
}
