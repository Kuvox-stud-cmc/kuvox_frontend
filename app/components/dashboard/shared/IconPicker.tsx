import { useState } from "react";

const COMMON_ICONS = [
  "folder", "image", "movie", "audiotrack", "favorite", 
  "star", "work", "landscape", "flight_takeoff", "eco",
  "pets", "sports_esports", "restaurant", "celebration", "school",
  "home", "event", "group", "shopping_bag", "lightbulb"
];

interface IconPickerProps {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  className?: string;
}

export function IconPicker({ name, label, defaultValue = "folder", error, className = "" }: IconPickerProps) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className={className}>
      <label className="block text-label-md text-on-surface-variant mb-2">{label}</label>
      <input type="hidden" name={name} value={selected} />
      
      <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
        {COMMON_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => setSelected(icon)}
            className={`flex aspect-square items-center justify-center rounded-xl transition-all ${
              selected === icon
                ? "bg-primary-container text-on-primary-container border-2 border-primary"
                : "bg-surface-container-high text-on-surface-variant border border-transparent hover:bg-surface-bright"
            }`}
            title={icon}
          >
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-label-sm text-error">{error}</p>}
    </div>
  );
}
