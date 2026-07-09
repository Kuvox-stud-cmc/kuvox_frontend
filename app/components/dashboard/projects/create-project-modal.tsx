import { Form, useNavigation } from "react-router";

import { FormActions } from "~/components/dashboard/layout/DashboardPageLayout";
import { Modal } from "~/components/dashboard/section";
import { TextArea, TextField } from "~/components/dashboard/shared/form";
import { ProjectKind } from "~/lib/api";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export function CreateProjectModal({ open, onClose, action }: CreateProjectModalProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Modal open={open} onClose={onClose} title="New Project">
      <Form method="post" action={action} className="space-y-4">
        <input type="hidden" name="intent" value="create" />
        <TextField
          name="name"
          label="Project Name"
          required
          placeholder="Campaign Video"
        />
        <label className="block text-label-md text-on-surface-variant">
          Project Type
          <select
            name="kind"
            defaultValue={ProjectKind.Video}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface transition-colors focus:border-primary focus:outline-none"
          >
            <option value={ProjectKind.Video}>Video</option>
            <option value={ProjectKind.Image}>Image</option>
          </select>
        </label>
        <TextArea
          name="description"
          label="Description"
          rows={3}
          placeholder="Optional project brief"
        />
        <FormActions
          onCancel={onClose}
          submitLabel={isSubmitting ? "Creating..." : "Create"}
          isSubmitting={isSubmitting}
        />
      </Form>
    </Modal>
  );
}
