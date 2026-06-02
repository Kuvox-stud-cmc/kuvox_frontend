import { Outlet } from "react-router";

/** Minimal full-screen layout for the onboarding flow. */
export default function OnboardingLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-8">
        <Outlet />
      </div>
    </div>
  );
}
