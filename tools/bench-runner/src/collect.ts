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
  /** Settle window after load/interaction, ms. */
  settleMs?: number;
}

export const DEFAULT_SETTLE_MS = 400;

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
  const settleMs = spec.settleMs ?? DEFAULT_SETTLE_MS;
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
    await page.waitForLoadState("networkidle");

    const initialEntries = await resourceEntries(page);

    await interaction(page);
    await page.waitForTimeout(settleMs);
    const afterEntries = await resourceEntries(page);

    // Flush the measurement client (its own reporting trigger): final
    // values report on visibility-hidden.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // The beacons are same-tick sendBeacon calls; give the route a moment.
    await page.waitForTimeout(300);

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
    // The document itself: the HTML bucket, counted as a request.
    buckets.html += nav.transferSize;
    counted += 1;

    const initialJsBytes = initialEntries
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
