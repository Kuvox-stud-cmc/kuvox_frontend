import type { Route } from "./+types/notifications";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notifications · Kuvox" }];
}

export default function Notifications() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <p className="mt-2 text-gray-600">Your recent notifications (stub).</p>
    </section>
  );
}
