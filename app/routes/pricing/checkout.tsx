import type { Route } from "./+types/checkout";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Checkout · Kuvox" }];
}

export default function Checkout() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="mt-2 text-gray-600">Complete your subscription purchase (stub).</p>
    </section>
  );
}
