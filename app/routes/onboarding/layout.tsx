import { Link, Outlet, useLocation } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/layout";

/** Ordered onboarding steps; index drives the progress indicator. */
const STEPS = [
  { path: "/onboarding/welcome", label: "Welcome" },
  { path: "/onboarding/personalize", label: "Personalize" },
  { path: "/onboarding/import-media", label: "Import media" },
  { path: "/onboarding/first-project", label: "First project" },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

/** Full-screen MD3-dark layout wrapping the guarded onboarding flow. */
export default function OnboardingLayout() {
  const location = useLocation();
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => location.pathname.startsWith(step.path)),
  );

  return (
    <div className="hero-gradient flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <header className="border-b border-outline-variant px-8 py-6 shadow-[0_1px_0_rgba(0,0,0,0.2)]">
          <Link to="/" className="flex justify-center">
            <img src="/logo.svg" alt="Kuvox" className="h-7" />
          </Link>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-label-md text-on-surface-variant">
                Step {activeIndex + 1} of {STEPS.length}
              </p>
              <p className="text-label-md text-on-surface-variant">
                {STEPS[activeIndex]?.label}
              </p>
            </div>
            <div className="mt-2 flex gap-2" aria-hidden="true">
              {STEPS.map((step, index) => (
                <span
                  key={step.path}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index <= activeIndex
                      ? "bg-primary"
                      : "bg-surface-container-highest"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        <div className="px-8 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
