#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
let root = "dist";
let listen = process.env.PORT || "3000";
let spa = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "-s" || arg === "--single") {
    spa = true;
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      root = args[i + 1];
      i += 1;
    }
    continue;
  }
  if (arg === "-l" || arg === "--listen") {
    listen = args[i + 1] || listen;
    i += 1;
    continue;
  }
  if (!arg.startsWith("-") && root === "dist") {
    root = arg;
  }
}

const rootDir = path.resolve(process.cwd(), root);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

function parseListen(value) {
  if (/^\d+$/.test(String(value))) {
    return { host: "0.0.0.0", port: Number(value) };
  }
  try {
    const url = new URL(String(value).includes("://") ? String(value) : `tcp://${value}`);
    return {
      host: url.hostname || "0.0.0.0",
      port: Number(url.port || process.env.PORT || 3000)
    };
  } catch {
    return { host: "0.0.0.0", port: Number(process.env.PORT || 3000) };
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, `.${target}`);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  let filePath = safeJoin(rootDir, pathname);
  if (!filePath) return send(res, 403, "Forbidden");

  const tryFile = (candidate, fallbackSpa = false) => {
    fs.stat(candidate, (err, stat) => {
      if (!err && stat.isDirectory()) {
        return tryFile(path.join(candidate, "index.html"), fallbackSpa);
      }
      if (err || !stat.isFile()) {
        if (fallbackSpa) {
          return tryFile(path.join(rootDir, "index.html"), false);
        }
        return send(res, 404, "Not Found");
      }
      const type = mime[path.extname(candidate).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
      fs.createReadStream(candidate).pipe(res);
    });
  };

  tryFile(filePath, spa);
});

const { host, port } = parseListen(listen);
server.listen(port, host, () => {
  console.log(`Serving ${rootDir} at http://${host}:${port}`);
});
