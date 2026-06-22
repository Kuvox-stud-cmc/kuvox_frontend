import { API_ROUTES } from "~/const/api-routes";
import type { Workspace, ProjectDto, ProjectTrashItem, PagedResult } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class ProjectsApi extends BaseApiModule {
  listProjects(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<ProjectDto>> {
    return this.list<ProjectDto>(token, API_ROUTES.PROJECTS, ws, log);
  }

  createProject(token: string, ws: Workspace, input: { kind: number; name: string; description?: string | null }, log?: RequestLogger): Promise<ProjectDto> {
    return this.create(token, API_ROUTES.PROJECTS, ws, {
      kind: input.kind,
      name: input.name,
      description: input.description || null,
    }, log);
  }

  listSharedProjects(token: string, log?: RequestLogger): Promise<PagedResult<ProjectDto>> {
    return this.get<PagedResult<ProjectDto>>(token, `${API_ROUTES.PROJECTS}/shared?pageSize=100`, log);
  }

  listProjectTrash(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<ProjectTrashItem>> {
    return this.list<ProjectTrashItem>(token, `${API_ROUTES.PROJECTS}/trash`, ws, log);
  }
}

export const projectsApi = new ProjectsApi(apiClient);

// Backward compatible exports
export const listProjects = (t: string, w: Workspace, l?: RequestLogger) => projectsApi.listProjects(t, w, l);
export const createProject = (t: string, w: Workspace, i: { kind: number; name: string; description?: string | null }, l?: RequestLogger) => projectsApi.createProject(t, w, i, l);
export const listSharedProjects = (t: string, l?: RequestLogger) => projectsApi.listSharedProjects(t, l);
export const listProjectTrash = (t: string, w: Workspace, l?: RequestLogger) => projectsApi.listProjectTrash(t, w, l);
