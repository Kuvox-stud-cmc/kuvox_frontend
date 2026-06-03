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
    <div className="bg-surface min-h-screen flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 sm:px-6 text-center relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] bg-primary/5 rounded-full blur-[80px] sm:blur-[100px] lg:blur-[120px] pointer-events-none" />

      {/* Decorative 404 watermark */}
      <span className="absolute text-[8rem] sm:text-[14rem] lg:text-[20rem] font-bold text-primary/[0.03] select-none pointer-events-none leading-none tracking-tighter">
        404
      </span>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-7">
        {/* Logo with glow ring */}
        <div className="relative mb-2 sm:mb-4">
          <div className="absolute inset-0 rounded-2xl scale-150 pointer-events-none" />
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center">
            <img
              src="/logo.svg"
              alt="Kuvox"
              className="h-5 sm:h-6 opacity-80"
            />
          </div>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-display font-semibold text-on-surface tracking-tight">
          404
        </h1>

        <p className="text-label-md sm:text-body-sm font-medium text-primary/60 uppercase tracking-widest -mt-2 sm:-mt-3">
          Page not found
        </p>

        <p className="text-body-sm sm:text-body-lg text-on-surface-variant font-normal max-w-xs sm:max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          to="/"
          className="mt-2 sm:mt-4 bg-primary text-on-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-label-md font-medium hover:bg-primary-fixed transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(192,193,255,0.2)]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export function ErrorBoundary(_: Route.ErrorBoundaryProps) {
  return <NotFoundPage />;
}

export default function NotFound() {
  return <NotFoundPage />;
}
