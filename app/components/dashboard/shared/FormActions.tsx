import { primaryButtonClass } from "~/components/dashboard/section";

interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  submitType?: "submit" | "button";
}

export function FormActions({
  onCancel,
  onSubmit,
  submitLabel,
  cancelLabel = "Cancel",
  isSubmitting = false,
  disabled = false,
  submitType = "submit",
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {cancelLabel}
      </button>
      <button
        type={submitType}
        onClick={onSubmit}
        disabled={disabled || isSubmitting}
        className={primaryButtonClass()}
      >
        {submitLabel}
      </button>
    </div>
  );
}
