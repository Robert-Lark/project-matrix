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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { computeCostReport, parseRateCard, renderReport } from "@pm/cost-calculator";
import { SURFACE_CONTROLS } from "@pm/switcher";
import {
  PROFILE_SPEC_VERSION,
  PROFILES,
  kbpsToBytesPerSecond,
} from "@pm/measurement";
import {
  InspectorCpuSource,
  LOCAL_PLANE_INSPECTORS,
  Receipt,
  assertBenchableTarget,
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
// A bare path constant: the bench runner mints a fresh per-batch ?run=
// nonce for every visit it drives (@pm/bench-runner batch discipline).
// kv-exempt: nonced by the bench runner at request time
const API_TARGET = "/api/plp";
// Real editorial variants — the END-TO-END non-vacuity for the inline-byte
// decomposition (issue #16). A placeholder has no inline script, so only a real
// variant page, driven through the composed origin with chrome injected, proves
// initialJsBytes actually counts inline executable JS (astro, whose bundle is
// INLINED) and that Qwik's post-load preloader lands on the initial side.
const EDITORIAL_TARGETS = ["/astro/editorial/", "/qwik/editorial/"] as const;

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
      // Editorial variants are LOCAL-ONLY: they exercise the harness byte
      // decomposition, not plane correctness (the drift gate + placeholder
      // bench already prove the deployed plane), and adding heavier pages to
      // the post-deploy smoke would aggravate the already-flagged deploy-bench
      // timing flake (finish-line log / issue #16 open design question).
      ...(REMOTE
        ? []
        : EDITORIAL_TARGETS.map((path) => ({ path, interactionId: "body-click" }))),
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

  it("records the MECHANISM that settled it, not just the ceiling", () => {
    // `harness.quiescence` is what lets a publication gate tell an honestly
    // settled receipt from one minted under the latch (ADR-0001 addendum R).
    // zod strips unknown keys and the field is optional, so a typo in
    // `batch.ts` would drop it silently and every receipt from that point on
    // would be byte-indistinguishable from a pre-fix one — with nothing red
    // until the gate lands and starts rejecting honest receipts (verify-slice,
    // anti-rigging lens). Asserted where a receipt is actually minted.
    expect(receipt.harness.quiescence).toBe("in-flight-tracked");
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

describe.skipIf(REMOTE)("editorial KB accounting is non-vacuous end-to-end (issue #16 defect 1/4)", () => {
  // The placeholders above ship no page JS, so they can only prove the NEGATIVE
  // (js === 0). These real variant pages drive the full pipeline — measureVisit
  // → served-body decomposition → chrome-injected document — the only place the
  // inline-byte accounting is proven against real served HTML rather than a
  // hand-written fixture (decompose.test.ts).
  it("astro's INLINED cart module lands in the JS headline; its cart-item JSON in data", () => {
    const astro = receipt.targets.find((t) => t.path === "/astro/editorial/")!;
    for (const run of astro.columns.cold.runs) {
      // Astro ships ZERO external JS (the bundle is inlined), so a non-zero JS
      // headline here can ONLY come from the inline-executable decomposition —
      // exactly the "0 KB JS islands variant" defect this unit kills.
      expect(run.kb.initialJsBytes).toBeGreaterThan(0);
      expect(run.kb.buckets.js).toBeGreaterThan(0);
      // The cart-item is `<script type="application/json">` — inert data, not JS.
      expect(run.kb.buckets.data).toBeGreaterThan(0);
      // Instrumentation markup is stripped, and the buckets still partition.
      expect(run.kb.instrumentationBytes).toBeGreaterThan(0);
      expect(run.kb.totalBytes).toBe(
        Object.values(run.kb.buckets).reduce((a, b) => a + b, 0),
      );
    }
  });

  it("qwik ships real JS, serializes state as data, and its preloader lands on the INITIAL side (defect 4)", () => {
    const qwik = receipt.targets.find((t) => t.path === "/qwik/editorial/")!;
    for (const run of qwik.columns.cold.runs) {
      expect(run.kb.initialJsBytes).toBeGreaterThan(0);
      // Qwik serializes resumability state as `<script type="qwik/json">` → data.
      expect(run.kb.buckets.data).toBeGreaterThan(0);
      // Nothing fetches on the body click, and the preloader was awaited onto
      // the initial side — so the interaction boundary is a clean zero, not the
      // run-varying straddle defect 4 was about.
      expect(run.kb.interactionBytes).toBe(0);
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
        // BOTH columns: a zeroed (invented) warm-column value must not
        // hide behind a correctly-null cold column.
        for (const column of [target.columns.cold, target.columns.warm]) {
          const cpu = column.resourceProfile.cpuMs;
          if (REMOTE) {
            expect(cpu.value).toBeNull();
            expect(cpu.source).toContain("observability");
          } else {
            expect(cpu.value).toBeGreaterThan(0);
            expect(cpu.source).toContain("v8-inspector-profile");
          }
        }
      }
    },
  );
});

describe("the cost calculator consumes the receipt as-is (issue #8: input shape aligns)", () => {
  it("prices the real receipt with the shipped dated card, honest about CPU both ways", () => {
    const card = parseRateCard(
      JSON.parse(
        readFileSync(
          join(repoRoot, "tools/cost-calculator/ratecards/2026-07-10-usd.json"),
          "utf8",
        ),
      ),
    );
    const report = computeCostReport({
      receipt,
      card,
      assumptions: { cacheHitRatio: 0.5, region: "us-east" },
      architectureHostId: "cloudflare-workers-paid",
      realWorldHosts: Object.fromEntries(
        receipt.targets.map((t) => [t.path, "cloudflare-workers-paid"]),
      ),
      date: new Date().toISOString(),
    });
    expect(report.input.commit.sha).toBe(receipt.commit.sha);
    for (const target of report.views.architectureOnly.targets) {
      // Bytes and requests always price (measured on both planes)…
      expect(target.blended.requests.value).toBeGreaterThan(0);
      expect(target.blended.egressBytes.value).toBeGreaterThan(0);
      const cpuLine = target.lines.find((l) => l.basis === "cpuMs")!;
      if (REMOTE) {
        // …CPU is an honest UNPRICED line until the deploy leg arms.
        expect(cpuLine.costUsdPer1MVisits).toBeNull();
        expect(target.totalUsdPer1MVisits).toBeNull();
        expect(target.unpriced.map((u) => u.meter)).toContain("Workers CPU time");
      } else {
        expect(cpuLine.costUsdPer1MVisits).toBeGreaterThan(0);
        expect(target.totalUsdPer1MVisits).toBeGreaterThan(0);
      }
    }
    // The published-arithmetic rendering holds together end-to-end.
    expect(renderReport(report)).toContain("ARCHITECTURE-ONLY");
  });
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
    // 600 s, raised from 300 s on 2026-08-28. The settle waits in this batch
    // are now GENUINE quiescence waits rather than a latch that returned
    // instantly (ADR-0001 addendum R), and this file gained a sibling that
    // drives its own batches, so the whole suite contends harder. This leg
    // drives a full batch TWICE over — it timed out at exactly 300003 ms on
    // the first full run after those landed. Sized to catch a HANG, not fitted
    // to an extrapolation: the last unit's own lesson (PR #34).
  }, 600_000);
});

describe("the fence as mechanism: the runner refuses remix3 (FINDINGS §7(c)3, slice F)", () => {
  // No origin needed: the guard sits in runBatch's validation block, BEFORE
  // any browser launches — a receipt naming the fenced exhibit cannot be
  // minted by the CLI, the reproduce path, or a direct library import.
  it("assertBenchableTarget names the fence for any /remix3/* path", () => {
    expect(() => assertBenchableTarget("/remix3/editorial/")).toThrowError(
      /fenced exhibit.*excluded from every benchmark number/,
    );
    expect(() => assertBenchableTarget("/remix3/anything/else")).toThrowError(/fenced/);
    // The guard resolves the path the way the runner's effectiveUrl does —
    // the spec shapes URL() accepts must not slip past a naive split
    // (verify-slice finding: both of these previously minted a fenced
    // receipt).
    expect(() => assertBenchableTarget("remix3/editorial/")).toThrowError(/fenced/);
    expect(() => assertBenchableTarget("/./remix3/editorial/")).toThrowError(/fenced/);
    // Prefix-scoped, not substring-scoped: a future variant whose name
    // merely contains "remix3" is not the exhibit.
    expect(() => assertBenchableTarget("/vanilla/editorial/")).not.toThrow();
    expect(() => assertBenchableTarget("/placeholder-static/sample/")).not.toThrow();
  });

  it("every chrome-labeled fenced exhibit is refused by the runner — the two fence registries cannot drift apart", () => {
    // The fence is double-entry: batch.ts FENCED_VARIANT_PREFIXES is the
    // hand-written variant wall, and the runner's second wall (fencedPathOf)
    // is derived from SURFACE_CONTROLS itself — @pm/switcher is already a
    // bench-runner dependency (chrome-constant.ts imports chromeFragmentOf).
    // The correspondence is still pinned HERE, where both packages meet, so
    // a registry edit that breaks the derivation fails a test rather than
    // minting receipts for an exhibit the chrome declares excluded
    // (verify-slice finding, seams lens).
    for (const controls of Object.values(SURFACE_CONTROLS)) {
      for (const f of controls.fencedExhibits ?? []) {
        expect(() => assertBenchableTarget(`/${f.variant}/editorial/`)).toThrowError(/fenced/);
      }
    }
  });

  it("every fenced STRATEGY path is refused by the runner, in every alias shape the runner accepts", () => {
    // The exhibit's third registry home (strategies[].fenced): a fenced
    // ROUTE of an otherwise-benchable variant, invisible to a variant-prefix
    // fence. Alias shapes mirror the remix3 cases above, plus the two that
    // matter most here: the slashless form (the app 308s it ONTO the fenced
    // page, so `page.goto` would measure the exhibit and label the receipt
    // with the unfenced-looking path) and a query-carrying one.
    const fencedStrategies = Object.values(SURFACE_CONTROLS)
      .flatMap((c) => c.strategies ?? [])
      .filter((s) => s.fenced === true);
    expect(fencedStrategies.length).toBeGreaterThan(0);
    for (const s of fencedStrategies) {
      const bare = s.path.replace(/^\/+|\/+$/g, "");
      // Percent-encoded last segment (`/react-next/plp/%61pollo/`): URL()
      // keeps the escape, the app decodes it before routing, so the fence
      // must decode before it compares.
      const cut = bare.lastIndexOf("/") + 1;
      const last = bare.slice(cut);
      const encodedLast = `%${last.charCodeAt(0).toString(16)}${last.slice(1)}`;
      for (const alias of [
        s.path,
        `/${bare}`,
        `${bare}/`,
        `/./${bare}/`,
        `/${bare}//`,
        `/${bare}/?cache=cold&run=probe`,
        `/${bare}?cache=cold`,
        `/${bare.slice(0, cut)}${encodedLast}/`,
      ]) {
        expect(() => assertBenchableTarget(alias), alias).toThrowError(/fenced/);
      }
      // Segment-scoped, not substring-scoped: a sibling route that merely
      // extends the fenced path's last segment is not the exhibit.
      expect(() => assertBenchableTarget(`/${bare}-two/`)).not.toThrow();
    }
    // And the fence is path-level, not variant-level: the fenced exhibit's
    // UNFENCED siblings on the same variant stay benchable.
    const unfenced = Object.values(SURFACE_CONTROLS)
      .flatMap((c) => c.strategies ?? [])
      .filter((s) => s.fenced !== true);
    expect(unfenced.length).toBeGreaterThan(0);
    for (const s of unfenced) expect(() => assertBenchableTarget(s.path)).not.toThrow();
  });

  it("runBatch rejects a batch carrying a remix3 target before driving anything", async () => {
    await expect(
      runBatch({
        origin: ORIGIN,
        targets: [{ path: "/remix3/editorial/", interactionId: "body-click" }],
        profileId: PROFILE.id,
        runsPerUrl: 1,
        n: 24,
        runNonce: `${NONCE}-fence`,
        repoRoot,
      }),
    ).rejects.toThrowError(/fenced exhibit/);
  });

  it("runBatch rejects a batch carrying the fenced Apollo route — slashless, the 308 shape — before driving anything", async () => {
    await expect(
      runBatch({
        origin: ORIGIN,
        targets: [{ path: "/react-next/plp/apollo", interactionId: "body-click" }],
        profileId: PROFILE.id,
        runsPerUrl: 1,
        n: 24,
        runNonce: `${NONCE}-fence-path`,
        repoRoot,
      }),
    ).rejects.toThrowError(/fenced exhibit/);
  });
});
