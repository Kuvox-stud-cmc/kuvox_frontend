import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createCookieSessionStorage } from "react-router";
import {
  coalesceJsonRequest,
  renderCoalescingMetrics,
} from "./coalescing.mjs";

loadLocalEnv();

const API_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  "http://localhost:5280";
const AI_SERVICE_URL =
  process.env.VITE_AI_SERVICE_URL ||
  process.env.AI_SERVICE_URL ||
  "http://localhost:8000";

const DEV_SESSION_SECRET = "dev-only-session-secret-change-me";
const SESSION_SECRET =
  process.env.SESSION_SECRET || DEV_SESSION_SECRET;
const SESSION_SECRETS = Array.from(
  new Set([SESSION_SECRET, DEV_SESSION_SECRET].filter(Boolean)),
);
const UPLOAD_PROXY_TIMEOUT_MS = Number(process.env.UPLOAD_PROXY_TIMEOUT_MS) || 15 * 60 * 1000;

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__kuvox_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: SESSION_SECRETS,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
});

export function installProxyHandlers(appOrServer, maybeServer) {
  const app = maybeServer ? appOrServer : appOrServer.middlewares;
  const server = maybeServer || appOrServer.httpServer;

  app.use("/metrics", (req, res, next) => {
    if (incomingPathname(req, "/metrics") !== "/metrics") {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!metricsEnabled()) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.statusCode = 405;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.end(renderCoalescingMetrics());
  });

  app.use("/bff/media/upload", async (req, res) => {
    await proxyHttp(req, res, "/api/media");
  });

  app.use("/bff/projects", async (req, res, next) => {
    const pathname = incomingPathname(req, "/bff/projects");
    const imageCompositionRoute = parseProjectImageCompositionRoute(pathname);
    const editorBootstrapRoute = parseProjectEditorBootstrapRoute(pathname);
    const projectMediaRoute = parseProjectMediaRoute(pathname);
    const videoTimelineRoute = parseProjectVideoTimelineRoute(pathname);
    const route = editorBootstrapRoute ?? imageCompositionRoute ?? projectMediaRoute ?? videoTimelineRoute;
    if (!route) {
      next();
      return;
    }

    if (!route.methods.includes(req.method)) {
      res.setHeader("Allow", route.methods.join(", "));
      sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
      return;
    }

    await proxyHttp(req, res, route.targetPath);
  });

  app.use("/bff/media", async (req, res, next) => {
    const pathname = incomingPathname(req, "/bff/media");
    const objectRoute = parseMediaObjectRoute(pathname);
    const libraryRoute = parseMediaLibraryRoute(pathname);
    const route = objectRoute ?? libraryRoute;
    if (!route) {
      next();
      return;
    }

    if (!route.methods.includes(req.method)) {
      res.setHeader("Allow", route.methods.join(", "));
      sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
      return;
    }

    await proxyHttp(req, res, route.targetPath);
  });

  app.use("/bff/albums", async (req, res, next) => {
    const route = parseAlbumPickerRoute(incomingPathname(req, "/bff/albums"));
    if (!route) {
      next();
      return;
    }

    if (!route.methods.includes(req.method)) {
      res.setHeader("Allow", route.methods.join(", "));
      sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
      return;
    }

    await proxyHttp(req, res, route.targetPath);
  });

  app.use("/bff/timelines", async (req, res, next) => {
    const pathname = incomingPathname(req, "/bff/timelines");
    const renderRoute = parseTimelineRenderRoute(pathname);
    const renderJobRoute = parseTimelineRenderJobRoute(pathname);
    const performanceRoute = parseTimelinePerformanceRoute(pathname);
    const route = renderRoute ?? renderJobRoute ?? performanceRoute;
    if (!route) {
      next();
      return;
    }

    if (!route.methods.includes(req.method)) {
      res.setHeader("Allow", route.methods.join(", "));
      sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
      return;
    }

    await proxyHttp(req, res, route.targetPath);
  });

  app.use("/bff/ai", async (req, res, next) => {
    const pathname = incomingPathname(req, "/bff/ai");
    const retrievalRoute = parseAiRetrievalRoute(pathname);
    if (retrievalRoute) {
      if (!mediaRetrievalEnabled()) {
        sendJson(
          res,
          503,
          { error: "Media retrieval is disabled." },
          undefined,
          proxyCorrelation(req),
        );
        return;
      }

      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
        return;
      }

      await handleAiVideoEditorRetrieval(req, res);
      return;
    }

    const planningRoute = parseAiPlanningRoute(pathname);
    if (!planningRoute) {
      next();
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "Method not allowed." }, undefined, proxyCorrelation(req));
      return;
    }

    await proxyHttp(req, res, planningRoute.targetPath, { baseUrl: AI_SERVICE_URL });
  });

  app.use("/hubs/media", async (req, res) => {
    await proxyHttp(req, res, "/hubs/media");
  });

  server?.on("upgrade", async (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith("/hubs/media")) {
      return;
    }

    try {
      await proxyWebSocket(req, socket, head, "/hubs/media");
    } catch (error) {
      console.warn(`[kuvox-proxy] websocket proxy failed: ${errorMessage(error)}`);
      socket.destroy();
    }
  });
}

async function proxyHttp(req, res, targetPath, options = {}) {
  const correlation = proxyCorrelation(req);
  const auth = await accessTokenFromRequest(req);
  if (!auth.token) {
    sendJson(res, 401, { error: auth.error }, auth.setCookie, correlation);
    return;
  }

  const target = targetUrl(req.url, targetPath, options.baseUrl ?? API_URL);
  const headers = proxyHeaders(req.headers, auth.token, target, correlation);
  const transport = target.protocol === "https:" ? https : http;
  const start = performance.now();
  let upstream;
  let completed = false;
  let handledFailure = false;

  const failProxy = (error, status = 502) => {
    if (handledFailure || completed) {
      return;
    }
    handledFailure = true;

    const clientReset = isConnectionResetError(error);
    logProxyEvent(clientReset ? "info" : "warn", {
      event: clientReset ? "bff.proxy.aborted" : "bff.proxy.failure",
      method: req.method,
      targetRoute: target.pathname,
      status: clientReset ? 499 : status,
      durationMs: Math.round(performance.now() - start),
      requestId: correlation.requestId,
      editorCorrelationId: correlation.editorCorrelationId,
      error: errorMessage(error),
    });

    upstream?.destroy();
    if (res.destroyed || res.writableEnded) {
      return;
    }
    if (clientReset) {
      res.destroy();
      return;
    }
    if (!res.headersSent) {
      sendJson(res, status, { error: `Proxy request failed: ${errorMessage(error)}` }, auth.setCookie, correlation);
      return;
    }
    res.end();
  };

  req.on("aborted", () => {
    const error = new Error("Client aborted request.");
    error.code = "ECONNRESET";
    failProxy(error);
  });
  req.on("error", failProxy);
  req.socket?.on("error", failProxy);
  res.on("error", failProxy);
  res.on("finish", () => {
    completed = true;
  });

  upstream = transport.request(
    target,
    {
      method: req.method,
      headers,
    },
    async (upstreamRes) => {
      upstreamRes.on("error", failProxy);
      const statusCode = upstreamRes.statusCode ?? 502;
      const contentType = headerValue(upstreamRes.headers["content-type"]) ?? "unknown";
      logProxyEvent("info", {
        event: "bff.proxy",
        method: req.method,
        targetRoute: target.pathname,
        status: statusCode,
        contentType,
        durationMs: Math.round(performance.now() - start),
        requestId: correlation.requestId,
        editorCorrelationId: correlation.editorCorrelationId,
      });
      const setCookie = statusCode === 401
        ? await destroySessionCookie(req)
        : auth.setCookie;
      res.writeHead(statusCode, responseHeaders(upstreamRes.headers, setCookie, correlation));
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", failProxy);
  res.on("close", () => {
    if (!completed) {
      upstream.destroy();
    }
  });

  upstream.setTimeout(UPLOAD_PROXY_TIMEOUT_MS, () => {
    upstream.destroy(new Error("Upstream request timed out."));
  });

  req.pipe(upstream);
}

async function handleAiVideoEditorRetrieval(req, res) {
  const correlation = proxyCorrelation(req);
  const start = performance.now();
  const auth = await accessTokenFromRequest(req);
  if (!auth.token) {
    sendJson(res, 401, { error: auth.error }, auth.setCookie, correlation);
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid JSON body." }, auth.setCookie, correlation);
    return;
  }

  const projectId = stringOrEmpty(body?.projectId);
  const query = stringOrEmpty(body?.query);
  if (!projectId) {
    sendJson(res, 400, { error: "projectId is required." }, auth.setCookie, correlation);
    return;
  }

  try {
    const caller = requestAbortController(req, res);
    const projectMedia = await fetchAllProjectMediaForRetrieval(
      projectId,
      auth.token,
      correlation,
      caller.signal,
    ).finally(caller.cleanup);
    const trustedRequest = buildTrustedVideoRetrievalRequest(body, projectMedia);
    const mediaIds = trustedRequest.mediaIds;
    const aiResponse = await fetchJsonFromAiService(
      "/retrieval/video-editor",
      trustedRequest,
      correlation,
    );

    logProxyEvent("info", {
      event: "bff.ai.retrieval",
      method: req.method,
      targetRoute: "/retrieval/video-editor",
      status: 200,
      durationMs: Math.round(performance.now() - start),
      requestId: correlation.requestId,
      editorCorrelationId: correlation.editorCorrelationId,
      mediaCount: mediaIds.length,
      topK: normalizeTopK(body?.topK),
      modalities: normalizeModalities(body?.modalities),
    });
    sendJson(res, 200, aiResponse, auth.setCookie, correlation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Semantic retrieval failed.";
    logProxyEvent("warn", {
      event: "bff.ai.retrieval.failure",
      method: req.method,
      targetRoute: "/retrieval/video-editor",
      status: 502,
      durationMs: Math.round(performance.now() - start),
      requestId: correlation.requestId,
      editorCorrelationId: correlation.editorCorrelationId,
      error: message,
    });
    sendJson(res, 502, { error: message }, auth.setCookie, correlation);
  }
}

async function fetchAllProjectMediaForRetrieval(projectId, token, correlation, signal) {
  const encodedProjectId = encodeURIComponent(projectId);
  const fetchPage = (page) => {
    const path = `/api/projects/${encodedProjectId}/media?page=${page}&pageSize=100`;
    return coalesceJsonRequest({
      resource: "retrieval_project_media",
      method: "GET",
      origin: API_URL,
      path,
      token,
      signal,
      upstream: ({ signal: upstreamSignal }) => fetchJsonFromApi(path, token, correlation, upstreamSignal),
    });
  };

  const first = await fetchPage(1);
  const items = Array.isArray(first?.items) ? [...first.items] : [];
  const totalPages = Math.max(1, Number(first?.totalPages ?? 1));
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page);
    if (Array.isArray(next?.items)) items.push(...next.items);
  }
  return { ...first, items };
}

async function fetchJsonFromApi(pathname, token, correlation, signal) {
  const target = new URL(API_URL);
  target.pathname = pathname;
  target.search = "";
  const queryIndex = pathname.indexOf("?");
  if (queryIndex >= 0) {
    target.pathname = pathname.slice(0, queryIndex);
    target.search = pathname.slice(queryIndex);
  }
  const response = await fetch(target, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "x-request-id": correlation.requestId,
      "x-kuvox-editor-correlation-id": correlation.editorCorrelationId,
    },
  });
  if (!response.ok) {
    throw new Error(`Project media lookup returned ${response.status}.`);
  }
  return await response.json();
}

async function fetchJsonFromAiService(pathname, body, correlation) {
  const target = new URL(AI_SERVICE_URL);
  target.pathname = pathname;
  target.search = "";
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-request-id": correlation.requestId,
      "x-kuvox-editor-correlation-id": correlation.editorCorrelationId,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`AI retrieval returned ${response.status}.`);
  }
  return await response.json();
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

async function proxyWebSocket(req, socket, head, targetPath) {
  socket.on("error", (error) => {
    console.warn(`[kuvox-proxy] websocket client socket error: ${errorMessage(error)}`);
  });

  const auth = await accessTokenFromRequest(req, { allowRefresh: false });
  if (!auth.token) {
    console.warn(`[kuvox-proxy] websocket auth failed: ${auth.error}`);
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const target = targetUrl(req.url, targetPath, API_URL);
  const isSecure = target.protocol === "https:";
  const port = Number(target.port) || (isSecure ? 443 : 80);
  const host = target.hostname;
  const upstream = isSecure
    ? tls.connect(port, host, { servername: host })
    : net.connect(port, host);

  socket.on("close", () => {
    upstream.destroy();
  });

  upstream.once(isSecure ? "secureConnect" : "connect", () => {
    const headers = proxyHeaders(req.headers, auth.token, target, proxyCorrelation(req));
    headers.host = target.host;
    headers.connection = "Upgrade";
    headers.upgrade = "websocket";

    const lines = [`GET ${target.pathname}${target.search} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          lines.push(`${name}: ${item}`);
        }
      } else if (value !== undefined) {
        lines.push(`${name}: ${value}`);
      }
    }

    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) {
      upstream.write(head);
    }
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", (error) => {
    console.warn(`[kuvox-proxy] websocket upstream error: ${errorMessage(error)}`);
    socket.destroy();
  });
}

function targetUrl(originalUrl, targetPath, baseUrl = API_URL) {
  const api = new URL(baseUrl);
  const incoming = new URL(originalUrl ?? targetPath, "http://frontend.local");
  api.pathname = targetPath;
  api.search = incoming.search;
  return api;
}

function incomingPathname(req, mountedPrefix) {
  const original = req.originalUrl || `${mountedPrefix}${req.url || ""}`;
  return new URL(original, "http://frontend.local").pathname;
}

function parseMediaObjectRoute(pathname) {
  const match = /^\/bff\/media\/([^/]+)\/object\/([^/]+)$/.exec(pathname);
  if (!match) {
    return null;
  }

  const mediaId = match[1];
  const variant = match[2].toLowerCase();
  if (!["thumbnail", "canonical", "proxy", "raw"].includes(variant)) {
    return null;
  }

  return {
    targetPath: `/api/media/${mediaId}/object/${variant}`,
    methods: ["GET", "HEAD"],
  };
}

export function parseMediaLibraryRoute(pathname) {
  if (pathname === "/bff/media/library") {
    return { targetPath: "/api/media", methods: ["GET"] };
  }
  if (pathname === "/bff/media/shared") {
    return { targetPath: "/api/media/shared", methods: ["GET"] };
  }
  return null;
}

export function parseAlbumPickerRoute(pathname) {
  if (pathname === "/bff/albums/library") {
    return { targetPath: "/api/albums", methods: ["GET"] };
  }
  if (pathname === "/bff/albums/shared") {
    return { targetPath: "/api/albums/shared", methods: ["GET"] };
  }

  const mediaMatch = /^\/bff\/albums\/([^/]+)\/media$/.exec(pathname);
  if (mediaMatch) {
    return {
      targetPath: `/api/albums/${mediaMatch[1]}/media`,
      methods: ["GET"],
    };
  }
  return null;
}

function parseProjectImageCompositionRoute(pathname) {
  const match = /^\/bff\/projects\/([^/]+)\/image-composition$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/projects/${match[1]}/image-composition`,
    methods: ["GET", "PUT"],
  };
}

export function parseProjectEditorBootstrapRoute(pathname) {
  const match = /^\/bff\/projects\/([^/]+)\/editor-bootstrap$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/projects/${match[1]}/editor-bootstrap`,
    methods: ["GET"],
  };
}

function parseProjectMediaRoute(pathname) {
  const match = /^\/bff\/projects\/([^/]+)\/media$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/projects/${match[1]}/media`,
    methods: ["GET", "POST"],
  };
}

function parseProjectVideoTimelineRoute(pathname) {
  const match = /^\/bff\/projects\/([^/]+)\/video-timeline$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/timelines/projects/${match[1]}/current`,
    methods: ["GET", "PUT"],
  };
}

function parseTimelineRenderRoute(pathname) {
  const match = /^\/bff\/timelines\/([^/]+)\/render$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/timelines/${match[1]}/render`,
    methods: ["POST"],
  };
}

export function parseTimelineRenderJobRoute(pathname) {
  const outputMatch = /^\/bff\/timelines\/render-jobs\/([^/]+)\/output$/.exec(pathname);
  if (outputMatch) {
    return {
      targetPath: `/api/timelines/render-jobs/${outputMatch[1]}/output`,
      methods: ["GET", "HEAD"],
    };
  }

  const jobMatch = /^\/bff\/timelines\/render-jobs\/([^/]+)$/.exec(pathname);
  if (!jobMatch) {
    return null;
  }

  return {
    targetPath: `/api/timelines/render-jobs/${jobMatch[1]}`,
    methods: ["GET"],
  };
}

function parseTimelinePerformanceRoute(pathname) {
  const match = /^\/bff\/timelines\/projects\/([^/]+)\/performance$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: `/api/timelines/projects/${match[1]}/performance`,
    methods: ["POST"],
  };
}

function parseAiPlanningRoute(pathname) {
  const match = /^\/bff\/ai\/planning\/video-editor$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: "/planning/video-editor",
  };
}

function parseAiRetrievalRoute(pathname) {
  const match = /^\/bff\/ai\/retrieval\/video-editor$/.exec(pathname);
  if (!match) {
    return null;
  }

  return {
    targetPath: "/retrieval/video-editor",
  };
}

export function trustedVideoMediaScope(projectMediaResponse) {
  const items = Array.isArray(projectMediaResponse?.items) ? projectMediaResponse.items : [];
  const byMediaId = new Map();
  const mediaIds = new Set();
  let cacheable = true;
  for (const item of items
    .filter((item) =>
      item &&
      typeof item === "object" &&
      item.kind === 0 &&
      String(item.availability ?? "").toLowerCase() === "available" &&
      String(item.status ?? "").toLowerCase() === "ready" &&
      typeof item.mediaId === "string" &&
      item.mediaId.length > 0,
    )) {
    const mediaId = item.mediaId.trim().toLowerCase();
    if (!mediaId) {
      continue;
    }
    mediaIds.add(mediaId);
    const revision = positiveRevision(item.searchRevision);
    if (revision === null) {
      cacheable = false;
      continue;
    }
    const existing = byMediaId.get(mediaId);
    if (existing !== undefined && revision !== existing) {
      cacheable = false;
    } else if (existing === undefined) {
      byMediaId.set(mediaId, revision);
    }
  }

  const sortedMediaIds = Array.from(mediaIds).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (!cacheable || sortedMediaIds.length === 0 || byMediaId.size !== sortedMediaIds.length) {
    return { mediaIds: sortedMediaIds, scopeRevision: undefined };
  }
  const pairs = sortedMediaIds.map((mediaId) => [mediaId, byMediaId.get(mediaId)]);
  const canonicalScope = pairs.map(([mediaId, revision]) => `${mediaId}:${revision}`).join("|");
  return {
    mediaIds: sortedMediaIds,
    scopeRevision: createHash("sha256").update(canonicalScope, "utf8").digest("hex"),
  };
}

export function buildTrustedVideoRetrievalRequest(browserBody, projectMediaResponse) {
  const trustedScope = trustedVideoMediaScope(projectMediaResponse);
  return {
    projectId: stringOrEmpty(browserBody?.projectId),
    mediaIds: trustedScope.mediaIds,
    ...(trustedScope.scopeRevision ? { scopeRevision: trustedScope.scopeRevision } : {}),
    query: stringOrEmpty(browserBody?.query),
    modalities: normalizeModalities(browserBody?.modalities),
    topK: normalizeTopK(browserBody?.topK),
    expandGraph: browserBody?.expandGraph !== false,
  };
}

function positiveRevision(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function normalizeModalities(value) {
  const allowed = new Set(["visual", "transcript", "audio", "ocr"]);
  if (!Array.isArray(value)) {
    return ["transcript", "ocr"];
  }
  const modalities = value.filter((item) => typeof item === "string" && allowed.has(item));
  return modalities.length > 0 ? Array.from(new Set(modalities)) : ["transcript", "ocr"];
}

function normalizeTopK(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 8;
  }
  return Math.min(50, Math.max(1, Math.trunc(numeric)));
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

export function proxyHeaders(originalHeaders, token, target, correlation) {
  const headers = { ...originalHeaders };
  delete headers.cookie;
  delete headers.host;
  delete headers.connection;
  headers.host = target.host;
  headers.authorization = `Bearer ${token}`;
  headers["x-request-id"] = correlation.requestId;
  headers["x-kuvox-editor-correlation-id"] = correlation.editorCorrelationId;
  return headers;
}

async function accessTokenFromRequest(req, options = {}) {
  const allowRefresh = options.allowRefresh !== false;
  const hasSessionCookie = hasCookie(req.headers.cookie, "__kuvox_session");
  const session = await sessionStorage.getSession(req.headers.cookie);
  const user = session.get("user");
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  const expiresAt = session.get("expiresAt");
  const sessionState = {
    hasSessionCookie,
    hasUser: Boolean(user),
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    hasExpiresAt: Boolean(expiresAt),
  };

  if (!accessToken && !refreshToken) {
    console.warn("[kuvox-proxy] auth failed: no signed-in session", sessionState);
    return { token: null, error: "Not signed in." };
  }

  if (accessToken && expiresAt && new Date(expiresAt).getTime() > Date.now() + 5_000) {
    return { token: accessToken };
  }

  if (!allowRefresh || !refreshToken) {
    console.warn(
      "[kuvox-proxy] auth failed: session expired and cannot refresh",
      sessionState,
    );
    return {
      token: null,
      error: "Your session expired. Please sign in again.",
      setCookie: await sessionStorage.destroySession(session),
    };
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    session.set("accessToken", tokens.accessToken);
    session.set("refreshToken", tokens.refreshToken);
    session.set("expiresAt", tokens.expiresAt);
    console.log("[kuvox-proxy] refreshed access token", sessionState);
    return {
      token: tokens.accessToken,
      setCookie: await sessionStorage.commitSession(session),
    };
  } catch (error) {
    console.warn(
      `[kuvox-proxy] auth failed: token refresh failed${
        error instanceof Error ? `: ${error.message}` : ""
      }`,
      sessionState,
    );
    return {
      token: null,
      error: "Your session expired. Please sign in again.",
      setCookie: await sessionStorage.destroySession(session),
    };
  }
}

async function destroySessionCookie(req) {
  const session = await sessionStorage.getSession(req.headers.cookie);
  return sessionStorage.destroySession(session);
}

function hasCookie(header, name) {
  if (!header) {
    return false;
  }

  return header.split(";").some((cookie) => cookie.trim().startsWith(`${name}=`));
}

async function refreshAccessToken(refreshToken) {
  const target = new URL(API_URL);
  target.pathname = "/api/auth/refresh";
  target.search = "";

  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refreshToken),
  });

  if (!response.ok) {
    throw new Error(`refresh returned ${response.status}`);
  }

  const tokens = await response.json();
  if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.expiresAt) {
    throw new Error("refresh returned an invalid token payload");
  }

  return tokens;
}

export function responseHeaders(upstreamHeaders, setCookie, correlation) {
  const headers = { ...upstreamHeaders };
  if (!headers["cache-control"]) {
    headers["cache-control"] = "no-store";
  }
  headers["x-request-id"] = correlation.requestId;
  headers["x-kuvox-editor-correlation-id"] = correlation.editorCorrelationId;
  if (!setCookie) {
    return headers;
  }

  const upstreamSetCookie = headers["set-cookie"];
  headers["set-cookie"] = upstreamSetCookie
    ? [...asArray(upstreamSetCookie), setCookie]
    : setCookie;
  return headers;
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function headerValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
}

function isConnectionResetError(error) {
  return error?.code === "ECONNRESET" || /ECONNRESET|socket hang up/i.test(errorMessage(error));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error.");
}

function sendJson(res, statusCode, body, setCookie, correlation = null) {
  if (body.error) {
    console.warn(`[kuvox-proxy] returning ${statusCode}: ${body.error}`);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (correlation) {
    res.setHeader("x-request-id", correlation.requestId);
    res.setHeader("x-kuvox-editor-correlation-id", correlation.editorCorrelationId);
  }
  if (setCookie) {
    res.setHeader("Set-Cookie", setCookie);
  }
  res.end(JSON.stringify(body));
}

function proxyCorrelation(req) {
  const requestId = headerValue(req.headers["x-request-id"]) || randomUUID();
  const editorCorrelationId = headerValue(req.headers["x-kuvox-editor-correlation-id"]) || requestId;
  req.headers["x-request-id"] = requestId;
  req.headers["x-kuvox-editor-correlation-id"] = editorCorrelationId;
  return { requestId, editorCorrelationId };
}

function logProxyEvent(level, fields) {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !/authorization|cookie|token|session|secret/i.test(key)),
  );
  console[level === "warn" ? "warn" : "log"]("[kuvox-proxy]", safeFields);
}

function requestAbortController(req, res) {
  const controller = new AbortController();
  const abort = () => {
    if (!res.writableEnded) {
      controller.abort(new Error("Caller aborted request."));
    }
  };
  req.once("aborted", abort);
  res.once("close", abort);
  return {
    signal: controller.signal,
    cleanup() {
      req.off("aborted", abort);
      res.off("close", abort);
    },
  };
}

function metricsEnabled() {
  return String(process.env.KUVOX_BFF_METRICS_ENABLED ?? "false").trim().toLowerCase() === "true";
}

export function mediaRetrievalEnabled() {
  return String(process.env.KUVOX_MEDIA_RETRIEVAL_ENABLED ?? "false").trim().toLowerCase() === "true";
}

function loadLocalEnv() {
  const proxyDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(proxyDir, "../.env"),
  ];

  for (const envPath of new Set(candidates)) {
    if (fs.existsSync(envPath)) {
      loadEnvFile(envPath);
    }
  }
}

function loadEnvFile(envPath) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
