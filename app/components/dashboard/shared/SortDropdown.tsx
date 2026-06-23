interface SortOption {
  label: string;
  value: string;
}

interface SortDropdownProps {
  /** Currently selected sort value. */
  value: string;
  /** Called when the user selects a new sort option. */
  onChange: (value: string) => void;
  /** Available sort options. */
  options: SortOption[];
  /** Label shown above the dropdown. @default "Sort by" */
  label?: string;
}

/** Labelled sort dropdown matching the dashboard design system. */
export function SortDropdown({
  value,
  onChange,
  options,
  label = "Sort by",
}: SortDropdownProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none transition-colors hover:border-primary/40 focus:border-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
