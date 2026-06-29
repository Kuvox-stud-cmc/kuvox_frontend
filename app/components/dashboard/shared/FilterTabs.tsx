type FilterItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon?: string;
};

interface FilterTabsProps<T extends string> {
  items: FilterItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: "pill" | "underline" | "boxed";
}

export function FilterTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
  variant = "pill",
}: FilterTabsProps<T>) {
  if (variant === "underline") {
    return (
      <div className={`flex items-center gap-6 overflow-x-auto border-b border-outline-variant ${className}`}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`whitespace-nowrap border-b-2 pb-3 text-body-sm font-medium transition-colors ${
              value === item.value
                ? "border-primary font-bold text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div className={`flex gap-3 overflow-x-auto pb-2 ${className}`}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium transition-colors ${
              value === item.value
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
            }`}
          >
            {item.icon && (
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-label-md font-medium transition-colors ${
            value === item.value
              ? "bg-primary font-bold text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          {item.label}
          {item.count != null && (
            <span
              className={`rounded-lg px-2 py-0.5 text-label-sm ${
                value === item.value
                  ? "bg-on-primary/20 text-on-primary"
                  : "bg-surface-container-highest text-on-surface-variant"
              }`}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
