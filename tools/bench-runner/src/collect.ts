/**
 * One measured visit (ADR-0001 §2, §3, §5, §6): drive a composed-origin URL
 * in a real Chromium under an applied profile, and account for everything
 * the receipt needs — from the browser's own accounting, never estimates.
 *
 *  - Web vitals come from the injected chrome's own pinned web-vitals build
 *    (THE one ruler, §2), harvested by intercepting `POST /api/beacon`: the
 *    payload is recorded and the request is fulfilled locally with a 204,
 *    so LAB traffic never reaches the RUM collector (§1: lab and field have
 *    split roles — a bench run must not pollute field data).
 *  - Bytes are compressed transfer sizes from resource timing (§6), bucketed
 *    HTML/JS/CSS/fonts/images/data (§3), with every /_pm/* and /api/beacon
 *    byte stripped (the instrumentation-boundary contract,
 *    packages/switcher/README.md) — stripped but REPORTED, so the exclusion
 *    is visible and provably non-vacuous.
 *  - TTFB decomposes into travel vs server think-time from the navigation-
 *    timing sub-phases (§5), raw timestamps kept (§9: publish the arithmetic).
 *  - The scripted interaction is a registry id (reproducible by name); the
 *    resource-timing delta across it is the per-interaction byte cost (§3).
 */
import type { Browser, Page } from "playwright";
import { kbpsToBytesPerSecond, type TestProfile } from "@pm/measurement";
import { type RunSampleT } from "./receipt";

/** Scripted interactions, reproducible from a receipt by id. */
export const INTERACTIONS: Readonly<
  Record<string, (page: Page) => Promise<void>>
> = {
  none: async () => {},
  /** The trivial interaction (issue #7: placeholders exercise it trivially):
   *  a real click on the page body — enough for the event-timing pipeline
   *  (INP) and a zero-byte per-interaction cost on static placeholders. */
  "body-click": async (page) => {
    await page.locator("main h1").first().click();
  },
  /** The editorial surface's ONE designed interaction (ADR-0008 §8): the
   *  featured release's Add to cart. Selected by accessible role + name —
   *  the canonical markup contract every variant must serve identically —
   *  and clicked COLD, no warm-up: the first click's latency IS the honest
   *  scripted INP, including any lazy handler binding a paradigm defers to
   *  that moment (resumability defers the binding, not the bytes — the
   *  slice-D measurement this surface's reading must not hide). The event
   *  registers regardless of when the handler resolves, so the event-timing
   *  entry the INP pipeline needs exists even where binding is deferred. */
  "editorial-add-to-cart": async (page) => {
    await page.getByRole("button", { name: "Add to cart" }).click();
  },
};

export interface ApplyResult {
  mechanism: string;
  latencyMs: number;
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  cpuMultiplier: number;
}

/**
 * Apply the profile's network/CPU axes at the automation layer via CDP —
 * the pinned TARGET characteristics applied directly (the profile spec
 * documents that Lighthouse's own applied-throttling multipliers are its
 * business, not the spec's). Returns what was actually sent to the browser.
 */
export async function applyProfile(
  page: Page,
  profile: TestProfile,
): Promise<ApplyResult> {
  const cdp = await page.context().newCDPSession(page);
  const applied: ApplyResult = {
    mechanism: "cdp-applied (Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate)",
    latencyMs: profile.network.rttMs,
    downloadBytesPerSec: kbpsToBytesPerSecond(profile.network.downloadKbps),
    uploadBytesPerSec: kbpsToBytesPerSecond(profile.network.uploadKbps),
    cpuMultiplier: profile.cpuMultiplier,
  };
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: applied.latencyMs,
    downloadThroughput: applied.downloadBytesPerSec,
    uploadThroughput: applied.uploadBytesPerSec,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: applied.cpuMultiplier });
  return applied;
}

/** Browser-context options for a profile's viewport axis — JS ON (the
 *  measurement client must run; contrast the drift gate's JS-off contexts). */
export function profileContextOptions(profile: TestProfile) {
  return {
    viewport: { width: profile.viewport.width, height: profile.viewport.height },
    deviceScaleFactor: profile.viewport.deviceScaleFactor,
    isMobile: profile.viewport.mobile,
    hasTouch: profile.viewport.mobile,
  };
}

interface ResourceEntry {
  name: string;
  transferSize: number;
}

/** The instrumentation boundary (packages/switcher/README.md): /_pm/*
 *  subresources and /api/beacon requests are the chrome's, not the page's. */
function isInstrumentation(url: string): boolean {
  const pathname = new URL(url).pathname;
  return pathname.startsWith("/_pm/") || pathname === "/api/beacon";
}

function bucketOf(url: string): keyof RunSampleT["kb"]["buckets"] {
  const pathname = new URL(url).pathname;
  if (pathname.startsWith("/api/")) return "data";
  const ext = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  if (["js", "mjs"].includes(ext)) return "js";
  if (ext === "css") return "css";
  if (["woff2", "woff", "ttf", "otf"].includes(ext)) return "fonts";
  if (["avif", "png", "jpg", "jpeg", "webp", "svg", "gif", "ico"].includes(ext)) {
    return "images";
  }
  return "other";
}

/**
 * The document response is ONE compressed stream, so its wire cost
 * (`transferSize`) cannot be split into per-part compressed sizes by
 * measurement — brotli is applied over the whole body at once. It is instead
 * attributed to buckets in proportion to each part's share of the UNCOMPRESSED
 * served bytes (ADR-0001 §3 addendum, 2026-08-01): the one reproducible split
 * that sums EXACTLY back to `transferSize` and double-counts nothing. Three
 * parts are carved out of what would otherwise all land in the HTML bucket:
 *
 *  - INLINE EXECUTABLE `<script>` (no `src`, JS/module type) → the JS bucket
 *    and the initial-JS headline. Without this an inlined bundle (Astro inlines
 *    its ~1.2 KB cart module) reports "0 KB JS" against the no-runtime control —
 *    the defect this addendum settles (issue #16 defect 1). Byte-identical
 *    enhancement, wildly different reported JS, purely because of the inline
 *    threshold: exactly the confound the render axis must not carry.
 *  - INLINE NON-EXECUTABLE `<script>` (a `type` the browser will not run:
 *    application/json, qwik/json, importmap, …) → the DATA bucket. These are
 *    serialized payloads a paradigm ships (Astro's cart-item JSON, Qwik's
 *    resumability state) — data, not executable JS and not prose HTML.
 *    Attributing them to JS would inflate the headline a hostile reader is
 *    meant to trust (serialized state is not runtime); leaving them in HTML
 *    hides them in the prose cell.
 *  - INJECTED INSTRUMENTATION MARKUP — the front Worker's chrome subtree
 *    (`<aside id="pm-chrome">…`), its `/_pm/*` head links, and the measurement
 *    `<script src="/_pm/…">` tag — → instrumentation, STRIPPED from every
 *    bucket like the `/_pm/*` subresource PAYLOADS already are (ADR-0001 §6,
 *    packages/switcher/README.md). The document byte bucket must not carry the
 *    instrument's own markup (audit 2026-08-01, collect.ts:303).
 *
 * Which paradigm delivers its script inline vs external, executable vs
 * serialized data, IS the render-axis variable (ADR-0003 §2) — this split is
 * what makes that variable visible instead of hidden in the HTML total.
 *
 * The share is uncompressed-proportional, exact only if every part compresses
 * at the document's average ratio (JS and prose do not compress identically).
 * It is a stated, reproducible attribution — a floor on honesty, strictly
 * better than reporting inline JS as zero — surfaced in the receipt's byte
 * source and the methodology page's limits, never presented as per-byte
 * compressed truth.
 */
export interface DocumentBytes {
  html: number;
  js: number;
  data: number;
  instrumentation: number;
}

// Inline `<script>` the browser EXECUTES as JS: an empty/absent type, or a
// JavaScript MIME type. Anything else carrying a type (application/json,
// qwik/json, importmap, speculationrules, application/ld+json, …) is a
// non-executed data payload.
const EXECUTABLE_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "module",
]);

/**
 * Tokenize a start tag's attribute string into name→value, lowercasing names.
 * A proper tokenizer, not a per-name regex scan: a `\b${name}` or even a
 * whitespace-anchored scan can match a namespaced/hyphenated attribute
 * (`q:type`, `data-type`) or the same token appearing INSIDE another
 * attribute's quoted value — Qwik really emits
 * `<script type="module" q:type="preload">`, and a wrong `type` read there
 * misbooks executable JS as data. Consuming each quoted value atomically makes
 * a value that contains `type=` inert. First occurrence of a name wins.
 */
function parseAttrs(attrs: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const m of attrs.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (!out.has(name)) out.set(name, m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

const utf8Len = (s: string): number =>
  typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(s).length
    : Buffer.byteLength(s, "utf8");

/**
 * Decompose one served HTML document's compressed `transferSize` into
 * html/js/data/instrumentation by uncompressed content share (see the block
 * comment above). `body` is the exact decoded bytes the browser received
 * (chrome injection already applied); `transferSize` is the compressed cost.
 * The three carve-outs are DISJOINT regions of the served bytes (the chrome
 * aside contains no `<script>`; the measurement script is its sibling; the
 * `/_pm/` links live in `<head>`), so nothing is counted twice, and HTML is
 * taken as the remainder so the four parts sum exactly to `transferSize`.
 */
export function decomposeDocument(body: string, transferSize: number): DocumentBytes {
  const docBytes = utf8Len(body);
  if (docBytes === 0 || transferSize <= 0) {
    return { html: Math.max(transferSize, 0), js: 0, data: 0, instrumentation: 0 };
  }

  let jsUncompressed = 0;
  let dataUncompressed = 0;
  let instrUncompressed = 0;

  // Script content cannot contain "</script>" (the HTML tokenizer ends the
  // element there), so this non-greedy match is exact.
  for (const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const fullBytes = utf8Len(m[0]);
    const attrs = parseAttrs(m[1] ?? "");
    const src = attrs.get("src");
    if (src !== undefined) {
      // External script: its PAYLOAD is counted from resource timing. Only the
      // instrument's own tag is stripped here (its /_pm/ payload is already
      // excluded); a variant's own external-script TAG stays HTML markup.
      if (src.includes("/_pm/")) instrUncompressed += fullBytes;
      continue;
    }
    const type = (attrs.get("type") ?? "").trim().toLowerCase();
    if (EXECUTABLE_SCRIPT_TYPES.has(type)) jsUncompressed += fullBytes;
    else dataUncompressed += fullBytes;
  }

  // Injected instrumentation markup: the chrome subtree + its `/_pm/` head
  // links (chrome has no nested <aside> and no inline <script>, so these
  // regions are disjoint from the script scan above).
  const chrome = body.match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i);
  if (chrome) instrUncompressed += utf8Len(chrome[0]);
  for (const m of body.matchAll(/<link\b[^>]*\/_pm\/[^>]*>/gi)) {
    instrUncompressed += utf8Len(m[0]);
  }

  // Apportion transferSize across the four buckets by uncompressed share via
  // LARGEST-REMAINDER (Hamilton): floor each share, then hand the leftover units
  // to the largest fractional parts. Exact (sums to transferSize) AND every
  // bucket ≥ 0. A plain per-bucket `Math.round` with HTML as the remainder can
  // drive HTML NEGATIVE when several tiny carve-outs each round up (verify-slice,
  // anti-rigging lens: transferSize=2 over 1 B js + 1 B data + 1 B chrome →
  // html = 2−1−1−1 = −1). HTML's own share is the remainder of the UNCOMPRESSED
  // bytes (≥ 0: the carve-outs are disjoint subsets), so it is apportioned like
  // the rest rather than absorbing rounding error.
  const htmlUncompressed =
    docBytes - jsUncompressed - dataUncompressed - instrUncompressed;
  const shares = [
    htmlUncompressed,
    jsUncompressed,
    dataUncompressed,
    instrUncompressed,
  ].map((u) => (transferSize * u) / docBytes);
  const out = shares.map((s) => Math.floor(s));
  const leftover = transferSize - out.reduce((a, b) => a + b, 0);
  const byFraction = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < leftover; k++) out[byFraction[k]!.i]! += 1;
  return { html: out[0]!, js: out[1]!, data: out[2]!, instrumentation: out[3]! };
}

async function resourceEntries(page: Page): Promise<ResourceEntry[]> {
  return page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      transferSize: (e as PerformanceResourceTiming).transferSize,
    })),
  );
}

export interface VisitSpec {
  effectiveUrl: string;
  interactionId: string;
  /** Upper bound (ms) for the signal-based settle waits — see
   *  {@link SETTLE_CAP_MS}. Not a fixed wait. */
  settleMs?: number;
}

/**
 * The CEILING on the runner's signal-based settle waits — the interaction
 * byte boundary (network-idle) and the vitals-beacon flush (delivery
 * quiesces). It is a hang-guard, never the boundary itself: the boundary is
 * always the real signal (a fetch completing, a beacon arriving), and this cap
 * only bounds how long the runner waits for a signal that may never come —
 * which then surfaces honestly as absent bytes / a null vital for the suite to
 * judge, exactly as ADR-0001 §9 and tools/drift-gate/README.md's "wait for the
 * real signal, never a proxy" require. Replaces the former fixed 400 ms settle
 * that could crop a slow interaction fetch or a slow beacon flush silently.
 */
export const SETTLE_CAP_MS = 3000;

/**
 * Drive one visit and return the full per-run sample.
 *
 * Every visit gets a FRESH browser context: the browser HTTP cache is a
 * confound, not a measured axis (the cache columns measure the EDGE tier,
 * ADR-0002 §8) — on the deployed plane assets ship `immutable`/etags, so a
 * shared context would silently zero run 2+'s transfer sizes. A fresh
 * context makes every run a first-time visitor by construction.
 */
export async function measureVisit(
  browser: Browser,
  profile: TestProfile,
  spec: VisitSpec,
): Promise<{ sample: RunSampleT; applied: ApplyResult }> {
  const interaction = INTERACTIONS[spec.interactionId];
  if (!interaction) {
    throw new Error(`unknown interaction id: ${spec.interactionId}`);
  }
  const settleCapMs = spec.settleMs ?? SETTLE_CAP_MS;
  const context = await browser.newContext(profileContextOptions(profile));
  const page = await context.newPage();
  try {
    const applied = await applyProfile(page, profile);

    // Lab/field isolation: capture the chrome's beacons, never deliver them.
    const beacons: Array<{ name?: string; value?: number }> = [];
    await page.route("**/api/beacon", async (route) => {
      try {
        beacons.push(JSON.parse(route.request().postData() ?? "{}"));
      } catch {
        /* malformed payload — the assertion surface is the suite, not here */
      }
      await route.fulfill({ status: 204 });
    });

    const response = await page.goto(spec.effectiveUrl, { waitUntil: "load" });
    const docCacheState = response?.headers()["x-pm-cache-state"] ?? null;
    // The exact decoded document bytes the browser received (chrome injection
    // already applied) — the raw material for the byte decomposition below. A
    // body that can't be retrieved degrades to "" (all document bytes stay in
    // the HTML bucket, the pre-decomposition behaviour), never throws.
    let servedBody = "";
    try {
      servedBody = (await response?.text()) ?? "";
    } catch {
      servedBody = "";
    }
    // Whether this page carries the instrument chrome — derived from the LIVE
    // DOM, NOT from servedBody: a body-read failure must degrade ONLY the byte
    // decomposition (to all-HTML), never silently skip the vitals-beacon flush
    // below and null the run's web-vitals — the two concerns were wrongly
    // coupled through servedBody (verify-slice, correctness + seams lenses).
    const hasChrome = await page.evaluate(
      () => document.getElementById("pm-chrome") !== null,
    );

    await page.waitForLoadState("networkidle");
    // Defect 4 (issue #16): Qwik's preloader is the only post-load fetching
    // among the live variants, and it runs inside requestIdleCallback(…,
    // {timeout: 2000}) — under a throttled profile or on a loaded runner it can
    // be starved PAST the networkidle above, so the byte boundary would fall in
    // the MIDDLE of it and the same build would yield two different receipts.
    // Settle post-load idle work onto the INITIAL byte side before the snapshot.
    // The rIC only guarantees Qwik's load handler has DEQUEUED and kicked off
    // its async import(); the real settling is the trailing networkidle that
    // bridges the import + the preload cascade (each modulepreload's onload
    // triggers the next wave), so THAT wait is load-bearing, not redundant. Loop
    // rIC→networkidle until a pass surfaces no new resource-timing entries, so a
    // cascade gap wider than networkidle's 500 ms window cannot end the snapshot
    // mid-cascade — bounded so a page that never settles cannot hang here.
    let priorCount = -1;
    for (let pass = 0; pass < 5; pass++) {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const rIC = globalThis.requestIdleCallback;
            if (rIC) rIC(() => resolve(), { timeout: 2000 });
            else setTimeout(resolve, 50);
          }),
      );
      await page.waitForLoadState("networkidle");
      const count = (await resourceEntries(page)).length;
      if (count === priorCount) break;
      priorCount = count;
    }

    const initialEntries = await resourceEntries(page);

    await interaction(page);
    // Interaction byte boundary (ADR-0001 §3): wait for the real signal — the
    // network going quiet — so an interaction-triggered fetch of ANY duration
    // is captured, not a fixed proxy window (a fetch slower than the old 400 ms
    // vanished from interactionBytes AND totalBytes). Bounded by settleCapMs so
    // a request wedged in flight surfaces as absent interaction bytes for the
    // suite to judge instead of hanging or being disguised.
    await page
      .waitForLoadState("networkidle", { timeout: settleCapMs })
      .catch(() => {});
    const afterEntries = await resourceEntries(page);

    // Wait for the interaction's own event-timing entry to EXIST before
    // flushing, or INP is silently lost — a false-FAIL (and worse, a null
    // metric in a published receipt) traced to web-vitals' own source rather
    // than guessed:
    //
    //  - `initMetric` starts INP at -1 (initMetric.js: `value = -1`), and
    //    `bindReporter` gates every emission — INCLUDING a forced one — behind
    //    `if (metric.value >= 0)`. So an INP that was never computed is not
    //    reported as 0; nothing is sent at all and the run records null.
    //  - INP is only computed once an entry reaches the InteractionManager,
    //    and that hop runs inside `whenIdleOrHidden` — a requestIdleCallback
    //    while the page is still visible.
    //  - The `event` observer cannot supply that entry here: it uses
    //    web-vitals' default `durationThreshold: 40`, and a trivial click on a
    //    static page measures ~8ms (verified in Chromium: one `pointerdown`
    //    entry, duration 8). INP therefore depends ENTIRELY on the buffered
    //    `first-input` observation, which arrives asynchronously.
    //
    // A fixed settle window is the wrong instrument for that: on a loaded
    // machine (a CI runner, or a dev box running anything else) the browser
    // can still be producing the entry when the window elapses, and the visit
    // records INP: null with no error anywhere. Waiting on the entry itself is
    // deterministic — `first-input` IS retained in the performance timeline
    // (which is what makes web-vitals' `buffered: true` work), so it can be
    // polled directly.
    //
    // Placement is deliberate: AFTER the byte accounting above, so nothing
    // measured moves — this only widens the window the vitals flush gets. A
    // timeout is swallowed on purpose: if no interaction entry ever appears,
    // that is a real finding for the suite's assertions to report as
    // INP: null, not something to disguise by failing the visit here.
    // Waiting for the entry is necessary but NOT sufficient, and the second
    // half is the part that actually starves. web-vitals' observer callback
    // does not compute INP inline: it defers into `whenIdleOrHidden`, i.e. a
    // `requestIdleCallback`. Meanwhile the ONLY emission that can ever fire is
    // the forced `report(true)` inside INP's own visibility-hidden handler — a
    // non-forced `report()` with the default `reportAllChanges: false` emits
    // nothing at all (`bindReporter`: the inner `if (forceReport ||
    // reportAllChanges)`). And that forced report runs BEFORE the deferred
    // idle work in the case that matters, because `getVisibilityWatcher`'s
    // listener is registered first and therefore fires first. So if the idle
    // callback has not run by then, `metric.value` is still -1, the forced
    // report is dropped, and the entry we waited for changes nothing.
    //
    // Idle callbacks run in request order, so awaiting one requested HERE
    // proves the earlier-queued one has already run and `metric.value` is set
    // before the flush below. The `timeout` option bounds it: if the page never
    // goes idle the callback is invoked anyway, and a genuinely absent INP
    // still surfaces as null for the suite to judge rather than hanging here.
    if (spec.interactionId !== "none") {
      await page
        .waitForFunction(
          () => performance.getEntriesByType("first-input").length > 0,
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {
          /* no entry: let the receipt record null and the suite judge it */
        });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const rIC: typeof globalThis.requestIdleCallback | undefined =
              globalThis.requestIdleCallback;
            if (rIC) rIC(() => resolve(), { timeout: 2000 });
            else setTimeout(resolve, 50);
          }),
      );
    }

    // Flush the measurement client (its own reporting trigger): final
    // values report on visibility-hidden.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Wait for the beacons to ARRIVE — not a fixed window, and NOT mere
    // quiescence. web-vitals sends each metric as its OWN sendBeacon, and on a
    // loaded runner the later ones (CLS/INP) can land >150 ms after the early
    // ones (TTFB/FCP/LCP), so a "no new beacon for a slice" check exits in that
    // gap and drops them — the exact null-vitals-shrinks-the-median failure this
    // wait exists to prevent (audit 2026-08-01, collect.ts:254; CI-confirmed).
    // Wait until every EXPECTED metric has arrived, bounded by settleCapMs so a
    // genuinely absent one still surfaces as null for the suite to judge rather
    // than hanging. A chromeless page fires no beacon by design — skip the wait.
    if (hasChrome) {
      const expected = ["TTFB", "FCP", "LCP", "CLS"];
      if (spec.interactionId !== "none") expected.push("INP");
      const deadline = Date.now() + settleCapMs;
      for (;;) {
        const arrived = new Set(
          beacons
            .map((b) => b.name)
            .filter((n): n is string => typeof n === "string"),
        );
        if (expected.every((m) => arrived.has(m))) break;
        if (Date.now() > deadline) break;
        await page.waitForTimeout(25);
      }
    }

    const nav = await page.evaluate(() => {
      const e = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!e) return null;
      return {
        startTime: e.startTime,
        redirectCount: e.redirectCount,
        fetchStart: e.fetchStart,
        domainLookupStart: e.domainLookupStart,
        domainLookupEnd: e.domainLookupEnd,
        connectStart: e.connectStart,
        secureConnectionStart: e.secureConnectionStart,
        connectEnd: e.connectEnd,
        requestStart: e.requestStart,
        responseStart: e.responseStart,
        responseEnd: e.responseEnd,
        transferSize: e.transferSize,
      };
    });
    if (nav === null) {
      throw new Error(`no navigation timing entry for ${spec.effectiveUrl}`);
    }

    const vitals: Record<string, number | null> = {
      TTFB: null, FCP: null, LCP: null, CLS: null, INP: null,
    };
    for (const b of beacons) {
      if (typeof b.name === "string" && b.name in vitals && typeof b.value === "number") {
        vitals[b.name] = b.value;
      }
    }

    const buckets = { html: 0, js: 0, css: 0, fonts: 0, images: 0, data: 0, other: 0 };
    let instrumentationBytes = 0;
    let instrumentationRequests = 0;
    let counted = 0;
    for (const entry of afterEntries) {
      if (isInstrumentation(entry.name)) {
        instrumentationBytes += entry.transferSize;
        instrumentationRequests += 1;
        continue;
      }
      counted += 1;
      buckets[bucketOf(entry.name)] += entry.transferSize;
    }
    // The document itself: decomposed from its single compressed transferSize
    // into html/js/data plus STRIPPED instrumentation markup by uncompressed
    // content share (decomposeDocument). Counted as one request.
    const doc = decomposeDocument(servedBody, nav.transferSize);
    buckets.html += doc.html;
    buckets.js += doc.js;
    buckets.data += doc.data;
    instrumentationBytes += doc.instrumentation;
    counted += 1;

    // Initial JS is the external initial-snapshot JS PLUS the document's own
    // inline executable script (present at load) — which is why an inlined
    // bundle no longer reads as zero (issue #16 defect 1).
    const initialJsBytes =
      doc.js +
      initialEntries
        .filter((e) => !isInstrumentation(e.name) && bucketOf(e.name) === "js")
        .reduce((sum, e) => sum + e.transferSize, 0);
    // Resource-timing entries are append-only: everything past the initial
    // snapshot's length was fetched because of the interaction — including
    // RE-fetches of URLs the page already loaded (a name-keyed diff would
    // hide those and underreport the interaction cost).
    const interactionBytes = afterEntries
      .slice(initialEntries.length)
      .filter((e) => !isInstrumentation(e.name))
      .reduce((sum, e) => sum + e.transferSize, 0);

    const sample: RunSampleT = {
      docCacheState,
      ttfb: {
        travelMs: nav.requestStart - nav.startTime,
        serverMs: nav.responseStart - nav.requestStart,
        raw: {
          startTime: nav.startTime,
          redirectCount: nav.redirectCount,
          fetchStart: nav.fetchStart,
          domainLookupStart: nav.domainLookupStart,
          domainLookupEnd: nav.domainLookupEnd,
          connectStart: nav.connectStart,
          secureConnectionStart: nav.secureConnectionStart,
          connectEnd: nav.connectEnd,
          requestStart: nav.requestStart,
          responseStart: nav.responseStart,
          responseEnd: nav.responseEnd,
        },
      },
      webVitals: {
        TTFB: vitals.TTFB ?? null,
        FCP: vitals.FCP ?? null,
        LCP: vitals.LCP ?? null,
        CLS: vitals.CLS ?? null,
        INP: vitals.INP ?? null,
      },
      kb: {
        buckets,
        initialJsBytes,
        interactionBytes,
        instrumentationBytes,
        totalBytes: Object.values(buckets).reduce((a, b) => a + b, 0),
      },
      requests: {
        counted,
        instrumentation: instrumentationRequests,
      },
    };
    return { sample, applied };
  } finally {
    await context.close();
  }
}
