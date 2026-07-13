/**
 * The observability probe: drives every strategy page through the SAME
 * interaction sequence against the real local composed origin and records,
 * per step, the tray-bearing network requests, their bytes, the wall time
 * to settle, and the edge tier's x-pm-cache-state — proving the scenario
 * cells are buildable and the differences observable.
 *
 * Sequence (the client-warmth mechanism, prime → measure):
 *   S1 load page 1            (first contact)
 *   S2 next  → page 2         (a FRESH state: no cache can help)
 *   S3 prev  → page 1         (a REVISIT: exactly what a client cache is for)
 *
 * Wall times are probe-side and local — directional only, never bench-grade
 * (the bench runner owns published latency under real profiles).
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:8940";
const nonce = `proto-${process.pid}-${Date.now()}`;

/** Tray-bearing = the request that carries the tray to the browser. */
const isTray = (url) =>
  url.includes("/api/plp") || url.includes("/partials/grid") || url.includes("/loaders/?");

const STRATEGIES = [
  { id: "plain-cold", url: `/plain/?cache=cold&run=${nonce}` },
  { id: "tanstack-cold", url: `/tanstack/?cache=cold&run=${nonce}` },
  { id: "tanstack-default-staletime", url: `/tanstack/?cache=cold&stale=0&run=${nonce}` },
  { id: "apollo-cold", url: `/apollo/?cache=cold&run=${nonce}` },
  { id: "loaders-cold", url: `/loaders/?cache=cold&run=${nonce}` },
  // The edge leg: SAME plain build, bypass dropped — a fresh nonce keys a
  // private warm-tier lane, so S1/S2 are misses and S3's revisit is a KV HIT
  // (the edge serving the repeat instead of the client).
  { id: "plain-edge", url: `/plain/?run=${nonce}-edge` },
  { id: "loaders-edge", url: `/loaders/?run=${nonce}-edge-l` },
];

async function settled(page, n, timeout = 15000) {
  await page.waitForSelector(
    `#grid[data-pm-page="${n}"][data-pm-status="settled"]`,
    { timeout },
  );
}

async function newBytes(page, sinceCount) {
  const entries = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      transferSize: e.transferSize,
    })),
  );
  return entries.slice(sinceCount);
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  // Same fallback the origin suite uses: no bundled Chromium on a dev
  // machine whose TLS interception blocks the Playwright CDN — drive the
  // system Chrome instead.
  browser = await chromium.launch({ channel: "chrome" });
}
const results = [];

for (const s of STRATEGIES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const trayLog = []; // { url, cacheState, step }
  let step = "S1";
  page.on("response", (res) => {
    if (isTray(res.url())) {
      trayLog.push({
        url: res.url().replace(BASE, ""),
        cacheState: res.headers()["x-pm-cache-state"] ?? null,
        step,
      });
    }
  });

  const record = { id: s.id, url: s.url, steps: {} };

  // S1 — first contact
  let t0 = Date.now();
  await page.goto(`${BASE}${s.url}`, { waitUntil: "load" });
  await settled(page, 1);
  let resCount = (await newBytes(page, 0)).length;
  record.steps.S1 = {
    wallMs: Date.now() - t0,
    trayRequests: trayLog.filter((r) => r.step === "S1").length,
    cacheStates: trayLog.filter((r) => r.step === "S1").map((r) => r.cacheState),
  };

  // S2 — fresh state (page 2)
  step = "S2";
  t0 = Date.now();
  await page.click("#next");
  await settled(page, 2);
  let entries = await newBytes(page, resCount);
  resCount += entries.length;
  record.steps.S2 = {
    wallMs: Date.now() - t0,
    trayRequests: trayLog.filter((r) => r.step === "S2").length,
    trayBytes: entries
      .filter((e) => isTray(e.name))
      .reduce((a, e) => a + e.transferSize, 0),
    cacheStates: trayLog.filter((r) => r.step === "S2").map((r) => r.cacheState),
  };

  // S3 — the revisit (page 1 again)
  step = "S3";
  t0 = Date.now();
  await page.click("#prev");
  await settled(page, 1);
  entries = await newBytes(page, resCount);
  record.steps.S3 = {
    wallMs: Date.now() - t0,
    trayRequests: trayLog.filter((r) => r.step === "S3").length,
    trayBytes: entries
      .filter((e) => isTray(e.name))
      .reduce((a, e) => a + e.transferSize, 0),
    cacheStates: trayLog.filter((r) => r.step === "S3").map((r) => r.cacheState),
  };

  results.push(record);
  await context.close();
}

await browser.close();

// ── Assertions: the differences the scenario table claims are observable ──
const byId = Object.fromEntries(results.map((r) => [r.id, r]));
const failures = [];
const expect = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
};

// Every strategy pays for a FRESH state (S2) — no cache can help.
for (const r of results) {
  expect(r.steps.S2.trayRequests >= 1, `${r.id}: fresh state (S2) hits the network`);
}
// The revisit (S3) is where strategies separate.
expect(byId["plain-cold"].steps.S3.trayRequests === 1, "plain: revisit refetches (1 request)");
expect(byId["loaders-cold"].steps.S3.trayRequests === 1, "loaders: revisit refetches a partial (1 request)");
expect(byId["tanstack-cold"].steps.S3.trayRequests === 0, "tanstack (staleTime 5min): revisit is FREE (0 requests)");
expect(byId["apollo-cold"].steps.S3.trayRequests === 0, "apollo (cache-first): revisit is free too — the exhibit's UX matches; its cost is bytes");
expect(
  byId["tanstack-default-staletime"].steps.S3.trayRequests >= 1,
  "tanstack DEFAULT (staleTime 0): revisit paints from cache but refetches in background (bytes ≠ 0) — why the published config matters",
);
// Edge semantics: cold pins bypass; a nonce-keyed warm lane goes miss → hit.
expect(
  byId["plain-cold"].steps.S1.cacheStates.concat(byId["plain-cold"].steps.S3.cacheStates).every((c) => c === "bypass"),
  "plain-cold: every tray response is x-pm-cache-state: bypass",
);
expect(
  byId["plain-edge"].steps.S1.cacheStates[0] === "miss" &&
    byId["plain-edge"].steps.S3.cacheStates[0] === "hit",
  "plain-edge: same build, S1 miss → S3 revisit served by the EDGE (hit)",
);
expect(
  byId["loaders-edge"].steps.S3.cacheStates[0] === "hit",
  "loaders-edge: server-side data fetch still observable — x-pm-cache-state propagated onto HTML (hit on revisit)",
);

console.log("\nPer-step summary (wallMs local+directional only):");
for (const r of results) {
  console.log(
    `${r.id.padEnd(28)} S1 ${String(r.steps.S1.wallMs).padStart(5)}ms ${r.steps.S1.trayRequests}req | ` +
      `S2 ${String(r.steps.S2.wallMs).padStart(5)}ms ${r.steps.S2.trayRequests}req ${r.steps.S2.trayBytes}B | ` +
      `S3 ${String(r.steps.S3.wallMs).padStart(5)}ms ${r.steps.S3.trayRequests}req ${r.steps.S3.trayBytes}B  ` +
      `cs:${[...r.steps.S1.cacheStates, ...r.steps.S2.cacheStates, ...r.steps.S3.cacheStates].join(",")}`,
  );
}

await writeFile(join(ROOT, "evidence.json"), JSON.stringify({ nonce, results }, null, 2));
console.log(`\nevidence.json written (nonce ${nonce})`);
if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) FAILED`);
  process.exit(1);
}
console.log("all assertions passed");
