import { Link } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/welcome";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Welcome · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

const HIGHLIGHTS = [
  {
    icon: "auto_awesome",
    title: "Semantic understanding",
    body: "Kuvox watches your footage and understands what's happening — scenes, speech, and moments — so you can find anything fast.",
  },
  {
    icon: "edit_note",
    title: "Natural-language edits",
    body: "Describe the cut you want in plain English and let the AI agent assemble, trim, and polish it for you.",
  },
] as const;

export default function OnboardingWelcome({ loaderData }: Route.ComponentProps) {
  const firstName = loaderData.user.displayName.split(" ")[0];

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">
        Welcome to Kuvox, {firstName}
      </h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Kuvox is the AI-native video editor that understands your footage and
        turns plain-language ideas into finished edits.
      </p>

      <div className="mt-6 space-y-3">
        {HIGHLIGHTS.map((item) => (
          <div
            key={item.title}
            className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container px-4 py-3"
          >
            <span className="material-symbols-outlined text-primary">
              {item.icon}
            </span>
            <div>
              <p className="text-label-lg text-on-surface">{item.title}</p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
        >
          Skip for now
        </Link>
        <Link
          to="/onboarding/personalize"
          className="rounded-lg bg-primary px-5 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed"
        >
          Get started
        </Link>
      </div>
    </section>
  );
}
