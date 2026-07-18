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
 * `/assets/img/*` is ALIASED onto a snapshot's img directory (surface-design
 * session): the rendered masters carry image srcs exactly as the trays do —
 * `/assets/img/…`, the composed origin's data-plane path (lib.mjs `imageSrc`)
 * — so the gate's server must answer that path or every master's images 404.
 * Default: the committed fixture snapshot (what the committed masters are
 * rendered from — CI never reads the crate, ADR-0007). Overridable for the
 * deployed-smoke leg, which re-renders masters from the RESOLVED served
 * snapshot (the origin-suite snapshot.ts precedent) and points the alias at
 * that snapshot's img dir.
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

export interface RepoServerOptions {
  /** Directory served at `/assets/img/*` (a snapshot's img dir). Defaults to
   *  the committed fixture snapshot's — the source the committed masters are
   *  rendered from. */
  assetsImgDir?: string;
}

export async function startRepoServer(
  rootDir: string,
  options: RepoServerOptions = {},
): Promise<StaticServer> {
  const assetsImgDir =
    options.assetsImgDir ??
    join(rootDir, "tools", "snapshot-fixture", "snapshot", "img");
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

      // The data-plane image alias (see header): /assets/img/{file} maps
      // onto the snapshot img dir; everything else maps onto the repo root.
      const aliased = segments[0] === "assets" && segments[1] === "img";
      const baseDir = aliased ? assetsImgDir : rootDir;
      const baseSegments = aliased ? segments.slice(2) : segments;

      let filePath = join(baseDir, ...baseSegments);
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
      if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
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
