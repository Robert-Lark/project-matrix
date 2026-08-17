/**
 * The receipt contract (ADR-0001 §9): every number a batch produces ships
 * with everything needed to reproduce it — profile, run count, date, commit
 * SHA, run location, raw per-run results, the exact URLs measured — plus the
 * measured resource profile the cost calculator consumes (ADR-0001 §7),
 * every field of which names its accounting source (never estimated).
 *
 * Zod-validated so `reproduce` refuses malformed or version-skewed receipts
 * loudly instead of silently re-running different conditions.
 */
import { z } from "zod";

export const RECEIPT_VERSION = 1;

/** A named, registry-resolvable accounting for one resource-profile field. */
const SourcedNumber = z.object({
  /** null = this source genuinely cannot account it here (never estimated). */
  value: z.number().nullable(),
  /** WHERE the number comes from — part of the anti-rigging trail. */
  source: z.string().min(1),
});

const ByteBuckets = z.object({
  html: z.number(),
  js: z.number(),
  css: z.number(),
  fonts: z.number(),
  images: z.number(),
  data: z.number(),
  other: z.number(),
});

const TtfbDecomposition = z.object({
  /** Phases before requestStart: redirects + DNS + TCP + TLS (ADR-0001 §5). */
  travelMs: z.number(),
  /** Server think-time ≈ responseStart − requestStart (ADR-0001 §5). */
  serverMs: z.number(),
  /** The raw sub-phase timestamps — publish the arithmetic (ADR-0001 §9). */
  raw: z.record(z.string(), z.number()),
});

const WebVitals = z.object({
  TTFB: z.number().nullable(),
  FCP: z.number().nullable(),
  LCP: z.number().nullable(),
  CLS: z.number().nullable(),
  INP: z.number().nullable(),
});

export const RunSample = z.object({
  /** x-pm-cache-state of the DOCUMENT response, when the plane sent one. */
  docCacheState: z.string().nullable(),
  /**
   * Did the post-interaction wait reach network idle, or hit its cap? Zero
   * interaction bytes means "nothing was fetched" ONLY when this is true —
   * a request still in flight when the cap elapses never lands in resource
   * timing, so the two are indistinguishable without this flag. Optional so
   * receipts minted before it remain parseable; absent means unrecorded,
   * which the publication build treats as unverified rather than true.
   */
  interactionSettled: z.boolean().optional(),
  ttfb: TtfbDecomposition,
  /** From the injected chrome's own pinned web-vitals build (ADR-0001 §2),
   *  harvested by intercepting its beacons. All-null when the page carries
   *  no chrome (e.g. a bare tray URL driven as a document). */
  webVitals: WebVitals,
  /** Compressed transfer sizes (resource timing), instrumentation stripped. */
  kb: z.object({
    buckets: ByteBuckets,
    /** The headline (ADR-0001 §3): JS bytes before any interaction. */
    initialJsBytes: z.number(),
    /** Bytes fetched because of the scripted interaction (ADR-0001 §3). */
    interactionBytes: z.number(),
    /** /_pm/* + /api/beacon bytes — EXCLUDED from every bucket above,
     *  reported so the exclusion is visible and non-vacuous (ADR-0001 §6). */
    instrumentationBytes: z.number(),
    /** Sum of buckets (excludes instrumentation by construction). */
    totalBytes: z.number(),
    /**
     * How the document's single compressed transferSize was split into
     * html/js/data/instrumentation (ADR-0001 §3 addendum, 2026-08-15):
     * the estimator that ran, the wire-calibrated codec and setting, and the
     * calibration residual in bytes. Optional so receipts minted before the
     * ruler change remain parseable; absent means the superseded
     * uncompressed-share rule attributed the document.
     */
    docAttribution: z
      .object({
        estimator: z.string(),
        /** The compression model the ratios used — the wire's own codec
         *  (brotli/zstd/gzip/deflate), null for the non-loo estimators. */
        codec: z.string().nullable().optional(),
        quality: z.number().nullable(),
        /** The compressed body the model was fitted against — the
         *  residual's denominator, so the fit is judgeable from the
         *  artifact alone. */
        calibrationTargetBytes: z.number().nullable().optional(),
        /** "encoded-body" (the honest fit) or "transfer-size" (the
         *  headers-included fallback — publishable never). */
        calibrationTargetSource: z.string().nullable().optional(),
        calibrationResidualBytes: z.number().nullable(),
        /** The document response's content-encoding, verbatim — a model
         *  fitted to a different wire must be visible in the artifact. */
        contentEncoding: z.string().nullable().optional(),
      })
      .optional(),
  }),
  requests: z.object({
    /** Request count, instrumentation excluded. */
    counted: z.number(),
    /** /_pm/* + /api/beacon request count — excluded, reported. */
    instrumentation: z.number(),
  }),
});
export type RunSampleT = z.infer<typeof RunSample>;

const Medians = z.object({
  ttfbTravelMs: z.number().nullable(),
  ttfbServerMs: z.number().nullable(),
  webVitals: WebVitals,
  totalBytes: z.number().nullable(),
  initialJsBytes: z.number().nullable(),
  interactionBytes: z.number().nullable(),
  requests: z.number().nullable(),
});

const Column = z.object({
  /** The exact URL driven, run-isolation nonce included (ADR-0001 §9). */
  effectiveUrl: z.string(),
  runs: z.array(RunSample),
  medians: Medians,
  /** The ADR-0001 §7 measured resource profile for ONE visit in this
   *  column, each field from real accounting with its source named. */
  resourceProfile: z.object({
    cpuMs: SourcedNumber,
    bytes: SourcedNumber,
    requests: SourcedNumber,
  }),
});

export const Target = z.object({
  /** Knob-free composed-origin path — the identity half of the condition. */
  path: z.string(),
  variant: z.string(),
  surface: z.string(),
  /** Registry id of the scripted interaction (reproducible by name). */
  interactionId: z.string(),
  columns: z.object({
    cold: Column,
    warm: Column,
  }),
});

export const Receipt = z.object({
  kind: z.literal("pm-bench-receipt"),
  receiptVersion: z.literal(RECEIPT_VERSION),
  date: z.string(),
  commit: z.object({
    sha: z.string(),
    /** An honest receipt admits an unclean tree (ADR-0001 §9). */
    dirty: z.boolean(),
  }),
  origin: z.string(),
  /**
   * What the ORIGIN attested it was serving (/_pm/build.json), recorded
   * beside the local pin above (ADR-0001 addendum N hole 2): `commit.sha`
   * names the tree that DROVE the browser; this names the tree the plane
   * was BUILT from. The runner refuses a batch whose origin SHA disagrees
   * with the local pin unless the cross-tree escape is passed explicitly —
   * and a receipt minted that way shows the disagreement right here.
   * Optional so pre-provenance receipts remain parseable; null means the
   * origin did not attest (no /_pm/build.json) and the escape was used.
   */
  originCommit: z
    .object({
      sha: z.string(),
      dirty: z.boolean(),
    })
    .nullable()
    .optional(),
  /** Two-location protocol activates downstream (pinned cloud runner);
   *  the label ships now so it is never retrofitted (issue #7). */
  runLocation: z.object({
    label: z.string(),
    source: z.string(),
  }),
  profile: z.object({
    id: z.string(),
    specVersion: z.number(),
    /** What the automation layer ACTUALLY applied — publish the arithmetic. */
    applied: z.object({
      mechanism: z.string(),
      latencyMs: z.number(),
      downloadBytesPerSec: z.number(),
      uploadBytesPerSec: z.number(),
      cpuMultiplier: z.number(),
      viewport: z.object({
        width: z.number(),
        height: z.number(),
        deviceScaleFactor: z.number(),
        mobile: z.boolean(),
      }),
    }),
  }),
  /** Batch-constant environment knobs (one variable per comparison,
   *  ADR-0001 §4): cache state is the two columns; everything else here. */
  environment: z.object({
    n: z.number(),
    runNonce: z.string(),
  }),
  runsPerUrl: z.number().min(1),
  /** What drove the measurement — reproduce-completeness (ADR-0001 §9). */
  harness: z.object({
    browser: z.string(),
    browserVersion: z.string(),
    settleMs: z.number(),
  }),
  /** Measured limits-of-data, stated in the receipt itself (ADR-0001 §9's
   *  limits-of-data ethos): what these numbers can and cannot claim. */
  methodNotes: z.array(z.string()),
  targets: z.array(Target).min(1),
});
export type ReceiptT = z.infer<typeof Receipt>;

export function parseReceipt(json: unknown): ReceiptT {
  return Receipt.parse(json);
}

/** Median of the non-null values; null when nothing was measurable. */
export function median(values: ReadonlyArray<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (present.length === 0) return null;
  const mid = Math.floor(present.length / 2);
  return present.length % 2 === 1
    ? present[mid]!
    : (present[mid - 1]! + present[mid]!) / 2;
}
