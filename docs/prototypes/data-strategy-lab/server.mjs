/**
 * The prototype's one server (throwaway):
 *
 *  - `/api/*`            same-origin proxy to the LOCAL composed origin
 *                        (front Worker :8787) — the client strategy pages
 *                        fetch the real data plane without CORS, exactly
 *                        the shape the composed origin gives real variants.
 *  - `/loaders/`         the server-loaders + progressive-enhancement leg:
 *                        THIS server fetches the tray upstream, renders full
 *                        HTML; pagination is plain <a href> (works JS-off),
 *                        enhanced by htmx into partial swaps.
 *  - `/partials/grid`    the htmx swap target — grid-only HTML.
 *  - static              /plain/ /tanstack/ /apollo/ shells + /dist bundles
 *                        + vendored htmx.
 *
 * Design point proven here: the server leg PROPAGATES the upstream
 * x-pm-cache-state onto its own HTML responses, so the edge tier stays
 * observable even when the data fetch happens server-side (the real HTMX
 * variant's Worker owes the same pass-through).
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.PM_ORIGIN ?? "http://127.0.0.1:8787";
const PORT = Number(process.env.PORT ?? 8940);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Forward the live request modifiers (n / cache / run) + page upstream. */
function upstreamPlpUrl(query) {
  const q = new URLSearchParams();
  if (query.get("n")) q.set("n", query.get("n"));
  q.set("page", query.get("page") || "1");
  if (query.get("cache")) q.set("cache", query.get("cache"));
  if (query.get("run")) q.set("run", query.get("run"));
  return `${ORIGIN}/api/plp?${q.toString()}`;
}

function gridHtml(data) {
  const cards = data.items
    .map(
      (r) => `<article class="pm-card">
  <h2>${esc(r.title)}</h2>
  <p>${esc(r.artist)}${r.year ? ` — ${esc(r.year)}` : ""}</p>
  <p>${
    r.priceFrom
      ? `$${esc(r.priceFrom.amount)} (${esc(r.numForSale)} for sale)`
      : "not for sale"
  }</p>
</article>`,
    )
    .join("\n");
  return `<div id="grid" data-pm-page="${data.page}" data-pm-status="settled">\n${cards}\n</div>`;
}

/** Query string for a page link, preserving the condition knobs. */
function pageQs(query, page) {
  const q = new URLSearchParams(query);
  q.set("page", String(page));
  return q.toString();
}

function pagerHtml(query, data) {
  const prev = Math.max(1, data.page - 1);
  const next = data.page + 1;
  // Progressive enhancement: real links first (JS-off works — a full
  // document navigation), htmx upgrades them to grid-only swaps.
  return `<p>
  <a id="prev" href="/loaders/?${esc(pageQs(query, prev))}"
     hx-get="/partials/grid?${esc(pageQs(query, prev))}"
     hx-target="#grid" hx-swap="outerHTML">prev</a>
  page ${data.page}
  <a id="next" href="/loaders/?${esc(pageQs(query, next))}"
     hx-get="/partials/grid?${esc(pageQs(query, next))}"
     hx-target="#grid" hx-swap="outerHTML">next</a>
</p>`;
}

async function fetchTray(query) {
  const res = await fetch(upstreamPlpUrl(query));
  if (!res.ok) throw new Error(`upstream /api/plp ${res.status}`);
  return {
    data: await res.json(),
    cacheState: res.headers.get("x-pm-cache-state") ?? "unknown",
  };
}

const STATIC = {
  "/plain/": ["public/plain.html", "text/html; charset=utf-8"],
  "/tanstack/": ["public/tanstack.html", "text/html; charset=utf-8"],
  "/apollo/": ["public/apollo.html", "text/html; charset=utf-8"],
  "/dist/plain.js": ["dist/plain.js", "text/javascript"],
  "/dist/tanstack.js": ["dist/tanstack.js", "text/javascript"],
  "/dist/apollo.js": ["dist/apollo.js", "text/javascript"],
  "/vendor/htmx.min.js": ["vendor/htmx.min.js", "text/javascript"],
  "/sizes.json": ["dist/sizes.json", "application/json"],
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/assets/")) {
      const upstream = await fetch(`${ORIGIN}${url.pathname}${url.search}`);
      const body = Buffer.from(await upstream.arrayBuffer());
      const headers = { "content-type": upstream.headers.get("content-type") ?? "" };
      const cs = upstream.headers.get("x-pm-cache-state");
      if (cs) headers["x-pm-cache-state"] = cs;
      res.writeHead(upstream.status, headers);
      return res.end(body);
    }

    if (url.pathname === "/loaders/") {
      const { data, cacheState } = await fetchTray(url.searchParams);
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>loaders</title>
<script src="/vendor/htmx.min.js" defer></script></head>
<body><main>
<h1>data-strategy-lab</h1>
${pagerHtml(url.searchParams, data)}
${gridHtml(data)}
</main></body></html>`;
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-pm-cache-state": cacheState,
      });
      return res.end(html);
    }

    if (url.pathname === "/partials/grid") {
      const { data, cacheState } = await fetchTray(url.searchParams);
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-pm-cache-state": cacheState,
      });
      // The pager's "page N" label lives outside the swap target in this
      // throwaway; the grid carries data-pm-page, which is what the probe
      // (and the real HUD) reads.
      return res.end(gridHtml(data));
    }

    const hit = STATIC[url.pathname];
    if (hit) {
      const [file, type] = hit;
      const body = await readFile(join(ROOT, file));
      res.writeHead(200, { "content-type": type });
      return res.end(body);
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
  } catch (err) {
    // Generic out, detail server-side (the security.md habit, even throwaway).
    console.error(JSON.stringify({ level: "error", message: err.message }));
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("internal error\n");
  }
});

server.listen(PORT, () => {
  console.log(`data-strategy-lab prototype on http://127.0.0.1:${PORT} → origin ${ORIGIN}`);
});
