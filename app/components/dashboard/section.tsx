import type { ReactNode } from "react";

/** Section title + optional subtitle and a right-aligned action slot. */
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

/** RFC 7807-friendly error banner. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-on-error-container">
      <span className="material-symbols-outlined text-[20px]">error</span>
      <p className="text-body-sm">{message}</p>
    </div>
  );
}

/** Centered empty-state for a section with no items. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant">{icon}</span>
      <p className="mt-3 text-body-lg text-on-surface">{title}</p>
      {hint && <p className="mt-1 text-body-sm text-on-surface-variant">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Pulsing placeholder grid shown while a section is (re)loading. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-xl border border-outline-variant bg-surface-container-low"
        />
      ))}
    </div>
  );
}

/** Small rounded label (kind / role / status). */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm uppercase tracking-wide text-on-surface-variant">
      {children}
    </span>
  );
}

/** Primary pill button used for section actions (matches auth/onboarding styling). */
export function primaryButtonClass(extra = ""): string {
  return `inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60 ${extra}`;
}

/** Centered modal dialog with a click-away backdrop. Render only when `open`. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-outline-variant bg-surface-container p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
