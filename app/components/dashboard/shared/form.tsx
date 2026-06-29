import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className = "", id, ...props }: TextFieldProps) {
  const inputId = id || props.name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-label-md text-on-surface-variant mb-1">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:outline-none transition-colors ${
          error ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-label-sm text-on-surface-variant/70">{hint}</p>}
      {error && <p className="mt-1 text-label-sm text-error">{error}</p>}
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextArea({ label, error, hint, className = "", id, ...props }: TextAreaProps) {
  const inputId = id || props.name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-label-md text-on-surface-variant mb-1">
        {label}
      </label>
      <textarea
        id={inputId}
        className={`w-full rounded-lg border bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:outline-none transition-colors ${
          error ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-label-sm text-on-surface-variant/70">{hint}</p>}
      {error && <p className="mt-1 text-label-sm text-error">{error}</p>}
    </div>
  );
}
