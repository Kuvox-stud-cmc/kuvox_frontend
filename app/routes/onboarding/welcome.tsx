import type { Route } from "./+types/welcome";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Welcome · Kuvox" }];
}

export default function OnboardingWelcome() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Welcome to Kuvox</h1>
      <p className="mt-2 text-gray-600">Let's get you set up (stub).</p>
    </section>
  );
}
