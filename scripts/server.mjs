import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
export function createServer(
  root,
  { prefix = "/", host = "127.0.0.1", port = 4173 } = {},
) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end("Not found");
      return;
    }
    const relative = pathname.slice(prefix.length) || "index.html";
    const file = path.resolve(base, relative);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      res.writeHead(404).end("Not found");
      return;
    }
    if (!stat.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
