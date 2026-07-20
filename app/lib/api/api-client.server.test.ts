import { afterEach, describe, expect, it, vi } from "vitest";

import { resetCoalescingStateForTests } from "../../../server/coalescing.mjs";
import { apiClient, bearerAuth, readError } from "./api-client.server";

afterEach(() => {
  delete process.env.KUVOX_BFF_COALESCING_ENABLED;
  vi.unstubAllGlobals();
  resetCoalescingStateForTests();
});

describe("readError", () => {
  it("preserves the structured authentication problem code", async () => {
    const response = Response.json({
      title: "Authentication error",
      detail: "This account already has an active session.",
      code: "active_session_conflict",
    }, { status: 409 });

    await expect(readError(response)).resolves.toEqual({
      message: "This account already has an active session.",
      code: "active_session_conflict",
    });
  });
});

describe("SSR API client coalescing", () => {
  it("shares exact authenticated auth/me reads through the runtime-neutral registry", async () => {
    process.env.KUVOX_BFF_COALESCING_ENABLED = "true";
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ id: "user-1" });
    }));
    const token = jwt();

    const [first, second] = await Promise.all([
      apiClient.get<{ id: string }>("/api/auth/me", { auth: bearerAuth(token) }),
      apiClient.get<{ id: string }>("/api/auth/me", { auth: bearerAuth(token) }),
    ]);

    expect(calls).toBe(1);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

function jwt() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    sub: "11111111-1111-4111-8111-111111111111",
    sid: "22222222-2222-4222-8222-222222222222",
    exp: Math.floor(Date.now() / 1000) + 3_600,
  })}.signature`;
}
