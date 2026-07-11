import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Form, useFetcher, useLocation, useNavigate } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";
import { mediaObjectUrl, type MediaObjectVariant } from "~/components/dashboard/workspace/media-thumbnail";
import { MediaKind, Permission, ProjectKind, mediaKindLabel, sharedRoleLabel, type ItemAccessMemberDto, type MediaDto } from "~/lib/api";

interface AssetCardContextMenuProps {
  media: MediaDto;
  workspaceKind: "personal" | "studio";
  canMoveToRecycleBin?: boolean;
  canManageAccess?: boolean;
  placement?: "bottom" | "top";
  buttonClassName?: string;
  menuClassName?: string;
  defaultDetailsOpen?: boolean;
  resourceType?: "media" | "project" | "album" | "projects" | "albums";
  deleteIntent?: string;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  copyUrl?: string;
}

type ResourceActionData = {
  ok?: boolean;
  intent?: string;
  resourceType?: "media" | "project" | "album" | "projects" | "albums";
  id?: string;
  access?: ItemAccessMemberDto[];
  projectId?: string;
  projectHref?: string;
  error?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

const menuItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:text-on-surface-variant/45 disabled:hover:bg-transparent";
const dangerMenuItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-label-md font-medium text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:text-error/40 disabled:hover:bg-transparent";
const detailRowClass = "flex items-start justify-between gap-4 border-b border-outline-variant/70 py-2 last:border-b-0";
const viewportMargin = 8;
const menuGap = 6;
const fallbackMenuWidth = 224;
const fallbackMenuHeight = 320;

export function AssetCardContextMenu({
  media,
  workspaceKind,
  canMoveToRecycleBin = true,
  canManageAccess = false,
  placement = "bottom",
  buttonClassName = "",
  menuClassName = "",
  defaultDetailsOpen = false,
  resourceType = "media",
  deleteIntent = "delete",
  deleteConfirmTitle = "Move to Recycle Bin",
  deleteConfirmMessage,
  copyUrl,
}: AssetCardContextMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const projectFetcher = useFetcher<ResourceActionData>();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const download = useMemo(() => bestDownloadSource(media), [media]);
  const pageLink = useMemo(() => buildAssetDeepLink(location.pathname, location.search, media.id), [location.pathname, location.search, media.id]);
  const projectAction = useMemo(() => projectActionForPath(location.pathname, workspaceKind), [location.pathname, workspaceKind]);
  const studioId = workspaceKind === "studio" ? studioIdFromPath(location.pathname) : null;
  const isCreatingProject = projectFetcher.state !== "idle";

  useEffect(() => {
    if (
      projectFetcher.data?.ok &&
      projectFetcher.data.intent === "create-project-from-media" &&
      projectFetcher.data.projectHref
    ) {
      setOpen(false);
      void navigate(projectFetcher.data.projectHref);
    }
  }, [navigate, projectFetcher.data]);

  const updateMenuPosition = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const menuRect = menuRef.current?.getBoundingClientRect();
    const menuWidth = menuRect?.width || fallbackMenuWidth;
    const menuHeight = menuRect?.height || fallbackMenuHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const hasRoomRight = rect.left + menuWidth <= viewportWidth - viewportMargin;
    const preferredLeft = hasRoomRight ? rect.left : rect.right - menuWidth;
    const left = clamp(preferredLeft, viewportMargin, Math.max(viewportMargin, viewportWidth - viewportMargin - menuWidth));

    const spaceBelow = viewportHeight - rect.bottom - menuGap - viewportMargin;
    const spaceAbove = rect.top - menuGap - viewportMargin;
    const openBelow = placement === "bottom"
      ? spaceBelow >= Math.min(menuHeight, 220) || spaceBelow >= spaceAbove
      : !(spaceAbove >= Math.min(menuHeight, 220) || spaceAbove >= spaceBelow);
    const availableHeight = Math.max(160, openBelow ? spaceBelow : spaceAbove);
    const top = openBelow
      ? Math.min(rect.bottom + menuGap, viewportHeight - viewportMargin - Math.min(menuHeight, availableHeight))
      : Math.max(viewportMargin, rect.top - menuGap - Math.min(menuHeight, availableHeight));

    setMenuPosition({ top, left, maxHeight: availableHeight });
  };

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, placement]);

  useEffect(() => {
    if (defaultDetailsOpen) setDetailsOpen(true);
  }, [defaultDetailsOpen, media.id]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyLink = async () => {
    const absoluteUrl = copyUrl
      ? (copyUrl.startsWith("http") ? copyUrl : new URL(copyUrl, window.location.origin).toString())
      : new URL(pageLink, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const closeMenu = () => setOpen(false);

  const openInNewProject = (projectKind: number) => {
    if (!projectAction || isCreatingProject) return;
    const formData = new FormData();
    formData.set("intent", "create-project-from-media");
    formData.set("resourceType", "media");
    formData.set("id", media.id);
    formData.set("projectKind", String(projectKind));
    if (studioId) formData.set("studioId", studioId);
    void projectFetcher.submit(formData, { method: "post", action: projectAction });
  };

  return (
    <>
      <div ref={ref} className="relative inline-flex" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Open actions for ${media.filename}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low/85 text-on-surface-variant shadow-sm backdrop-blur transition-colors hover:bg-surface-container-high hover:text-on-surface ${buttonClassName}`}
        >
          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
        </button>

        {open && menuPosition && createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              maxHeight: menuPosition.maxHeight,
            }}
            className={`z-[80] min-w-56 overflow-y-auto overflow-x-hidden rounded-xl border border-outline-variant bg-surface-container-low py-1 shadow-xl ${menuClassName}`}
          >
            {/* Open in New Project */}
            {resourceType === "media" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!projectAction || isCreatingProject}
                  onClick={() => openInNewProject(ProjectKind.Video)}
                  className={menuItemClass}
                >
                  <span className="material-symbols-outlined text-[18px]">video_call</span>
                  {isCreatingProject ? "Creating Project..." : "Open in New Video Project"}
                </button>
                {media.kind === MediaKind.Image ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!projectAction || isCreatingProject}
                    onClick={() => openInNewProject(ProjectKind.Image)}
                    className={menuItemClass}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    Open in New Image Project
                  </button>
                ) : null}
                {projectFetcher.data?.error ? (
                  <p className="px-3 py-2 text-label-sm text-error" role="alert">
                    {projectFetcher.data.error}
                  </p>
                ) : null}
              </>
            ) : (copyUrl ? (
              <a
                role="menuitem"
                href={copyUrl}
                target="_blank"
                rel="noreferrer"
                onClick={closeMenu}
                className={menuItemClass}
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Open in New Tab
              </a>
            ) : null)}

            {/* Asset Details */}
            {resourceType === "media" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setDetailsOpen(true);
                }}
                className={menuItemClass}
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
                Asset Details
              </button>
            )}

            {/* Download */}
            {resourceType === "media" && (
              <a
                role="menuitem"
                href={download?.href ?? undefined}
                download={media.filename}
                aria-disabled={!download}
                onClick={(event) => {
                  if (!download) {
                    event.preventDefault();
                    return;
                  }
                  closeMenu();
                }}
                className={`${menuItemClass} ${download ? "" : "pointer-events-none text-on-surface-variant/45"}`}
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download
              </a>
            )}

            {/* Copy Link */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                void copyLink();
              }}
              className={menuItemClass}
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              {copyState === "copied" ? "Link Copied" : copyState === "failed" ? "Copy Failed" : "Copy Link"}
            </button>

            {/* Manage Access / Share */}
            {workspaceKind === "studio" ? (
              <button
                type="button"
                role="menuitem"
                disabled={!canManageAccess}
                title={canManageAccess ? undefined : "Only Studio owners and admins can manage access"}
                onClick={() => {
                  closeMenu();
                  setAccessOpen(true);
                }}
                className={menuItemClass}
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                Manage Access
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShareOpen(true);
                }}
                className={menuItemClass}
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
                Share
              </button>
            )}

            <div className="my-1 border-t border-outline-variant" />
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveToRecycleBin}
              title={canMoveToRecycleBin ? undefined : "You do not have permission to perform this action"}
              onClick={() => {
                closeMenu();
                setConfirmOpen(true);
              }}
              className={dangerMenuItemClass}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              {deleteConfirmTitle}
            </button>
          </div>,
          document.body,
        )}
      </div>

      {detailsOpen && (
        <AssetDetailsModal media={media} downloadVariant={download?.variant ?? null} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
      )}
      {confirmOpen && (
        <MoveToRecycleBinModal
          media={media}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          resourceType={resourceType}
          deleteIntent={deleteIntent}
          confirmTitle={deleteConfirmTitle}
          confirmMessage={deleteConfirmMessage}
        />
      )}
      {accessOpen && workspaceKind === "studio" && (
        <MediaAccessModal
          mediaId={media.id}
          open={accessOpen}
          onClose={() => setAccessOpen(false)}
          canManageAccess={canManageAccess}
          resourceType={resourceType === "projects" ? "project" : resourceType === "albums" ? "album" : (resourceType as "media" | "project" | "album")}
        />
      )}
      {shareOpen && workspaceKind === "personal" && (
        <ShareModal
          resourceId={media.id}
          resourceType={resourceType === "projects" ? "project" : resourceType === "albums" ? "album" : (resourceType as "media" | "project" | "album")}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

function AssetDetailsModal({
  media,
  downloadVariant,
  open,
  onClose,
}: {
  media: MediaDto;
  downloadVariant: MediaObjectVariant | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Asset details">
      <div className="space-y-1 text-body-sm">
        <DetailRow label="Filename" value={media.filename} />
        <DetailRow label="Type" value={mediaKindLabel(media.kind)} />
        <DetailRow label="Status" value={media.status || media.pipeline?.label || "Unknown"} />
        <DetailRow label="Owner" value={media.ownerDisplayName || media.ownerEmail || "Current workspace"} />
        <DetailRow label="Size" value={formatSize(media.sizeBytes)} />
        <DetailRow label="Dimensions" value={formatDimensions(media)} />
        <DetailRow label="Duration" value={formatDuration(media.durationSeconds)} />
        <DetailRow label="Created" value={formatDate(media.createdAt)} />
        <DetailRow label="Download object" value={downloadVariant ? objectVariantLabel(downloadVariant) : "Unavailable"} />
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={detailRowClass}>
      <span className="shrink-0 text-label-md font-medium text-on-surface-variant">{label}</span>
      <span className="min-w-0 break-words text-right text-label-md text-on-surface">{value}</span>
    </div>
  );
}
function MoveToRecycleBinModal({
  media,
  open,
  onClose,
  resourceType = "media",
  deleteIntent = "delete",
  confirmTitle = "Move to Recycle Bin",
  confirmMessage,
}: {
  media: MediaDto;
  open: boolean;
  onClose: () => void;
  resourceType?: string;
  deleteIntent?: string;
  confirmTitle?: string;
  confirmMessage?: string;
}) {
  const message = confirmMessage || `Move ${media.filename} to Recycle Bin?`;
  return (
    <Modal open={open} onClose={onClose} title={confirmTitle}>
      <div className="text-body-sm text-on-surface-variant">
        {message}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface">
          Cancel
        </button>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value={deleteIntent} />
          <input type="hidden" name="resourceType" value={resourceType} />
          <input type="hidden" name="id" value={media.id} />
          <button type="submit" className={primaryButtonClass("!bg-error !text-on-error hover:!bg-error/90")}>
            {confirmTitle}
          </button>
        </Form>
      </div>
    </Modal>
  );
}

function MediaAccessModal({
  mediaId,
  open,
  onClose,
  canManageAccess,
  resourceType = "media",
}: {
  mediaId: string;
  open: boolean;
  onClose: () => void;
  canManageAccess: boolean;
  resourceType?: "media" | "project" | "album";
}) {
  const fetcher = useFetcher<ResourceActionData>();
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
    formData.set("id", mediaId);
    fetcher.submit(formData, { method: "post" });
  }, [open, mediaId, resourceType]);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.id === mediaId &&
      (actionData.intent === "load-resource-access" || actionData.intent === "update-resource-access") &&
      actionData.access
    ) {
      setRows(actionData.access);
    }
  }, [actionData, mediaId]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName)), [rows]);

  return (
    <Modal open={open} onClose={onClose} title="Studio access">
      <div className="space-y-4">
        {isLoading && rows.length === 0 ? (
          <p className="rounded-lg bg-surface-container-high px-3 py-3 text-body-sm text-on-surface-variant">Loading Studio members...</p>
        ) : null}
        {actionData?.error ? <p className="rounded-lg bg-error-container px-3 py-2 text-label-md text-on-error-container">{actionData.error}</p> : null}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {sortedRows.map((row) => (
            <AccessRow
              key={row.userId}
              row={row}
              mediaId={mediaId}
              canManageAccess={canManageAccess}
              isSubmitting={fetcher.state !== "idle" && pendingUserId === row.userId}
              fetcher={fetcher}
              resourceType={resourceType}
            />
          ))}
        </div>
        {!isLoading && sortedRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant px-3 py-6 text-center text-body-sm text-on-surface-variant">No Studio members found.</p>
        ) : null}
      </div>
    </Modal>
  );
}

function AccessRow({
  row,
  mediaId,
  canManageAccess,
  isSubmitting,
  fetcher,
  resourceType,
}: {
  row: ItemAccessMemberDto;
  mediaId: string;
  canManageAccess: boolean;
  isSubmitting: boolean;
  fetcher: ReturnType<typeof useFetcher<ResourceActionData>>;
  resourceType: "media" | "project" | "album";
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
          <p className="truncate text-body-sm font-bold text-on-surface" title={label}>{label}</p>
          <p className="truncate text-label-sm text-on-surface-variant" title={row.email}>{row.email}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">{row.studioRole}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <p className="text-label-sm text-on-surface-variant">Effective: {row.isHidden ? "Hidden" : sharedRoleLabel(row.effectiveRole)}</p>
          {canEditRow ? (
            <fetcher.Form method="post" className="flex gap-2">
              <input type="hidden" name="intent" value="update-resource-access" />
              <input type="hidden" name="resourceType" value={resourceType} />
              <input type="hidden" name="id" value={mediaId} />
              <input type="hidden" name="userId" value={row.userId} />
              <select name="role" defaultValue={roleValue} className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1.5 text-label-md text-on-surface outline-none focus:border-primary">
                <option value={Permission.Viewer}>Viewer</option>
                <option value={Permission.Editor}>Editor</option>
                <option value="hidden">Hidden</option>
              </select>
              <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-3 py-1.5 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60">
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </fetcher.Form>
          ) : (
            <p className="text-label-sm text-outline">{row.canManage ? "Access controls unavailable." : "Managed by Studio role."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareModal({
  resourceId,
  resourceType,
  open,
  onClose,
}: {
  resourceId: string;
  resourceType: string;
  open: boolean;
  onClose: () => void;
}) {
  const fetcher = useFetcher<ResourceActionData>();
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
      onClose();
      setRecipients([]);
      setDraft("");
      setInputError(null);
    }
  }, [actionData, resourceId, onClose]);

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
    <Modal open={open} onClose={onClose} title="Share item">
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
            onClick={onClose}
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
  );
}

function parseEmailTokens(value: string): { valid: string[]; invalid: string[] } {
  const tokens = value
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    if (emailPattern.test(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

function mergeEmails(current: string[], incoming: string[]): string[] {
  return Array.from(new Set([...current, ...incoming]));
}

function bestDownloadSource(media: MediaDto): { href: string; variant: MediaObjectVariant } | null {
  const candidates: MediaObjectVariant[] = media.kind === MediaKind.Video ? ["canonical", "proxy", "raw"] : ["canonical", "raw", "thumbnail"];
  for (const variant of candidates) {
    const key = storageKeyForVariant(media, variant);
    if (key) return { href: mediaObjectUrl(media.id, variant, key), variant };
  }
  return null;
}

function storageKeyForVariant(media: MediaDto, variant: MediaObjectVariant): string | null {
  if (variant === "thumbnail") return media.thumbnailStorageKey || null;
  if (variant === "canonical") return media.canonicalStorageKey || null;
  if (variant === "proxy") return media.proxyStorageKey || null;
  return media.storageKey || null;
}

function buildAssetDeepLink(pathname: string, search: string, mediaId: string) {
  const params = new URLSearchParams(search);
  params.set("asset", mediaId);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

function projectActionForPath(pathname: string, workspaceKind: "personal" | "studio"): string | null {
  if (workspaceKind === "personal") return "/dashboard/projects";
  const studioId = studioIdFromPath(pathname);
  return studioId ? `/teams/${encodeURIComponent(studioId)}/projects` : null;
}

function studioIdFromPath(pathname: string): string | null {
  const match = /^\/teams\/([^/]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

function formatSize(value: MediaDto["sizeBytes"]): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Pending";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDimensions(media: MediaDto): string {
  if (!media.width || !media.height) return "Unavailable";
  return `${media.width} x ${media.height}`;
}

function formatDuration(value: MediaDto["durationSeconds"]): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Unavailable";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function objectVariantLabel(value: MediaObjectVariant): string {
  if (value === "canonical") return "Canonical";
  if (value === "proxy") return "Proxy";
  if (value === "thumbnail") return "Thumbnail";
  return "Raw";
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
