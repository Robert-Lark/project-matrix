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
export const PLP_N = { default: 24, max: 240 } as const;

export function clampN(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? "", 10) || PLP_N.default;
  return Math.min(Math.max(parsed, 1), PLP_N.max);
}

/**
 * The environment + cache-state beacon tags, canonicalized from a query
 * string. Wire format (pinned by tests, relied on by the bench runner's
 * batch keys): environment = `n=<effective>|cache=<cold|default>`.
 */
export function knobTags(search: string): {
  environment: string;
  cacheState: "cold" | "default";
} {
  const params = new URLSearchParams(search);
  const cache = params.get("cache") === "cold" ? "cold" : "default";
  return {
    environment: `n=${clampN(params.get("n"))}|cache=${cache}`,
    cacheState: cache,
  };
}
