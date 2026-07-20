import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTrustedVideoRetrievalRequest,
  installProxyHandlers,
  parseAlbumPickerRoute,
  parseMediaLibraryRoute,
  parseProjectEditorBootstrapRoute,
  parseTimelineRenderJobRoute,
  proxyHeaders,
  responseHeaders,
  trustedVideoMediaScope,
} from "./proxy.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.KUVOX_MEDIA_RETRIEVAL_ENABLED;
});

describe("disabled retrieval BFF route", () => {
  it("returns 503 before authentication, project media lookup, or AI upstream access", async () => {
    process.env.KUVOX_MEDIA_RETRIEVAL_ENABLED = "false";
    const handlers = new Map<string, (...args: any[]) => unknown>();
    const app = {
      use(path: string, handler: (...args: any[]) => unknown) {
        handlers.set(path, handler);
      },
    };
    installProxyHandlers(app, { on() {} });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const headers = new Map<string, string>();
    let statusCode = 0;
    let body = "";
    const response = {
      set statusCode(value: number) { statusCode = value; },
      get statusCode() { return statusCode; },
      setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
      end(value = "") { body = value; },
    };

    await handlers.get("/bff/ai")!(
      {
        method: "POST",
        url: "/retrieval/video-editor",
        originalUrl: "/bff/ai/retrieval/video-editor",
        headers: {},
      },
      response,
      () => { throw new Error("disabled retrieval must not fall through"); },
    );

    expect(statusCode).toBe(503);
    expect(headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(body)).toEqual({ error: "Media retrieval is disabled." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("editor bootstrap BFF route", () => {
  it("proxies the unified project editor bootstrap", () => {
    expect(parseProjectEditorBootstrapRoute("/bff/projects/project-1/editor-bootstrap")).toEqual({
      targetPath: "/api/projects/project-1/editor-bootstrap",
      methods: ["GET"],
    });
  });
});

describe("project media picker BFF routes", () => {
  it("proxies workspace, shared, and album media reads through authenticated server routes", () => {
    expect(parseMediaLibraryRoute("/bff/media/library")).toEqual({ targetPath: "/api/media", methods: ["GET"] });
    expect(parseMediaLibraryRoute("/bff/media/shared")).toEqual({ targetPath: "/api/media/shared", methods: ["GET"] });
    expect(parseAlbumPickerRoute("/bff/albums/library")).toEqual({ targetPath: "/api/albums", methods: ["GET"] });
    expect(parseAlbumPickerRoute("/bff/albums/shared")).toEqual({ targetPath: "/api/albums/shared", methods: ["GET"] });
    expect(parseAlbumPickerRoute("/bff/albums/album-1/media")).toEqual({ targetPath: "/api/albums/album-1/media", methods: ["GET"] });
  });
});

describe("trusted video retrieval scope", () => {
  it("selects ready available videos, deduplicates, sorts, and hashes revisions", () => {
    const scope = trustedVideoMediaScope({
      items: [
        { mediaId: "B", kind: 0, availability: "available", status: "Ready", searchRevision: "2" },
        { mediaId: "a", kind: 0, availability: "AVAILABLE", status: "ready", searchRevision: 3 },
        { mediaId: "A", kind: 0, availability: "available", status: "ready", searchRevision: 3 },
        { mediaId: "image", kind: 1, availability: "available", status: "ready", searchRevision: 9 },
      ],
    });

    expect(scope.mediaIds).toEqual(["a", "b"]);
    expect(scope.scopeRevision).toBe(
      "f66ca0598f4612b15a7f9c9eadea33ee8a507b02949eb97f59a057660730e81f",
    );
  });

  it("returns no trusted revision when no positive searchable revisions exist", () => {
    expect(trustedVideoMediaScope({
      items: [{ mediaId: "a", kind: 0, availability: "available", status: "ready", searchRevision: "bad" }],
    })).toEqual({ mediaIds: ["a"], scopeRevision: undefined });
  });

  it("preserves retrieval but bypasses caching for conflicting revisions", () => {
    expect(trustedVideoMediaScope({
      items: [
        { mediaId: "a", kind: 0, availability: "available", status: "ready", searchRevision: 1 },
        { mediaId: "A", kind: 0, availability: "available", status: "ready", searchRevision: 2 },
      ],
    })).toEqual({ mediaIds: ["a"], scopeRevision: undefined });
  });

  it("ignores browser-provided media IDs and scope revision", () => {
    const request = buildTrustedVideoRetrievalRequest(
      {
        projectId: "project-1",
        mediaIds: ["attacker-media"],
        scopeRevision: "f".repeat(64),
        query: "find scene",
        modalities: ["ocr"],
        topK: 5,
      },
      {
        items: [
          {
            mediaId: "trusted-media",
            kind: 0,
            availability: "available",
            status: "ready",
            searchRevision: 7,
          },
        ],
      },
    );

    expect(request.mediaIds).toEqual(["trusted-media"]);
    expect(request.scopeRevision).not.toBe("f".repeat(64));
    expect(request.scopeRevision).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("render job BFF routes", () => {
  it("proxies authenticated render status reads", () => {
    expect(parseTimelineRenderJobRoute("/bff/timelines/render-jobs/job-1")).toEqual({
      targetPath: "/api/timelines/render-jobs/job-1",
      methods: ["GET"],
    });
  });

  it("proxies render output GET and HEAD requests", () => {
    expect(parseTimelineRenderJobRoute("/bff/timelines/render-jobs/job-1/output")).toEqual({
      targetPath: "/api/timelines/render-jobs/job-1/output",
      methods: ["GET", "HEAD"],
    });
  });
});

describe("BFF conditional and cache header forwarding", () => {
  it("forwards If-None-Match without forwarding cookies or browser authorization", () => {
    const headers = proxyHeaders(
      { cookie: "secret", authorization: "browser-value", "if-none-match": 'W/"revision"' },
      "server-token",
      new URL("http://api.local/api/projects/1/image-composition"),
      { requestId: "request-1", editorCorrelationId: "editor-1" },
    );

    expect(headers["if-none-match"]).toBe('W/"revision"');
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBe("Bearer server-token");
  });

  it("preserves upstream 304 validator policy headers", () => {
    const headers = responseHeaders(
      { etag: '"revision"', "cache-control": "private, no-cache", "content-length": "0" },
      undefined,
      { requestId: "request-1", editorCorrelationId: "editor-1" },
    );

    expect(headers.etag).toBe('"revision"');
    expect(headers["cache-control"]).toBe("private, no-cache");
    expect(headers["content-length"]).toBe("0");
  });

  it("defaults proxy responses without an explicit policy to no-store", () => {
    const headers = responseHeaders(
      { "content-type": "application/json" },
      undefined,
      { requestId: "request-1", editorCorrelationId: "editor-1" },
    );
    expect(headers["cache-control"]).toBe("no-store");
  });
});
