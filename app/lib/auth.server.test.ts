import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api/api-client.server";
import { commitSession, getSession } from "./session.server";

const fetchMe = vi.fn();
const refreshRequest = vi.fn();

vi.mock("./api.server", async () => {
  const actual = await vi.importActual<typeof import("./api.server")>("./api.server");
  return {
    ...actual,
    fetchMe,
    refreshRequest,
  };
});

const { redirectIfAuthenticated, requireUser } = await import("./auth.server");

describe("frontend session validation", () => {
  beforeEach(() => {
    fetchMe.mockReset();
    refreshRequest.mockReset();
  });

  it("restores a valid persistent cookie and redirects away from login", async () => {
    const request = await authenticatedRequest("http://localhost/login");
    fetchMe.mockResolvedValue(sessionUser);

    const response = await thrownResponse(() => redirectIfAuthenticated(request));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("clears a rejected cookie and reloads the login page", async () => {
    const request = await authenticatedRequest("http://localhost/login");
    fetchMe.mockRejectedValue(new ApiError(401, "Unauthorized"));

    const response = await thrownResponse(() => redirectIfAuthenticated(request));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://localhost/login");
    expect(response.headers.get("Set-Cookie")).toContain("__kuvox_session=");
    expect(response.headers.get("Set-Cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("redirects a replaced protected session with the dedicated reason", async () => {
    const request = await authenticatedRequest("http://localhost/dashboard");
    fetchMe.mockRejectedValue(new ApiError(401, "Unauthorized"));

    const response = await thrownResponse(() => requireUser(request));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login?reason=session-replaced");
    expect(response.headers.get("Set-Cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });
});

const sessionUser = {
  id: "01900000-0000-7000-8000-000000000001",
  email: "user@example.com",
  displayName: "Test User",
  plan: "Free",
  emailVerified: true,
};

async function authenticatedRequest(url: string): Promise<Request> {
  const session = await getSession(new Request(url));
  session.set("accessToken", "access-token");
  session.set("refreshToken", "refresh-token");
  session.set("expiresAt", new Date(Date.now() + 60_000).toISOString());
  session.set("user", sessionUser);
  const cookie = await commitSession(session);
  return new Request(url, { headers: { Cookie: cookie } });
}

async function thrownResponse(run: () => Promise<unknown>): Promise<Response> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  throw new Error("Expected a redirect response.");
}
