import { API_URL } from "../config";
import { logger, type RequestLogger } from "../logger.server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.detail || body?.title || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

// --- Strategy: AuthStrategy ---

export interface AuthStrategy {
  applyHeaders(headers: Headers): void;
}

export class NoAuth implements AuthStrategy {
  applyHeaders() {}
}

export class BearerAuth implements AuthStrategy {
  constructor(private token: string) {}
  applyHeaders(headers: Headers) {
    headers.set("Authorization", `Bearer ${this.token}`);
  }
}

export function noAuth(): AuthStrategy {
  return new NoAuth();
}

export function bearerAuth(token: string): AuthStrategy {
  return new BearerAuth(token);
}

// --- Decorator: Composable middleware ---

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export function withLogging(inner: FetchFn, log: RequestLogger = logger): FetchFn {
  return async (url: string, init: RequestInit) => {
    const method = (init.method ?? "GET").toUpperCase();
    const start = performance.now();
    try {
      const response = await inner(url, init);
      const durationMs = Math.round(performance.now() - start);
      const fields = { apiMethod: method, apiPath: url.replace(API_URL, ""), status: response.status, durationMs };
      if (response.ok) {
        log.info(fields, "api call");
      } else {
        log.warn(fields, "api call failed");
      }
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      log.error({ apiMethod: method, apiPath: url.replace(API_URL, ""), durationMs, err: error }, "api call errored");
      throw error;
    }
  };
}

export function withCorrelationId(inner: FetchFn, log: RequestLogger = logger): FetchFn {
  return async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    const requestId = log.bindings().requestId as string | undefined;
    if (requestId && !headers.has("x-request-id")) {
      headers.set("x-request-id", requestId);
    }
    return inner(url, { ...init, headers });
  };
}

export function withAuthStrategy(inner: FetchFn, strategy: AuthStrategy): FetchFn {
  return async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    strategy.applyHeaders(headers);
    return inner(url, { ...init, headers });
  };
}

// --- Singleton: ApiClient ---

export interface RequestOptions {
  auth?: AuthStrategy;
  log?: RequestLogger;
}

export class ApiClient {
  private static instance: ApiClient;

  private constructor(public baseUrl: string) {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(API_URL);
    }
    return ApiClient.instance;
  }

  private buildPipeline(options?: RequestOptions): FetchFn {
    const log = options?.log || logger;
    let pipeline: FetchFn = (url, init) => fetch(url, init);
    pipeline = withCorrelationId(pipeline, log);
    pipeline = withLogging(pipeline, log);
    if (options?.auth) {
      pipeline = withAuthStrategy(pipeline, options.auth);
    }
    return pipeline;
  }

  async request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
    const pipeline = this.buildPipeline(options);
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await pipeline(`${this.baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      throw new ApiError(response.status, await readError(response));
    }
    return (await response.json()) as T;
  }

  async requestVoid(path: string, init?: RequestInit, options?: RequestOptions): Promise<void> {
    const pipeline = this.buildPipeline(options);
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await pipeline(`${this.baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      throw new ApiError(response.status, await readError(response));
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { method: "GET" }, options);
  }

  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }, options);
  }

  async postVoid(path: string, body: unknown, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { method: "POST", body: JSON.stringify(body) }, options);
  }

  async patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, options);
  }

  async deleteVoid(path: string, options?: RequestOptions): Promise<void> {
    return this.requestVoid(path, { method: "DELETE" }, options);
  }
}

export const apiClient = ApiClient.getInstance();
