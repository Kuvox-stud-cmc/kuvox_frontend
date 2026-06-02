import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Dashboard · Kuvox" }];
}

export default function DashboardHome() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="mt-2 text-gray-600">Your dashboard overview (stub).</p>
    </section>
  );
}
