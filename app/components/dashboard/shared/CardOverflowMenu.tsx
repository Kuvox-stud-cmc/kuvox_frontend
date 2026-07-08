import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Form } from "react-router";

import { Modal, primaryButtonClass } from "~/components/dashboard/section";

interface CardOverflowMenuProps {
  id: string;
  itemLabel: string;
  intent?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  buttonClassName?: string;
  menuClassName?: string;
  placement?: "bottom" | "top";
}

export function CardOverflowMenu({
  id,
  itemLabel,
  intent = "delete",
  confirmTitle = "Move to Recycle Bin",
  confirmMessage = "Move this item to Recycle Bin?",
  confirmLabel = "Move to Recycle Bin",
  buttonClassName = "",
  menuClassName = "",
  placement = "bottom",
}: CardOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hiddenFields = Object.entries({ intent, id }).filter(([, value]) => value !== undefined && value !== null);

  const updateMenuPosition = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPosition({
      top: placement === "top" ? rect.top - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, placement]);

  return (
    <>
      <div
        ref={ref}
        className="relative inline-flex"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Open actions for ${itemLabel}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className={`shrink-0 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface ${buttonClassName}`}
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
              right: menuPosition.right,
              transform: placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className={`z-50 min-w-36 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low py-1 shadow-xl ${menuClassName}`}
          >
            <button
              type="button"
              aria-label={`Move ${itemLabel} to Recycle Bin`}
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-label-md font-medium text-error transition-colors hover:bg-error/10"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Delete
            </button>
          </div>,
          document.body,
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={confirmTitle}>
        <div className="text-body-sm text-on-surface-variant">{confirmMessage}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
          <Form method="post" onSubmit={() => setConfirmOpen(false)}>
            {hiddenFields.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={String(value)} />
            ))}
            <button
              type="submit"
              className={primaryButtonClass("!bg-error !text-on-error hover:!bg-error/90")}
            >
              {confirmLabel}
            </button>
          </Form>
        </div>
      </Modal>
    </>
  );
}
