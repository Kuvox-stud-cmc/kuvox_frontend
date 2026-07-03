import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { createCookieSessionStorage } from "react-router";

loadLocalEnv();

const API_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  "http://localhost:5280";

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

  app.use("/bff/media/upload", async (req, res) => {
    await proxyHttp(req, res, "/api/media");
  });

  app.use("/bff/media", async (req, res, next) => {
    const pathname = incomingPathname(req, "/bff/media");
    const objectRoute = parseMediaObjectRoute(pathname);
    if (!objectRoute) {
      next();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    await proxyHttp(req, res, objectRoute.targetPath);
  });

  app.use("/hubs/media", async (req, res) => {
    await proxyHttp(req, res, "/hubs/media");
  });

  server?.on("upgrade", async (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith("/hubs/media")) {
      return;
    }

    await proxyWebSocket(req, socket, head, "/hubs/media");
  });
}

async function proxyHttp(req, res, targetPath) {
  const auth = await accessTokenFromRequest(req);
  if (!auth.token) {
    sendJson(res, 401, { error: auth.error }, auth.setCookie);
    return;
  }

  const target = targetUrl(req.url, targetPath);
  const headers = proxyHeaders(req.headers, auth.token, target);
  const transport = target.protocol === "https:" ? https : http;
  const start = performance.now();

  const upstream = transport.request(
    target,
    {
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const statusCode = upstreamRes.statusCode ?? 502;
      const contentType = headerValue(upstreamRes.headers["content-type"]) ?? "unknown";
      console.log(
        `[kuvox-proxy] ${req.method} ${target.pathname}${target.search} -> ${statusCode} ${contentType} (${Math.round(
          performance.now() - start,
        )}ms)`,
      );
      res.writeHead(statusCode, responseHeaders(upstreamRes.headers, auth.setCookie));
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    console.warn(
      `[kuvox-proxy] ${req.method} ${target.pathname} failed: ${error.message}`,
    );
    if (!res.headersSent) {
      sendJson(res, 502, { error: `Proxy request failed: ${error.message}` });
      return;
    }
    res.end();
  });

  upstream.setTimeout(UPLOAD_PROXY_TIMEOUT_MS, () => {
    upstream.destroy(new Error("Upstream request timed out."));
  });

  req.pipe(upstream);
}

async function proxyWebSocket(req, socket, head, targetPath) {
  const auth = await accessTokenFromRequest(req, { allowRefresh: false });
  if (!auth.token) {
    console.warn(`[kuvox-proxy] websocket auth failed: ${auth.error}`);
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const target = targetUrl(req.url, targetPath);
  const isSecure = target.protocol === "https:";
  const port = Number(target.port) || (isSecure ? 443 : 80);
  const host = target.hostname;
  const upstream = isSecure
    ? tls.connect(port, host, { servername: host })
    : net.connect(port, host);

  upstream.once(isSecure ? "secureConnect" : "connect", () => {
    const headers = proxyHeaders(req.headers, auth.token, target);
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

  upstream.on("error", () => {
    socket.destroy();
  });
}

function targetUrl(originalUrl, targetPath) {
  const api = new URL(API_URL);
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
  };
}

function proxyHeaders(originalHeaders, token, target) {
  const headers = { ...originalHeaders };
  delete headers.cookie;
  delete headers.host;
  delete headers.connection;
  headers.host = target.host;
  headers.authorization = `Bearer ${token}`;
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

function responseHeaders(upstreamHeaders, setCookie) {
  if (!setCookie) {
    return upstreamHeaders;
  }

  const headers = { ...upstreamHeaders };
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

function sendJson(res, statusCode, body, setCookie) {
  console.warn(`[kuvox-proxy] returning ${statusCode}: ${body.error}`);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  if (setCookie) {
    res.setHeader("Set-Cookie", setCookie);
  }
  res.end(JSON.stringify(body));
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
