import { Link } from "react-router";

import type { Route } from "./+types/not-found";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Not found · Kuvox" }];
}

/** Catch-all `*` route: respond with a real 404 status, render the page below. */
export function loader() {
  throw new Response("Not Found", { status: 404 });
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-gray-600">The requested page could not be found.</p>
      <Link to="/" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Back home
      </Link>
    </div>
  );
}

export function ErrorBoundary(_: Route.ErrorBoundaryProps) {
  return <NotFoundPage />;
}

export default function NotFound() {
  return <NotFoundPage />;
}
