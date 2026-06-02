import type { Route } from "./+types/account";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Account profile · Kuvox" }];
}

export default function Account() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Account profile</h1>
      <p className="mt-2 text-gray-600">Your account details (stub).</p>
    </section>
  );
}
