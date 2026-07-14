type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/20 text-danger",
  info: "bg-info/20 text-info",
  neutral: "bg-surface-container text-on-surface-variant",
  primary: "bg-primary/20 text-primary",
};

const DOT_CLASS: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
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
