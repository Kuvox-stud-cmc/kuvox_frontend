import { useEffect, useRef, useState } from "react";

import { ConfirmSubmitButton } from "~/components/dashboard/section";

interface CardOverflowMenuProps {
  id: string;
  itemLabel: string;
  intent?: string;
  confirmMessage?: string;
  buttonClassName?: string;
  menuClassName?: string;
  placement?: "bottom" | "top";
}

export function CardOverflowMenu({
  id,
  itemLabel,
  intent = "delete",
  confirmMessage = "Move this item to trash?",
  buttonClassName = "",
  menuClassName = "",
  placement = "bottom",
}: CardOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
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

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-20 min-w-36 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low py-1 shadow-xl ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } ${menuClassName}`}
        >
          <ConfirmSubmitButton
            fields={{ intent, id }}
            title="Confirm delete"
            message={confirmMessage}
            confirmLabel="Delete"
            ariaLabel={`Delete ${itemLabel}`}
            buttonClassName="flex w-full items-center gap-2 px-3 py-2 text-left text-label-md font-medium text-error transition-colors hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </ConfirmSubmitButton>
        </div>
      )}
    </div>
  );
}
