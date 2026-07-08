import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import { actionErrorMessage } from "~/lib/action-error.server";
import { fetchSettings, updateOnboardingProfile } from "~/lib/api.server";
import type { CreationGoal, UserPersonality } from "~/lib/api";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/personalize";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Personalize your experience · Kuvox" }];
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

const ROLE_VALUES = new Set<UserPersonality>(ROLES.map((role) => role.value));

const GOALS = [
  { value: "youtube", label: "YouTube" },
  { value: "social_clips", label: "Social clips" },
  { value: "highlights", label: "Highlights" },
  { value: "color_grading", label: "Color grading" },
  { value: "podcasts", label: "Podcasts" },
  { value: "tutorials", label: "Tutorials" },
] as const;

const GOAL_VALUES = new Set<CreationGoal>(GOALS.map((goal) => goal.value));

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { onboarding: null };
  }

  try {
    const settings = await fetchSettings(accessToken, reqLog);
    return { onboarding: settings.onboarding };
  } catch (error) {
    reqLog.warn({ err: error }, "failed to load onboarding profile");
    return { onboarding: null };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { error: "Your session expired. Please sign in again." };
  }

  const formData = await request.formData();
  const role = String(formData.get("role") ?? "").trim();
  const goals = formData
    .getAll("goals")
    .map((goal) => String(goal).trim())
    .filter(Boolean);

  if (!isUserPersonality(role)) {
    return { error: "Pick the option that best describes you." };
  }

  const creationGoals: CreationGoal[] = [];
  for (const goal of goals) {
    if (!isCreationGoal(goal)) {
      return { error: "Choose a supported creation goal." };
    }

    if (!creationGoals.includes(goal)) {
      creationGoals.push(goal);
    }
  }

  try {
    await updateOnboardingProfile(accessToken, { personality: role, creationGoals }, reqLog);
    return redirect("/onboarding/import-media");
  } catch (error) {
    reqLog.error({ err: error }, "onboarding personalization action failed");
    return { error: actionErrorMessage(error) };
  }
}

export default function Personalize({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const storedPersonality = loaderData.onboarding?.personality ?? "";
  const initialRole: UserPersonality | "" = isUserPersonality(storedPersonality)
    ? storedPersonality
    : "";
  const initialGoals = (loaderData.onboarding?.creationGoals ?? []).filter(isCreationGoal);
  const [role, setRole] = useState<UserPersonality | "">(initialRole);
  const [goals, setGoals] = useState<CreationGoal[]>(initialGoals);

  const toggleGoal = (goal: CreationGoal) =>
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
              const selected = goals.includes(goal.value);
              return (
                <button
                  type="button"
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-label-md transition-colors ${
                    selected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/50"
                  }`}
                >
                  {goal.label}
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

function isUserPersonality(value: string): value is UserPersonality {
  return ROLE_VALUES.has(value as UserPersonality);
}

function isCreationGoal(value: string): value is CreationGoal {
  return GOAL_VALUES.has(value as CreationGoal);
}
