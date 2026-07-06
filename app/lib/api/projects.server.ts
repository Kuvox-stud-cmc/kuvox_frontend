import { API_ROUTES } from "~/const/api-routes";
import type {
  Workspace,
  ProjectDto,
  ProjectTrashItem,
  PagedResult,
  ShareRequest,
  ItemAccessMemberDto,
  ImageCompositionDto,
  SaveImageCompositionRequest,
} from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class ProjectsApi extends BaseApiModule {
  listProjects(token: string, ws: Workspace, log?: RequestLogger): Promise<PagedResult<ProjectDto>> {
    return this.list<ProjectDto>(token, API_ROUTES.PROJECTS, ws, log);
  }

  getProject(token: string, id: string, log?: RequestLogger): Promise<ProjectDto> {
    return this.get<ProjectDto>(token, `${API_ROUTES.PROJECTS}/${id}`, log);
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

  setStar(token: string, id: string, isStarred: boolean, log?: RequestLogger): Promise<ProjectDto> {
    return this.put<{ isStarred: boolean }, ProjectDto>(
      token,
      `${API_ROUTES.PROJECTS}/${id}/star`,
      { isStarred },
      log,
    );
  }

  shareProject(token: string, id: string, input: ShareRequest, log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `${API_ROUTES.PROJECTS}/${id}/share`, input, log);
  }

  unshareProject(token: string, id: string, userId: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.PROJECTS}/${id}/share/${userId}`, log);
  }

  listAccess(token: string, id: string, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.get<ItemAccessMemberDto[]>(token, `${API_ROUTES.PROJECTS}/${id}/access`, log);
  }

  updateAccess(token: string, id: string, input: { userId: string; role?: number | null; isHidden: boolean }, log?: RequestLogger): Promise<ItemAccessMemberDto[]> {
    return this.put<typeof input, ItemAccessMemberDto[]>(token, `${API_ROUTES.PROJECTS}/${id}/access`, input, log);
  }

  getImageComposition(token: string, id: string, log?: RequestLogger): Promise<ImageCompositionDto> {
    return this.get<ImageCompositionDto>(token, `${API_ROUTES.PROJECTS}/${id}/image-composition`, log);
  }

  saveImageComposition(
    token: string,
    id: string,
    input: SaveImageCompositionRequest,
    log?: RequestLogger,
  ): Promise<ImageCompositionDto> {
    return this.put<SaveImageCompositionRequest, ImageCompositionDto>(
      token,
      `${API_ROUTES.PROJECTS}/${id}/image-composition`,
      input,
      log,
    );
  }
}

export const projectsApi = new ProjectsApi(apiClient);

// Backward compatible exports
export const listProjects = (t: string, w: Workspace, l?: RequestLogger) => projectsApi.listProjects(t, w, l);
export const getProject = (t: string, id: string, l?: RequestLogger) => projectsApi.getProject(t, id, l);
export const createProject = (t: string, w: Workspace, i: { kind: number; name: string; description?: string | null }, l?: RequestLogger) => projectsApi.createProject(t, w, i, l);
export const listSharedProjects = (t: string, l?: RequestLogger) => projectsApi.listSharedProjects(t, l);
export const listProjectTrash = (t: string, w: Workspace, l?: RequestLogger) => projectsApi.listProjectTrash(t, w, l);
export const setProjectStar = (t: string, id: string, v: boolean, l?: RequestLogger) => projectsApi.setStar(t, id, v, l);
export const shareProject = (t: string, id: string, i: ShareRequest, l?: RequestLogger) => projectsApi.shareProject(t, id, i, l);
export const unshareProject = (t: string, id: string, u: string, l?: RequestLogger) => projectsApi.unshareProject(t, id, u, l);
export const listProjectAccess = (t: string, id: string, l?: RequestLogger) => projectsApi.listAccess(t, id, l);
export const updateProjectAccess = (t: string, id: string, i: { userId: string; role?: number | null; isHidden: boolean }, l?: RequestLogger) => projectsApi.updateAccess(t, id, i, l);
export const getImageComposition = (t: string, id: string, l?: RequestLogger) => projectsApi.getImageComposition(t, id, l);
export const saveImageComposition = (t: string, id: string, i: SaveImageCompositionRequest, l?: RequestLogger) => projectsApi.saveImageComposition(t, id, i, l);
