import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist"),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};
createServer(async (req, res) => {
  try {
    let path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (path !== root && !path.startsWith(root + "/")) throw Error();
    if ((await stat(path)).isDirectory()) path += "/index.html";
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-cache");
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Local: http://localhost:${port}`),
);
