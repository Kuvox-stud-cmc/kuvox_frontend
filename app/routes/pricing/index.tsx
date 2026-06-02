import { Link } from "react-router";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Pricing · Kuvox" }];
}

export default function Pricing() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Pricing</h1>
      <p className="mt-2 text-gray-600">Plans and pricing tiers (stub).</p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link to="/pricing/student-verification" className="text-blue-600">
          Student verification
        </Link>
        <Link to="/pricing/checkout" className="text-blue-600">
          Checkout
        </Link>
      </div>
    </section>
  );
}
