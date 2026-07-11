import { describe, expect, it } from "vitest";

import { readError } from "./api-client.server";

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
