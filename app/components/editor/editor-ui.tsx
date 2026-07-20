import type { ReactNode } from "react";

interface EditorIconProps {
  children: string;
  className?: string;
  filled?: boolean;
}

export function EditorIcon({ children, className = "", filled = false }: EditorIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
    >
      {children}
    </span>
  );
}

interface EditorIconButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  filled?: boolean;
  className?: string;
  iconClassName?: string;
  onClick?: () => void;
}

export function EditorIconButton({
  icon,
  label,
  active = false,
  disabled = false,
  filled = false,
  className = "",
  iconClassName = "",
  onClick,
}: EditorIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[4px] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none ${
        active
          ? "border border-primary/35 bg-surface-container-high text-primary shadow-[inset_0_0_0_1px_rgba(192,193,255,0.08)]"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      } ${className}`}
    >
      <EditorIcon className={`text-[20px] ${iconClassName}`} filled={filled}>
        {icon}
      </EditorIcon>
    </button>
  );
}

interface PanelHeaderProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function PanelHeader({ title, eyebrow, action, compact = false }: PanelHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-outline-variant ${
        compact ? "h-12 px-2" : "h-14 px-3"
      }`}
    >
      <div className="min-w-0 flex-1">
        {compact ? (
          <div className="flex min-w-0 items-baseline">
            <h2 className="truncate text-label-md font-semibold uppercase tracking-[0.05em] text-on-surface">
              {title}
            </h2>
          </div>
        ) : (
          <>
            <h2 className="truncate text-label-md font-semibold uppercase tracking-[0.05em] text-on-surface">
              {title}
            </h2>
            {eyebrow ? (
              <p className="mt-0.5 truncate text-label-sm uppercase text-on-surface-variant">
                {eyebrow}
              </p>
            ) : null}
          </>
        )}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
