import { Link, Outlet } from "react-router";

/** Minimal centered layout for the authentication pages. */
export default function AuthLayout() {
  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <Link to="/" className="flex justify-center">
          <img src="/logo.svg" alt="Kuvox" className="h-7" />
        </Link>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
