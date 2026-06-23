import type { ReactNode } from "react";
import { Link } from "react-router";

interface SectionHeaderProps {
  /** Section title rendered as h2. */
  title: string;
  /** Optional item count displayed next to the title. */
  count?: number | string;
  /** Label for the right-side action link/button. @default "View All" */
  actionLabel?: string;
  /** When provided, renders a react-router Link with an arrow. */
  actionTo?: string;
  /** When provided (and `actionTo` is omitted), renders a button. */
  actionOnClick?: () => void;
  /** Custom content for the right side instead of the default action. */
  children?: ReactNode;
}

/**
 * Standard content-section header used throughout dashboard pages.
 *
 * ```tsx
 * <SectionHeader title="Recent Photos" actionLabel="View All" />
 * ```
 */
export function SectionHeader({
  title,
  count,
  actionLabel = "View All",
  actionTo,
  actionOnClick,
  children,
}: SectionHeaderProps) {
  const hasAction = actionTo || actionOnClick;

  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-headline-md font-bold text-on-surface">{title}</h2>
        {count != null && (
          <span className="text-label-md text-on-surface-variant">{count}</span>
        )}
      </div>

      {children ??
        (hasAction && (
          actionTo ? (
            <Link
              to={actionTo}
              className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
            >
              {actionLabel}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={actionOnClick}
              className="flex items-center gap-1 text-label-md font-medium text-primary transition-colors hover:text-primary-fixed"
            >
              {actionLabel}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          )
        ))}
    </div>
  );
}
