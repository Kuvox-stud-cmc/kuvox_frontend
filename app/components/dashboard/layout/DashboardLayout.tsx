import { CARD_GRADIENTS } from "~/components/dashboard/constants/dashboard.constants";

interface GradientPlaceholderProps {
  /** Index used to cycle through gradient presets. */
  index: number;
  /** Material Symbols icon shown in the center. @default "image" */
  icon?: string;
  /** Icon font-size class. @default "text-[40px]" */
  iconSize?: string;
}

/**
 * Gradient background placeholder for cards that lack a real thumbnail.
 * Automatically cycles through `CARD_GRADIENTS` by index.
 */
export function GradientPlaceholder({
  index,
  icon = "image",
  iconSize = "text-[40px]",
}: GradientPlaceholderProps) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]}`}
    >
      <span
        className={`material-symbols-outlined ${iconSize} text-on-surface-variant/20`}
      >
        {icon}
      </span>
    </div>
  );
}

interface FilterButtonProps {
  /** Click handler. */
  onClick?: () => void;
  /** Button label. @default "Filter" */
  label?: string;
}

/** Standard filter button with a filter_list icon. */
export function FilterButton({ onClick, label = "Filter" }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
    >
      <span className="material-symbols-outlined text-[18px]">filter_list</span>
      {label}
    </button>
  );
}

interface StatusDotBadgeProps {
  /** Badge label text. */
  label: string;
  /** Color tone. @default "primary" */
  tone?: "primary" | "secondary" | "tertiary" | "error";
}

const STATUS_TONE_MAP = {
  primary: "bg-primary/20 text-primary",
  secondary: "bg-secondary/20 text-secondary",
  tertiary: "bg-tertiary/20 text-tertiary",
  error: "bg-error/20 text-error",
} as const;

const DOT_TONE_MAP = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
} as const;

/** Small pill badge with a colored dot indicator. */
export function StatusDotBadge({
  label,
  tone = "primary",
}: StatusDotBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold backdrop-blur-md ${STATUS_TONE_MAP[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE_MAP[tone]}`} />
      {label}
    </span>
  );
}
