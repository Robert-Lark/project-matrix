/**
 * The cost calculator's arithmetic held to issue #8's acceptance criteria —
 * PURE (no origin, no I/O, no clock): a known resource profile × a known
 * rate card × a stated cache-hit ratio and region must produce EXACT,
 * hand-computed dollars for both views, publish every intermediate step,
 * and keep nulls honest (unpriced, never estimated or zeroed).
 *
 * Fixture values are chosen to be exact in binary floating point, so every
 * dollar assertion is `toBe`, not `toBeCloseTo` — the arithmetic has no
 * tolerance to hide in. The fixture receipt is parsed through the REAL
 * receipt contract (`Receipt.parse`) so the calculator's input shape is
 * pinned to what the bench runner emits (issue #8 "input shape aligns").
 *
 * The one I/O-touching block at the end validates the SHIPPED dated card
 * against the card contract — separate from the pure AC1 assertions.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RECEIPT_VERSION, Receipt, type ReceiptT } from "@pm/bench-runner";
import {
  blendColumns,
  computeCostReport,
  parseCostReport,
  parseRateCard,
  type CostInput,
  type RateCardT,
} from "@pm/cost-calculator";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NULL_VITALS = { TTFB: null, FCP: null, LCP: null, CLS: null, INP: null };

function column(
  url: string,
  profile: { cpuMs: number | null; bytes: number; requests: number },
  cpuSource: string,
) {
  return {
    effectiveUrl: url,
    runs: [],
    medians: {
      ttfbTravelMs: null,
      ttfbServerMs: null,
      webVitals: NULL_VITALS,
      totalBytes: null,
      initialJsBytes: null,
      interactionBytes: null,
      requests: null,
    },
    resourceProfile: {
      cpuMs: { value: profile.cpuMs, source: cpuSource },
      bytes: { value: profile.bytes, source: "fixture bytes accounting" },
      requests: { value: profile.requests, source: "fixture request accounting" },
    },
  };
}

// Target A measures everything; target B's CPU is the deployed-origin shape
// (null with the source named) in BOTH columns.
const FIXTURE_RECEIPT: ReceiptT = Receipt.parse({
  kind: "pm-bench-receipt",
  receiptVersion: RECEIPT_VERSION,
  date: "2026-07-10T00:00:00.000Z",
  commit: { sha: "f".repeat(40), dirty: false },
  origin: "http://fixture.invalid",
  runLocation: { label: "fixture", source: "fixture" },
  profile: {
    id: "avg-broadband-desktop",
    specVersion: 1,
    applied: {
      mechanism: "fixture",
      latencyMs: 0,
      downloadBytesPerSec: 0,
      uploadBytesPerSec: 0,
      cpuMultiplier: 1,
      viewport: { width: 1, height: 1, deviceScaleFactor: 1, mobile: false },
    },
  },
  environment: { n: 24, runNonce: "fixture" },
  runsPerUrl: 1,
  harness: { browser: "fixture", browserVersion: "0", settleMs: 0 },
  methodNotes: ["fixture: warm means edge-tier warm; the browser cache is a held-constant."],
  targets: [
    {
      path: "/a/sample/",
      variant: "a",
      surface: "sample",
      interactionId: "none",
      columns: {
        cold: column("http://fixture.invalid/a/sample/?cache=cold", { cpuMs: 40, bytes: 2_000_000, requests: 20 }, "fixture v8 profile"),
        warm: column("http://fixture.invalid/a/sample/", { cpuMs: 8, bytes: 1_000_000, requests: 12 }, "fixture v8 profile"),
      },
    },
    {
      path: "/b/sample/",
      variant: "b",
      surface: "sample",
      interactionId: "none",
      columns: {
        cold: column("http://fixture.invalid/b/sample/?cache=cold", { cpuMs: null, bytes: 4_000_000, requests: 40 }, "workers observability cpuTimeMs (arms with the deploy leg)"),
        warm: column("http://fixture.invalid/b/sample/", { cpuMs: null, bytes: 800_000, requests: 8 }, "workers observability cpuTimeMs (arms with the deploy leg)"),
      },
    },
  ],
});

// At cache-hit ratio 0.75 the expected per-visit profiles are exact:
//   A: requests = 0.75×12 + 0.25×20 = 14; cpuMs = 0.75×8 + 0.25×40 = 16;
//      bytes = 0.75×1,000,000 + 0.25×2,000,000 = 1,250,000
//   B: requests = 0.75×8 + 0.25×40 = 16; cpuMs = null;
//      bytes = 0.75×800,000 + 0.25×4,000,000 = 1,600,000
const H = 0.75;
const REGION = "moon-base";

const FIXTURE_CARD: RateCardT = parseRateCard({
  kind: "pm-rate-card",
  cardVersion: 1,
  id: "fixture-card",
  capturedAt: "2026-01-01",
  verifiedBy: "hand-authored test fixture",
  regions: [REGION],
  hosts: [
    {
      hostId: "alpha",
      vendor: "Alpha",
      plan: "Alpha Paid",
      monthlyBaseUsd: 5,
      rates: [
        // $0.25/1M requests → A: 0.25 × 14 = $3.50; B: 0.25 × 16 = $4.00
        { meter: "Alpha requests", basis: "requests", amountUsd: 0.25, per: 1_000_000, unit: "requests", regions: "all", includedPerMonth: 6_000_000, quote: "fixture: $0.25 per million", url: "fixture://alpha" },
        // $36 per 10 CPU-hr = $36 per 36,000,000 CPU-ms → A: 36 × 16e6 / 36e6 = $16
        { meter: "Alpha CPU", basis: "cpuMs", amountUsd: 36, per: 10, unit: "CPU-hr", regions: "all", quote: "fixture: $36 per 10 CPU-hours", url: "fixture://alpha" },
        // $0.20/GB → A: 0.20 × 1,250 GB = $250; B: 0.20 × 1,600 GB = $320
        { meter: "Alpha egress", basis: "egressBytes", amountUsd: 0.2, per: 1, unit: "GB", regions: "all", quote: "fixture: $0.20 per GB", url: "fixture://alpha" },
      ],
      freePlan: {
        plan: "Alpha Free",
        allowances: [
          { meter: "Alpha requests", basis: "requests", allowance: 3000, unit: "requests", period: "day", quote: "fixture: 3,000 per day", url: "fixture://alpha" },
        ],
        overflow: "fixture: requests beyond the free allowance fail with 429",
      },
    },
    {
      hostId: "beta",
      vendor: "Beta",
      plan: "Beta Pro",
      monthlyBaseUsd: 20,
      monthlyCreditUsd: 10,
      rates: [
        // $2/1M requests → A: 2 × 14 = $28
        { meter: "Beta edge requests", basis: "requests", amountUsd: 2, per: 1_000_000, unit: "requests", regions: [REGION], quote: "fixture: $2.00 per million", url: "fixture://beta" },
        // $4/1M invocations, one per visit → $4 flat
        { meter: "Beta invocations", basis: "visits", amountUsd: 4, per: 1_000_000, unit: "invocations", regions: "all", quote: "fixture: $4 per million invocations", url: "fixture://beta", note: "one invocation per visit — the rendered document" },
        // $9 per 2 CPU-hr = $9 per 7,200,000 CPU-ms → A: 9 × 16e6 / 7.2e6 = $20
        { meter: "Beta active CPU", basis: "cpuMs", amountUsd: 9, per: 2, unit: "CPU-hr", regions: "all", quote: "fixture: $9 per 2 CPU-hours", url: "fixture://beta" },
        // $0.50/GB → A: 0.50 × 1,250 GB = $625
        { meter: "Beta transfer", basis: "egressBytes", amountUsd: 0.5, per: 1, unit: "GB", regions: [REGION], quote: "fixture: $0.50 per GB", url: "fixture://beta" },
      ],
      unmeasured: [
        { meter: "Beta phantom memory", priceSummary: "$1/GB-hr", quote: "fixture: billed on wall-time × memory", url: "fixture://beta", note: "the measured profile has no wall-time × memory dimension" },
      ],
      freePlan: {
        plan: "Beta Hobby",
        allowances: [
          { meter: "Beta invocations", basis: "visits", allowance: 1_000_000, unit: "invocations", period: "month", quote: "fixture: 1M per month", url: "fixture://beta" },
          // 4 CPU-hr = 14,400,000 CPU-ms — exercises allowance unit conversion
          { meter: "Beta active CPU", basis: "cpuMs", allowance: 4, unit: "CPU-hr", period: "month", quote: "fixture: 4 CPU-hours per month", url: "fixture://beta" },
          { meter: "Beta edge requests", basis: "requests", allowance: "unlimited", unit: "requests", period: "month", quote: "fixture: unlimited", url: "fixture://beta" },
          { meter: "Beta per-invocation cap", allowance: 10, unit: "CPU-ms", period: "invocation", quote: "fixture: 10ms per invocation", url: "fixture://beta" },
        ],
        overflow: "fixture: hobby pauses beyond the allowance",
      },
    },
    {
      // An all-$0 host (the cloudflare-static-assets shape): a $0 rate
      // prices ANY usage — even an unaccounted one — at exactly $0.
      hostId: "gamma",
      vendor: "Gamma",
      plan: "Gamma Free",
      monthlyBaseUsd: 0,
      rates: [
        { meter: "Gamma requests", basis: "requests", amountUsd: 0, per: 1_000_000, unit: "requests", regions: "all", quote: "fixture: free", url: "fixture://gamma" },
        { meter: "Gamma CPU", basis: "cpuMs", amountUsd: 0, per: 1_000_000, unit: "CPU-ms", regions: "all", quote: "fixture: free", url: "fixture://gamma" },
        { meter: "Gamma egress", basis: "egressBytes", amountUsd: 0, per: 1, unit: "GB", regions: "all", quote: "fixture: free", url: "fixture://gamma" },
      ],
    },
  ],
});

function baseInput(): CostInput {
  return {
    receipt: FIXTURE_RECEIPT,
    card: FIXTURE_CARD,
    assumptions: { cacheHitRatio: H, region: REGION },
    architectureHostId: "alpha",
    realWorldHosts: { "/a/sample/": "beta", "/b/sample/": "alpha" },
    date: "2026-07-10T00:00:00.000Z",
  };
}

const report = computeCostReport(baseInput());
const [archA, archB] = report.views.architectureOnly.targets;
const [realA, realB] = report.views.realWorld.targets;

// ---------------------------------------------------------------------------
// AC1 — exact dollars, both views, pure arithmetic
// ---------------------------------------------------------------------------

describe("known profile × known card × stated ratio and region → exact dollars (issue #8 AC1)", () => {
  it("architecture-only: every variant priced on the SAME host's rates", () => {
    expect(report.views.architectureOnly.hostId).toBe("alpha");
    // A: $3.50 requests + $16 CPU + $250 egress = $269.50 per 1M visits
    expect(archA!.lines.map((l) => l.costUsdPer1MVisits)).toEqual([3.5, 16, 250]);
    expect(archA!.totalUsdPer1MVisits).toBe(269.5);
  });

  it("real-world: each variant priced on its stated host", () => {
    // A on beta: $28 requests + $4 invocations + $20 CPU + $625 egress = $677
    expect(realA!.hostId).toBe("beta");
    const byMeter = new Map(realA!.lines.map((l) => [l.meter, l.costUsdPer1MVisits]));
    expect(byMeter.get("Beta edge requests")).toBe(28);
    expect(byMeter.get("Beta invocations")).toBe(4);
    expect(byMeter.get("Beta active CPU")).toBe(20);
    expect(byMeter.get("Beta transfer")).toBe(625);
    expect(realA!.totalUsdPer1MVisits).toBe(677);
    // The two views genuinely differ for the same measured profile.
    expect(realA!.totalUsdPer1MVisits).not.toBe(archA!.totalUsdPer1MVisits);
    // B maps to alpha in both views — identical by construction.
    expect(realB!.hostId).toBe("alpha");
    expect(realB!.pricedSubtotalUsdPer1MVisits).toBe(archB!.pricedSubtotalUsdPer1MVisits);
  });

  it("the blend is the stated ratio over the receipt's two MEASURED columns", () => {
    expect(archA!.blended.requests.value).toBe(14);
    expect(archA!.blended.cpuMs.value).toBe(16);
    expect(archA!.blended.egressBytes.value).toBe(1_250_000);
    expect(archA!.blended.requests.arithmetic).toContain("0.75 × 12 (warm) + 0.25 × 20 (cold) = 14");
    // Measurement sources ride along from the receipt, never invented.
    expect(archA!.blended.cpuMs.source).toContain("fixture v8 profile");
  });
});

// ---------------------------------------------------------------------------
// AC2 — the card is data: dated, swappable without code changes
// ---------------------------------------------------------------------------

describe("rate card is dated and swappable without code changes (issue #8 AC2)", () => {
  it("swapping the card document changes the dollars and the provenance echo", () => {
    const swapped = structuredClone(FIXTURE_CARD);
    swapped.id = "fixture-card-v2";
    swapped.capturedAt = "2026-02-02";
    swapped.hosts[0]!.rates[0]!.amountUsd = 0.5; // $0.25 → $0.50 per 1M requests
    const report2 = computeCostReport({ ...baseInput(), card: parseRateCard(swapped) });
    const a2 = report2.views.architectureOnly.targets[0]!;
    // A requests: 0.50 × 14 = $7.00; total 7 + 16 + 250 = $273
    expect(a2.totalUsdPer1MVisits).toBe(273);
    expect(report2.card).toEqual({ id: "fixture-card-v2", capturedAt: "2026-02-02", verifiedBy: "hand-authored test fixture" });
    expect(report.card.capturedAt).toBe("2026-01-01");
  });
});

// ---------------------------------------------------------------------------
// AC3 — cache-hit ratio and region are required, explicit inputs
// ---------------------------------------------------------------------------

describe("cache-hit ratio and region are required, explicit inputs (issue #8 AC3)", () => {
  it("rejects a cache-hit ratio outside [0, 1] or non-finite", () => {
    for (const bad of [-0.1, 1.5, Number.NaN]) {
      expect(() =>
        computeCostReport({ ...baseInput(), assumptions: { cacheHitRatio: bad, region: REGION } }),
      ).toThrow(/cache-hit ratio is a required explicit input/);
    }
  });

  it("rejects a region outside the card's vocabulary, naming what the card knows", () => {
    expect(() =>
      computeCostReport({ ...baseInput(), assumptions: { cacheHitRatio: H, region: "mars" } }),
    ).toThrow(/region is a required explicit input.*moon-base/);
  });

  it("rejects a real-world view with an unmapped target — no hidden defaults", () => {
    expect(() =>
      computeCostReport({ ...baseInput(), realWorldHosts: { "/a/sample/": "beta" } }),
    ).toThrow(/missing "\/b\/sample\/"/);
  });

  it("rejects a mapping key that matches no receipt target (typo guard)", () => {
    expect(() =>
      computeCostReport({
        ...baseInput(),
        realWorldHosts: { "/a/sample/": "beta", "/b/sample/": "alpha", "/b/sample": "alpha" },
      }),
    ).toThrow(/names "\/b\/sample", which is not a receipt target/);
  });

  it("rejects an unknown architecture host, naming the card's hosts", () => {
    expect(() =>
      computeCostReport({ ...baseInput(), architectureHostId: "delta" }),
    ).toThrow(/no host "delta".*alpha, beta, gamma/);
  });

  it("the stated assumptions are echoed in the report", () => {
    expect(report.assumptions.cacheHitRatio).toBe(H);
    expect(report.assumptions.region).toBe(REGION);
  });
});

// ---------------------------------------------------------------------------
// A card must fail at PARSE time, not mid-report on some input combination
// ---------------------------------------------------------------------------

describe("card authoring errors surface at parse time (AC2: swappable safely)", () => {
  it("rejects a checkable allowance whose unit does not convert to its basis", () => {
    const bad = structuredClone(FIXTURE_CARD);
    bad.hosts[1]!.freePlan!.allowances[1]!.unit = "TB";
    expect(() => parseRateCard(JSON.parse(JSON.stringify(bad)))).toThrow(
      /allowance "Beta active CPU" uses unit "TB"/,
    );
  });

  it("stated-only caps (basis-less / per-invocation / unlimited) may use any unit", () => {
    const ok = structuredClone(FIXTURE_CARD);
    // basis-less stated cap with a unit the converter has never heard of.
    ok.hosts[1]!.freePlan!.allowances.push({
      meter: "Beta phantom pool",
      allowance: 9,
      unit: "GB-hr",
      period: "month",
      quote: "fixture: stated only",
      url: "fixture://beta",
    });
    expect(() => parseRateCard(JSON.parse(JSON.stringify(ok)))).not.toThrow();
  });

  it("rejects duplicate hostIds — an appended (not replaced) host block must not first-match-win", () => {
    const bad = structuredClone(FIXTURE_CARD);
    bad.hosts.push(structuredClone(bad.hosts[1]!));
    bad.hosts[3]!.rates[0]!.amountUsd = 3.2;
    expect(() => parseRateCard(JSON.parse(JSON.stringify(bad)))).toThrow(
      /hostId "beta" appears more than once/,
    );
  });

  it("rejects duplicate rates for one meter/region on the visits basis too", () => {
    const bad = structuredClone(FIXTURE_CARD);
    bad.hosts[1]!.rates.push({
      meter: "Beta invocations",
      basis: "visits",
      amountUsd: 1,
      per: 1_000_000,
      unit: "invocations",
      regions: "all",
      quote: "fixture: duplicate",
      url: "fixture://beta",
    });
    expect(() => parseRateCard(JSON.parse(JSON.stringify(bad)))).toThrow(
      /meter "Beta invocations" has more than one rate/,
    );
  });
});

// ---------------------------------------------------------------------------
// AC4 — intermediate arithmetic published, normalized to $/1M visits
// ---------------------------------------------------------------------------

describe("the output publishes its arithmetic, normalized to $/1M visits (issue #8 AC4)", () => {
  it("the report validates against the versioned report contract", () => {
    expect(() => parseCostReport(JSON.parse(JSON.stringify(report)))).not.toThrow();
  });

  it("every priced line shows blend → ×1M normalization → unit conversion → dollars", () => {
    const cpu = archA!.lines.find((l) => l.meter === "Alpha CPU")!;
    expect(cpu.usagePer1MVisits).toBe(16_000_000);
    expect(cpu.arithmetic).toContain("expected/visit = 0.75 × 8 (warm) + 0.25 × 40 (cold) = 16");
    expect(cpu.arithmetic).toContain("× 1,000,000 visits = 16,000,000 CPU-ms");
    expect(cpu.arithmetic).toContain("1 CPU-hr = 3,600,000 CPU-ms");
    expect(cpu.arithmetic).toContain("= $16");
  });

  it("every line echoes the rate's provenance (quote + url) — the price side's receipt", () => {
    for (const target of [...report.views.architectureOnly.targets, ...report.views.realWorld.targets]) {
      for (const line of target.lines) {
        expect(line.rate.quote.length).toBeGreaterThan(0);
        expect(line.rate.url.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Nulls stay honest — never estimated, never zeroed
// ---------------------------------------------------------------------------

describe("a null resource-profile field is unpriced, never estimated (ADR-0001 §7)", () => {
  it("B's null CPU makes the CPU line unpriced and the total null; the subtotal is labeled partial", () => {
    const cpu = archB!.lines.find((l) => l.meter === "Alpha CPU")!;
    expect(cpu.costUsdPer1MVisits).toBeNull();
    expect(cpu.unpricedReason).toContain("never estimated");
    expect(archB!.totalUsdPer1MVisits).toBeNull();
    // $4.00 requests + $320 egress — the priced part only.
    expect(archB!.pricedSubtotalUsdPer1MVisits).toBe(324);
    expect(archB!.unpriced).toEqual([
      { meter: "Alpha CPU", reason: expect.stringContaining("cpuMs unavailable") },
    ]);
  });

  it("a $0 rate prices even an unaccounted quantity at exactly $0 — zero is not an estimate", () => {
    // B (null CPU in both columns) on the all-free gamma host: the true
    // total is fully determined regardless of the unknown usage.
    const free = computeCostReport({
      ...baseInput(),
      realWorldHosts: { "/a/sample/": "gamma", "/b/sample/": "gamma" },
    });
    const bOnGamma = free.views.realWorld.targets[1]!;
    expect(bOnGamma.blended.cpuMs.value).toBeNull();
    const cpuLine = bOnGamma.lines.find((l) => l.meter === "Gamma CPU")!;
    expect(cpuLine.costUsdPer1MVisits).toBe(0);
    expect(cpuLine.arithmetic).toContain("$0 rate prices ANY usage at exactly $0");
    expect(bOnGamma.unpriced).toEqual([]);
    expect(bOnGamma.totalUsdPer1MVisits).toBe(0);
  });

  it("a zero-weight column cannot poison the blend", () => {
    const nullCold = { value: null, source: "cannot account" };
    const realWarm = { value: 5, source: "measured" };
    expect(blendColumns("cpuMs", nullCold, realWarm, 1).value).toBe(5);
    expect(blendColumns("cpuMs", realWarm, nullCold, 0).value).toBe(5);
    // …but a weighted null makes the expectation honestly null.
    expect(blendColumns("cpuMs", nullCold, realWarm, 0.5).value).toBeNull();
  });

  it("unmeasured vendor meters are declared on the target and in the method notes", () => {
    expect(realA!.unmeasuredMeters).toEqual(["Beta phantom memory"]);
    expect(report.methodNotes.join("\n")).toContain("Beta phantom memory");
  });

  it("refuses a physically impossible (negative) profile value loudly — never priced", () => {
    const doctored = structuredClone(FIXTURE_RECEIPT);
    doctored.targets[0]!.columns.warm.resourceProfile.bytes.value = -3e9;
    expect(() => computeCostReport({ ...baseInput(), receipt: doctored })).toThrow(
      /physically impossible value \(-3000000000/,
    );
  });

  it("the report identifies WHICH receipt priced it (run nonce) and carries the receipt's own limits-of-data", () => {
    expect(report.input.runNonce).toBe("fixture");
    expect(report.methodNotes).toContain(
      "receipt: fixture: warm means edge-tier warm; the browser cache is a held-constant.",
    );
  });
});

// ---------------------------------------------------------------------------
// Actual charge at a stated volume: free-tier fit + paid-plan bill
// ---------------------------------------------------------------------------

describe("actual charge at a stated monthly volume (ADR-0001 §7: ≈$0 to date + grounded extrapolation)", () => {
  const withActual = computeCostReport({ ...baseInput(), monthlyVisits: 1_000_000 });
  const hosts = new Map(withActual.actual!.hosts.map((h) => [h.hostId, h]));
  const beta = hosts.get("beta")!;
  const alpha = hosts.get("alpha")!;

  it("splits the stated volume evenly across measured targets, stating the split", () => {
    expect(withActual.actual!.monthlyVisits).toBe(1_000_000);
    expect(withActual.actual!.split).toContain("split evenly across the 2 measured target(s)");
    expect(beta.monthlyVisits).toBe(500_000);
    expect(alpha.monthlyVisits).toBe(500_000);
  });

  it("free plan: fits → $0 with the allowance arithmetic shown (unit conversion included)", () => {
    expect(beta.freePlan!.chargeUsd).toBe(0);
    const checks = new Map(beta.freePlan!.checks.map((c) => [c.meter, c]));
    // 500,000 invocations vs 1,000,000 — fits.
    expect(checks.get("Beta invocations")!.fits).toBe(true);
    // 16 CPU-ms × 500,000 = 8,000,000 vs 4 CPU-hr = 14,400,000 — fits.
    const cpuCheck = checks.get("Beta active CPU")!;
    expect(cpuCheck.fits).toBe(true);
    expect(cpuCheck.arithmetic).toContain("8,000,000");
    expect(cpuCheck.arithmetic).toContain("14,400,000");
    expect(checks.get("Beta edge requests")!.arithmetic).toContain("unlimited");
    // The per-invocation cap is stated, not silently verified.
    const cap = checks.get("Beta per-invocation cap")!;
    expect(cap.checkable).toBe(false);
    expect(cap.fits).toBeNull();
  });

  it("free plan: an exceeded allowance means the plan blocks — charge is null with the overflow stated", () => {
    // B on alpha: 16 requests × 500,000 = 8,000,000/month ≈ 262,839/day > 3,000.
    const reqCheck = alpha.freePlan!.checks.find((c) => c.meter === "Alpha requests")!;
    expect(reqCheck.fits).toBe(false);
    expect(reqCheck.arithmetic).toContain("EXCEEDED");
    expect(alpha.freePlan!.chargeUsd).toBeNull();
    expect(alpha.freePlan!.arithmetic).toContain("does not bill overage");
  });

  it("paid plan: base + max(0, overage − credit), exact", () => {
    // Beta (target A): requests 2×7M/1M = $14; invocations 4×0.5M/1M = $2;
    // CPU 9×8M/7.2M = $10; egress 0.5×625GB = $312.50 → overage $338.50;
    // − $10 credit = $328.50; + $20 base = $348.50.
    expect(beta.paidPlan.totalUsd).toBe(348.5);
    expect(beta.paidPlan.arithmetic).toContain("$20 base");
    expect(beta.paidPlan.arithmetic).toContain("$10 credit");
  });

  it("visits-basis paid lines carry the unit exactly once", () => {
    const invocations = beta.paidPlan.lines.find((l) => l.meter === "Beta invocations")!;
    expect(invocations.arithmetic).toContain("= 500,000 visits;");
    expect(invocations.arithmetic).not.toMatch(/visits visits/);
  });

  it("paid plan: included allotments enter here, and a null meter keeps the total honest", () => {
    // Alpha (target B): requests 8M − 6M included = 2M × $0.25/1M = $0.50;
    // egress 800 GB × $0.20 = $160; CPU unavailable → total null,
    // priced subtotal $5 base + $160.50.
    const reqLine = alpha.paidPlan.lines.find((l) => l.meter === "Alpha requests")!;
    expect(reqLine.overageUsd).toBe(0.5);
    expect(reqLine.arithmetic).toContain("max(0, 8,000,000 − 6,000,000)");
    expect(alpha.paidPlan.totalUsd).toBeNull();
    expect(alpha.paidPlan.pricedSubtotalUsd).toBe(165.5);
  });

  it("absent a stated volume, the actual view is absent — never a default", () => {
    expect(report.actual).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The shipped dated card (I/O: reads the repo's own data file)
// ---------------------------------------------------------------------------

describe("the shipped rate card is dated, sourced, and covers every basis", () => {
  const shipped = parseRateCard(
    JSON.parse(
      readFileSync(join(repoRoot, "tools/cost-calculator/ratecards/2026-07-10-usd.json"), "utf8"),
    ),
  );

  it("carries its capture date and verification provenance", () => {
    expect(shipped.capturedAt).toBe("2026-07-10");
    expect(shipped.verifiedBy).toContain("2026-07-10");
  });

  it("prices the four portfolio host models (parseRateCard enforces basis coverage per region)", () => {
    expect(shipped.hosts.map((h) => h.hostId).sort()).toEqual([
      "cloudflare-static-assets",
      "cloudflare-workers-paid",
      "vercel-pro",
      "vercel-pro-static",
    ]);
  });

  it("declares the vendor meters the measured profile cannot account", () => {
    const vercel = shipped.hosts.find((h) => h.hostId === "vercel-pro")!;
    expect(vercel.unmeasured!.map((u) => u.meter)).toContain("Provisioned Memory");
    expect(vercel.unmeasured!.map((u) => u.meter)).toContain("Fast Origin Transfer");
  });
});
