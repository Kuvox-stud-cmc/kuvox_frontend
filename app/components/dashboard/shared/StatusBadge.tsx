type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-secondary/20 text-secondary",
  warning: "bg-tertiary/20 text-tertiary",
  danger: "bg-error/20 text-error",
  info: "bg-primary/20 text-primary",
  neutral: "bg-surface-container text-on-surface-variant",
  primary: "bg-primary/20 text-primary",
};

const DOT_CLASS: Record<StatusTone, string> = {
  success: "bg-secondary",
  warning: "bg-tertiary",
  danger: "bg-error",
  info: "bg-primary",
  neutral: "bg-outline",
  primary: "bg-primary",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  pulse?: boolean;
  dotPosition?: "start" | "end";
  className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
  pulse = false,
  dotPosition = "start",
  className = "",
}: StatusBadgeProps) {
  const dotElement = dot ? (
    <span
      className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]} ${pulse ? "animate-pulse" : ""}`}
    />
  ) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label-sm font-bold backdrop-blur-md ${TONE_CLASS[tone]} ${className}`}
    >
      {dotPosition === "start" && dotElement}
      {label}
      {dotPosition === "end" && dotElement}
    </span>
  );
}
