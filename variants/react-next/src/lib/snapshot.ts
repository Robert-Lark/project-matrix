// Which snapshot is being served is only knowable at REQUEST time (the
// manifest's `crate` field, via GET /api/snapshot) — but the featured-release
// POLICY (which id to feature) is a small committed constant, not fetched
// data, so it is bundled at build time exactly as vanilla's build.mjs reads
// it (ADR-0008 §9). Importing the fixture's own committed files rather than
// hardcoding its crate name keeps this tool-derived, never typed.
import fixtureManifest from "../../../../tools/snapshot-fixture/snapshot/manifest.json";
import fixtureCuration from "../../../../tools/snapshot-fixture/snapshot/curation.json";

/** The crate's frozen curation.json predates the `featured` field (it was
 *  introduced by the fixture), so the crate's pick is the recorded design
 *  constant (ADR-0008 §9 — editorial 953800, a curated choice, not a
 *  receipt); the fixture's curation.json carries it directly. */
const CRATE_FEATURED_ID = 953800;

export function isFixtureCrate(crateName: string): boolean {
  return crateName === fixtureManifest.crate;
}

export function featuredIdFor(crateName: string): number {
  return isFixtureCrate(crateName) ? fixtureCuration.featured : CRATE_FEATURED_ID;
}
