/**
 * The ADR-0001 §7 arithmetic, pure end to end (no I/O, no clock, no
 * defaults): measured resource profile × dated rate card × REQUIRED
 * cache-hit ratio and region → $/1M visits, architecture-only and
 * real-world views, plus free-tier fit / paid-plan charge at a stated
 * monthly volume.
 *
 * The cache-hit ratio blends the receipt's two MEASURED columns —
 * expected = h × warm + (1−h) × cold — which is why receipts carry both;
 * nothing here is modeled, only weighted.
 *
 * Cost = amountUsd × usage / (per × unitFactor), multiplication before
 * division so clean inputs stay exact in binary floating point (asserted
 * to exact dollars in suite/cost.test.ts).
 */
import type { ReceiptT } from "@pm/bench-runner/receipt";
import {
  UNIT_CONVERSIONS,
  findHost,
  ratesFor,
  type Basis,
  type HostT,
  type RateCardT,
  type RateT,
  type AllowanceT,
} from "./ratecard";
import {
  COST_REPORT_VERSION,
  type BlendedQuantityT,
  type CostLineT,
  type CostReportT,
  type HostActualT,
  type PricedTargetT,
} from "./report";

type TargetT = ReceiptT["targets"][number];
/** The receipt's per-column measured resource profile — the §7 input. */
export type ResourceProfileT = TargetT["columns"]["cold"]["resourceProfile"];

/** Mean Gregorian month, for daily-allowance arithmetic (stated in output). */
export const DAYS_PER_MONTH = 30.436875;

const BASE_UNITS: Record<Basis, string> = {
  requests: "requests",
  cpuMs: "CPU-ms",
  egressBytes: "bytes",
  visits: "visits",
};

const PROFILE_FIELD: Record<Exclude<Basis, "visits">, keyof ResourceProfileT> = {
  requests: "requests",
  cpuMs: "cpuMs",
  egressBytes: "bytes",
};

export interface Assumptions {
  /** Share of visits arriving with the edge tier warm, in [0, 1]. */
  cacheHitRatio: number;
  /** One of the card's regions. */
  region: string;
}

export interface CostInput {
  receipt: ReceiptT;
  card: RateCardT;
  assumptions: Assumptions;
  /** The one host whose rates price EVERY variant (paradigm isolated). */
  architectureHostId: string;
  /** target path → hostId; every receipt target must be mapped. */
  realWorldHosts: Record<string, string>;
  /** Stated real monthly volume for the actual-charge view. */
  monthlyVisits?: number;
  /** Report timestamp — supplied, not read from a clock (purity). */
  date: string;
}

export function validateAssumptions(card: RateCardT, a: Assumptions): void {
  if (!Number.isFinite(a.cacheHitRatio) || a.cacheHitRatio < 0 || a.cacheHitRatio > 1) {
    throw new Error(
      `cache-hit ratio is a required explicit input in [0, 1]; got ${a.cacheHitRatio}`,
    );
  }
  if (!card.regions.includes(a.region)) {
    throw new Error(
      `region is a required explicit input; "${a.region}" is not in rate card ${card.id}'s vocabulary (${card.regions.join(", ")})`,
    );
  }
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n !== 0 && Math.abs(n) < 1e-4) return n.toExponential(4).replace(/\.?0+e/, "e");
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function usd(n: number): string {
  return `$${fmt(n)}`;
}

/** Expected per-visit quantity at the stated cache-hit ratio. A column with
 *  zero weight cannot poison the blend; a null in a weighted column makes
 *  the expectation honestly null, naming the source that couldn't account it. */
export function blendColumns(
  basis: Basis,
  cold: { value: number | null; source: string },
  warm: { value: number | null; source: string },
  cacheHitRatio: number,
): BlendedQuantityT {
  const h = cacheHitRatio;
  // Measured quantities are physically nonnegative — a negative value is a
  // doctored or corrupt receipt and must be refused loudly, not priced.
  for (const [label, col] of [["cold", cold], ["warm", warm]] as const) {
    if (col.value !== null && (col.value < 0 || !Number.isFinite(col.value))) {
      throw new Error(
        `${basis} ${label} column carries a physically impossible value (${col.value}, source: ${col.source}) — refusing to price a doctored or corrupt profile`,
      );
    }
  }
  const source =
    cold.source === warm.source ? cold.source : `cold: ${cold.source}; warm: ${warm.source}`;
  const only = (label: "warm" | "cold", col: { value: number | null; source: string }) => {
    if (col.value === null) {
      return {
        basis,
        value: null,
        arithmetic: `cache-hit ratio ${h}: ${label} column only, which its source could not account (${col.source})`,
        source,
      };
    }
    return {
      basis,
      value: col.value,
      arithmetic: `cache-hit ratio ${h}: ${label} column only = ${fmt(col.value)}`,
      source,
    };
  };
  if (h === 1) return only("warm", warm);
  if (h === 0) return only("cold", cold);
  if (warm.value === null || cold.value === null) {
    const missing = [
      warm.value === null ? `warm (${warm.source})` : null,
      cold.value === null ? `cold (${cold.source})` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    return {
      basis,
      value: null,
      arithmetic: `expected/visit unavailable: the ${missing} column's source could not account it here (never estimated)`,
      source,
    };
  }
  const value = h * warm.value + (1 - h) * cold.value;
  return {
    basis,
    value,
    arithmetic: `expected/visit = ${h} × ${fmt(warm.value)} (warm) + ${fmt(1 - h)} × ${fmt(cold.value)} (cold) = ${fmt(value)}`,
    source,
  };
}

/** Price one card rate over 1M visits of the blended quantity. */
export function priceLine(rate: RateT, blended: BlendedQuantityT): CostLineT {
  const factor = UNIT_CONVERSIONS[rate.basis][rate.unit]!;
  const baseUnit = BASE_UNITS[rate.basis];
  const perBase = rate.per * factor;
  const unitArithmetic =
    factor === 1
      ? `${usd(rate.amountUsd)} per ${fmt(rate.per)} ${rate.unit}`
      : `${usd(rate.amountUsd)} per ${fmt(rate.per)} ${rate.unit} (1 ${rate.unit} = ${fmt(factor)} ${baseUnit}) = ${usd(rate.amountUsd)} per ${fmt(perBase)} ${baseUnit}`;
  const rateEcho = {
    amountUsd: rate.amountUsd,
    per: rate.per,
    unit: rate.unit,
    quote: rate.quote,
    url: rate.url,
    ...(rate.note === undefined ? {} : { note: rate.note }),
  };
  if (blended.value === null) {
    // A $0 rate is $0 for ANY usage — no estimation involved, so an
    // unaccounted quantity still prices exactly. Anything else stays
    // honestly unpriced.
    if (rate.amountUsd === 0) {
      return {
        meter: rate.meter,
        basis: rate.basis,
        rate: rateEcho,
        usagePer1MVisits: null,
        baseUnit,
        costUsdPer1MVisits: 0,
        arithmetic: `${unitArithmetic}; measured ${rate.basis} unavailable (${blended.arithmetic}), but a $0 rate prices ANY usage at exactly $0 — no estimation involved`,
      };
    }
    return {
      meter: rate.meter,
      basis: rate.basis,
      rate: rateEcho,
      usagePer1MVisits: null,
      baseUnit,
      costUsdPer1MVisits: null,
      arithmetic: `${unitArithmetic}; usage unpriceable — ${blended.arithmetic}`,
      unpricedReason: `measured ${rate.basis} unavailable: ${blended.arithmetic}`,
    };
  }
  const usagePer1M = blended.value * 1_000_000;
  const cost = (rate.amountUsd * usagePer1M) / perBase;
  return {
    meter: rate.meter,
    basis: rate.basis,
    rate: rateEcho,
    usagePer1MVisits: usagePer1M,
    baseUnit,
    costUsdPer1MVisits: cost,
    arithmetic: `${blended.arithmetic}; × 1,000,000 visits = ${fmt(usagePer1M)} ${baseUnit}; ${unitArithmetic}; cost = ${usd(rate.amountUsd)} × ${fmt(usagePer1M)} / ${fmt(perBase)} = ${usd(cost)}`,
  };
}

/** One visit is exactly one unit on the `visits` basis, by definition. */
function visitsQuantity(): BlendedQuantityT {
  return {
    basis: "visits",
    value: 1,
    arithmetic: "1 per visit by definition (see the rate's stated assumption)",
    source: "definitional",
  };
}

export function priceTarget(
  target: { path: string; variant: string; surface: string },
  profiles: { cold: ResourceProfileT; warm: ResourceProfileT },
  host: HostT,
  assumptions: Assumptions,
): PricedTargetT {
  const blended = {} as Record<Exclude<Basis, "visits">, BlendedQuantityT>;
  for (const basis of ["requests", "cpuMs", "egressBytes"] as const) {
    const field = PROFILE_FIELD[basis];
    blended[basis] = blendColumns(
      basis,
      profiles.cold[field],
      profiles.warm[field],
      assumptions.cacheHitRatio,
    );
  }
  const lines: CostLineT[] = [];
  for (const basis of ["requests", "cpuMs", "egressBytes", "visits"] as const) {
    const quantity = basis === "visits" ? visitsQuantity() : blended[basis];
    for (const rate of ratesFor(host, basis, assumptions.region)) {
      lines.push(priceLine(rate, quantity));
    }
  }
  const unpriced = lines
    .filter((l) => l.costUsdPer1MVisits === null)
    .map((l) => ({ meter: l.meter, reason: l.unpricedReason ?? "unpriced" }));
  const pricedSubtotal = lines.reduce((sum, l) => sum + (l.costUsdPer1MVisits ?? 0), 0);
  return {
    path: target.path,
    variant: target.variant,
    surface: target.surface,
    hostId: host.hostId,
    blended,
    lines,
    totalUsdPer1MVisits: unpriced.length === 0 ? pricedSubtotal : null,
    pricedSubtotalUsdPer1MVisits: pricedSubtotal,
    unpriced,
    unmeasuredMeters: (host.unmeasured ?? []).map((u) => u.meter),
  };
}

/** Free-plan fit + paid-plan charge for one host at a stated volume. */
function actualForHost(
  host: HostT,
  targets: Array<{ path: string; blended: Record<Exclude<Basis, "visits">, BlendedQuantityT> }>,
  perTargetVisits: number,
  region: string,
): HostActualT {
  const hostVisits = perTargetVisits * targets.length;
  // Monthly usage per basis, summed over this host's targets.
  const usage: Record<Basis, { value: number | null; arithmetic: string }> = {
    requests: monthlyUsage("requests"),
    cpuMs: monthlyUsage("cpuMs"),
    egressBytes: monthlyUsage("egressBytes"),
    visits: {
      value: hostVisits,
      // No trailing unit: the consuming templates append the base unit.
      arithmetic: `${fmt(perTargetVisits)} visits/month × ${targets.length} target(s) = ${fmt(hostVisits)}`,
    },
  };

  function monthlyUsage(basis: Exclude<Basis, "visits">) {
    const parts: string[] = [];
    let total = 0;
    for (const t of targets) {
      const b = t.blended[basis];
      if (b.value === null) {
        return {
          value: null,
          arithmetic: `unavailable: ${t.path} — ${b.arithmetic}`,
        };
      }
      total += b.value * perTargetVisits;
      parts.push(`${fmt(b.value)}/visit × ${fmt(perTargetVisits)} (${t.path})`);
    }
    return { value: total, arithmetic: `${parts.join(" + ")} = ${fmt(total)}` };
  }

  const freePlan = host.freePlan
    ? (() => {
        const checks = host.freePlan!.allowances.map((a) => checkAllowance(a, usage));
        const anyExceeded = checks.some((c) => c.fits === false);
        const anyUnknown = checks.some((c) => c.fits === null && c.checkable);
        return {
          plan: host.freePlan!.plan,
          checks,
          chargeUsd: anyExceeded || anyUnknown ? null : 0,
          overflow: host.freePlan!.overflow,
          arithmetic: anyExceeded
            ? `an allowance is exceeded — the free plan does not bill overage: ${host.freePlan!.overflow}`
            : anyUnknown
              ? "a checkable allowance could not be evaluated (usage unavailable) — fit unknown"
              : "every checkable allowance fits — charge is $0 (uncheckable caps listed above, stated not verified)",
        };
      })()
    : null;

  const paidLines = ratesForAllBases(host, region).map((rate) => {
    const u = usage[rate.basis];
    const factor = UNIT_CONVERSIONS[rate.basis][rate.unit]!;
    const baseUnit = BASE_UNITS[rate.basis];
    const includedBase = rate.includedPerMonth === undefined ? 0 : rate.includedPerMonth * factor;
    if (u.value === null) {
      // Same zero-rate rule as priceLine: $0 × any usage = $0 exactly.
      if (rate.amountUsd === 0) {
        return {
          meter: rate.meter,
          monthlyUsage: null,
          baseUnit,
          includedPerMonth: rate.includedPerMonth === undefined ? null : includedBase,
          overageUsd: 0,
          arithmetic: `monthly ${rate.basis} usage unavailable (${u.arithmetic}), but a $0 rate prices ANY usage at exactly $0`,
        };
      }
      return {
        meter: rate.meter,
        monthlyUsage: null,
        baseUnit,
        includedPerMonth: rate.includedPerMonth === undefined ? null : includedBase,
        overageUsd: null,
        arithmetic: `monthly ${rate.basis} usage unavailable — ${u.arithmetic}`,
        unpricedReason: u.arithmetic,
      };
    }
    const overageBase = Math.max(0, u.value - includedBase);
    const overageUsd = (rate.amountUsd * overageBase) / (rate.per * factor);
    return {
      meter: rate.meter,
      monthlyUsage: u.value,
      baseUnit,
      includedPerMonth: rate.includedPerMonth === undefined ? null : includedBase,
      overageUsd,
      arithmetic: `usage = ${u.arithmetic} ${baseUnit}; included/month = ${fmt(includedBase)} ${baseUnit}; overage = max(0, ${fmt(u.value)} − ${fmt(includedBase)}) = ${fmt(overageBase)} ${baseUnit}; ${usd(rate.amountUsd)} per ${fmt(rate.per * factor)} ${baseUnit} → ${usd(overageUsd)}`,
    };
  });
  const unpricedPaid = paidLines.filter((l) => l.overageUsd === null);
  const overageSubtotal = paidLines.reduce((sum, l) => sum + (l.overageUsd ?? 0), 0);
  const credit = host.monthlyCreditUsd ?? 0;
  const billedOverage = Math.max(0, overageSubtotal - credit);
  const paidTotal = unpricedPaid.length === 0 ? host.monthlyBaseUsd + billedOverage : null;
  return {
    hostId: host.hostId,
    targetPaths: targets.map((t) => t.path),
    monthlyVisits: hostVisits,
    freePlan,
    paidPlan: {
      plan: host.plan,
      monthlyBaseUsd: host.monthlyBaseUsd,
      monthlyCreditUsd: credit,
      lines: paidLines,
      totalUsd: paidTotal,
      pricedSubtotalUsd: host.monthlyBaseUsd + billedOverage,
      arithmetic: `total = ${usd(host.monthlyBaseUsd)} base + max(0, ${usd(overageSubtotal)} overage − ${usd(credit)} credit) = ${paidTotal === null ? "unavailable (unpriced meters above)" : usd(paidTotal)}`,
    },
  };
}

function ratesForAllBases(host: HostT, region: string): RateT[] {
  return (["requests", "cpuMs", "egressBytes", "visits"] as const).flatMap((basis) =>
    ratesFor(host, basis, region),
  );
}

function checkAllowance(
  a: AllowanceT,
  usage: Record<Basis, { value: number | null; arithmetic: string }>,
) {
  if (a.basis === undefined || a.period === "invocation") {
    return {
      meter: a.meter,
      checkable: false,
      fits: null,
      arithmetic: `stated cap, not checkable against the measured per-visit profile: ${a.allowance} ${a.unit} per ${a.period} — "${a.quote}"${a.note ? ` (${a.note})` : ""}`,
    };
  }
  if (a.allowance === "unlimited") {
    return {
      meter: a.meter,
      checkable: true,
      fits: true,
      arithmetic: `unlimited by the vendor's own statement — "${a.quote}"`,
    };
  }
  const u = usage[a.basis];
  const factor = UNIT_CONVERSIONS[a.basis][a.unit];
  if (factor === undefined) {
    throw new Error(
      `allowance "${a.meter}" unit "${a.unit}" does not convert to basis ${a.basis}`,
    );
  }
  const allowanceBase = a.allowance * factor;
  if (u.value === null) {
    return {
      meter: a.meter,
      checkable: true,
      fits: null,
      arithmetic: `monthly usage unavailable — ${u.arithmetic}`,
    };
  }
  const periodUsage = a.period === "day" ? u.value / DAYS_PER_MONTH : u.value;
  const periodNote =
    a.period === "day" ? ` (monthly ÷ ${DAYS_PER_MONTH} days/month mean Gregorian)` : "";
  const fits = periodUsage <= allowanceBase;
  return {
    meter: a.meter,
    checkable: true,
    fits,
    arithmetic: `usage/${a.period}${periodNote} = ${fmt(periodUsage)} ${BASE_UNITS[a.basis]} vs allowance ${fmt(allowanceBase)} → ${fits ? "fits" : "EXCEEDED"}`,
  };
}

export function computeCostReport(input: CostInput): CostReportT {
  const { receipt, card, assumptions } = input;
  validateAssumptions(card, assumptions);

  const archHost = findHost(card, input.architectureHostId);
  for (const target of receipt.targets) {
    if (!(target.path in input.realWorldHosts)) {
      throw new Error(
        `real-world view needs an explicit host for every target; missing "${target.path}"`,
      );
    }
  }
  // A mapping key that matches no target is a typo waiting to shadow one —
  // explicit inputs are checked both ways.
  const targetPaths = new Set(receipt.targets.map((t) => t.path));
  for (const key of Object.keys(input.realWorldHosts)) {
    if (!targetPaths.has(key)) {
      throw new Error(
        `real-world host mapping names "${key}", which is not a receipt target (targets: ${[...targetPaths].join(", ")})`,
      );
    }
  }

  const pairs = receipt.targets.map((t) => ({
    target: { path: t.path, variant: t.variant, surface: t.surface },
    profiles: {
      cold: t.columns.cold.resourceProfile,
      warm: t.columns.warm.resourceProfile,
    },
  }));

  const architectureTargets = pairs.map((p) =>
    priceTarget(p.target, p.profiles, archHost, assumptions),
  );
  const realWorldTargets = pairs.map((p) =>
    priceTarget(
      p.target,
      p.profiles,
      findHost(card, input.realWorldHosts[p.target.path]!),
      assumptions,
    ),
  );

  const usedHosts = new Map<string, HostT>([[archHost.hostId, archHost]]);
  for (const hostId of Object.values(input.realWorldHosts)) {
    usedHosts.set(hostId, findHost(card, hostId));
  }

  const actual =
    input.monthlyVisits === undefined
      ? null
      : (() => {
          if (!Number.isFinite(input.monthlyVisits!) || input.monthlyVisits! < 0) {
            throw new Error(`monthly visits must be a nonnegative number; got ${input.monthlyVisits}`);
          }
          const perTargetVisits = input.monthlyVisits! / receipt.targets.length;
          const byHost = new Map<string, PricedTargetT[]>();
          for (const t of realWorldTargets) {
            const list = byHost.get(t.hostId) ?? [];
            list.push(t);
            byHost.set(t.hostId, list);
          }
          return {
            monthlyVisits: input.monthlyVisits!,
            split: `${fmt(input.monthlyVisits!)} visits/month split evenly across the ${receipt.targets.length} measured target(s) = ${fmt(perTargetVisits)} each (swap the split by re-running with different inputs)`,
            hosts: [...byHost.entries()].map(([hostId, targets]) =>
              actualForHost(
                usedHosts.get(hostId)!,
                targets.map((t) => ({ path: t.path, blended: t.blended })),
                perTargetVisits,
                assumptions.region,
              ),
            ),
          };
        })();

  const methodNotes = [
    // The measurement side's stated limits travel with the dollars — the
    // receipt is gitignored, its caveats must not be.
    ...receipt.methodNotes.map((note) => `receipt: ${note}`),
    "egress is priced from the receipt's instrumentation-stripped bytes (the architecture's own transfer, ADR-0001 §6) — a deployed site's total egress additionally carries the injected chrome's bytes.",
    "a null never becomes an estimate: a quantity whose measurement source could not account it yields an UNPRICED line and a null total (partial sums are labeled) — except under a $0 rate, where the COST is exactly determined for any usage (the usage itself stays null).",
    "GB is decimal (1 GB = 1,000,000,000 bytes); CPU-hr = 3,600,000 CPU-ms — conversions are shown inline in each line's arithmetic.",
    ...[...usedHosts.values()].flatMap((h) => [
      ...(h.caveats ?? []).map((c) => `${h.hostId}: ${c}`),
      ...(h.unmeasured ?? []).map(
        (u) =>
          `${h.hostId} also bills "${u.meter}" (${u.priceSummary}), which the measured profile cannot account: ${u.note} — "${u.quote}" (${u.url})`,
      ),
    ]),
    ...(card.notes ?? []),
  ];

  return {
    kind: "pm-cost-report",
    reportVersion: COST_REPORT_VERSION,
    date: input.date,
    input: {
      receiptDate: receipt.date,
      commit: { sha: receipt.commit.sha, dirty: receipt.commit.dirty },
      origin: receipt.origin,
      profileId: receipt.profile.id,
      n: receipt.environment.n,
      runsPerUrl: receipt.runsPerUrl,
      runLocation: receipt.runLocation.label,
      runNonce: receipt.environment.runNonce,
    },
    card: { id: card.id, capturedAt: card.capturedAt, verifiedBy: card.verifiedBy },
    assumptions: {
      cacheHitRatio: assumptions.cacheHitRatio,
      region: assumptions.region,
      visitDefinition:
        "one visit = one measured page visit of the target under the receipt's batch conditions (profile, ?n=, interaction); expected usage blends the receipt's measured cold/warm columns at the stated cache-hit ratio",
      notes: [
        `architecture-only view prices every variant on ${archHost.hostId}'s marginal rates (vendor held constant; base fees and included allotments amortize toward zero at scale and are handled in the actual-charge view)`,
        "real-world view prices each variant on its stated host's marginal rates",
      ],
    },
    methodNotes,
    views: {
      architectureOnly: { hostId: archHost.hostId, targets: architectureTargets },
      realWorld: { mapping: { ...input.realWorldHosts }, targets: realWorldTargets },
    },
    actual,
  };
}
