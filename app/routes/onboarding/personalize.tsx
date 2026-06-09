import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import { requireUser } from "~/lib/auth.server";

import type { Route } from "./+types/personalize";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Personalize · Kuvox" }];
}

const ROLES = [
  {
    value: "creator",
    icon: "movie",
    title: "Creator",
    body: "I publish videos to grow an audience.",
  },
  {
    value: "casual",
    icon: "sentiment_satisfied",
    title: "Casual",
    body: "I edit clips for fun and personal projects.",
  },
  {
    value: "professional",
    icon: "work",
    title: "Professional",
    body: "I edit video as part of my job or business.",
  },
] as const;

const GOALS = [
  "YouTube",
  "Social clips",
  "Highlights",
  "Color grading",
  "Podcasts",
  "Tutorials",
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const role = String(formData.get("role") ?? "").trim();

  if (!role) {
    return { error: "Pick the option that best describes you." };
  }

  // TODO: persist to a preferences endpoint when available.
  return redirect("/onboarding/import-media");
}

export default function Personalize({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [role, setRole] = useState<string>("");
  const [goals, setGoals] = useState<string[]>([]);

  const toggleGoal = (goal: string) =>
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((g) => g !== goal)
        : [...current, goal],
    );

  return (
    <section>
      <h1 className="text-headline-lg text-on-surface">Tell us about you</h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        We'll tune Kuvox's suggestions to match how you work.
      </p>

      {actionData?.error && (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="mt-6 space-y-6">
        <input type="hidden" name="role" value={role} />
        {goals.map((goal) => (
          <input key={goal} type="hidden" name="goals" value={goal} />
        ))}

        <fieldset>
          <legend className="text-label-md text-on-surface-variant">
            Which best describes you?
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {ROLES.map((option) => {
              const selected = role === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setRole(option.value)}
                  aria-pressed={selected}
                  className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-outline-variant bg-surface-container hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-primary">
                    {option.icon}
                  </span>
                  <span className="text-label-lg text-on-surface">
                    {option.title}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {option.body}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-label-md text-on-surface-variant">
            What do you want to create? (optional)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((goal) => {
              const selected = goals.includes(goal);
              return (
                <button
                  type="button"
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-label-md transition-colors ${
                    selected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/50"
                  }`}
                >
                  {goal}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4 pt-2">
          <Link
            to="/onboarding/welcome"
            className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            Back
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/onboarding/import-media"
              className="text-body-sm text-on-surface-variant transition-colors hover:text-primary"
            >
              Skip
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-5 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </Form>
    </section>
  );
}
