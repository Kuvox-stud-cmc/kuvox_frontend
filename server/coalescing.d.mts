export type CoalescingResource = "auth_me" | "studio_memberships" | "retrieval_project_media";

export interface CoalescingConfig {
  enabled: boolean;
  resources: Set<string>;
  maxInFlight: number;
  deadlineMs: number;
}

export class CoalescingDeadlineError extends Error {}

export function getCoalescingConfig(env?: Record<string, string | undefined>): CoalescingConfig;
export function classifyCoalescingRequest(method: string, origin: string, path: string): CoalescingResource | null;
export function coalesceJsonRequest<T>(options: {
  resource: CoalescingResource;
  method?: string;
  origin: string;
  path: string;
  token: string;
  signal?: AbortSignal;
  upstream: (options: { signal?: AbortSignal }) => Promise<T>;
  config?: CoalescingConfig;
  now?: () => number;
}): Promise<T>;
export function renderCoalescingMetrics(): string;
export function coalescingDebugSnapshot(): { keys: string[]; metrics: string };
export function resetCoalescingStateForTests(): void;
