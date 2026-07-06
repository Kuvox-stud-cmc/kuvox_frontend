import { ProjectKind, type ProjectDto } from "~/lib/api";

export function projectEditorHref(project: Pick<ProjectDto, "id" | "kind">): string {
  return project.kind === ProjectKind.Image
    ? `/editor/image/${project.id}`
    : `/editor/video/${project.id}`;
}
