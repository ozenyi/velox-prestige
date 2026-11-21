import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const port = Number(process.env.PORT || 4173);
const base = "/velox-prestige";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    res.writeHead(302, { Location: base + "/" });
    res.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Introuvable");
    return;
  }
  let relative = pathname.slice(base.length) || "/";
  if (relative.endsWith("/")) relative += "index.html";
  const file = path.normalize(path.join(dist, relative));
  if (!file.startsWith(dist)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      const fallback = path.join(dist, "404.html");
      fs.readFile(fallback, (err404, page) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(err404 ? "Introuvable" : page);
      });
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}${base}/`);
});
