import { type Workspace, workspaceQuery, type PagedResult } from "../api";
import { type ApiClient, bearerAuth } from "./api-client.server";
import { type RequestLogger } from "../logger.server";

export abstract class BaseApiModule {
  constructor(protected client: ApiClient) {}

  protected list<T>(token: string, basePath: string, ws?: Workspace, log?: RequestLogger): Promise<PagedResult<T>> {
    const query = ws ? workspaceQuery(ws, { pageSize: 100 }) : "?pageSize=100";
    return this.client.get<PagedResult<T>>(`${basePath}${query}`, { auth: bearerAuth(token), log });
  }

  protected create<TIn, TOut>(token: string, basePath: string, ws: Workspace, body: TIn, log?: RequestLogger): Promise<TOut> {
    return this.client.post<TOut>(`${basePath}${workspaceQuery(ws)}`, body, { auth: bearerAuth(token), log });
  }

  protected deleteVoid(token: string, path: string, log?: RequestLogger): Promise<void> {
    return this.client.deleteVoid(path, { auth: bearerAuth(token), log });
  }
  
  protected postVoid<TIn>(token: string, path: string, body: TIn, log?: RequestLogger): Promise<void> {
    return this.client.postVoid(path, body, { auth: bearerAuth(token), log });
  }

  protected put<TIn, TOut>(token: string, path: string, body: TIn, log?: RequestLogger): Promise<TOut> {
    return this.client.put<TOut>(path, body, { auth: bearerAuth(token), log });
  }

  protected patch<TIn, TOut>(token: string, path: string, body: TIn, log?: RequestLogger): Promise<TOut> {
    return this.client.patch<TOut>(path, body, { auth: bearerAuth(token), log });
  }
  
  protected get<T>(token: string, path: string, log?: RequestLogger): Promise<T> {
    return this.client.get<T>(path, { auth: bearerAuth(token), log });
  }
}
