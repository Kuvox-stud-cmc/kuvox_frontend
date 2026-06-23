import type { ReactNode } from "react";

const TONE_MAP = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  tertiary: "bg-tertiary/10 text-tertiary",
  error: "bg-error/10 text-error",
} as const;

type Tone = keyof typeof TONE_MAP;

interface MetricCardProps {
  /** Material Symbols icon name. */
  icon: string;
  /** Short descriptive label. */
  label: string;
  /** Main numeric or string value. */
  value: string | number;
  /** Color tone for the icon badge. @default "primary" */
  tone?: Tone;
  /** Secondary detail text below the value. */
  detail?: string;
  /** Inline suffix shown right after the value (e.g. "GB", "h"). */
  suffix?: string;
  /** Trend percentage. When set, shows an up-arrow with the percentage. */
  trend?: number;
  /** Optional custom content rendered in the bottom-right area (e.g. ProgressRing). */
  children?: ReactNode;
}

export function MetricCard({
  icon,
  label,
  value,
  tone = "primary",
  detail,
  suffix,
  trend,
  children,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE_MAP[tone]}`}
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <span className="text-label-md font-medium text-on-surface-variant">{label}</span>
        </div>
        {children && <div>{children}</div>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-headline-md font-bold text-on-surface">{value}</span>
            {suffix && (
              <span className="text-label-sm text-on-surface-variant">{suffix}</span>
            )}
          </div>
          {detail && (
            <p className="mt-1 text-label-sm text-on-surface-variant">{detail}</p>
          )}
        </div>
        {trend != null && (
          <span className="inline-flex items-center gap-1 text-label-sm font-bold text-secondary">
            <span className="material-symbols-outlined text-[12px]">trending_up</span>
            {trend}%{" "}
            <span className="font-normal text-on-surface-variant">vs last month</span>
          </span>
        )}
      </div>
    </div>
  );
}
