import type { Route } from "./+types/billing";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Billing & subscription · Kuvox" }];
}

export default function Billing() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Billing & subscription</h1>
      <p className="mt-2 text-gray-600">Manage your plan and invoices (stub).</p>
    </section>
  );
}
