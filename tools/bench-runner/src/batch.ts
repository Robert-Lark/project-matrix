/**
 * The batch engine (ADR-0001 §4, §9): one batch measures ALL its targets
 * under ONE frozen environment — profile, `?n=`, cache columns — so a noisy
 * moment hits every variant equally and only one variable ever changes per
 * comparison. Environment flips are separate batches by construction: the
 * spec admits exactly one profile and one n.
 *
 * Cache columns (ADR-0001 §4, ADR-0002 §8):
 *  - cold: `?cache=cold` — the edge Worker's bypass; R2 every time, KV
 *    never touched, so cold stays cold for all N runs.
 *  - warm: no cache param; ONE unmeasured priming visit drives the page so
 *    every data fetch it makes passes the KV write-through, then the N
 *    measured runs read the warm tier.
 * A run-isolation nonce (`?run=`, the edge Worker's documented knob) keys
 * this batch's warm state away from every other run's — including previous
 * post-deploy smokes against the same persistent KV.
 *
 * Runs are ROUND-ROBIN interleaved across targets (run i of every target
 * before run i+1 of any): a noisy moment lands on every variant, not on
 * whichever URL happened to be measuring (§9 "one batch").
 */
import { chromium, type Browser } from "playwright";
import { getProfile, PLP_N, PROFILE_SPEC_VERSION, clampN } from "@pm/measurement";
import {
  SETTLE_CAP_MS,
  INTERACTIONS,
  measureVisit,
  type ApplyResult,
} from "./collect";
import { commitPin } from "./git";
import { fetchOriginCommit, verifyOriginCommit } from "./origin-commit";
import { median, RECEIPT_VERSION, type ReceiptT, type RunSampleT } from "./receipt";
import type { CpuSource } from "./cpu";
import { UNAVAILABLE_CPU_SOURCE } from "./cpu";

export interface TargetSpec {
  /** Knob-free composed-origin path, e.g. `/placeholder-static/sample/`. */
  path: string;
  /** Registry id from {@link INTERACTIONS}. */
  interactionId: string;
}

export interface BatchSpec {
  origin: string;
  targets: TargetSpec[];
  profileId: string;
  runsPerUrl: number;
  /** The `?n=` data-volume knob, batch-constant. */
  n?: number;
  /** Override for reproducible tests; generated when absent. */
  runNonce?: string;
  runLocation?: { label: string; source: string };
  /** Per-visit CPU-ms accounting; defaults to the honest "unavailable". */
  cpuSource?: CpuSource;
  /** Repo root for the commit pin. */
  repoRoot: string;
  /**
   * Explicit escape for DELIBERATE cross-tree measurement (ADR-0001
   * addendum N hole 2): without it the batch refuses an origin whose
   * attested build SHA disagrees with the local pin, or one that does not
   * attest at all. With it, the receipt records the disagreement (or the
   * null) in plain sight.
   */
  allowCrossTree?: boolean;
}

type ColumnKey = "cold" | "warm";
const COLUMNS: ColumnKey[] = ["cold", "warm"];

function effectiveUrl(
  origin: string,
  path: string,
  n: number,
  nonce: string,
  column: ColumnKey,
): string {
  const url = new URL(path, origin);
  url.searchParams.set("n", String(n));
  url.searchParams.set("run", nonce);
  if (column === "cold") url.searchParams.set("cache", "cold");
  return url.toString();
}

function medians(runs: RunSampleT[]) {
  return {
    ttfbTravelMs: median(runs.map((r) => r.ttfb.travelMs)),
    ttfbServerMs: median(runs.map((r) => r.ttfb.serverMs)),
    webVitals: {
      TTFB: median(runs.map((r) => r.webVitals.TTFB)),
      FCP: median(runs.map((r) => r.webVitals.FCP)),
      LCP: median(runs.map((r) => r.webVitals.LCP)),
      CLS: median(runs.map((r) => r.webVitals.CLS)),
      INP: median(runs.map((r) => r.webVitals.INP)),
    },
    totalBytes: median(runs.map((r) => r.kb.totalBytes)),
    initialJsBytes: median(runs.map((r) => r.kb.initialJsBytes)),
    interactionBytes: median(runs.map((r) => r.kb.interactionBytes)),
    requests: median(runs.map((r) => r.requests.counted)),
  };
}

/**
 * Variant prefixes the runner REFUSES outright — the fence as MECHANISM,
 * not policy (remix3-frontier FINDINGS §7(c)3; ADR-0003 first addendum).
 * remix3 is the fenced frontier exhibit: pre-release, in no number, and a
 * receipt naming it must be impossible to mint, not merely against the
 * rules. Lives HERE in runBatch rather than the CLI so the reproduce path
 * and direct library imports hit the same wall (a CLI-only guard would be
 * bypassable by everything that matters).
 */
const FENCED_VARIANT_PREFIXES = new Set(["remix3"]);

/** A target path's segments, resolved EXACTLY the way the runner's
 *  effectiveUrl will (`new URL(path, origin)`): a naive split on the raw
 *  string reads a different first segment for a no-leading-slash spec
 *  ("remix3/editorial/") or a dot-segment one ("/./remix3/editorial/") —
 *  and every consumer of "the path's segments" must share ONE derivation
 *  or they disagree about which page was measured (verify-slice finding,
 *  correctness lens: the fence resolved while the receipt's
 *  variant/surface labels split the raw string). */
export function resolvedPathSegments(path: string): string[] {
  return new URL(path, "https://resolve.invalid").pathname.split("/");
}

export function assertBenchableTarget(path: string): void {
  // The fence must hold against the spec shapes the runner accepts, not
  // just the ones the suite writes (verify-slice finding — the raw-split
  // form was bypassable by anything URL() normalizes).
  const prefix = resolvedPathSegments(path)[1] ?? "";
  if (FENCED_VARIANT_PREFIXES.has(prefix)) {
    throw new Error(
      `${path}: "${prefix}" is a fenced exhibit — excluded from every benchmark number ` +
        `(remix3-frontier FINDINGS §7(c); ADR-0003 first addendum). The runner refuses ` +
        `the target so no receipt can ever carry it.`,
    );
  }
}

export async function runBatch(rawSpec: BatchSpec): Promise<ReceiptT> {
  // Canonicalize every target path ONCE, at the entry (the one-derivation
  // rule on resolvedPathSegments): downstream, target.path feeds
  // effectiveUrl, the receipt's path/variant/surface labels, the samples
  // map keys, AND the CPU source's serving-path derivation
  // (cpu.ts servingWorkers splits raw) — normalizing here keeps every one
  // of those consumers reading the same segments (verify-slice finding,
  // seams lens: a no-leading-slash target previously aborted a local-CPU
  // batch mid-run with an error naming a worker that doesn't exist).
  const spec: BatchSpec = {
    ...rawSpec,
    targets: rawSpec.targets.map((t) => ({
      ...t,
      path: new URL(t.path, "https://resolve.invalid").pathname,
    })),
  };
  const profile = getProfile(spec.profileId);
  if (!profile) throw new Error(`unknown profile id: ${spec.profileId}`);
  for (const t of spec.targets) {
    assertBenchableTarget(t.path);
    // Object.hasOwn, not a bare lookup: the id is operator-supplied and a
    // prototype key ("valueOf", "toString") resolves to an inherited
    // FUNCTION here — truthy, and callable in measureVisit — so the batch
    // would run, click nothing, and mint a schema-valid receipt with INP
    // null and zero interaction bytes that nothing distinguishes from a
    // real one (verify-slice, correctness lens; the repo's recurring
    // prototype-key class).
    if (!Object.hasOwn(INTERACTIONS, t.interactionId)) {
      throw new Error(`unknown interaction id: ${t.interactionId} (${t.path})`);
    }
  }
  const n = clampN(String(spec.n ?? PLP_N.default));
  const nonce = spec.runNonce ?? `bench-${Date.now().toString(36)}`;
  const origin = spec.origin.replace(/\/$/, "");
  const cpu = spec.cpuSource ?? UNAVAILABLE_CPU_SOURCE;
  const commit = commitPin(spec.repoRoot);
  // Origin provenance BEFORE any browser launches (ADR-0001 addendum N
  // hole 2): the receipt must name the tree the plane was serving, not just
  // the tree that drove the browser — and a disagreement refuses the batch
  // unless the operator escapes it explicitly.
  const originCommit = await verifyOriginCommit(
    origin,
    commit.sha,
    spec.allowCrossTree === true,
  );

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch {
    // Dev machines where TLS interception blocks the Playwright CDN drive
    // the system Chrome instead; CI installs bundled Chromium.
    browser = await chromium.launch({ channel: "chrome" });
  }

  let appliedResult: ApplyResult | null = null;
  try {
    // Column phases. Within a column: prime (warm only), then round-robin
    // interleaved runs. CPU accounting brackets each target's runs; the
    // interleave means a target's window is its OWN visits only when the
    // source samples per-visit, so the per-target window instead brackets
    // the whole column and divides by that target's visit count — a CPU
    // source that cannot attribute per-target reports column-wide totals.
    // The inspector source attributes per-visit (start/stop around each),
    // so the engine calls it around individual visits.
    const samples = new Map<string, RunSampleT[]>(); // key: path + "\0" + column
    const cpuMs = new Map<string, Array<number | null>>();

    for (const column of COLUMNS) {
      if (column === "warm") {
        // One unmeasured priming visit per target: the page's own data
        // fetches pass the KV write-through and warm this nonce's keys.
        for (const target of spec.targets) {
          const url = effectiveUrl(origin, target.path, n, nonce, "warm");
          await measureVisit(browser, profile, {
            effectiveUrl: url,
            interactionId: "none",
          });
        }
      }
      for (let run = 0; run < spec.runsPerUrl; run++) {
        for (const target of spec.targets) {
          const key = `${target.path}\0${column}`;
          const url = effectiveUrl(origin, target.path, n, nonce, column);
          // Pass the knob-free path: the inspector source brackets THIS
          // target's serving path (front + its variant + edge), not the plane.
          await cpu.beforeVisit(target.path);
          const { sample, applied } = await measureVisit(browser, profile, {
            effectiveUrl: url,
            interactionId: target.interactionId,
          });
          const visitCpuMs = await cpu.afterVisit(target.path);
          appliedResult = applied;
          if (!samples.has(key)) samples.set(key, []);
          if (!cpuMs.has(key)) cpuMs.set(key, []);
          samples.get(key)!.push(sample);
          cpuMs.get(key)!.push(visitCpuMs);
        }
      }
    }

    const targets = spec.targets.map((target) => {
      // Same derivation as the fence and effectiveUrl (resolvedPathSegments
      // doc comment): a receipt's variant/surface labels must name the page
      // that was actually measured.
      const [, variant = "", surface = ""] = resolvedPathSegments(target.path);
      const column = (key: ColumnKey) => {
        const runs = samples.get(`${target.path}\0${key}`) ?? [];
        const cpuValues = cpuMs.get(`${target.path}\0${key}`) ?? [];
        const med = medians(runs);
        return {
          effectiveUrl: effectiveUrl(origin, target.path, n, nonce, key),
          runs,
          medians: med,
          resourceProfile: {
            cpuMs: { value: median(cpuValues), source: cpu.sourceName },
            bytes: {
              value: med.totalBytes,
              source:
                "resource-timing transferSize (compressed over-wire, instrumentation stripped), median of runs",
            },
            requests: {
              value: med.requests,
              source:
                "resource-timing entry count + document (instrumentation stripped), median of runs",
            },
          },
        };
      };
      return {
        path: target.path,
        variant,
        surface,
        interactionId: target.interactionId,
        columns: { cold: column("cold"), warm: column("warm") },
      };
    });

    if (appliedResult === null) throw new Error("batch measured nothing");
    // The attestation is re-fetched AFTER the last run, UNCONDITIONALLY:
    // push-to-main deploys the plane, so a deploy landing mid-batch would
    // leave early runs measuring one tree and late runs another, behind a
    // receipt whose start-of-batch originCommit still matches the local pin
    // (verify-slice, this unit). Any transition refuses — including
    // null→non-null, which is exactly what a deploy that ADDS attestation
    // looks like from a batch started against a pre-attestation plane. Only
    // null→null stays genuinely undetectable, and the receipt already says
    // so (originCommit: null). The cross-tree escape covers a DELIBERATE
    // tree mismatch, never a plane that moved under the measurement.
    {
      const after = await fetchOriginCommit(origin);
      const label = (c: { sha: string } | null) => (c ? c.sha.slice(0, 12) : "unattested");
      const moved =
        (originCommit === null) !== (after === null) ||
        (originCommit !== null &&
          after !== null &&
          (after.sha !== originCommit.sha || after.dirty !== originCommit.dirty));
      if (moved) {
        throw new Error(
          `the origin's attested build changed mid-batch (${label(originCommit)} → ${label(after)}) — ` +
            `the runs straddle a deploy and the receipt would mix two planes; re-run in a quiet deploy window`,
        );
      }
    }
    return {
      kind: "pm-bench-receipt",
      receiptVersion: RECEIPT_VERSION,
      date: new Date().toISOString(),
      commit,
      origin,
      originCommit,
      runLocation:
        spec.runLocation ??
        { label: "local-dev", source: "unpinned developer machine (the pinned cloud runner + two-location protocol activate downstream, ADR-0001 §9)" },
      profile: {
        id: profile.id,
        specVersion: PROFILE_SPEC_VERSION,
        applied: {
          mechanism: appliedResult.mechanism,
          latencyMs: appliedResult.latencyMs,
          downloadBytesPerSec: appliedResult.downloadBytesPerSec,
          uploadBytesPerSec: appliedResult.uploadBytesPerSec,
          cpuMultiplier: appliedResult.cpuMultiplier,
          viewport: {
            width: profile.viewport.width,
            height: profile.viewport.height,
            deviceScaleFactor: profile.viewport.deviceScaleFactor,
            mobile: profile.viewport.mobile,
          },
        },
      },
      environment: { n, runNonce: nonce },
      runsPerUrl: spec.runsPerUrl,
      harness: {
        browser: browser.browserType().name(),
        browserVersion: browser.version(),
        // The CEILING on the signal-based settle waits, not a fixed wait — see
        // the methodNote below and collect.ts SETTLE_CAP_MS.
        settleMs: SETTLE_CAP_MS,
      },
      methodNotes: [
        "settle is signal-based, never a fixed window: the interaction byte boundary waits for the network to go idle and the vitals-beacon flush waits for delivery to quiesce, each bounded by harness.settleMs so an absent signal surfaces as absent bytes / a null vital rather than hanging (ADR-0001 §9; tools/drift-gate/README.md 'wait for the real signal, never a proxy'). Any post-load idle work (e.g. Qwik's preloader) is awaited onto the INITIAL byte side before the boundary snapshot, so the initial/interaction split is deterministic across runs.",
        "document bytes are decomposed (ADR-0001 §3 addendum, 2026-08-15, superseding addendum G's uncompressed-share rule): the single compressed document transferSize stays the authority on the TOTAL, and the split between html/js/data/STRIPPED instrumentation markup takes its ratios from leave-one-out marginals — what the compressed document loses when exactly that part is removed — computed with the WIRE'S OWN CODEC (brotli for a br wire, zstandard for the zstd wire Chromium negotiates, …) at the setting calibrated per document against the observed compressed body (codec, setting, and residual recorded per run in kb.docAttribution). Inline executable script counts as JS (an inlined bundle is not 0 KB), inline non-executable script (application/json, qwik/json, …) counts as data, and the injected chrome markup + its /_pm/ tags are stripped like the /_pm/ subresource payloads (ADR-0001 §6). An uncompressed document needs no estimate and uses exact uncompressed share. Stated bias: disjoint parts' marginals under-sum the whole (shared redundancy belongs to no single part, measured 0.94–0.95x on the live shapes), so normalisation scales parts up ~x1.05 pro-rata.",
        "ttfb sub-phases (travelMs/serverMs) are attributed BENEATH any CDP network emulation: Chromium rebases navigation-timing under applied throttling (demonstrated 2026-07-10: a 500ms emulated latency delivers on the wall clock but responseStart still reads ~1ms), so the decomposition reflects the plane's REAL serving — compare it across variants, not against the profile's emulated RTT. FCP/LCP/INP paint/interaction timestamps are wall-clock and DO reflect the applied profile.",
        "every run is a fresh browser context (first-time visitor): the browser HTTP cache is a held-constant, not a measured axis — the cold/warm columns measure the edge tier (ADR-0002 §8).",
        "PRECONDITION for a comparable re-run against a DEPLOYED plane: the effective URLs below must be warmed until they serve compressed before measuring. A brand-new URL's first hit is a cache MISS that Cloudflare serves UNCOMPRESSED (the class tools/origin-suite's wireEncoding warms against), and because the run nonce is part of the URL, a reproduce with a fresh nonce makes every URL brand new — so run 1 of every target pays an inflated, non-comparable transfer. `bench reproduce --nonce <this receipt's environment.runNonce>` re-drives the exact published URLs so they can be pre-warmed; without it the reproduction is same-paths/profile/runs/interaction with fresh cache state, not same-URL.",
      ],
      targets,
    };
  } finally {
    await cpu.close();
    await browser.close();
  }
}

/** Rebuild the spec a receipt was produced from — the reproduce path
 *  (ADR-0001 §9): same URLs, profile, run count, as one batch. A fresh
 *  nonce mints fresh cache state; the spec-version pin refuses to
 *  "reproduce" under silently different conditions. */
export function specFromReceipt(
  receipt: ReceiptT,
  repoRoot: string,
  overrides?: Partial<
    Pick<BatchSpec, "origin" | "cpuSource" | "runLocation" | "runNonce" | "allowCrossTree">
  >,
): BatchSpec {
  if (receipt.profile.specVersion !== PROFILE_SPEC_VERSION) {
    throw new Error(
      `receipt ran under profile spec v${receipt.profile.specVersion}, current is v${PROFILE_SPEC_VERSION} — conditions changed, refusing to reproduce silently`,
    );
  }
  return {
    origin: overrides?.origin ?? receipt.origin,
    targets: receipt.targets.map((t) => ({
      path: t.path,
      interactionId: t.interactionId,
    })),
    profileId: receipt.profile.id,
    runsPerUrl: receipt.runsPerUrl,
    n: receipt.environment.n,
    repoRoot,
    cpuSource: overrides?.cpuSource,
    runLocation: overrides?.runLocation,
    // A reproduce mints FRESH cache state by default (a new nonce), which
    // is the honest reproduction — but it also makes every effective URL
    // brand new, and on the deployed plane a brand-new URL's first hit is
    // an UNCOMPRESSED cache MISS (the slice-C class). An operator who wants
    // to pre-warm the exact URLs before measuring can pass the nonce
    // through; without this the flag added for that purpose was
    // unreachable from the advertised reproduce path (verify-slice,
    // anti-rigging lens).
    runNonce: overrides?.runNonce,
    allowCrossTree: overrides?.allowCrossTree,
  };
}
