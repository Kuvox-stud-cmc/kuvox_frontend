import type { Route } from "./+types/student-verification";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Student verification · Kuvox" }];
}

export default function StudentVerification() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Student verification</h1>
      <p className="mt-2 text-gray-600">Verify your student status for discounted pricing (stub).</p>
    </section>
  );
}
