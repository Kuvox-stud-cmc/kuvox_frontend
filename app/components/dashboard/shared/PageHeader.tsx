import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Page title rendered as h1. */
  title: string;
  /** Short description rendered below the title. */
  subtitle?: string;
  /** Toolbar controls (view toggle, sort, filter, CTA) rendered on the right. */
  children?: ReactNode;
}

/**
 * Standard dashboard page header.
 * Stacks vertically on mobile, aligns side-by-side on lg+.
 */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-end gap-4">{children}</div>
      )}
    </div>
  );
}
