import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createApiChatSession,
  createSupportTicket,
  isCacanodeChatConfigured,
  isCacanodeTicketConfigured,
  sendApiChatMessage,
} from "./cacanode-support.server";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  process.env.CACANODE_API_URL = "http://localhost:8080/api/v1/";
  process.env.CACANODE_API_TOKEN = "ccn_it_server_only";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  delete process.env.CACANODE_API_URL;
  delete process.env.CACANODE_API_TOKEN;
  vi.unstubAllGlobals();
});

describe("CacaNode support configuration", () => {
  it("keeps chat and ticket submission gated by the server-only api token", () => {
    expect(isCacanodeChatConfigured()).toBe(true);
    expect(isCacanodeTicketConfigured()).toBe(true);
    delete process.env.CACANODE_API_TOKEN;
    expect(isCacanodeChatConfigured()).toBe(false);
    expect(isCacanodeTicketConfigured()).toBe(false);
  });
});

describe("CacaNode Custom API chat client", () => {
  it("creates an api:chat customer session without exposing the token in the body", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "session-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await createApiChatSession({
      externalUserId: "visitor-1",
      customerName: "Jane",
      customerEmail: "jane@example.com",
      locale: "vi-VN",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:8080/api/v1/external/chat/sessions");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer ccn_it_server_only");
    expect(JSON.parse(String(init?.body))).toEqual({
      external_user_id: "visitor-1",
      customer_name: "Jane",
      customer_email: "jane@example.com",
      locale: "vi-VN",
    });
    expect(String(init?.body)).not.toContain("ccn_it_server_only");
  });

  it("sends an idempotent Custom API message and preserves public citation URLs", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      role: "assistant",
      content: "Open the guide [S1]",
      citations: [{
        id: "S1",
        document_id: "document-1",
        source_name: "guide.pdf",
        public_url: "https://cacanode.example/evidence/signed-token",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const message = await sendApiChatMessage("session-1", "How do I edit?", "message-key-1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:8080/api/v1/external/chat/sessions/session-1/messages");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("message-key-1");
    expect(message.citations[0]?.public_url).toBe("https://cacanode.example/evidence/signed-token");
  });
});

describe("CacaNode ticket client", () => {
  it("creates a ticket with the same api token that owns the Custom API session", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: "ticket-1",
      sessionId: "session-1",
      customerEmail: "jane@example.com",
      title: "Billing issue",
      description: "Charged twice",
      status: "OPEN",
      priority: "NORMAL",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    await createSupportTicket({
      sessionId: "session-1",
      customerEmail: "jane@example.com",
      customerName: "Jane",
      title: "Billing issue",
      description: "Charged twice",
    }, "ticket-key-1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:8080/api/v1/external/tickets");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer ccn_it_server_only");
    expect(headers.get("Idempotency-Key")).toBe("ticket-key-1");
    expect(String(init?.body)).not.toContain("ccn_it_server_only");
  });

  it("requires HTTP 201 before treating a ticket as created", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "ticket-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(createSupportTicket({
      sessionId: "session-1",
      customerEmail: "jane@example.com",
      title: "Billing issue",
      description: "Charged twice",
    }, "ticket-key-1")).rejects.toMatchObject({
      status: 502,
      message: "CacaNode returned HTTP 200; expected HTTP 201",
    });
  });
});
