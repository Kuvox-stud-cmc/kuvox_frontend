import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";
import {
  Permission,
  sharedRoleLabel,
  type ItemAccessMemberDto,
} from "~/lib/api";

export type ResourceType = "project" | "media" | "album";

interface ResourceActionData {
  ok?: boolean;
  intent?: string;
  resourceType?: ResourceType;
  id?: string;
  sharedCount?: number;
  access?: ItemAccessMemberDto[];
  error?: string;
}

interface ResourceDialogProps {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  buttonClassName?: string;
}

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({
  resourceType,
  resourceId,
  resourceName,
  buttonClassName = "",
}: ResourceDialogProps) {
  const fetcher = useFetcher<ResourceActionData>();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const isSubmitting = fetcher.state !== "idle";
  const actionData = fetcher.data;
  const draftEmails = parseEmailTokens(draft).valid;
  const submitEmails = mergeEmails(recipients, draftEmails);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.intent === "share-resource" &&
      actionData.id === resourceId
    ) {
      setOpen(false);
      setRecipients([]);
      setDraft("");
      setInputError(null);
    }
  }, [actionData, resourceId]);

  const commitDraft = (value = draft) => {
    const parsed = parseEmailTokens(value);
    if (parsed.invalid.length > 0) {
      setInputError("Enter valid email addresses.");
      return false;
    }

    if (parsed.valid.length > 0) {
      setRecipients((current) => mergeEmails(current, parsed.valid));
      setDraft("");
      setInputError(null);
    }

    return true;
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Share ${resourceName}`}
        title={`Share ${resourceName}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`${iconButtonClass} ${buttonClassName}`}
      >
        <span className="material-symbols-outlined text-[18px]">share</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Share item">
        <fetcher.Form
          method="post"
          className="space-y-4"
          onSubmit={(event) => {
            const parsed = parseEmailTokens(draft);
            if (parsed.invalid.length > 0 || submitEmails.length === 0) {
              event.preventDefault();
              setInputError(
                parsed.invalid.length > 0
                  ? "Enter valid email addresses."
                  : "Add at least one person.",
              );
            }
          }}
        >
          <input type="hidden" name="intent" value="share-resource" />
          <input type="hidden" name="resourceType" value={resourceType} />
          <input type="hidden" name="id" value={resourceId} />
          <input type="hidden" name="emails" value={submitEmails.join(",")} />

          <label className="block">
            <span className="mb-1 block text-label-md text-on-surface-variant">People</span>
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high px-2 py-2 focus-within:border-primary">
              {recipients.map((recipient) => (
                <span
                  key={recipient}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-container/30 px-2 py-1 text-label-md text-on-surface"
                >
                  <span className="max-w-48 truncate">{recipient}</span>
                  <button
                    type="button"
                    onClick={() => setRecipients((current) => current.filter((email) => email !== recipient))}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                    aria-label={`Remove ${recipient}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              ))}
              <input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setInputError(null);
                }}
                onBlur={() => {
                  if (draft.trim()) commitDraft();
                }}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text");
                  if (!/[,\s;]/.test(pasted)) return;
                  event.preventDefault();
                  commitDraft(`${draft} ${pasted}`);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "," || event.key === ";") {
                    event.preventDefault();
                    commitDraft();
                  }
                  if (event.key === "Backspace" && !draft) {
                    setRecipients((current) => current.slice(0, -1));
                  }
                }}
                placeholder={recipients.length === 0 ? "name@example.com" : ""}
                className="min-w-48 flex-1 border-0 bg-transparent px-1 py-1 text-body-sm text-on-surface outline-none placeholder:text-outline"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-label-md text-on-surface-variant">Role</span>
            <select
              name="role"
              defaultValue={Permission.Viewer}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface outline-none transition-colors focus:border-primary"
            >
              <option value={Permission.Viewer}>Viewer</option>
              <option value={Permission.Editor}>Editor</option>
            </select>
          </label>

          {inputError ? (
            <p className="rounded-lg bg-error-container px-3 py-2 text-label-md text-on-error-container">
              {inputError}
            </p>
          ) : actionData?.error ? (
            <p className="rounded-lg bg-error-container px-3 py-2 text-label-md text-on-error-container">
              {actionData.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || submitEmails.length === 0} className={primaryButtonClass()}>
              {isSubmitting ? "Sharing..." : "Share"}
            </button>
          </div>
        </fetcher.Form>
      </Modal>
    </>
  );
}

function parseEmailTokens(value: string): { valid: string[]; invalid: string[] } {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  return {
    valid: tokens.filter((token) => emailPattern.test(token)),
    invalid: tokens.filter((token) => !emailPattern.test(token)),
  };
}

function mergeEmails(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((email) => email.toLowerCase()));
  const merged = [...current];
  for (const email of incoming) {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }
  return merged;
}

export function AccessDialog({
  resourceType,
  resourceId,
  resourceName,
  canManageAccess,
  buttonClassName = "",
}: ResourceDialogProps & { canManageAccess: boolean }) {
  const fetcher = useFetcher<ResourceActionData>();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ItemAccessMemberDto[]>([]);
  const actionData = fetcher.data;
  const pendingUserId = fetcher.formData?.get("userId");
  const pendingIntent = fetcher.formData?.get("intent");
  const isLoading = fetcher.state !== "idle" && pendingIntent === "load-resource-access";

  useEffect(() => {
    if (!open) return;
    const formData = new FormData();
    formData.set("intent", "load-resource-access");
    formData.set("resourceType", resourceType);
    formData.set("id", resourceId);
    fetcher.submit(formData, { method: "post" });
  }, [open, resourceId, resourceType]);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.id === resourceId &&
      (actionData.intent === "load-resource-access" ||
        actionData.intent === "update-resource-access") &&
      actionData.access
    ) {
      setRows(actionData.access);
    }
  }, [actionData, resourceId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [rows],
  );

  return (
    <>
      <button
        type="button"
        disabled={!canManageAccess}
        aria-label={`Manage access for ${resourceName}`}
        title={
          canManageAccess
            ? `Manage access for ${resourceName}`
            : "Only Studio owners and admins can manage access"
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`${iconButtonClass} ${buttonClassName}`}
      >
        <span className="material-symbols-outlined text-[18px]">key</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Studio access">
        <div className="space-y-4">
          {isLoading && rows.length === 0 ? (
            <p className="rounded-lg bg-surface-container-high px-3 py-3 text-body-sm text-on-surface-variant">
              Loading Studio members...
            </p>
          ) : null}

          {actionData?.error ? (
            <p className="rounded-lg bg-error-container px-3 py-2 text-label-md text-on-error-container">
              {actionData.error}
            </p>
          ) : null}

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {sortedRows.map((row) => (
              <AccessRow
                key={row.userId}
                row={row}
                resourceType={resourceType}
                resourceId={resourceId}
                canManageAccess={canManageAccess}
                isSubmitting={fetcher.state !== "idle" && pendingUserId === row.userId}
                fetcher={fetcher}
              />
            ))}
          </div>

          {!isLoading && sortedRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-outline-variant px-3 py-6 text-center text-body-sm text-on-surface-variant">
              No Studio members found.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function AccessRow({
  row,
  resourceType,
  resourceId,
  canManageAccess,
  isSubmitting,
  fetcher,
}: {
  row: ItemAccessMemberDto;
  resourceType: ResourceType;
  resourceId: string;
  canManageAccess: boolean;
  isSubmitting: boolean;
  fetcher: ReturnType<typeof useFetcher<ResourceActionData>>;
}) {
  const canEditRow = canManageAccess && row.canManage;
  const label = row.displayName || row.email;
  const roleValue = row.isHidden
    ? "hidden"
    : row.overrideRole === Permission.Editor || row.effectiveRole === Permission.Editor
      ? String(Permission.Editor)
      : String(Permission.Viewer);

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body-sm font-bold text-on-surface" title={label}>
            {label}
          </p>
          <p className="truncate text-label-sm text-on-surface-variant" title={row.email}>
            {row.email}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
          {row.studioRole}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <p className="text-label-sm text-on-surface-variant">
            Effective: {row.isHidden ? "Hidden" : sharedRoleLabel(row.effectiveRole)}
          </p>
          {canEditRow ? (
            <fetcher.Form method="post" className="flex gap-2">
              <input type="hidden" name="intent" value="update-resource-access" />
              <input type="hidden" name="resourceType" value={resourceType} />
              <input type="hidden" name="id" value={resourceId} />
              <input type="hidden" name="userId" value={row.userId} />
              <select
                name="role"
                defaultValue={roleValue}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1.5 text-label-md text-on-surface outline-none focus:border-primary"
              >
                <option value={Permission.Viewer}>Viewer</option>
                <option value={Permission.Editor}>Editor</option>
                <option value="hidden">Hidden</option>
              </select>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-3 py-1.5 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </fetcher.Form>
          ) : (
            <p className="text-label-sm text-outline">
              {row.canManage ? "Access controls unavailable." : "Managed by Studio role."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
