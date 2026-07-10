/**
 * The bench runner at the composed-origin seam (issue #7, ADR-0001): a tiny
 * batch — three targets, two runs, one profile — driven against the same
 * origin the visitors get, then the receipt is held to the acceptance
 * criteria. The two placeholder PAGES prove the chrome-beacon vitals
 * harvest, instrumentation stripping, and the trivial interaction; the bare
 * tray URL (/api/plp driven as a document) proves the cold/warm columns
 * observable end-to-end (x-pm-cache-state: bypass vs hit) and that the
 * runner is honest where no chrome exists (all-null vitals, never invented).
 *
 * Locally the CPU field comes from the inspector profiler over the four
 * pinned dev inspectors; against the deployed origin (the post-deploy
 * smoke) no inspector exists and the field must be an honest null naming
 * the armed-path source — asserted both ways. Note: vitest runs suite
 * FILES in parallel, so sibling files' traffic can inflate this batch's
 * CPU samples — the assertions here are presence/provenance (> 0, source
 * named), never magnitude; clean numbers come from `pnpm bench` runs on a
 * quiet plane.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PROFILE_SPEC_VERSION,
  PROFILES,
  kbpsToBytesPerSecond,
} from "@pm/measurement";
import {
  InspectorCpuSource,
  LOCAL_PLANE_INSPECTORS,
  Receipt,
  runBatch,
  specFromReceipt,
  type ReceiptT,
} from "@pm/bench-runner";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
// The deployed plane (the smoke): real KV (eventually consistent), no local
// inspectors.
const REMOTE = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const NONCE = `suite-bench-${Date.now().toString(36)}`;
const PROFILE = PROFILES["avg-broadband-desktop"];
const RUNS = 2;

const PAGE_TARGETS = ["/placeholder-static/sample/", "/placeholder-ssr/sample/"] as const;
const API_TARGET = "/api/plp";

let receipt: ReceiptT;

beforeAll(async () => {
  if (REMOTE) {
    // Real KV caches negative lookups and is eventually consistent — warm
    // the batch's nonce-keyed entry and poll for the hit (the data-plane
    // suite's pattern) so the batch's warm column measures warm, not
    // propagation luck.
    const warmUrl = `${ORIGIN}${API_TARGET}?n=24&run=${NONCE}`;
    const deadline = Date.now() + 90_000;
    for (;;) {
      const res = await fetch(warmUrl);
      if (res.headers.get("x-pm-cache-state") === "hit" || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  receipt = await runBatch({
    origin: ORIGIN,
    targets: [
      ...PAGE_TARGETS.map((path) => ({ path, interactionId: "body-click" })),
      { path: API_TARGET, interactionId: "none" },
    ],
    profileId: PROFILE.id,
    runsPerUrl: RUNS,
    n: 24,
    runNonce: NONCE,
    repoRoot,
    cpuSource: REMOTE ? undefined : new InspectorCpuSource(LOCAL_PLANE_INSPECTORS),
  });
}, 300_000);

describe("the receipt is a complete, SHA-pinned record (ADR-0001 §9)", () => {
  it("parses against the receipt contract and pins THIS commit", () => {
    const parsed = Receipt.parse(receipt);
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    expect(parsed.commit.sha).toBe(sha);
    expect(typeof parsed.commit.dirty).toBe("boolean");
    expect(parsed.runsPerUrl).toBe(RUNS);
    expect(parsed.runLocation.label.length).toBeGreaterThan(0);
    expect(Date.parse(parsed.date)).toBeGreaterThan(0);
  });

  it("records the exact URLs measured, knobs included", () => {
    for (const target of receipt.targets) {
      const cold = new URL(target.columns.cold.effectiveUrl);
      const warm = new URL(target.columns.warm.effectiveUrl);
      expect(cold.pathname).toBe(target.path);
      expect(cold.searchParams.get("cache")).toBe("cold");
      expect(warm.searchParams.get("cache")).toBeNull();
      for (const url of [cold, warm]) {
        expect(url.origin).toBe(ORIGIN);
        expect(url.searchParams.get("n")).toBe("24");
        expect(url.searchParams.get("run")).toBe(NONCE);
      }
    }
  });

  it("pins the profile spec version and publishes the applied throttle arithmetic", () => {
    expect(receipt.profile.id).toBe(PROFILE.id);
    expect(receipt.profile.specVersion).toBe(PROFILE_SPEC_VERSION);
    const applied = receipt.profile.applied;
    expect(applied.latencyMs).toBe(PROFILE.network.rttMs);
    expect(applied.downloadBytesPerSec).toBe(
      kbpsToBytesPerSecond(PROFILE.network.downloadKbps),
    );
    expect(applied.cpuMultiplier).toBe(PROFILE.cpuMultiplier);
    expect(applied.mechanism).toContain("cdp-applied");
  });
});

describe("cold and warm are real, separate columns (ADR-0001 §4)", () => {
  it("the tray target's cold runs bypass and its warm runs hit", () => {
    const tray = receipt.targets.find((t) => t.path === API_TARGET)!;
    for (const run of tray.columns.cold.runs) {
      expect(run.docCacheState).toBe("bypass");
    }
    for (const run of tray.columns.warm.runs) {
      expect(run.docCacheState).toBe("hit");
    }
  });

  it("page documents carry no cache-state header — recorded as null, never invented", () => {
    for (const path of PAGE_TARGETS) {
      const target = receipt.targets.find((t) => t.path === path)!;
      for (const run of [...target.columns.cold.runs, ...target.columns.warm.runs]) {
        expect(run.docCacheState).toBeNull();
      }
    }
  });
});

describe("KB accounting (ADR-0001 §3, §6)", () => {
  it("strips instrumentation NON-vacuously on pages: /_pm/* bytes exist and are excluded", () => {
    for (const path of PAGE_TARGETS) {
      const target = receipt.targets.find((t) => t.path === path)!;
      for (const run of target.columns.cold.runs) {
        // chrome.css + measure.js at minimum — the exclusion has something
        // to exclude, so a severed stripping path cannot pass silently.
        expect(run.requests.instrumentation).toBeGreaterThanOrEqual(2);
        expect(run.kb.instrumentationBytes).toBeGreaterThan(0);
        expect(run.kb.buckets.html).toBeGreaterThan(0);
        expect(run.kb.buckets.fonts).toBeGreaterThan(0);
        expect(run.kb.buckets.css).toBeGreaterThan(0);
        // Placeholders ship no page JS: the headline is honestly zero —
        // measure.js rides the instrumentation bucket, not the JS bucket.
        expect(run.kb.initialJsBytes).toBe(0);
        expect(run.kb.buckets.js).toBe(0);
        // The trivial interaction fetches nothing.
        expect(run.kb.interactionBytes).toBe(0);
        expect(run.kb.totalBytes).toBe(
          Object.values(run.kb.buckets).reduce((a, b) => a + b, 0),
        );
      }
    }
  });
});

describe("TTFB decomposition and the one-ruler vitals (ADR-0001 §2, §5)", () => {
  it("every run decomposes TTFB into travel vs server think-time", () => {
    for (const target of receipt.targets) {
      for (const run of [...target.columns.cold.runs, ...target.columns.warm.runs]) {
        expect(run.ttfb.serverMs).toBeGreaterThan(0);
        expect(run.ttfb.travelMs).toBeGreaterThanOrEqual(0);
        expect(run.ttfb.raw.responseStart).toBeGreaterThan(0);
      }
    }
  });

  it("pages report the chrome's own web-vitals; the chromeless tray reports null, never invented", () => {
    for (const path of PAGE_TARGETS) {
      const target = receipt.targets.find((t) => t.path === path)!;
      for (const run of target.columns.cold.runs) {
        expect(run.webVitals.TTFB).not.toBeNull();
        expect(run.webVitals.FCP).not.toBeNull();
        expect(run.webVitals.LCP).not.toBeNull();
        expect(run.webVitals.CLS).not.toBeNull();
        // The scripted interaction makes INP measurable.
        expect(run.webVitals.INP).not.toBeNull();
      }
    }
    const tray = receipt.targets.find((t) => t.path === API_TARGET)!;
    for (const run of tray.columns.cold.runs) {
      expect(Object.values(run.webVitals).every((v) => v === null)).toBe(true);
    }
  });
});

describe("the measured resource profile (ADR-0001 §7)", () => {
  it("bytes and requests come from the runner's own accounting, sources named", () => {
    for (const target of receipt.targets) {
      for (const column of [target.columns.cold, target.columns.warm]) {
        const rp = column.resourceProfile;
        expect(rp.bytes.value).toBeGreaterThan(0);
        expect(rp.bytes.source).toContain("resource-timing");
        expect(rp.requests.value).toBeGreaterThanOrEqual(1);
        expect(rp.requests.source).toContain("resource-timing");
      }
    }
  });

  it(
    REMOTE
      ? "CPU-ms is an honest null naming the armed-path source (no inspector on the deployed plane)"
      : "CPU-ms comes from real V8 profiles of the local plane, source named",
    () => {
      for (const target of receipt.targets) {
        const cpu = target.columns.cold.resourceProfile.cpuMs;
        if (REMOTE) {
          expect(cpu.value).toBeNull();
          expect(cpu.source).toContain("observability");
        } else {
          expect(cpu.value).toBeGreaterThan(0);
          expect(cpu.source).toContain("v8-inspector-profile");
        }
      }
    },
  );
});

describe("one-command reproduce (ADR-0001 §9)", () => {
  it("re-runs the receipt's batch — same URLs, profile, run count — emitting a new receipt", async () => {
    const spec = specFromReceipt(receipt, repoRoot, {
      origin: ORIGIN,
      cpuSource: REMOTE ? undefined : new InspectorCpuSource(LOCAL_PLANE_INSPECTORS),
    });
    const again = Receipt.parse(await runBatch(spec));
    expect(again.targets.map((t) => t.path)).toEqual(
      receipt.targets.map((t) => t.path),
    );
    expect(again.profile.id).toBe(receipt.profile.id);
    expect(again.runsPerUrl).toBe(receipt.runsPerUrl);
    expect(again.environment.n).toBe(receipt.environment.n);
    // A fresh batch, not a replay: new nonce, new date.
    expect(again.environment.runNonce).not.toBe(receipt.environment.runNonce);
  }, 300_000);
});
