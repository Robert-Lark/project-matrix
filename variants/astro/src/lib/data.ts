/**
 * The shape `scripts/prepare-build.mjs` bakes into `src/data/snapshot.json`
 * before every build — the editorial page's entire data dependency, resolved
 * once from the committed trays PM_SNAPSHOT selects.
 *
 * Typed against the shared tray contract (`@pm/data-contract`) rather than
 * re-declared loosely: the trays are the same normalized payload every variant
 * consumes (ADR-0002), and a drifting field name should be a type error here,
 * not a missing string in the rendered page.
 */
import type { ReleaseDetail, ReleaseSummary } from "@pm/data-contract";

export interface EditorialData {
  /** Which committed snapshot this build baked: selects the essay. */
  readonly name: string;
  /** The manifest's freeze date — the dateline IS this value (ADR-0008 §8). */
  readonly capturedAt: string;
  readonly featured: ReleaseDetail;
  readonly summary: ReleaseSummary;
}

/** The PDP bake (`src/data/pdp.json`, pdp-variants slice 2): EVERY detail
 *  tray — the build-time paradigm renders the whole catalogue (the vanilla
 *  build.mjs precedent; rendering only the bench's handful would rig the
 *  variant to fit the instrument). */
export interface PdpData {
  readonly name: string;
  readonly capturedAt: string;
  readonly details: readonly ReleaseDetail[];
}
