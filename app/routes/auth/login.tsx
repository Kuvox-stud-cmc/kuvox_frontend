import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Log in · Kuvox" }];
}

export default function Login() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-2 text-gray-600">Sign in to your account (stub).</p>
    </section>
  );
}
