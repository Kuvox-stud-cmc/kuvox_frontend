import { Link, Outlet } from "react-router";

/** Minimal centered layout for the authentication pages. */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8">
        <Link to="/" className="block text-center text-lg font-bold">
          Kuvox
        </Link>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
