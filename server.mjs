// Production server: the same setup as `react-router-serve`, but the request log prints only the path.
// Shopify sends id_token, hmac and session in the query string; they must never reach the logs (CLAUDE.md hard rule).
import path from "node:path";
import url from "node:url";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";

const buildPath = path.resolve("build/server/index.js");
const build = await import(url.pathToFileURL(buildPath).href);
const port = Number(process.env.PORT) || 3000;

/** The request path without its query string. */
function logPath(originalUrl) {
  return (originalUrl || "").split("?")[0];
}

morgan.token("path", (req) => logPath(req.originalUrl || req.url));

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(
  path.posix.join(build.publicPath, "assets"),
  express.static(path.join(build.assetsBuildDirectory, "assets"), { immutable: true, maxAge: "1y" }),
);
app.use(build.publicPath, express.static(build.assetsBuildDirectory));
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan(":method :path :status :res[content-length] - :response-time ms"));
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = process.env.HOST ? app.listen(port, process.env.HOST, onListen) : app.listen(port, onListen);
function onListen() {
  console.log(`[perks] listening on ${port}`);
}
["SIGTERM", "SIGINT"].forEach((signal) => process.once(signal, () => server.close(console.error)));
