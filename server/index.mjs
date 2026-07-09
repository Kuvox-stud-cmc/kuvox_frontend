import path from "node:path";
import url from "node:url";
import express from "express";
import { createRequestHandler } from "@react-router/express";
import { installProxyHandlers } from "./proxy.mjs";

process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST;
const buildPathArg = process.argv[2] || "./build/server/index.js";
const buildPath = path.resolve(buildPathArg);
const build = await import(url.pathToFileURL(buildPath).href);
const clientBuildDirectory = path.resolve(path.dirname(buildPath), "../client");
const publicDirectory = path.resolve("public");

const ONE_HOUR_SECONDS = 60 * 60;
const ONE_DAY_SECONDS = 24 * ONE_HOUR_SECONDS;
const THIRTY_DAYS_SECONDS = 30 * ONE_DAY_SECONDS;
const ONE_YEAR_SECONDS = 365 * ONE_DAY_SECONDS;

const app = express();
app.disable("x-powered-by");

const server = host ? app.listen(port, host, onListen) : app.listen(port, onListen);

installProxyHandlers(app, server);

app.use(
  "/assets",
  express.static(path.join(clientBuildDirectory, "assets"), {
    immutable: true,
    maxAge: "1y",
    setHeaders: setImmutableAssetHeaders,
  }),
);
app.use(
  express.static(clientBuildDirectory, {
    maxAge: "1h",
    setHeaders: setClientBuildHeaders,
  }),
);
app.use(
  express.static(publicDirectory, {
    etag: true,
    lastModified: true,
    maxAge: "1h",
    setHeaders: setPublicAssetHeaders,
  }),
);
app.use(setHtmlCacheHeaders);
app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  }),
);

function onListen() {
  const shownHost = host || "localhost";
  console.log(`[kuvox-frontend] http://${shownHost}:${port}`);
}

function setImmutableAssetHeaders(res) {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
  );
}

function setClientBuildHeaders(res, filePath) {
  const relativePath = normalizeRelativePath(clientBuildDirectory, filePath);

  if (isLongLivedPublicAsset(relativePath)) {
    setLongLivedPublicAssetHeaders(res, relativePath);
    return;
  }

  if (isHtmlFile(filePath)) {
    res.setHeader("Cache-Control", "no-store");
    return;
  }

  res.setHeader(
    "Cache-Control",
    `public, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=${ONE_DAY_SECONDS}`,
  );
}

function setPublicAssetHeaders(res, filePath) {
  const relativePath = normalizeRelativePath(publicDirectory, filePath);

  if (isLongLivedPublicAsset(relativePath)) {
    setLongLivedPublicAssetHeaders(res, relativePath);
    return;
  }

  if (isHtmlFile(filePath)) {
    res.setHeader("Cache-Control", "no-store");
    return;
  }

  res.setHeader(
    "Cache-Control",
    `public, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=${ONE_HOUR_SECONDS}`,
  );
}

function setHtmlCacheHeaders(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  next();
}

function normalizeRelativePath(rootDirectory, filePath) {
  return path.relative(rootDirectory, filePath).split(path.sep).join("/");
}

function isLongLivedPublicAsset(relativePath) {
  const normalized = relativePath.toLowerCase();
  return (
    normalized.startsWith("landingpage/")
    || normalized.startsWith("images/")
    || normalized === "hero-preview.png"
    || normalized === "favicon.ico"
    || normalized === "logo.svg"
  );
}

function setLongLivedPublicAssetHeaders(res, relativePath) {
  const normalized = relativePath.toLowerCase();
  const maxAge = normalized.startsWith("landingpage/")
    ? THIRTY_DAYS_SECONDS
    : 7 * ONE_DAY_SECONDS;

  res.setHeader(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${ONE_DAY_SECONDS}`,
  );
}

function isHtmlFile(filePath) {
  return path.extname(filePath).toLowerCase() === ".html";
}

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server.close(console.error));
});
