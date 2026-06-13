import { useMemo, useState } from "react";
import { Link } from "react-router";

import { primaryButtonClass } from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Reviews · Kuvox" }];
}

/* ── Mock data ──────────────────────────────────────────────────────────── */

type ReviewStatus =
  | "waiting_approval"
  | "changes_requested"
  | "waiting_review"
  | "approved";

interface MockReview {
  id: string;
  title: string;
  reviewer: string;
  submittedAgo: string;
  status: ReviewStatus;
  comments: number;
}

const MOCK_REVIEWS: MockReview[] = [
  {
    id: "r1",
    title: "Travel Vlog",
    reviewer: "Sarah Chen",
    submittedAgo: "2 hours ago",
    status: "waiting_approval",
    comments: 2,
  },
  {
    id: "r2",
    title: "Product Promo",
    reviewer: "John Smith",
    submittedAgo: "Yesterday",
    status: "changes_requested",
    comments: 5,
  },
  {
    id: "r3",
    title: "Instagram Reel",
    reviewer: "Emma Davis",
    submittedAgo: "3 days ago",
    status: "waiting_review",
    comments: 0,
  },
  {
    id: "r4",
    title: "Brand Story Cut",
    reviewer: "Alex Rivera",
    submittedAgo: "4 days ago",
    status: "approved",
    comments: 1,
  },
  {
    id: "r5",
    title: "Podcast Trailer",
    reviewer: "Mia Thompson",
    submittedAgo: "1 week ago",
    status: "waiting_approval",
    comments: 3,
  },
];

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; text: string; dot: string; bg: string }
> = {
  waiting_approval: {
    label: "Waiting Approval",
    text: "text-tertiary",
    dot: "bg-tertiary",
    bg: "bg-tertiary/15",
  },
  changes_requested: {
    label: "Changes Requested",
    text: "text-error",
    dot: "bg-error",
    bg: "bg-error/15",
  },
  waiting_review: {
    label: "Waiting Review",
    text: "text-primary",
    dot: "bg-primary",
    bg: "bg-primary/15",
  },
  approved: {
    label: "Approved",
    text: "text-secondary",
    dot: "bg-secondary",
    bg: "bg-secondary/15",
  },
};

const FILTER_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Pending", value: "pending" as const },
  { label: "Changes", value: "changes_requested" as const },
  { label: "Approved", value: "approved" as const },
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: "primary" | "secondary" | "tertiary" | "error";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
    error: "bg-error/10 text-error",
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <p className="mb-1 text-label-sm text-on-surface-variant">{label}</p>
      <span className="text-headline-md font-bold text-on-surface">{value}</span>
    </div>
  );
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-bold ${config.bg} ${config.text}`}
    >
      {config.label}
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
    </span>
  );
}

function ReviewRow({ review }: { review: MockReview }) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/30">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-label-md font-bold text-on-surface-variant">
        {review.title.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body-sm font-bold text-on-surface">{review.title}</h3>
        <p className="mt-0.5 text-label-md text-on-surface-variant">
          By {review.reviewer} · {review.submittedAgo}
        </p>
      </div>
      <div className="hidden items-center gap-2 text-label-sm text-on-surface-variant sm:flex">
        <span className="material-symbols-outlined text-[16px]">chat</span>
        {review.comments}
      </div>
      <ReviewStatusBadge status={review.status} />
      <button
        type="button"
        className="shrink-0 rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-on-surface group-hover:opacity-100"
      >
        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function Reviews() {
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]["value"]>("all");

  const pendingCount = MOCK_REVIEWS.filter(
    (r) => r.status !== "approved",
  ).length;

  const filtered = useMemo(() => {
    if (filter === "all") return MOCK_REVIEWS;
    if (filter === "pending") {
      return MOCK_REVIEWS.filter((r) => r.status !== "approved");
    }
    return MOCK_REVIEWS.filter((r) => r.status === filter);
  }, [filter]);

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">Reviews</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Track and manage project review requests from your team.
          </p>
        </div>
        <Link to="/dashboard/projects" className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">send</span>
          Submit for review
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="rate_review" label="Pending" value={pendingCount} tone="tertiary" />
        <MetricCard
          icon="error"
          label="Changes Requested"
          value={MOCK_REVIEWS.filter((r) => r.status === "changes_requested").length}
          tone="error"
        />
        <MetricCard
          icon="check_circle"
          label="Approved"
          value={MOCK_REVIEWS.filter((r) => r.status === "approved").length}
          tone="secondary"
        />
        <MetricCard icon="schedule" label="Avg. Turnaround" value="1.8 d" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-4 py-1.5 text-label-md font-medium transition-colors ${
              filter === option.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">
            {filter === "all" ? "All Reviews" : FILTER_OPTIONS.find((o) => o.value === filter)?.label}
          </h2>
          <span className="text-label-md text-on-surface-variant">{filtered.length} items</span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">
              rate_review
            </span>
            <p className="mt-3 text-body-sm text-on-surface">No reviews match this filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
