import { useState } from "react";
import { Form, useNavigation } from "react-router";

import {
  CardGridSkeleton,
  Chip,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import type { TrashEntry } from "~/lib/api";

import type { WorkspaceActionData } from "./projects-view";

/** Trash list with Restore + Delete-permanently (confirm) + purge hint, shared by routes. */
export function TrashView({
  entries,
  loadError,
  actionData,
  subtitle,
  title = "Trash",
  emptyTitle = "Trash is empty",
}: {
  entries: TrashEntry[];
  loadError: string | null;
  actionData?: WorkspaceActionData;
  subtitle?: string;
  title?: string;
  emptyTitle?: string;
}) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [confirm, setConfirm] = useState<TrashEntry | null>(null);

  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />

      {loadError && <ErrorBanner message={loadError} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="delete"
          title={emptyTitle}
          hint="Deleted projects and media will appear here."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((entry) => (
            <li
              key={`${entry.resource}-${entry.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">
                  {entry.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body-lg text-on-surface">{entry.label}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-label-md text-on-surface-variant">
                    <Chip>{entry.kindLabel}</Chip>
                    <span>
                      Purges in {entry.purgesInDays} day{entry.purgesInDays === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="resource" value={entry.resource} />
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
                  >
                    <span className="material-symbols-outlined text-[18px]">restore</span>
                    Restore
                  </button>
                </Form>
                <button
                  type="button"
                  onClick={() => setConfirm(entry)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-label-md text-error transition-colors hover:bg-error-container hover:text-on-error-container"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                  Delete permanently
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Delete permanently?">
        <p className="text-body-sm text-on-surface-variant">
          This will permanently delete{" "}
          <span className="font-medium text-on-surface">{confirm?.label}</span>. This action
          cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
          {confirm && (
            <Form method="post" onSubmit={() => setConfirm(null)}>
              <input type="hidden" name="intent" value="permanent" />
              <input type="hidden" name="resource" value={confirm.resource} />
              <input type="hidden" name="id" value={confirm.id} />
              <button
                type="submit"
                className={primaryButtonClass("!bg-error !text-on-error hover:!bg-error/90")}
              >
                Delete permanently
              </button>
            </Form>
          )}
        </div>
      </Modal>
    </section>
  );
}
