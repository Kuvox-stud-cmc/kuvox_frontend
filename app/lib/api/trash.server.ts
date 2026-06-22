import type { ResourceKind } from "../api";
import { BaseApiModule } from "./base.server";
import type { RequestLogger } from "../logger.server";
import { apiClient } from "./api-client.server";

export class TrashApi extends BaseApiModule {
  softDelete(token: string, resource: ResourceKind, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `/api/${resource}/${id}`, log);
  }

  restore(token: string, resource: ResourceKind, id: string, log?: RequestLogger): Promise<void> {
    return this.postVoid(token, `/api/${resource}/${id}/restore`, undefined, log);
  }

  permanentDelete(token: string, resource: ResourceKind, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `/api/${resource}/${id}/permanent`, log);
  }
}

export const trashApi = new TrashApi(apiClient);

// Backward compatible exports
export const softDelete = (t: string, r: ResourceKind, id: string, l?: RequestLogger) => trashApi.softDelete(t, r, id, l);
export const restore = (t: string, r: ResourceKind, id: string, l?: RequestLogger) => trashApi.restore(t, r, id, l);
export const permanentDelete = (t: string, r: ResourceKind, id: string, l?: RequestLogger) => trashApi.permanentDelete(t, r, id, l);
