import { useEffect, useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";

import {
  CardGridSkeleton,
  Chip,
  ConfirmSubmitButton,
  EmptyState,
  ErrorBanner,
  Modal,
  primaryButtonClass,
  SectionHeader,
} from "~/components/dashboard/section";
import { ProjectKind, projectKindLabel, type ProjectDto } from "~/lib/api";
import { projectEditorHref } from "~/lib/project-routes";

export interface WorkspaceActionData {
  ok?: boolean;
  intent?: string;
  error?: string;
}

const KIND_FILTERS = [
  { label: "All", value: "all" as const },
  { label: "Video", value: ProjectKind.Video },
  { label: "Image", value: ProjectKind.Image },
];

/**
 * Project grid + kind filter + create dialog + soft-delete, shared by the Personal and Team
 * sections. Forms post to the current route, so each route supplies its own workspace-scoped
 * loader/action; this component is purely presentational.
 */
export function ProjectsView({
  projects,
  loadError,
  actionData,
  subtitle,
  canWrite = true,
}: {
  projects: ProjectDto[];
  loadError: string | null;
  actionData?: WorkspaceActionData;
  subtitle?: string;
  canWrite?: boolean;
}) {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState<"all" | number>("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create") {
      setCreateOpen(false);
    }
  }, [actionData]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const visible =
    filter === "all" ? projects : projects.filter((project) => project.kind === filter);

  return (
    <section>
      <SectionHeader
        title="Projects"
        subtitle={subtitle}
        action={canWrite ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={primaryButtonClass()}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New project
          </button>
        ) : undefined}
      />

      {loadError && <ErrorBanner message={loadError} />}
      {actionData?.error && <ErrorBanner message={actionData.error} />}

      <div className="mt-6 flex gap-2">
        {KIND_FILTERS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1 text-label-md transition-colors ${
              filter === option.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="movie"
          title={projects.length === 0 ? "No projects yet" : "No projects match this filter"}
          hint={projects.length === 0 ? "Create a project to start editing." : undefined}
          action={
            projects.length === 0 && canWrite ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className={primaryButtonClass()}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New project
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} canWrite={canWrite} />
          ))}
        </div>
      )}

      {canWrite ? (
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New project">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />
          <div>
            <label htmlFor="name" className="block text-label-md text-on-surface-variant">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="My new edit"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="kind" className="block text-label-md text-on-surface-variant">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={ProjectKind.Video}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value={ProjectKind.Video}>Video</option>
              <option value={ProjectKind.Image}>Image</option>
            </select>
          </div>
          <div>
            <label htmlFor="description" className="block text-label-md text-on-surface-variant">
              Description <span className="text-on-surface-variant">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={navigation.state === "submitting"}
              className={primaryButtonClass()}
            >
              {navigation.state === "submitting" ? "Creating…" : "Create"}
            </button>
          </div>
        </Form>
      </Modal>
      ) : null}
    </section>
  );
}

function ProjectCard({ project, canWrite }: { project: ProjectDto; canWrite: boolean }) {
  const isVideo = project.kind === ProjectKind.Video;
  return (
    <div className="group flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary/40">
      <Link to={projectEditorHref(project)} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="material-symbols-outlined text-primary">
            {isVideo ? "movie" : "image"}
          </span>
          <Chip>{projectKindLabel(project.kind)}</Chip>
        </div>
        <h3 className="mt-3 truncate text-body-lg text-on-surface">{project.name}</h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">
            {project.description}
          </p>
        )}
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-label-md text-on-surface-variant">{project.status}</span>
        {canWrite ? (
        <ConfirmSubmitButton
          fields={{ intent: "delete", id: project.id }}
          title="Move project to trash?"
          message={
            <>
              Move <span className="font-medium text-on-surface">{project.name}</span> to trash?
            </>
          }
          confirmLabel="Move to trash"
          ariaLabel={`Move ${project.name} to Trash`}
          buttonClassName="rounded-lg p-1.5 text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-error group-hover:opacity-100 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </ConfirmSubmitButton>
        ) : null}
      </div>
    </div>
  );
}
