/**
 * The ADR-0001 addendum-F chrome constant: the injected instrument's RUNTIME
 * cost on timing metrics, measured with/without the chrome on the SAME page
 * under ONE profile and published as a stated constant on the methodology
 * page. Byte-stripping (ADR-0001 §6) removes the chrome from measured KB; it
 * cannot remove the chrome's parse/style/layout/font/script work — or its
 * subresource contention on a throttled network — from FCP/LCP/CLS. This
 * probe states that cost instead of letting it ride silently. ADR-0008 §5
 * binds the re-measure to the redesigned strip, before any publication.
 *
 *   node tools/bench-runner/dist/chrome-constant.mjs \
 *     --origin https://… [--target /vanilla/editorial/] \
 *     [--profile slow-4g-mid-phone] [--runs 7] [--allow-cross-tree] [--out …]
 *
 * Method, load-bearing choices:
 *  - BOTH conditions intercept the document response and re-fulfill it
 *    locally, so the interception hop cancels out of the delta; the
 *    "without" condition strips exactly the three injected regions the byte
 *    accounting strips (the chrome subtree, its /_pm/ head links, the
 *    measurement script tag — decomposeDocument's own boundaries), before
 *    the browser ever parses them.
 *  - The without-condition replaces each stripped region with an inert HTML
 *    comment of EQUAL byte length (stripChromeEqualBytes), so the document
 *    transfer term is identical in both conditions and cancels — the delta
 *    is the chrome's processing cost, and its wire cost is reported as a
 *    separate calibrated figure. Re-compressing is not available: Playwright's
 *    route.fulfill ignores a declared content-encoding, and serving one
 *    condition decoded would put ~8 KB of uncompressed markup on a throttled
 *    wire where the plane puts low-single-digit KB compressed — the delta
 *    would be an artifact of the probe (verify-slice, anti-rigging lens).
 *  - Paint/shift metrics come from the browser's own performance timeline
 *    via an init-script observer, IDENTICALLY in both conditions — the
 *    injected ruler cannot measure its own absence, so neither condition
 *    uses it (the constant is about the ruler, not from it).
 *  - Conditions are round-robin interleaved (with, without, with, …) so a
 *    noisy moment lands on both, and the published constant is the delta of
 *    medians. Beacons are captured and never delivered (lab/field split).
 *  - Scope, stated: the constant covers LOAD-time metrics (FCP/LCP/CLS plus
 *    long-task main-thread time). It does not claim the chrome's
 *    interaction-time cost.
 */
import { chromium, type Browser, type Page } from "playwright";
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "node:zlib";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProfile, PROFILE_SPEC_VERSION, type TestProfile } from "@pm/measurement";
import { chromeFragmentOf } from "@pm/switcher";
import {
  applyProfile,
  armNetworkQuiescence,
  profileContextOptions,
  LOAD_QUIET_CAP_MS,
  NETWORK_QUIET_MS,
} from "./collect";
import { commitPin } from "./git";
import { fetchOriginCommit, verifyOriginCommit, type OriginCommit } from "./origin-commit";
import { median } from "./receipt";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Strip exactly the injected instrumentation regions — the same three
 *  boundaries decomposeDocument attributes to `instrumentation`. */
export function stripChrome(body: string): string {
  return body
    .replace(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i, "")
    .replace(/<link\b[^>]*\/_pm\/[^>]*>/gi, "")
    .replace(/<script\b[^>]*src="[^"]*\/_pm\/[^"]*"[^>]*><\/script>/gi, "");
}

/**
 * The same strip, but each removed region is replaced by an inert HTML
 * comment of EQUAL byte length, so both conditions' documents are the same
 * size on the wire.
 *
 * Why this instead of re-compressing: the plane sends one brotli stream, and
 * the two conditions differ by exactly the chrome's bytes — so serving both
 * DECODED would put ~8 KB of extra uncompressed markup on a throttled wire
 * in the with-condition only, and a large part of the measured delta would
 * be an artifact of the probe rather than a property of the chrome
 * (verify-slice, anti-rigging lens). Fulfilling a pre-compressed body is not
 * available: Playwright's route.fulfill does not honour a declared
 * content-encoding, and the browser receives a corrupt document (measured —
 * 3,660 bytes and no chrome node, against 18,146 and a chrome node for a
 * plain fulfil).
 *
 * Padding makes the document transfer term IDENTICAL and therefore cancel,
 * so what the delta measures is the chrome's PROCESSING cost — tokenizing,
 * styling, laying out, and its own subresources (chrome.css, the instrument
 * mono, measure.js), which are still real requests to the real plane and
 * still compressed normally. The document bytes the chrome would add on the
 * wire are reported separately, brotli-measured, so the two components are
 * each what they claim to be rather than blended into one number.
 */
export function stripChromeEqualBytes(body: string): string {
  const pad = (region: string) => {
    // "<!--" + "-->" is 7 bytes; a region shorter than that cannot be padded
    // to length (none is — the smallest is a /_pm/ link tag).
    const inner = Buffer.byteLength(region, "utf8") - 7;
    return inner >= 0 ? `<!--${" ".repeat(inner)}-->` : "";
  };
  return body
    .replace(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i, pad)
    .replace(/<link\b[^>]*\/_pm\/[^>]*>/gi, pad)
    .replace(/<script\b[^>]*src="[^"]*\/_pm\/[^"]*"[^>]*><\/script>/gi, pad);
}

interface ProbeMetrics {
  FCP: number | null;
  LCP: number | null;
  CLS: number | null;
  longTaskMs: number | null;
}

/**
 * Provenance of the chrome the constant actually describes. The strip's cost
 * scales with what it renders: the EMPTY state (30 em-dash cells, no fit
 * sentence) is ~3 KB smaller than the POPULATED state (30 receipt anchors +
 * the derived fit line). Measuring against a plane that carries no
 * publication would state a constant for a chrome that no longer ships —
 * so the probe records what it measured, and the front build re-renders the
 * fragment from `renderContext` and REFUSES when the sha256 differs
 * (ADR-0001 addendum N hole 1: `populated` alone let a stale constant ride,
 * because both the hashed and the shipping fragment satisfy it).
 */
export interface MeasuredChrome {
  bytes: number;
  sha256: string;
  /** Did the measured fragment carry published readings (receipt anchors)? */
  populated: boolean;
  /**
   * What the chrome costs ON THE WIRE: brotli of the served document minus
   * brotli of the same document with the instrumentation regions removed —
   * a leave-one-out marginal, the same attribution principle the byte
   * ruler's decomposeDocument uses (ADR-0001 §3 addendum, 2026-08-15). The
   * timing delta deliberately excludes this (both conditions are padded to
   * equal document bytes), so it is reported here rather than blended into
   * a number that would then be neither one thing nor the other.
   */
  wireBytesBrotli: number;
  /** Quality the wire figure was computed at: calibrated against the
   *  plane's own compressed body when it served brotli, else the q11
   *  fallback (wireCalibrated says which). */
  wireQuality: number;
  wireCalibrated: boolean;
  /** The raw compressed body observed for the target (null when the plane
   *  served identity), and the calibration residual against it. */
  encodedBodySize: number | null;
  calibrationResidualBytes: number | null;
  documentBytesUncompressed: number;
  /**
   * The exact renderChrome() inputs the measured fragment renders under —
   * variant/surface/location read from the fragment's own data attributes,
   * pathname/search from the probed target. The front build re-renders the
   * fragment from these against the lab bundle it just built; a hash
   * mismatch refuses the build (hole 1's two-pass publish).
   */
  renderContext: {
    variant: string;
    surface: string;
    pathname: string;
    search: string;
    location: string;
  };
}

const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");

const brotliBytes = (text: string, quality: number): number =>
  brotliCompressSync(Buffer.from(text, "utf8"), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: quality },
  }).length;

/** One raw fetch of the target with `accept-encoding: br`, counting the
 *  bytes as they cross the wire (fetch() would decompress transparently and
 *  hide them). Returns the decoded body beside the raw count. */
function fetchRawTarget(
  url: string,
): Promise<{ body: string; encodedBytes: number; contentEncoding: string | null }> {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(url);
    const req = (u.protocol === "https:" ? httpsRequest : httpRequest)(
      u,
      { headers: { "accept-encoding": "br" } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if ((res.statusCode ?? 0) !== 200) {
            reject(new Error(`${url} answered ${res.statusCode}`));
            return;
          }
          const raw = Buffer.concat(chunks);
          const contentEncoding = res.headers["content-encoding"] ?? null;
          try {
            const body =
              contentEncoding === "br" ? brotliDecompressSync(raw).toString("utf8") : raw.toString("utf8");
            resolvePromise({ body, encodedBytes: raw.length, contentEncoding });
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Read one attribute off the fragment's opening aside tag. */
function fragmentAttr(fragment: string, name: string): string {
  return fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}

function measuredChromeOf(
  body: string,
  target: { pathname: string; search: string },
  wire: { encodedBytes: number; contentEncoding: string | null },
): MeasuredChrome {
  const fragment = chromeFragmentOf(body);
  if (fragment === "") {
    throw new Error("no chrome fragment in the served target — nothing to measure");
  }
  // Wire-quality calibration (the decomposeDocument principle): scan q0–q11
  // for the whole-document size closest to the observed compressed body.
  // A plane serving identity (local dev) cannot calibrate — the q11
  // fallback is recorded as uncalibrated, and the deployed-plane re-measure
  // replaces it (the addendum-L/N cycle, now visible in the artifact).
  const calibrated = wire.contentEncoding === "br";
  let wireQuality = 11;
  let calibrationResidualBytes: number | null = null;
  if (calibrated) {
    let best: { q: number; size: number } | null = null;
    for (let q = 0; q <= 11; q++) {
      const size = brotliBytes(body, q);
      if (!best || Math.abs(size - wire.encodedBytes) < Math.abs(best.size - wire.encodedBytes)) {
        best = { q, size };
      }
    }
    wireQuality = best!.q;
    calibrationResidualBytes = best!.size - wire.encodedBytes;
  }
  return {
    bytes: Buffer.byteLength(fragment, "utf8"),
    sha256: sha256Hex(fragment),
    populated: /class="pm-chrome__reading"/.test(fragment),
    wireBytesBrotli: brotliBytes(body, wireQuality) - brotliBytes(stripChrome(body), wireQuality),
    wireQuality,
    wireCalibrated: calibrated,
    encodedBodySize: calibrated ? wire.encodedBytes : null,
    calibrationResidualBytes,
    documentBytesUncompressed: Buffer.byteLength(body, "utf8"),
    renderContext: {
      variant: fragmentAttr(fragment, "data-pm-variant"),
      surface: fragmentAttr(fragment, "data-pm-surface"),
      pathname: target.pathname,
      search: target.search,
      location: fragmentAttr(fragment, "data-pm-location"),
    },
  };
}

declare global {
  interface Window {
    __pmProbe?: { fcp: number | null; lcp: number | null; cls: number; longTaskMs: number };
  }
}

async function probeVisit(
  browser: Browser,
  profile: TestProfile,
  url: string,
  condition: "with" | "without",
): Promise<ProbeMetrics & { fragmentSha: string | null }> {
  const context = await browser.newContext(profileContextOptions(profile));
  const page: Page = await context.newPage();
  try {
    await applyProfile(page, profile);
    // The observers must exist before any document byte parses.
    await page.addInitScript(() => {
      const probe = { fcp: null as number | null, lcp: null as number | null, cls: 0, longTaskMs: 0 };
      (window as Window).__pmProbe = probe;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") probe.fcp = e.startTime;
        }
      }).observe({ type: "paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) probe.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      // CLS by the SESSION-WINDOW MAXIMUM — the definition web-vitals (the
      // site's one ruler) applies, not the superseded running total: a
      // window closes after a 1 s gap or 5 s of duration, and CLS is the
      // largest window's sum. A total would print a number that no session
      // window would ever report, on a page whose methodology claims CLS
      // means the same thing everywhere (verify-slice, conformance lens).
      let winSum = 0;
      let winStart = 0;
      let winPrev = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (shift.hadRecentInput) continue;
          if (
            winSum !== 0 &&
            (shift.startTime - winPrev >= 1000 || shift.startTime - winStart >= 5000)
          ) {
            winSum = 0;
          }
          if (winSum === 0) winStart = shift.startTime;
          winPrev = shift.startTime;
          winSum += shift.value;
          if (winSum > probe.cls) probe.cls = winSum;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) probe.longTaskMs += e.duration;
      }).observe({ type: "longtask", buffered: true });
    });
    // Lab/field isolation: the with-condition's chrome sends beacons — they
    // are captured here and never reach the RUM collector.
    await page.route("**/api/beacon", (route) => route.fulfill({ status: 204 }));
    // Document interception, BOTH conditions (the hop cancels out of the
    // delta); only "without" modifies the body. Content-encoding and length
    // headers are dropped because route.fetch() yields the DECODED body.
    // The fragment sha is RECORDED here and judged by the caller after the
    // visit, never thrown from inside the route handler: Playwright's route
    // dispatch has no path to reject the awaited navigation with a
    // user-handler error, so a throw here is at best an unhandled rejection
    // and at worst a silently-continuing probe (verify-slice, this unit).
    // Both conditions record it — the upstream body still carries the
    // chrome before the strip below, and the LAST without-visit of the
    // probe would otherwise be the one visit a mid-probe deploy could slip
    // past.
    let observedFragmentSha: string | null = null;
    await page.route(url, async (route) => {
      const upstream = await route.fetch();
      const body = await upstream.text();
      const headers = { ...upstream.headers() };
      delete headers["content-length"];
      delete headers["transfer-encoding"];
      observedFragmentSha = sha256Hex(chromeFragmentOf(body));
      // Equal document bytes in both conditions (see stripChromeEqualBytes):
      // the transfer term cancels, so the delta is the chrome's processing
      // cost. route.fetch() yields the DECODED body, so content-encoding
      // must go — Playwright will not serve a pre-compressed one.
      delete headers["content-encoding"];
      const served =
        condition === "without" ? stripChromeEqualBytes(body) : body;
      await route.fulfill({ status: upstream.status(), headers, body: served });
    });

    // Armed BEFORE the navigation so nothing of the visit is missed. Until
    // 2026-08-28 both settles here were `waitForLoadState("networkidle")`,
    // and the second one was the SAME document-lifecycle latch this unit
    // removed from collect.ts: no navigation happens between them, so the
    // second call hit the already-fired fast path and returned in a
    // microtask. The comment below promised "one more quiet check" and there
    // was none — the probe read `window.__pmProbe` immediately after the idle
    // callback, with no quiet window at all (verify-slice, correctness lens).
    // It matters more here than almost anywhere: this probe mints the
    // published chrome constant, and late paint/shift entries are exactly
    // what the with-chrome arm has more of.
    const network = armNetworkQuiescence(page);
    const quiet = async (where: string) => {
      if (!(await network.wait(NETWORK_QUIET_MS, LOAD_QUIET_CAP_MS))) {
        throw new Error(
          `chrome-constant: the network never went quiet for ${NETWORK_QUIET_MS} ms within ` +
            `${LOAD_QUIET_CAP_MS} ms ${where} (${url}, condition "${condition}") — the probe has no honest ` +
            `degraded mode: both arms must get the identical settle or the delta is not a delta`,
        );
      }
    };
    await page.goto(url, { waitUntil: "load" });
    await quiet("of load");
    // Settle late paint/shift entries the same way in both conditions —
    // bounded idle, then a REAL quiet window.
    await page.evaluate(
      () =>
        new Promise<void>((resolveIdle) => {
          const rIC = globalThis.requestIdleCallback;
          if (rIC) rIC(() => resolveIdle(), { timeout: 2000 });
          else setTimeout(resolveIdle, 50);
        }),
    );
    await quiet("after the post-load idle pass");

    const raw = await page.evaluate(() => window.__pmProbe ?? null);
    if (!raw) throw new Error("probe init script did not run");
    // The with-condition must actually have carried the chrome, and the
    // without-condition must actually not — otherwise the delta is a lie.
    const chromeCount = await page.evaluate(
      () => document.querySelectorAll("#pm-chrome").length,
    );
    if (condition === "with" && chromeCount !== 1) {
      throw new Error(`with-condition page carries ${chromeCount} chrome nodes, expected 1`);
    }
    if (condition === "without" && chromeCount !== 0) {
      throw new Error(`without-condition page still carries the chrome — strip failed`);
    }
    return {
      FCP: raw.fcp,
      LCP: raw.lcp,
      CLS: raw.cls,
      longTaskMs: raw.longTaskMs,
      fragmentSha: observedFragmentSha,
    };
  } finally {
    await context.close();
  }
}

function medians(runs: ProbeMetrics[]) {
  return {
    FCP: median(runs.map((r) => r.FCP)),
    LCP: median(runs.map((r) => r.LCP)),
    CLS: median(runs.map((r) => r.CLS)),
    longTaskMs: median(runs.map((r) => r.longTaskMs)),
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      origin: { type: "string" },
      target: { type: "string", default: "/vanilla/editorial/" },
      profile: { type: "string", default: "slow-4g-mid-phone" },
      runs: { type: "string", default: "7" },
      // The same explicit cross-tree escape the batch runner takes
      // (ADR-0001 addendum N hole 2): without it the probe refuses an
      // origin whose attested build disagrees with this checkout, or one
      // that does not attest at all.
      "allow-cross-tree": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  if (!values.origin) {
    console.error("chrome-constant requires --origin");
    return 2;
  }
  const profile = getProfile(values.profile);
  if (!profile) {
    console.error(`unknown profile id: ${values.profile}`);
    return 2;
  }
  const runs = parseInt(values.runs, 10);
  // A malformed --runs must not "succeed" having measured nothing: NaN or 0
  // skips the loop entirely, and while the publication gate would refuse
  // the null-delta artifact later, a tool that exits 0 for a measurement
  // that never ran is a lie at the point of use (verify-slice, this unit).
  if (!Number.isInteger(runs) || runs < 1) {
    console.error(`--runs must be a positive integer (got ${values.runs})`);
    return 2;
  }
  const targetUrl = new URL(values.target, values.origin);
  const url = targetUrl.toString();

  // Origin provenance BEFORE anything measures (hole 2 — the probe is
  // bound by the same rule as a batch).
  const commit = commitPin(repoRoot);
  const originCommit: OriginCommit | null = await verifyOriginCommit(
    values.origin,
    commit.sha,
    values["allow-cross-tree"],
  );

  // ONE raw fetch establishes what the constant describes: the decoded body
  // (fragment, render context, populated state) AND the compressed body the
  // plane actually serves (the wire-quality calibration target). Every
  // with-condition visit below must then serve the SAME fragment, or the
  // delta would mix two chromes.
  const raw = await fetchRawTarget(url);
  const measuredChrome = measuredChromeOf(
    raw.body,
    { pathname: targetUrl.pathname, search: targetUrl.search },
    { encodedBytes: raw.encodedBytes, contentEncoding: raw.contentEncoding },
  );

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  const samples: Record<"with" | "without", ProbeMetrics[]> = { with: [], without: [] };
  try {
    for (let run = 0; run < runs; run++) {
      // ABBA pair ordering: a fixed with-then-without order puts every
      // with-sample systematically half a pair EARLIER than its partner, so
      // a monotonic environment trend (thermal ramp, drifting network) does
      // not cancel out of the delta of medians the way random noise does —
      // alternating the pair order cancels first-order drift too
      // (verify-slice, this unit; ~2 ms/visit drift visible in the
      // bootstrap artifact's own runs).
      const order: ReadonlyArray<"with" | "without"> =
        run % 2 === 0 ? ["with", "without"] : ["without", "with"];
      for (const condition of order) {
        const { fragmentSha, ...metrics } = await probeVisit(browser, profile, url, condition);
        // Judged HERE, after the visit resolves, for BOTH conditions —
        // see probeVisit's route-handler note for why.
        if (fragmentSha !== measuredChrome.sha256) {
          throw new Error(
            `the served chrome changed mid-probe (${measuredChrome.sha256.slice(0, 12)} → ` +
              `${fragmentSha === null ? "no document intercepted" : fragmentSha.slice(0, 12)}) — ` +
              `the delta would mix two fragments`,
          );
        }
        samples[condition].push(metrics);
      }
    }
  } finally {
    await browser.close();
  }
  // Re-fetched AFTER the last visit, UNCONDITIONALLY (the batch runner's
  // mid-run rule): a deploy landing mid-probe would otherwise leave early
  // visits measuring one plane and late ones another. Any transition
  // refuses — including null→non-null, a deploy that ADDS attestation
  // (this unit's own merge is that deploy); null→null stays genuinely
  // undetectable and the artifact already says so. The fragment sha above
  // binds every DOCUMENT to one chrome; this binds the SUBRESOURCES the
  // probe's delta also rides (chrome.css, the mono, measure.js), which the
  // sha cannot see.
  {
    const after = await fetchOriginCommit(values.origin);
    const label = (c: OriginCommit | null) => (c ? c.sha.slice(0, 12) : "unattested");
    const moved =
      (originCommit === null) !== (after === null) ||
      (originCommit !== null &&
        after !== null &&
        (after.sha !== originCommit.sha || after.dirty !== originCommit.dirty));
    if (moved) {
      throw new Error(
        `the origin's attested build changed mid-probe (${label(originCommit)} → ${label(after)}) — ` +
          `re-run in a quiet deploy window`,
      );
    }
  }

  const withMed = medians(samples.with);
  const withoutMed = medians(samples.without);
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? null : a - b;
  const artifact = {
    kind: "pm-chrome-constant",
    date: new Date().toISOString(),
    commit,
    // What the origin attested it was serving (hole 2; null = it did not
    // attest and the cross-tree escape was passed — visibly unattested).
    originCommit,
    origin: values.origin,
    target: values.target,
    profile: { id: profile.id, specVersion: PROFILE_SPEC_VERSION },
    runsPerCondition: runs,
    // WHICH chrome this constant describes (see MeasuredChrome): the strip's
    // cost scales with what it renders, so the artifact carries the measured
    // fragment's size and hash, and whether it was the populated state.
    measuredChrome,
    method: [
      "both conditions intercept the document response and re-fulfill it locally (the hop cancels out of the delta); the without-condition replaces exactly the injected chrome subtree, its /_pm/ head links, and the measurement script tag — decomposeDocument's own instrumentation boundaries — with inert HTML comments of EQUAL byte length, before parse",
      "the document transfer term is therefore IDENTICAL in both conditions and cancels: this delta is the chrome's PROCESSING cost (tokenize/style/layout, plus its own real subresources — chrome.css, the instrument mono, measure.js — which are fetched from the real plane and compressed normally). What the chrome adds to the document ON THE WIRE is reported separately as measuredChrome.wireBytesBrotli rather than blended in: a leave-one-out brotli marginal (full body minus chrome-stripped body) at the quality calibrated against the plane's own compressed serving of the target (measuredChrome.wireQuality; q11 fallback, flagged uncalibrated, when the plane served identity) — the same attribution principle decomposeDocument uses (ADR-0001 §3 addendum 2026-08-15). Serving both bodies decoded would have put the chrome's ~8 KB of uncompressed markup on the throttled wire in one condition only; fulfilling a pre-compressed body is not possible (Playwright's route.fulfill ignores a declared content-encoding — measured: a corrupt 3,660-byte document with no chrome node, against 18,146 bytes for a plain fulfil)",
      "measuredChrome.renderContext records the exact renderChrome() inputs the measured fragment renders under; the front build re-renders the fragment from them against the lab bundle it builds and REFUSES when the sha256 differs (ADR-0001 addendum N hole 1: the constant must describe the chrome that ships, and 'populated' alone cannot tell a current fragment from a stale one)",
      "paint/shift/long-task metrics come from the browser's own performance timeline via an init-script observer, identically in both conditions — the injected ruler cannot measure its own absence",
      "CLS is the session-window maximum (the web-vitals definition the rest of the site publishes), never the superseded running total",
      "conditions pair-interleaved in ALTERNATING order (with/without, then without/with — ABBA), so first-order environmental drift cancels from the delta as well as random noise; the published constant is the delta of medians (with − without)",
      "scope: load-time cost only (FCP/LCP/CLS/long-task main-thread ms) for ONE target page under ONE profile; interaction-time cost is not claimed, and the constant is not a claim of per-variant or per-profile equality",
    ],
    conditions: {
      with: { runs: samples.with, medians: withMed },
      without: { runs: samples.without, medians: withoutMed },
    },
    deltaMedians: {
      FCP: delta(withMed.FCP, withoutMed.FCP),
      LCP: delta(withMed.LCP, withoutMed.LCP),
      CLS: delta(withMed.CLS, withoutMed.CLS),
      longTaskMs: delta(withMed.longTaskMs, withoutMed.longTaskMs),
    },
  };
  const out =
    values.out ??
    join(
      repoRoot,
      "tools/bench-runner/receipts",
      `chrome-constant-${artifact.date.replace(/[:.]/g, "-")}.json`,
    );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(artifact, null, 2) + "\n");
  console.log(out);
  return 0;
}

process.exit(await main());
