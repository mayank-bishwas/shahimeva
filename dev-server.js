const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT || 8000);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};
const reloadClients = new Set();
let reloadTimer;

function broadcastReload() {
  for (const client of reloadClients) {
    client.write("data: reload\n\n");
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/__reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write("\n");
    reloadClients.add(response);
    request.on("close", () => reloadClients.delete(response));
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (
    (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) ||
    relativePath.split(/[\\/]/).some((part) => part.startsWith("."))
  ) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code !== "ENOENT" && error.code !== "EISDIR") {
        console.error(`Could not read ${relativePath}:`, error);
        response.writeHead(500);
        response.end("Could not read file");
        return;
      }

      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    let body = file;

    if (extension === ".html") {
      const liveReloadScript =
        '<script>const reloadEvents = new EventSource("/__reload"); reloadEvents.onmessage = () => location.reload();</script>';
      body = Buffer.from(file.toString("utf8").replace("</body>", `${liveReloadScript}</body>`));
    }

    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": body.length,
      "Content-Type": contentType,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  });
});

const watcher = fs.watch(root, { recursive: true }, (_eventType, filename) => {
  if (!filename || String(filename).split(/[\\/]/).some((part) => part.startsWith("."))) {
    return;
  }

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(broadcastReload, 100);
});

watcher.on("error", (error) => {
  console.error("Live reload file watcher failed:", error);
});

server.on("error", (error) => {
  console.error(`Could not start the local server on port ${port}:`, error.message);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Shahi Meva is running at http://localhost:${port}`);
  console.log("Edit index.html, styles.css, or script.js; the page will reload automatically.");
});
