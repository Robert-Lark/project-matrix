/**
 * The gate's static server: serves the REPO ROOT over local HTTP so the
 * reference render (packages/reference/surfaces/…) and the deliberate-drift
 * fixture (tools/drift-gate/fixtures/…) load in a real browser with their
 * relative `node_modules/@pm/tokens` links resolving through the pnpm
 * workspace symlinks — the same shared CSS/font bytes the variants serve.
 *
 * `file://` was rejected: Chromium's font/CORS behavior on file URLs differs
 * from HTTP and the whole gate otherwise runs over HTTP.
 *
 * Binds 127.0.0.1 on an EPHEMERAL port — no fixed-port collision class, no
 * interaction with the origin-suite orchestrator's pre-flight list.
 * Local/CI-only; path traversal is rejected, symlinks inside the repo are
 * deliberately followed (that's how workspace links work).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, sep } from "node:path";

const MIME: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
};

export interface StaticServer {
  /** e.g. `http://127.0.0.1:49321` (no trailing slash). */
  origin: string;
  close(): Promise<void>;
}

export async function startRepoServer(rootDir: string): Promise<StaticServer> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const segments = decodeURIComponent(url.pathname)
        .split("/")
        .filter((s) => s !== "");
      if (segments.some((s) => s === "..")) {
        res.writeHead(400).end("bad path\n");
        return;
      }

      let filePath = join(rootDir, ...segments);
      if (url.pathname.endsWith("/")) {
        filePath = join(filePath, "index.html");
      } else {
        const s = await stat(filePath).catch(() => undefined);
        if (s?.isDirectory()) {
          res.writeHead(307, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
      }
      // Containment against the resolved JOIN (symlink targets inside the
      // repo, e.g. node_modules → ../../packages/tokens, stay reachable).
      if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
        res.writeHead(400).end("bad path\n");
        return;
      }

      const body = await readFile(filePath);
      res
        .writeHead(200, {
          "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
        })
        .end(body);
    } catch {
      res.writeHead(404).end("not found\n");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("static server bound to a non-TCP address");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
