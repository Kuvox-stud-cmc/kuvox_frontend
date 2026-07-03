import type { Workspace, ProjectDto, MediaDto, ProjectTrashItem, MediaTrashItem, StudioDto, StudioMemberDto, ResourceKind } from "./api";
import { requireUser } from "./auth.server";
import { getSession, type SessionUser } from "./session.server";
import { logger, type RequestLogger, createRequestLogger } from "./logger.server";

import { projectsApi } from "./api/projects.server";
import { mediaApi } from "./api/media.server";
import { trashApi } from "./api/trash.server";
import { studiosApi } from "./api/studios.server";
import { authApi } from "./api/auth.server";

export class BffFacade {
  constructor(
    public user: SessionUser,
    public log: RequestLogger,
    private token: string,
  ) {}

  static async fromRequest(request: Request): Promise<BffFacade> {
    const log = createRequestLogger(request);
    const user = await requireUser(request, log);
    const session = await getSession(request);
    const token = session.get("accessToken")!;
    return new BffFacade(user, log, token);
  }

  // Auth (Token rotation/fetchMe are typically handled via middleware/guards, but exposed here if needed)
  fetchMe() { return authApi.fetchMe(this.token, this.log); }

  // Projects
  listProjects(ws: Workspace) { return projectsApi.listProjects(this.token, ws, this.log); }
  createProject(ws: Workspace, input: { kind: number; name: string; description?: string | null }) { return projectsApi.createProject(this.token, ws, input, this.log); }
  listSharedProjects() { return projectsApi.listSharedProjects(this.token, this.log); }
  listProjectTrash(ws: Workspace) { return projectsApi.listProjectTrash(this.token, ws, this.log); }

  // Media
  listMedia(ws: Workspace) { return mediaApi.listMedia(this.token, ws, this.log); }
  listSharedMedia() { return mediaApi.listSharedMedia(this.token, this.log); }
  listMediaTrash(ws: Workspace) { return mediaApi.listMediaTrash(this.token, ws, this.log); }

  // Trash Generic
  softDelete(resource: ResourceKind, id: string) { return trashApi.softDelete(this.token, resource, id, this.log); }
  restore(resource: ResourceKind, id: string) { return trashApi.restore(this.token, resource, id, this.log); }
  permanentDelete(resource: ResourceKind, id: string) { return trashApi.permanentDelete(this.token, resource, id, this.log); }

  // Studios (Teams)
  listMyStudios() { return studiosApi.listMyStudios(this.token, this.log); }
  listStudioMembers(studioId: string) { return studiosApi.listStudioMembers(this.token, studioId, this.log); }
  addStudioMember(studioId: string, input: { email: string; role: number }) { return studiosApi.addStudioMember(this.token, studioId, input, this.log); }
  updateStudioMember(studioId: string, userId: string, role: number) { return studiosApi.updateStudioMember(this.token, studioId, userId, role, this.log); }
  removeStudioMember(studioId: string, userId: string) { return studiosApi.removeStudioMember(this.token, studioId, userId, this.log); }
  createStudio(name: string) { return studiosApi.createStudio(this.token, name, this.log); }
  getStudioClaims() { return studiosApi.getStudioClaims(this.token); }
}
