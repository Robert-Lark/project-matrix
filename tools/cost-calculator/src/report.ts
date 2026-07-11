/**
 * The cost-report contract (ADR-0001 §7 + §9): the calculator's output is
 * itself a receipt — it echoes the measurement's provenance (the bench
 * receipt), the price side's provenance (the dated card), and every
 * intermediate step of the arithmetic, so a skeptic can swap any input and
 * re-run rather than argue with a bottom line.
 *
 * Nulls are honest throughout: a quantity the measurement's named source
 * could not account (e.g. CPU-ms against a deployed origin before the
 * telemetry leg arms) yields an UNPRICED line and a null total — partial
 * sums are labeled as such, never passed off as the answer. The one
 * deliberate exception: a $0 rate prices ANY usage at exactly $0 (the
 * cost is arithmetic, not an estimate; the usage itself stays null).
 */
import { z } from "zod";
import { BASES } from "./ratecard";

export const COST_REPORT_VERSION = 1;

/** One measured quantity blended across the receipt's cold/warm columns at
 *  the stated cache-hit ratio, with the blend shown. */
const BlendedQuantity = z.object({
  basis: z.enum(BASES),
  /** Per-visit expectation; null when a needed column couldn't account it. */
  value: z.number().nullable(),
  arithmetic: z.string(),
  /** The measurement source(s), carried from the receipt — never invented. */
  source: z.string(),
});
export type BlendedQuantityT = z.infer<typeof BlendedQuantity>;

/** One vendor meter priced for 1M visits. */
const CostLine = z.object({
  meter: z.string(),
  basis: z.enum(BASES),
  /** The card rate applied, echoed with its provenance. */
  rate: z.object({
    amountUsd: z.number(),
    per: z.number(),
    unit: z.string(),
    quote: z.string(),
    url: z.string(),
    note: z.string().optional(),
  }),
  /** Usage over 1M visits in the basis's base unit. */
  usagePer1MVisits: z.number().nullable(),
  baseUnit: z.string(),
  costUsdPer1MVisits: z.number().nullable(),
  /** The full chain: blend → normalization → unit conversion → dollars. */
  arithmetic: z.string(),
  unpricedReason: z.string().optional(),
});
export type CostLineT = z.infer<typeof CostLine>;

const PricedTarget = z.object({
  path: z.string(),
  variant: z.string(),
  surface: z.string(),
  hostId: z.string(),
  blended: z.object({
    requests: BlendedQuantity,
    cpuMs: BlendedQuantity,
    egressBytes: BlendedQuantity,
  }),
  lines: z.array(CostLine),
  /** Null whenever any line is unpriced — a partial sum is not a total. */
  totalUsdPer1MVisits: z.number().nullable(),
  /** Sum of the lines that DID price (labeled partial via `unpriced`). */
  pricedSubtotalUsdPer1MVisits: z.number(),
  unpriced: z.array(z.object({ meter: z.string(), reason: z.string() })),
  /** Vendor meters this host bills that the profile cannot account. */
  unmeasuredMeters: z.array(z.string()),
});
export type PricedTargetT = z.infer<typeof PricedTarget>;

/** Free-plan fit at a stated monthly volume. */
const AllowanceCheck = z.object({
  meter: z.string(),
  checkable: z.boolean(),
  /** null when not checkable against the measured profile. */
  fits: z.boolean().nullable(),
  arithmetic: z.string(),
});

const FreePlanFit = z.object({
  plan: z.string(),
  checks: z.array(AllowanceCheck),
  /** $0 while every checkable allowance fits — free plans block, not bill. */
  chargeUsd: z.number().nullable(),
  overflow: z.string(),
  arithmetic: z.string(),
});

const PaidPlanLine = z.object({
  meter: z.string(),
  monthlyUsage: z.number().nullable(),
  baseUnit: z.string(),
  includedPerMonth: z.number().nullable(),
  overageUsd: z.number().nullable(),
  arithmetic: z.string(),
  unpricedReason: z.string().optional(),
});

const PaidPlanCharge = z.object({
  plan: z.string(),
  monthlyBaseUsd: z.number(),
  monthlyCreditUsd: z.number(),
  lines: z.array(PaidPlanLine),
  totalUsd: z.number().nullable(),
  pricedSubtotalUsd: z.number(),
  arithmetic: z.string(),
});

const HostActual = z.object({
  hostId: z.string(),
  targetPaths: z.array(z.string()),
  monthlyVisits: z.number(),
  freePlan: FreePlanFit.nullable(),
  paidPlan: PaidPlanCharge,
});
export type HostActualT = z.infer<typeof HostActual>;

export const CostReport = z.object({
  kind: z.literal("pm-cost-report"),
  reportVersion: z.literal(COST_REPORT_VERSION),
  date: z.string(),
  /** Provenance echo of the measurement side (ADR-0001 §9). */
  input: z.object({
    receiptDate: z.string(),
    commit: z.object({ sha: z.string(), dirty: z.boolean() }),
    origin: z.string(),
    profileId: z.string(),
    n: z.number(),
    runsPerUrl: z.number(),
    runLocation: z.string(),
    /** The batch's unique key — receipts are gitignored, so date+SHA alone
     *  cannot say WHICH receipt priced this report. */
    runNonce: z.string(),
  }),
  /** Provenance echo of the price side. */
  card: z.object({ id: z.string(), capturedAt: z.string(), verifiedBy: z.string() }),
  /** The stated, required inputs — never defaults hidden in code. */
  assumptions: z.object({
    cacheHitRatio: z.number(),
    region: z.string(),
    visitDefinition: z.string(),
    notes: z.array(z.string()),
  }),
  /** Limits-of-data, stated in the report itself. */
  methodNotes: z.array(z.string()),
  views: z.object({
    /** One host's rates applied to every variant: paradigm, vendor held. */
    architectureOnly: z.object({
      hostId: z.string(),
      targets: z.array(PricedTarget),
    }),
    /** Each variant on its actual host. */
    realWorld: z.object({
      mapping: z.record(z.string(), z.string()),
      targets: z.array(PricedTarget),
    }),
  }),
  /** Charge at a stated real monthly volume: free-plan fit (the honest
   *  ≈$0 to date) + the paid-plan bill (the grounded extrapolation's
   *  low end). Absent when no volume was stated. */
  actual: z
    .object({
      monthlyVisits: z.number(),
      split: z.string(),
      hosts: z.array(HostActual),
    })
    .nullable(),
});
export type CostReportT = z.infer<typeof CostReport>;

export function parseCostReport(json: unknown): CostReportT {
  return CostReport.parse(json);
}
