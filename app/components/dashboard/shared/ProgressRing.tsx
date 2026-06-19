const TONE_CLASS = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
} as const;

interface ProgressRingProps {
  /** Percentage complete (0–100). */
  progress: number;
  /** Outer dimension in pixels. @default 44 */
  size?: number;
  /** Ring stroke width in pixels. @default 3 */
  strokeWidth?: number;
  /** Color tone for the filled arc. @default "primary" */
  tone?: keyof typeof TONE_CLASS;
}

/** SVG circular progress indicator used in metric cards. */
export function ProgressRing({
  progress,
  size = 44,
  strokeWidth = 3,
  tone = "primary",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={TONE_CLASS[tone]}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "stroke-dashoffset 0.35s ease",
          }}
        />
      </svg>
      <span className="absolute text-label-sm font-bold text-on-surface">
        {progress}%
      </span>
    </div>
  );
}
