import { Link, Form } from "react-router";

import {
  MetricCard,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { EmptyState, ErrorBanner, primaryButtonClass } from "~/components/dashboard/section";
import {
  TaskIssueKind,
  TaskIssueStatus,
  isTaskOpen,
  taskKindLabel,
  taskStatusLabel,
  type StudioDto,
  type TaskIssueDto,
} from "~/lib/api";
import { ApiError, listAssignedTasks, listMyStudios } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { createRequestLogger, withUser } from "~/lib/logger.server";
import { getSession } from "~/lib/session.server";

import type { Route } from "./+types/reviews";

export function meta() {
  return [{ title: "Reviews · Kuvox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const log = createRequestLogger(request);
  const user = await requireUser(request, log);
  const reqLog = withUser(log, user);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const url = new URL(request.url);
  const filters = buildFilters(url.searchParams);

  if (!accessToken) {
    return {
      items: [] as TaskIssueDto[],
      studios: [] as StudioDto[],
      filters,
      error: "Your session expired. Please sign in again." as string | null,
    };
  }

  try {
    const [items, studios] = await Promise.all([
      listAssignedTasks(accessToken, filters, reqLog),
      listMyStudios(accessToken, reqLog),
    ]);
    return { items, studios, filters, error: null as string | null };
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Couldn't load tasks and reviews.";
    reqLog.error({ err: error }, "failed to load assigned tasks");
    return { items: [] as TaskIssueDto[], studios: [] as StudioDto[], filters, error: message };
  }
}

function buildFilters(search: URLSearchParams) {
  const due = search.get("due") ?? "";
  return {
    kind: search.get("kind") ?? "",
    status: search.get("status") ?? "",
    studioId: search.get("studioId") ?? "",
    milestoneId: search.get("milestoneId") ?? "",
    due,
    dueBefore: due === "week" ? nextDays(7) : due === "today" ? nextDays(1) : "",
  };
}

function nextDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export default function Reviews({ loaderData }: Route.ComponentProps) {
  const { items, studios, filters, error } = loaderData;
  const open = items.filter((item) => isTaskOpen(item.status));
  const reviews = items.filter((item) => item.kind === TaskIssueKind.Review);
  const changes = items.filter((item) => item.status === TaskIssueStatus.ChangesRequested);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Tasks & Reviews"
        subtitle="Assigned work across every team you belong to."
      >
        <Link to="/dashboard/team" className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">groups</span>
          Open teams
        </Link>
      </PageHeader>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="task_alt" label="Open" value={open.length} tone="primary" />
        <MetricCard icon="rate_review" label="Reviews" value={reviews.length} tone="tertiary" />
        <MetricCard icon="error" label="Changes" value={changes.length} tone="error" />
        <MetricCard icon="groups" label="Teams" value={new Set(items.map((item) => item.studioId)).size} />
      </div>

      <Form method="get" className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 md:grid-cols-5">
        <SelectFilter name="kind" label="Type" value={filters.kind}>
          <option value="">All</option>
          <option value={TaskIssueKind.Task}>Tasks</option>
          <option value={TaskIssueKind.Review}>Reviews</option>
        </SelectFilter>
        <SelectFilter name="status" label="Status" value={filters.status}>
          <option value="">All</option>
          {Object.entries(TaskIssueStatus).map(([label, value]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectFilter>
        <SelectFilter name="studioId" label="Team" value={filters.studioId}>
          <option value="">All teams</option>
          {studios.map((studio) => (
            <option key={studio.id} value={studio.id}>{studio.name}</option>
          ))}
        </SelectFilter>
        <SelectFilter name="due" label="Due" value={filters.due}>
          <option value="">Any time</option>
          <option value="today">Today</option>
          <option value="week">Next 7 days</option>
        </SelectFilter>
        <div className="flex items-end">
          <button type="submit" className={primaryButtonClass("w-full justify-center")}>
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            Apply
          </button>
        </div>
      </Form>

      <section>
        <SectionHeader title="Assigned to me" count={`${items.length} items`} />
        {items.length === 0 ? (
          <EmptyState
            icon="task_alt"
            title={studios.length === 0 ? "No teams yet" : "No assigned work"}
            hint={studios.length === 0 ? "Join or create a team to see Studio tasks here." : "Tasks and reviews assigned to you will appear here."}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <TaskRow key={item.id} item={item} teamName={teamName(studios, item.studioId)} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function SelectFilter({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-label-md text-on-surface-variant">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function TaskRow({ item, teamName }: { item: TaskIssueDto; teamName: string }) {
  return (
    <Link
      to={`/teams/${item.studioId}/tasks`}
      className="group flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/30"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
        <span className="material-symbols-outlined text-[20px]">
          {item.kind === TaskIssueKind.Review ? "rate_review" : "task_alt"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body-sm font-bold text-on-surface">{item.title}</h3>
        <p className="mt-0.5 truncate text-label-md text-on-surface-variant">
          {teamName} · {taskKindLabel(item.kind)} · {item.milestone?.title ?? "No milestone"} · Due {formatDueDate(item.dueDate)}
        </p>
      </div>
      <StatusBadge
        label={taskStatusLabel(item.status)}
        tone={statusTone(item.status)}
        dotPosition="end"
        className="px-2.5 py-1"
      />
    </Link>
  );
}

function statusTone(status: number): Parameters<typeof StatusBadge>[0]["tone"] {
  if (status === TaskIssueStatus.ChangesRequested) return "danger";
  if (status === TaskIssueStatus.Approved || status === TaskIssueStatus.Done) return "success";
  if (status === TaskIssueStatus.InReview) return "warning";
  if (status === TaskIssueStatus.InProgress) return "primary";
  return "neutral";
}

function teamName(studios: StudioDto[], studioId: string) {
  return studios.find((studio) => studio.id === studioId)?.name ?? "Team";
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
