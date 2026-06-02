import type { Route } from "./+types/contact-sales";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Contact sales · Kuvox" }];
}

export default function ContactSales() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Contact sales</h1>
      <p className="mt-2 text-gray-600">Get in touch with our sales team (stub).</p>
    </section>
  );
}
