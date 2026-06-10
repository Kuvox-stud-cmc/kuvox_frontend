import { Link } from "react-router";

import type { Route } from "./+types/forgot-password";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Forgot password · Kuvox" }];
}

export default function ForgotPassword() {
  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Forgot password</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        Password reset is coming soon. We&apos;re still wiring up email delivery — for
        now, please contact support if you can&apos;t sign in.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-block text-body-sm text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </section>
  );
}
