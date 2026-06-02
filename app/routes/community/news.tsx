import type { Route } from "./+types/news";

export function meta(_: Route.MetaArgs) {
  return [{ title: "News & announcements · Kuvox" }];
}

export default function News() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">News & announcements</h1>
      <p className="mt-2 text-gray-600">Product news and updates (stub).</p>
    </section>
  );
}
