// THROWAWAY UI PROTOTYPE — run: node ./prototypes/home-carousel-2026-08-05/server.mjs
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml" };
createServer(async (request, response) => {
  const requested = request.url?.split("?")[0] || "/";
  const relative = requested === "/" ? "index.html" : requested.replace(/^\//, "");
  const path = normalize(join(root, relative));
  if (!path.startsWith(normalize(root))) return response.writeHead(403).end();
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": `${mime[extname(path)] || "application/octet-stream"}; charset=utf-8` });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4178, "127.0.0.1", () => console.log("Prototype: http://127.0.0.1:4178/?variant=A"));
