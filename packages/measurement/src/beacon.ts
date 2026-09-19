/**
 * The beacon tag contract (ADR-0001 §8): the five tags every RUM event
 * carries — variant / surface / environment / cache-state / location. This is
 * the ONE spelling both sides import: the edge Worker's collector rejects
 * events missing any of these keys, and the chrome-slice sender (issue #5)
 * builds events from the same list — so the wire format cannot drift between
 * prose ("cache-state") and code (`cacheState`).
 */
export const BEACON_TAG_KEYS = [
  "variant",
  "surface",
  "environment",
  "cacheState",
  "location",
] as const;

export type BeaconTagKey = (typeof BEACON_TAG_KEYS)[number];

export type BeaconTags = Record<BeaconTagKey, string>;

export interface BeaconEvent {
  /** Metric name, e.g. "LCP" — bounded (the collector rejects >96 bytes). */
  name?: string;
  value?: number;
  tags: BeaconTags;
}

/**
 * The data-volume knob's canonical bounds (ADR-0002 §5): ONE definition,
 * consumed by the edge Worker (served condition + KV key) and the chrome's
 * environment tag — so the tag is bijective with what was actually served
 * (n=0240, n=99999, and junk all collapse to their effective value, and the
 * tag can never exceed the collector's byte limits).
 */
export const PLP_N = {
  default: 24,
  max: 240,
  /** The two values the switcher offers (`SURFACE_CONTROLS.plp.nKnob`) and
   *  the ONLY two the edge Worker's warm tier holds — see `plpWarmable`. */
  warmed: [24, 240],
} as const;

export function clampN(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? "", 10) || PLP_N.default;
  return Math.min(Math.max(parsed, 1), PLP_N.max);
}

/**
 * Can the warm tier hold this condition at all? ONE derivation, consumed by
 * the edge Worker (which skips KV in both directions when the answer is no)
 * and by the chrome's `cacheState` tag (which would otherwise stamp a
 * search or a hand-typed `?n=48` as `default` — a KV-tier column — while
 * every one of those requests was served from R2). The rule is the URL-
 * derivable half of the key-cardinality policy (ADR-0005 addendum,
 * 2026-09-04): free-text search has no finite key space, and `n` is warmed
 * only at the two published knob values. The page ceiling is the other
 * half and needs the snapshot, so it lives in the Worker alone.
 */
export function plpWarmable(params: URLSearchParams): boolean {
  const n = clampN(params.get("n"));
  const q = (params.get("q") ?? "").trim();
  return (PLP_N.warmed as readonly number[]).includes(n) && q === "";
}

/**
 * The environment + cache-state beacon tags, canonicalized from a query
 * string. Wire format (pinned by tests, relied on by the bench runner's
 * batch keys): environment = `n=<effective>|cache=<cold|default>` — the
 * REQUESTED column, unchanged. `cacheState` is the tier the request can
 * actually reach: `cold` (bypass asked), `default` (the warm tier), or
 * `none` for a condition the warm tier never holds (`plpWarmable`), so RUM
 * for a search is not blended into the KV column it never touched.
 */
export function knobTags(search: string): {
  environment: string;
  cacheState: "cold" | "default" | "none";
} {
  const params = new URLSearchParams(search);
  const cache = params.get("cache") === "cold" ? "cold" : "default";
  return {
    environment: `n=${clampN(params.get("n"))}|cache=${cache}`,
    cacheState: cache === "cold" ? "cold" : plpWarmable(params) ? "default" : "none",
  };
}

/**
 * The beacon ROSTER (security floor, 2026-09-18 — 2026-08-29 audit priority
 * 4, task 2). `variant` is the Analytics Engine INDEX (the sampling key) and
 * `surface` the first blob every dashboard groups by. The collector checked
 * both for presence and byte length only, so any string became a sampling
 * key — RUM-dashboard pollution, one curl at a time. Published numbers were
 * never at risk (they come from committed lab bundles, never from RUM),
 * which is why this is a roster and not a signature.
 *
 * ONE roster, no copies:
 *  - `VARIANT_PREFIXES` is the set the front Worker DISPATCHES (ADR-0004
 *    §3): it builds its prefix → service-binding map from this list, so a
 *    variant the front serves is a variant the collector accepts, by
 *    construction. The chrome's `variant` tag IS that prefix (the front
 *    passes `url.pathname.split("/")[1]` to renderChrome).
 *  - `SURFACE_NAMES` is the switcher registry's key set (`@pm/switcher`
 *    SURFACE_CONTROLS — pinned to this list by `satisfies` at compile time
 *    and by a runtime test). The chrome's `surface` tag is the path's second
 *    segment, and every page a variant serves with a chrome slot sits under
 *    one of these names (read off a held plane, 2026-09-18).
 *  - The home surface's IN-PAGE HUD (ADR-0007 §5) tags itself
 *    `singleton` / `home`; the origin suite pins the served markup to
 *    `HOME_TAGS`. The suite's own beacon traffic — REAL, undeletable AE
 *    points on the post-deploy smoke — carries the reserved `ci-smoke` on
 *    both tags so a dashboard can exclude it by name.
 * The measurement client's `"unknown"` fallback (client.ts) is deliberately
 * NOT on the roster: a page whose chrome lost its data attributes is exactly
 * the point that must not become a sampling key.
 */
export const VARIANT_PREFIXES = [
  "placeholder-static",
  "placeholder-ssr",
  "vanilla",
  "react-next",
  "astro",
  "qwik",
  "htmx",
  "remix3",
] as const;
export type VariantPrefix = (typeof VARIANT_PREFIXES)[number];

export const SURFACE_NAMES = [
  "sample",
  "editorial",
  "pdp",
  "plp",
  "checkout",
  "a11y",
  "how-it-was-built",
] as const;
export type SurfaceName = (typeof SURFACE_NAMES)[number];

/** The home singleton's own tag pair (workers/front/home/index.html). */
export const HOME_TAGS = { variant: "singleton", surface: "home" } as const;

/** Reserved for the origin suite and the post-deploy smoke; excluded from
 *  any field analysis by name (workers/README.md). */
export const SMOKE_TAG = "ci-smoke";

export const BEACON_VARIANTS: ReadonlySet<string> = new Set<string>([
  ...VARIANT_PREFIXES,
  HOME_TAGS.variant,
  SMOKE_TAG,
]);
export const BEACON_SURFACES: ReadonlySet<string> = new Set<string>([
  ...SURFACE_NAMES,
  HOME_TAGS.surface,
  SMOKE_TAG,
]);
