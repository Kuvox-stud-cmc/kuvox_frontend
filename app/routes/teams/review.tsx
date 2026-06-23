import { Link } from "react-router";

import { SectionHeader } from "~/components/dashboard/section";

import type { Route } from "./+types/review";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Review · Team · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

const PENDING = [
  { id: "1", name: "Travel Campaign – Intro", submittedBy: "Nguyen A", date: "23/06", priority: "high" },
  { id: "2", name: "Product Demo – Cut v2", submittedBy: "Bob Le", date: "22/06", priority: "medium" },
  { id: "3", name: "Social Reel – June", submittedBy: "Alice Tran", date: "22/06", priority: "low" },
];

const APPROVED = [
  { id: "1", name: "Brand Video – Final", approvedBy: "Emma Pham", date: "21/06" },
  { id: "2", name: "Interview – Edit v3", approvedBy: "Emma Pham", date: "20/06" },
];

const REJECTED = [
  { id: "1", name: "Teaser – Draft", rejectedBy: "Emma Pham", date: "21/06", reason: "Audio levels need adjustment in the first 10 seconds." },
  { id: "2", name: "Ad Creative – v1", rejectedBy: "Emma Pham", date: "19/06", reason: "Color grading doesn't match brand guidelines." },
];

const WORKFLOW_STEPS = [
  { label: "Editor", icon: "edit", description: "Create & edit content" },
  { label: "Submit Review", icon: "send", description: "Submit for approval" },
  { label: "Reviewer", icon: "person", description: "Review submission" },
  { label: "Approve", icon: "check_circle", description: "Approve or reject" },
  { label: "Export", icon: "download", description: "Export final version" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-error/20 text-error",
  medium: "bg-tertiary/20 text-tertiary",
  low: "bg-secondary/20 text-secondary",
};

type ReviewView = "pending" | "approved" | "rejected";

const VIEW_CONFIG: Record<ReviewView, { label: string; icon: string }> = {
  pending: { label: "Pending Review", icon: "hourglass_top" },
  approved: { label: "Approved", icon: "check_circle" },
  rejected: { label: "Rejected", icon: "cancel" },
};

export default function TeamReview({ params }: Route.ComponentProps) {
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const view = (url?.searchParams.get("view") as ReviewView) ?? "pending";
  const studioId = params.studioId;

  return (
    <section>
      <SectionHeader title="Review" subtitle="Manage content approvals and feedback." />

      {/* Workflow diagram */}
      <div className="mt-6 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <h3 className="mb-4 text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
          Review Workflow
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-[20px] text-primary">{step.icon}</span>
                </div>
                <span className="text-label-md font-medium text-on-surface">{step.label}</span>
                <span className="text-[10px] text-on-surface-variant">{step.description}</span>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <span className="material-symbols-outlined mx-1 text-[16px] text-on-surface-variant/50">
                  arrow_forward
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div className="mt-6 flex gap-2">
        {(Object.keys(VIEW_CONFIG) as ReviewView[]).map((key) => (
          <Link
            key={key}
            to={`/teams/${studioId}/review?view=${key}`}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-body-sm transition-colors ${
              view === key
                ? "bg-primary/20 text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{VIEW_CONFIG[key].icon}</span>
            {VIEW_CONFIG[key].label}
            {key === "pending" && PENDING.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-label-sm text-primary">
                {PENDING.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {view === "pending" && (
          <div className="space-y-3">
            {PENDING.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary/10">
                  <span className="material-symbols-outlined text-[20px] text-tertiary">hourglass_top</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-on-surface">{item.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    Submitted by {item.submittedBy} · {item.date}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-label-sm capitalize ${PRIORITY_STYLES[item.priority]}`}>
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        )}

        {view === "approved" && (
          <div className="space-y-3">
            {APPROVED.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                  <span className="material-symbols-outlined text-[20px] text-secondary">check_circle</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-on-surface">{item.name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    Approved by {item.approvedBy} · {item.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "rejected" && (
          <div className="space-y-3">
            {REJECTED.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-error/30 bg-surface-container-low p-4 transition-colors hover:border-error/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10">
                    <span className="material-symbols-outlined text-[20px] text-error">cancel</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-on-surface">{item.name}</p>
                    <p className="text-label-md text-on-surface-variant">
                      Rejected by {item.rejectedBy} · {item.date}
                    </p>
                  </div>
                </div>
                <p className="mt-2 rounded-lg bg-error/5 px-3 py-2 pl-14 text-body-sm text-on-surface-variant">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
