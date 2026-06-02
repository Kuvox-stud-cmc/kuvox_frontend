import type { Route } from "./+types/signup";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign up · Kuvox" }];
}

export default function Signup() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <p className="mt-2 text-gray-600">Create a new account (stub).</p>
    </section>
  );
}
