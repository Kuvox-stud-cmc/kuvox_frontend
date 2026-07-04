import type { ReactNode } from "react";

export const primarySettingsButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary shadow-[0_10px_24px_rgba(192,193,255,0.14)] transition-colors hover:bg-primary-fixed disabled:opacity-60";

export const secondarySettingsButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-label-md font-semibold text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-on-surface disabled:opacity-60";

export function SettingsHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="rounded-xl border border-outline-variant bg-surface-container-low px-5 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
          <span className="material-symbols-outlined text-[14px]">settings</span>
          Settings
        </p>
        <h1 className="mt-2 text-headline-lg font-bold text-on-surface">{title}</h1>
        <p className="mt-2 max-w-2xl text-body-sm text-on-surface-variant">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </header>
  );
}

export function SettingsPanel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-[0_16px_42px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest/35 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-headline-md font-semibold text-on-surface">{title}</h2>
          {description ? (
            <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SettingsNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-primary/30 bg-primary/10 text-primary",
    success: "border-secondary/30 bg-secondary/10 text-secondary",
    warning: "border-tertiary/30 bg-tertiary/10 text-tertiary",
    error: "border-error/30 bg-error/10 text-error",
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-body-sm shadow-[0_10px_30px_rgba(0,0,0,0.08)] ${toneClass}`}>
      <span className="material-symbols-outlined mt-0.5 text-[18px]">
        {tone === "error" ? "error" : tone === "warning" ? "warning" : "info"}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function SettingsTextField({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required = false,
  readOnly = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-md font-medium text-on-surface-variant">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2.5 text-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary read-only:cursor-not-allowed read-only:text-on-surface-variant"
      />
    </label>
  );
}

export function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container p-4 transition-colors hover:border-primary/35 hover:bg-surface-container-high">
      <span>
        <span className="block text-body-sm font-semibold text-on-surface">{label}</span>
        <span className="mt-1 block text-label-md text-on-surface-variant">{description}</span>
      </span>
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="h-5 w-5 shrink-0 accent-primary"
      />
    </label>
  );
}

export function StatTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-[0_14px_36px_rgba(0,0,0,0.1)] transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-md font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {label}
          </p>
          <p className="mt-2 text-headline-md font-bold text-on-surface">{value}</p>
          {detail ? <p className="mt-1 text-label-md text-on-surface-variant">{detail}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(0)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
