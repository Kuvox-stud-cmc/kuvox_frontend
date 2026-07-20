import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  CoalescingDeadlineError,
  coalesceJsonRequest,
  coalescingDebugSnapshot,
  renderCoalescingMetrics,
  resetCoalescingStateForTests,
} from "./coalescing.mjs";

const execFileAsync = promisify(execFile);
const userOne = "11111111-1111-4111-8111-111111111111";
const userTwo = "22222222-2222-4222-8222-222222222222";
const sessionOne = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionTwo = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const projectOne = "33333333-3333-4333-8333-333333333333";
const projectTwo = "44444444-4444-4444-8444-444444444444";

afterEach(() => resetCoalescingStateForTests());

describe("process-local BFF request coalescing", () => {
  it("joins simultaneous reads and clones parsed JSON for every caller", async () => {
    let calls = 0;
    const gate = deferred<{ nested: { value: number } }>();
    const upstream = async () => {
      calls += 1;
      return gate.promise;
    };
    const first = request({ resource: "auth_me", path: "/api/auth/me", upstream });
    const second = request({ resource: "auth_me", path: "/api/auth/me", upstream });

    gate.resolve({ nested: { value: 1 } });
    const [left, right] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(left).toEqual(right);
    expect(left).not.toBe(right);
    expect(left.nested).not.toBe(right.nested);
    expect(renderCoalescingMetrics()).toContain('outcome="leader"} 1');
    expect(renderCoalescingMetrics()).toContain('outcome="joiner"} 1');
  });

  it("isolates users, sessions, resources, projects, and unsupported query values", async () => {
    let calls = 0;
    const upstream = async () => ({ call: ++calls });
    await Promise.all([
      request({ resource: "auth_me", path: "/api/auth/me", token: jwt(userOne, sessionOne), upstream }),
      request({ resource: "auth_me", path: "/api/auth/me", token: jwt(userTwo, sessionOne), upstream }),
      request({ resource: "auth_me", path: "/api/auth/me", token: jwt(userOne, sessionTwo), upstream }),
      request({ resource: "studio_memberships", path: "/api/auth/me/studios", upstream }),
      request({ resource: "retrieval_project_media", path: mediaPath(projectOne), upstream }),
      request({ resource: "retrieval_project_media", path: mediaPath(projectTwo), upstream }),
      request({ resource: "retrieval_project_media", path: `/api/projects/${projectOne}/media?pageSize=100`, upstream }),
    ]);
    expect(calls).toBe(7);
  });

  it("fails open when capacity is exhausted", async () => {
    const gate = deferred<{ source: string }>();
    let firstCalls = 0;
    let secondCalls = 0;
    const first = request({
      resource: "retrieval_project_media",
      path: mediaPath(projectOne),
      config: enabledConfig({ maxInFlight: 1 }),
      upstream: async () => {
        firstCalls += 1;
        return gate.promise;
      },
    });
    const second = request({
      resource: "retrieval_project_media",
      path: mediaPath(projectTwo),
      config: enabledConfig({ maxInFlight: 1 }),
      upstream: async () => ({ source: `independent-${++secondCalls}` }),
    });

    await expect(second).resolves.toEqual({ source: "independent-1" });
    gate.resolve({ source: "leader" });
    await expect(first).resolves.toEqual({ source: "leader" });
    expect(firstCalls).toBe(1);
    expect(renderCoalescingMetrics()).toContain('outcome="bypass"} 1');
  });

  it("fails open through an independent request when a matching entry is expired", async () => {
    let now = 1_000;
    let calls = 0;
    const first = coalesceJsonRequest({
      resource: "auth_me",
      method: "GET",
      origin: "http://api.local",
      path: "/api/auth/me",
      token: jwt(userOne, sessionOne, 10_000),
      config: enabledConfig({ deadlineMs: 100 }),
      now: () => now,
      upstream: async ({ signal }) => {
        calls += 1;
        return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true }));
      },
    });
    const firstRejected = expect(first).rejects.toBeInstanceOf(Error);
    await Promise.resolve();
    now = 1_101;
    const second = coalesceJsonRequest({
      resource: "auth_me",
      method: "GET",
      origin: "http://api.local",
      path: "/api/auth/me",
      token: jwt(userOne, sessionOne, 10_000),
      config: enabledConfig({ deadlineMs: 100 }),
      now: () => now,
      upstream: async () => ({ source: `independent-${++calls}` }),
    });

    await expect(second).resolves.toEqual({ source: "independent-2" });
    await firstRejected;
    expect(renderCoalescingMetrics()).toContain('outcome="bypass"} 1');
  });

  it("uses an independent hard deadline, cleans up, and permits immediate retry", async () => {
    let calls = 0;
    await expect(request({
      resource: "auth_me",
      path: "/api/auth/me",
      config: enabledConfig({ deadlineMs: 15 }),
      upstream: async () => {
        calls += 1;
        return new Promise(() => {});
      },
    })).rejects.toBeInstanceOf(CoalescingDeadlineError);

    await expect(request({
      resource: "auth_me",
      path: "/api/auth/me",
      upstream: async () => ({ call: ++calls }),
    })).resolves.toEqual({ call: 2 });
    expect(coalescingDebugSnapshot().keys).toHaveLength(0);
    expect(renderCoalescingMetrics()).toContain('outcome="timeout"} 1');
  });

  it("allows a caller to abort without cancelling the shared leader", async () => {
    const gate = deferred<{ ok: boolean }>();
    let calls = 0;
    const leader = request({
      resource: "auth_me",
      path: "/api/auth/me",
      upstream: async () => {
        calls += 1;
        return gate.promise;
      },
    });
    const controller = new AbortController();
    const joiner = request({
      resource: "auth_me",
      path: "/api/auth/me",
      signal: controller.signal,
      upstream: async () => {
        calls += 1;
        return gate.promise;
      },
    });
    controller.abort();
    await expect(joiner).rejects.toMatchObject({ name: "AbortError" });
    gate.resolve({ ok: true });
    await expect(leader).resolves.toEqual({ ok: true });
    expect(calls).toBe(1);
    expect(renderCoalescingMetrics()).toContain('outcome="caller_abort"} 1');
  });

  it("cleans up failures and preserves upstream error behavior for retry", async () => {
    let calls = 0;
    const upstream = async () => {
      calls += 1;
      if (calls === 1) throw new Error("upstream failed");
      return { ok: true };
    };
    await expect(request({ resource: "auth_me", path: "/api/auth/me", upstream }))
      .rejects.toThrow("upstream failed");
    await expect(request({ resource: "auth_me", path: "/api/auth/me", upstream }))
      .resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(coalescingDebugSnapshot().keys).toHaveLength(0);
  });

  it("bypasses expired or malformed JWTs and never exposes bearer tokens", async () => {
    const expired = jwt(userOne, sessionOne, Math.floor(Date.now() / 1000) - 1);
    const rawToken = jwt(userOne, sessionOne);
    let calls = 0;
    await Promise.all([
      request({ resource: "auth_me", path: "/api/auth/me", token: expired, upstream: async () => ({ call: ++calls }) }),
      request({ resource: "auth_me", path: "/api/auth/me", token: "not-a-jwt", upstream: async () => ({ call: ++calls }) }),
      request({ resource: "auth_me", path: "/api/auth/me", token: rawToken, upstream: async () => ({ call: ++calls }) }),
    ]);
    const snapshot = JSON.stringify(coalescingDebugSnapshot());
    expect(calls).toBe(3);
    expect(snapshot).not.toContain(rawToken);
    expect(snapshot).not.toContain(userOne);
    expect(snapshot).not.toContain(sessionOne);
    expect(coalescingDebugSnapshot().keys.every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });

  it("has one independent leader per frontend process", async () => {
    const modulePath = fileURLToPath(new URL("./coalescing.mjs", import.meta.url));
    const script = `
      import { coalesceJsonRequest, renderCoalescingMetrics } from ${JSON.stringify(modulePath)};
      const payload = ${JSON.stringify(jwt(userOne, sessionOne))};
      let calls = 0;
      const upstream = async () => { calls += 1; await new Promise(r => setTimeout(r, 20)); return { ok: true }; };
      await Promise.all([1,2].map(() => coalesceJsonRequest({
        resource: "auth_me", method: "GET", origin: "http://api.local", path: "/api/auth/me",
        token: payload, config: { enabled: true, resources: new Set(["auth_me"]), maxInFlight: 8, deadlineMs: 1000 }, upstream
      })));
      process.stdout.write(JSON.stringify({ calls, metrics: renderCoalescingMetrics() }));
    `;
    const [first, second] = await Promise.all([
      execFileAsync(process.execPath, ["--input-type=module", "--eval", script]),
      execFileAsync(process.execPath, ["--input-type=module", "--eval", script]),
    ]);
    for (const output of [first.stdout, second.stdout]) {
      const result = JSON.parse(output);
      expect(result.calls).toBe(1);
      expect(result.metrics).toContain('outcome="leader"} 1');
      expect(result.metrics).toContain('outcome="joiner"} 1');
    }
  });
});

function request<T>({
  resource,
  path,
  token = jwt(userOne, sessionOne),
  signal,
  upstream,
  config = enabledConfig(),
}: {
  resource: "auth_me" | "studio_memberships" | "retrieval_project_media";
  path: string;
  token?: string;
  signal?: AbortSignal;
  upstream: (options: { signal?: AbortSignal }) => Promise<T>;
  config?: ReturnType<typeof enabledConfig>;
}) {
  return coalesceJsonRequest({
    resource,
    method: "GET",
    origin: "http://api.local",
    path,
    token,
    signal,
    upstream,
    config,
  });
}

function enabledConfig(overrides: Partial<{ maxInFlight: number; deadlineMs: number }> = {}) {
  return {
    enabled: true,
    resources: new Set(["auth_me", "studio_memberships", "retrieval_project_media"]),
    maxInFlight: overrides.maxInFlight ?? 256,
    deadlineMs: overrides.deadlineMs ?? 5_000,
  };
}

function mediaPath(projectId: string) {
  return `/api/projects/${projectId}/media?pageSize=500`;
}

function jwt(sub: string, sid: string, exp = Math.floor(Date.now() / 1000) + 3_600) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub, sid, exp })}.signature-do-not-log`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
