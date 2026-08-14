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
 *     [--profile slow-4g-mid-phone] [--runs 7] [--out …]
 *
 * Method, load-bearing choices:
 *  - BOTH conditions intercept the document response and re-fulfill it
 *    locally, so the interception hop cancels out of the delta; the
 *    "without" condition strips exactly the three injected regions the byte
 *    accounting strips (the chrome subtree, its /_pm/ head links, the
 *    measurement script tag — decomposeDocument's own boundaries), before
 *    the browser ever parses them.
 *  - The fulfilled bodies are RE-COMPRESSED with brotli and served with
 *    `content-encoding: br`, because the two conditions differ by exactly
 *    the chrome's bytes and the hop only cancels the parts that are equal.
 *    Serving the decoded body would put ~8 KB of uncompressed markup on a
 *    throttled wire where the plane puts low-single-digit KB compressed, and
 *    the transfer term of the delta would be an artifact of the probe rather
 *    than a property of the chrome (verify-slice, anti-rigging lens).
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
import { brotliCompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProfile, PROFILE_SPEC_VERSION, type TestProfile } from "@pm/measurement";
import { applyProfile, profileContextOptions } from "./collect";
import { commitPin } from "./git";
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
 * so the probe records what it measured and the front build refuses a
 * constant measured against an unpopulated chrome (verify-slice,
 * anti-rigging lens).
 */
export interface MeasuredChrome {
  bytes: number;
  sha256: string;
  /** Did the measured fragment carry published readings (receipt anchors)? */
  populated: boolean;
}

function measuredChromeOf(body: string): MeasuredChrome {
  const fragment =
    body.match(
      /<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>\s*<script[^>]*\/_pm\/measure\.js[^>]*><\/script>/i,
    )?.[0] ??
    body.match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i)?.[0] ??
    "";
  return {
    bytes: Buffer.byteLength(fragment, "utf8"),
    sha256: createHash("sha256").update(fragment).digest("hex"),
    populated: /class="pm-chrome__reading"/.test(fragment),
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
  onMeasuredChrome?: (m: MeasuredChrome) => void,
): Promise<ProbeMetrics> {
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
    await page.route(url, async (route) => {
      const upstream = await route.fetch();
      const body = await upstream.text();
      const headers = { ...upstream.headers() };
      delete headers["content-length"];
      delete headers["transfer-encoding"];
      // Preserve the WIRE shape: the conditions differ by exactly the
      // chrome's bytes, so those bytes must cross the throttled connection
      // compressed, as the plane sends them. Re-compressing here (rather
      // than passing the decoded body and dropping content-encoding) keeps
      // the delta's transfer term a property of the chrome.
      if (condition === "with") onMeasuredChrome?.(measuredChromeOf(body));
      const served = condition === "without" ? stripChrome(body) : body;
      headers["content-encoding"] = "br";
      await route.fulfill({
        status: upstream.status(),
        headers,
        body: brotliCompressSync(Buffer.from(served, "utf8")),
      });
    });

    await page.goto(url, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    // Settle late paint/shift entries the same way in both conditions —
    // bounded idle, then one more quiet check.
    await page.evaluate(
      () =>
        new Promise<void>((resolveIdle) => {
          const rIC = globalThis.requestIdleCallback;
          if (rIC) rIC(() => resolveIdle(), { timeout: 2000 });
          else setTimeout(resolveIdle, 50);
        }),
    );
    await page.waitForLoadState("networkidle");

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
    return { FCP: raw.fcp, LCP: raw.lcp, CLS: raw.cls, longTaskMs: raw.longTaskMs };
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
  const url = new URL(values.target, values.origin).toString();

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: "chrome" });
  }
  const samples: Record<"with" | "without", ProbeMetrics[]> = { with: [], without: [] };
  let measuredChrome: MeasuredChrome | null = null;
  try {
    for (let run = 0; run < runs; run++) {
      for (const condition of ["with", "without"] as const) {
        samples[condition].push(
          await probeVisit(browser, profile, url, condition, (m) => {
            // Every with-run must see the SAME chrome, or the delta mixes
            // two different fragments.
            if (measuredChrome && measuredChrome.sha256 !== m.sha256) {
              throw new Error(
                `the served chrome changed mid-probe (${measuredChrome.sha256.slice(0, 12)} → ${m.sha256.slice(0, 12)}) — the delta would mix two fragments`,
              );
            }
            measuredChrome = m;
          }),
        );
      }
    }
  } finally {
    await browser.close();
  }
  if (!measuredChrome) throw new Error("no chrome fragment was observed — nothing to measure");

  const withMed = medians(samples.with);
  const withoutMed = medians(samples.without);
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? null : a - b;
  const artifact = {
    kind: "pm-chrome-constant",
    date: new Date().toISOString(),
    commit: commitPin(repoRoot),
    origin: values.origin,
    target: values.target,
    profile: { id: profile.id, specVersion: PROFILE_SPEC_VERSION },
    runsPerCondition: runs,
    // WHICH chrome this constant describes (see MeasuredChrome): the strip's
    // cost scales with what it renders, so the artifact carries the measured
    // fragment's size and hash, and whether it was the populated state.
    measuredChrome,
    method: [
      "both conditions intercept the document response and re-fulfill it locally (the hop cancels out of the delta); the without-condition strips exactly the injected chrome subtree, its /_pm/ head links, and the measurement script tag — decomposeDocument's own instrumentation boundaries — before parse",
      "both fulfilled bodies are re-compressed with brotli and served content-encoding: br, so the bytes the two conditions differ by cross the throttled connection compressed exactly as the plane sends them — serving the decoded body would make the delta's transfer term an artifact of the probe",
      "paint/shift/long-task metrics come from the browser's own performance timeline via an init-script observer, identically in both conditions — the injected ruler cannot measure its own absence",
      "CLS is the session-window maximum (the web-vitals definition the rest of the site publishes), never the superseded running total",
      "conditions round-robin interleaved; the published constant is the delta of medians (with − without)",
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
