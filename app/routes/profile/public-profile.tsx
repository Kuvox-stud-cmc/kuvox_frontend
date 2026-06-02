import type { Route } from "./+types/public-profile";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Profile · Kuvox" }];
}

export default function PublicProfile({ params }: Route.ComponentProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Public profile</h2>
      <p className="mt-2 text-gray-600">
        Public showcase for @{params.username} (stub).
      </p>
    </section>
  );
}
