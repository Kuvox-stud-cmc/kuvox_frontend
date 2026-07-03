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

const app = express();
app.disable("x-powered-by");

const server = host ? app.listen(port, host, onListen) : app.listen(port, onListen);

installProxyHandlers(app, server);

app.use(
  "/assets",
  express.static(path.join(clientBuildDirectory, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(express.static(clientBuildDirectory));
app.use(express.static("public", { maxAge: "1h" }));
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

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server.close(console.error));
});
