import type { MouseEventHandler } from "react";
import { Link } from "react-router";

interface QuickActionCardProps {
  icon: string;
  title: string;
  description?: string;
  to?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "default" | "dashed" | "compact";
  className?: string;
}

const VARIANT_CLASS = {
  default:
    "items-start border-outline-variant/10 bg-surface-container-high p-4 text-left hover:border-primary/50",
  dashed:
    "items-center justify-center border-dashed border-outline-variant bg-surface-container-low p-6 text-center hover:border-primary/40 hover:bg-surface-container",
  compact:
    "items-center justify-center border-outline-variant bg-surface-container p-4 text-center hover:bg-surface-container-high",
} as const;

export function QuickActionCard({
  icon,
  title,
  description,
  to,
  onClick,
  variant = "default",
  className = "",
}: QuickActionCardProps) {
  const content = (
    <>
      <div
        className={
          variant === "compact"
            ? "mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary transition-transform group-hover:scale-110"
            : "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110"
        }
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div>
        <p
          className={
            variant === "compact"
              ? "text-label-sm font-bold text-on-surface-variant"
              : "text-body-sm font-bold text-on-surface"
          }
        >
          {title}
        </p>
        {description && (
          <p className="mt-1 text-label-sm text-outline">{description}</p>
        )}
      </div>
    </>
  );

  const classes = `group flex flex-col gap-3 rounded-xl border transition-all ${VARIANT_CLASS[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
