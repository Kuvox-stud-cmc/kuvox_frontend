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
  onClick?: () => void;
}

export function EditorIconButton({
  icon,
  label,
  active = false,
  disabled = false,
  filled = false,
  className = "",
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
      <EditorIcon className="text-[20px]" filled={filled}>
        {icon}
      </EditorIcon>
    </button>
  );
}

interface PanelHeaderProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function PanelHeader({ title, eyebrow, action }: PanelHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-outline-variant px-3">
      <div>
        <h2 className="text-label-md font-semibold uppercase tracking-[0.05em] text-on-surface">
          {title}
        </h2>
        {eyebrow ? (
          <p className="mt-0.5 text-label-sm uppercase tracking-wide text-on-surface-variant">
            {eyebrow}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
