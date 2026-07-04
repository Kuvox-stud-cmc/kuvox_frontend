import { useFetcher } from "react-router";

interface IconToggleButtonProps {
  id: string;
  active: boolean;
  intent: string;
  field?: string;
  activeIcon: string;
  inactiveIcon: string;
  activeClassName: string;
  inactiveClassName?: string;
  label: string;
  className?: string;
}

export function IconToggleButton({
  id,
  active,
  intent,
  field = "value",
  activeIcon,
  inactiveIcon,
  activeClassName,
  inactiveClassName = "text-on-surface-variant hover:text-on-surface",
  label,
  className = "",
}: IconToggleButtonProps) {
  const fetcher = useFetcher();
  const submittedValue = fetcher.formData?.get(field);
  const optimisticActive =
    typeof submittedValue === "string" ? submittedValue === "true" : active;
  const nextValue = !optimisticActive;
  const variant = activeIcon === "star" || inactiveIcon === "star_border" ? "star" : "heart";

  return (
    <fetcher.Form method="post" onClick={(event) => event.stopPropagation()}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={field} value={String(nextValue)} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          optimisticActive ? activeClassName : inactiveClassName
        } ${className}`}
      >
        <ToggleIcon variant={variant} active={optimisticActive} />
      </button>
    </fetcher.Form>
  );
}

function ToggleIcon({ variant, active }: { variant: "heart" | "star"; active: boolean }) {
  if (variant === "star") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.9 14.9 8.8 21.4 9.7 16.7 14.3 17.8 20.8 12 17.7 6.2 20.8 7.3 14.3 2.6 9.7 9.1 8.8 12 2.9Z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 5.6c-2-2.1-5.3-2.1-7.3 0L12 7.1l-1.5-1.5c-2-2.1-5.3-2.1-7.3 0-2.1 2.2-2.1 5.7 0 7.8L12 22l8.8-8.6c2.1-2.1 2.1-5.6 0-7.8Z" />
    </svg>
  );
}
