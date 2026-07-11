/**
 * The rate-card contract (ADR-0001 §7): the PRICE half of the cost model,
 * fully separated from the measured resource profile. A card is a dated
 * DATA file — swapping prices means swapping the file, never touching code
 * (rate cards drift by design; the date is load-bearing).
 *
 * Each host maps the vendor's billing meters onto the measured profile via
 * a `basis`, prices them in the vendor's own native units (the calculator
 * converts, showing its work), and DECLARES the meters the profile cannot
 * account (`unmeasured`) so they surface as limits-of-data instead of
 * silently vanishing. Every rate carries the exact quote + URL it was
 * verified from — the anti-rigging trail extends into the price side.
 */
import { z } from "zod";

export const RATE_CARD_VERSION = 1;

/** Which measured quantity a rate multiplies. `visits` is the unit itself
 *  (exactly 1 per visit) — for per-visit meters like an SSR document's
 *  function invocation, where the assumption must be stated on the rate. */
export const BASES = ["requests", "cpuMs", "egressBytes", "visits"] as const;
export type Basis = (typeof BASES)[number];

/** Native vendor units the calculator can convert to each basis's base
 *  unit (request / CPU-ms / byte / visit). Conversions are published in
 *  every line's arithmetic. GB is decimal (1 GB = 1e9 bytes), matching
 *  how the vendors meter transfer. */
export const UNIT_CONVERSIONS: Record<Basis, Record<string, number>> = {
  requests: { requests: 1 },
  cpuMs: { "CPU-ms": 1, "CPU-hr": 3_600_000 },
  egressBytes: { bytes: 1, MB: 1e6, GB: 1e9 },
  visits: { visits: 1, invocations: 1 },
};

const Money = z.number().nonnegative().finite();

const Rate = z.object({
  /** The vendor's own name for the billing meter (e.g. "Edge Requests"). */
  meter: z.string().min(1),
  basis: z.enum(BASES),
  /** Price in the vendor's native terms: `amountUsd` per `per` `unit`. */
  amountUsd: Money,
  per: z.number().positive(),
  unit: z.string().min(1),
  /** Card regions this rate prices; "all" = the vendor prices it flat. */
  regions: z.union([z.literal("all"), z.array(z.string().min(1)).min(1)]),
  /** Paid-plan monthly allotment (in `unit`s) before the marginal rate. */
  includedPerMonth: z.number().nonnegative().optional(),
  /** EXACT quote from the vendor page this figure was read from. */
  quote: z.string().min(1),
  url: z.string().min(1),
  /** Stated assumptions (e.g. what "one visit" means for this meter). */
  note: z.string().optional(),
});
export type RateT = z.infer<typeof Rate>;

/** A vendor meter the measured profile genuinely cannot account — declared
 *  with its price so the report can state what the number leaves out. */
const UnmeasuredMeter = z.object({
  meter: z.string().min(1),
  priceSummary: z.string().min(1),
  quote: z.string().min(1),
  url: z.string().min(1),
  note: z.string().min(1),
});

const Allowance = z.object({
  meter: z.string().min(1),
  /** Absent basis = stated but not checkable against the measured profile
   *  (e.g. a per-invocation CPU cap when the profile has per-visit totals). */
  basis: z.enum(BASES).optional(),
  /** "unlimited" states a vendor's explicit no-limit (always fits). */
  allowance: z.union([z.number().nonnegative(), z.literal("unlimited")]),
  unit: z.string().min(1),
  /** "invocation" caps are stated, never checkable from per-visit totals. */
  period: z.enum(["day", "month", "invocation"]),
  quote: z.string().min(1),
  url: z.string().min(1),
  note: z.string().optional(),
});
export type AllowanceT = z.infer<typeof Allowance>;

const FreePlan = z.object({
  plan: z.string().min(1),
  allowances: z.array(Allowance),
  /** What the vendor does beyond the allowance (blocks vs bills). */
  overflow: z.string().min(1),
});

const Host = z.object({
  hostId: z.string().min(1),
  vendor: z.string().min(1),
  plan: z.string().min(1),
  /** Minimum monthly charge for the plan itself. */
  monthlyBaseUsd: Money,
  /** Monthly usage credit that offsets on-demand charges (e.g. Vercel Pro). */
  monthlyCreditUsd: Money.optional(),
  rates: z.array(Rate).min(1),
  unmeasured: z.array(UnmeasuredMeter).optional(),
  freePlan: FreePlan.optional(),
  caveats: z.array(z.string()).optional(),
});
export type HostT = z.infer<typeof Host>;

export const RateCard = z.object({
  kind: z.literal("pm-rate-card"),
  cardVersion: z.literal(RATE_CARD_VERSION),
  id: z.string().min(1),
  /** The DATE — a rate card is only meaningful dated (ADR-0001 §7). */
  capturedAt: z.string().min(1),
  /** How the figures were verified (the provenance of the price side). */
  verifiedBy: z.string().min(1),
  /** The card's own region vocabulary; region-scoped rates use these names
   *  and each maps to the vendor's region in its quote. */
  regions: z.array(z.string().min(1)).min(1),
  hosts: z.array(Host).min(1),
  notes: z.array(z.string()).optional(),
});
export type RateCardT = z.infer<typeof RateCard>;

export function parseRateCard(json: unknown): RateCardT {
  const card = RateCard.parse(json);
  // Duplicate hostIds would price with whichever block findHost sees
  // first — an append-without-delete card edit must fail at parse time.
  const seenHosts = new Set<string>();
  for (const host of card.hosts) {
    if (seenHosts.has(host.hostId)) {
      throw new Error(
        `rate card ${card.id}: hostId "${host.hostId}" appears more than once — replace the block, don't append`,
      );
    }
    seenHosts.add(host.hostId);
  }
  for (const host of card.hosts) {
    for (const rate of host.rates) {
      const factor = UNIT_CONVERSIONS[rate.basis][rate.unit];
      if (factor === undefined) {
        throw new Error(
          `rate card ${card.id}: host ${host.hostId} meter "${rate.meter}" prices unit "${rate.unit}", which does not convert to basis ${rate.basis} (known: ${Object.keys(UNIT_CONVERSIONS[rate.basis]).join(", ")})`,
        );
      }
      if (rate.regions !== "all") {
        for (const region of rate.regions) {
          if (!card.regions.includes(region)) {
            throw new Error(
              `rate card ${card.id}: host ${host.hostId} meter "${rate.meter}" names region "${region}" outside the card's vocabulary (${card.regions.join(", ")})`,
            );
          }
        }
      }
    }
    // Every measured basis must be covered for every card region: a host
    // that charges nothing for a dimension states $0 with a quote — free
    // is a fact about the vendor, never a default hidden in code. The
    // visits basis isn't required, but its duplicate check runs here too —
    // a card must fail at PARSE time, not mid-report on some input combo.
    for (const basis of BASES) {
      for (const region of card.regions) {
        const matches = ratesFor(host, basis, region);
        if (basis !== "visits" && matches.length === 0) {
          throw new Error(
            `rate card ${card.id}: host ${host.hostId} has no "${basis}" rate covering region "${region}" — state $0 with the vendor's quote if the vendor does not charge it`,
          );
        }
      }
    }
    // Checkable free-plan allowances must convert at parse time for the
    // same reason (stated-only caps — basis-less, per-invocation, or
    // "unlimited" — are never converted, so any unit is fine there).
    for (const a of host.freePlan?.allowances ?? []) {
      const checkable =
        a.basis !== undefined && a.period !== "invocation" && a.allowance !== "unlimited";
      if (checkable && UNIT_CONVERSIONS[a.basis!][a.unit] === undefined) {
        throw new Error(
          `rate card ${card.id}: host ${host.hostId} free-plan allowance "${a.meter}" uses unit "${a.unit}", which does not convert to basis ${a.basis} (known: ${Object.keys(UNIT_CONVERSIONS[a.basis!]).join(", ")})`,
        );
      }
    }
  }
  return card;
}

export function findHost(card: RateCardT, hostId: string): HostT {
  const host = card.hosts.find((h) => h.hostId === hostId);
  if (!host) {
    throw new Error(
      `rate card ${card.id} has no host "${hostId}" (available: ${card.hosts.map((h) => h.hostId).join(", ")})`,
    );
  }
  return host;
}

/** All of a host's rates on one basis that price the given region. A meter
 *  may appear once per region; two rates for the same meter covering the
 *  same region is an authoring error surfaced here. */
export function ratesFor(host: HostT, basis: Basis, region: string): RateT[] {
  const matches = host.rates.filter(
    (r) => r.basis === basis && (r.regions === "all" || r.regions.includes(region)),
  );
  const seen = new Set<string>();
  for (const rate of matches) {
    if (seen.has(rate.meter)) {
      throw new Error(
        `host ${host.hostId}: meter "${rate.meter}" has more than one rate covering region "${region}"`,
      );
    }
    seen.add(rate.meter);
  }
  return matches;
}
