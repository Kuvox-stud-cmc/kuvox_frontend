import type { CacanodeMessage } from "./cacanode-support";

const REQUEST_TIMEOUT_MS = 110_000;

export interface CreateApiChatSessionInput {
  externalUserId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  locale: string;
}

export interface CacanodeChatSession {
  id: string;
}

export interface CreateSupportTicketInput {
  sessionId: string;
  customerEmail: string;
  customerName?: string | null;
  title: string;
  description: string;
}

export interface CacanodeTicket {
  id: string;
  sessionId: string;
  customerEmail: string;
  customerName?: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt?: string | null;
}

export class CacanodeSupportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter: string | null = null,
    public readonly body: unknown = null,
  ) {
    super(message);
  }
}

export function isCacanodeChatConfigured(): boolean {
  return Boolean(apiUrl() && apiToken());
}

export function isCacanodeTicketConfigured(): boolean {
  return isCacanodeChatConfigured();
}

export async function createApiChatSession(
  input: CreateApiChatSessionInput,
): Promise<CacanodeChatSession> {
  return apiRequest<CacanodeChatSession>("/external/chat/sessions", {
    method: "POST",
    body: JSON.stringify({
      external_user_id: input.externalUserId,
      customer_name: input.customerName || undefined,
      customer_email: input.customerEmail || undefined,
      locale: input.locale || "vi-VN",
    }),
  });
}

export async function sendApiChatMessage(
  sessionId: string,
  content: string,
  idempotencyKey: string,
): Promise<CacanodeMessage> {
  return apiRequest<CacanodeMessage>(
    `/external/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ content }),
    },
  );
}

export async function createSupportTicket(
  input: CreateSupportTicketInput,
  idempotencyKey: string,
): Promise<CacanodeTicket> {
  return apiRequest<CacanodeTicket>("/external/tickets", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      customerEmail: input.customerEmail,
      customerName: input.customerName || undefined,
      title: input.title,
      description: input.description,
    }),
  }, 201);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit,
  expectedStatus = 200,
): Promise<T> {
  const baseUrl = apiUrl();
  const token = apiToken();
  if (!baseUrl || !token) {
    throw new CacanodeSupportError("AI support is not configured.", 503);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new CacanodeSupportError(
      errorMessage(body) ?? `CacaNode request failed with HTTP ${response.status}`,
      response.status,
      response.headers.get("retry-after"),
      body,
    );
  }
  if (response.status !== expectedStatus) {
    throw new CacanodeSupportError(
      `CacaNode returned HTTP ${response.status}; expected HTTP ${expectedStatus}`,
      502,
      response.headers.get("retry-after"),
      body,
    );
  }

  return body as T;
}

function apiUrl(): string {
  return process.env.CACANODE_API_URL?.trim().replace(/\/+$/, "") || "";
}

function apiToken(): string {
  return process.env.CACANODE_API_TOKEN?.trim() || "";
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }
  return null;
}
