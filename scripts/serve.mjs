// Mini serveur local pour prévisualiser dist/ : node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.argv[2] || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };

createServer(async (req, res) => {
  let p = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try { if ((await stat(p)).isDirectory()) p = path.join(p, "index.html"); } catch {}
  try {
    const body = await readFile(p);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(await readFile(path.join(DIST, "404.html")).catch(() => "404"));
  }
}).listen(PORT, () => console.log(`Aperçu : http://localhost:${PORT}`));
