import type { Route } from "./+types/forgot-password";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Forgot password · Kuvox" }];
}

export default function ForgotPassword() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="mt-2 text-gray-600">Reset your password (stub).</p>
    </section>
  );
}
