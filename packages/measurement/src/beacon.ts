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
