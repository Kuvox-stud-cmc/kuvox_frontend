type ViewMode = "grid" | "list";

interface ViewToggleProps {
  /** Currently active view mode. */
  mode: ViewMode;
  /** Called when the user clicks a view button. */
  onChange: (mode: ViewMode) => void;
  /** Label shown above the toggle. @default "View" */
  label?: string;
}

/** Grid/List view toggle matching the dashboard design system. */
export function ViewToggle({ mode, onChange, label = "View" }: ViewToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Grid view"
          onClick={() => onChange("grid")}
          className={`rounded-md p-1.5 transition-colors ${
            mode === "grid"
              ? "bg-primary/20 text-primary"
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
        </button>
        <button
          type="button"
          aria-label="List view"
          onClick={() => onChange("list")}
          className={`rounded-md p-1.5 transition-colors ${
            mode === "list"
              ? "bg-primary/20 text-primary"
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">view_list</span>
        </button>
      </div>
    </div>
  );
}
