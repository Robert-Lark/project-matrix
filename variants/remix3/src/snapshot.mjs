// Which snapshot is being served is only knowable at REQUEST time (the
// manifest's `crate` field, via GET /api/snapshot) — but the featured-release
// POLICY (which id to feature) is a small committed constant, not fetched
// data, so it is bundled at deploy time. Importing the fixture's own
// committed files rather than hardcoding its crate name keeps this
// tool-derived, never typed (the slice-B/D precedent; re-typed here from the
// htmx module because policy is variant-owned code, not shared runtime).
//
// `with { type: "json" }` so the module loads identically under wrangler's
// esbuild AND plain Node (the pre-merge guard's runner), keeping the module
// framework-neutral.
import fixtureCuration from "../../../tools/snapshot-fixture/snapshot/curation.json" with { type: "json" };
import fixtureManifest from "../../../tools/snapshot-fixture/snapshot/manifest.json" with { type: "json" };

/** The crate's frozen curation.json predates the `featured` field (it was
 *  introduced by the fixture), so the crate's pick is the recorded design
 *  constant (ADR-0008 §9 — editorial 953800, a curated choice, not a
 *  receipt); the fixture's curation.json carries it directly. */
const CRATE_FEATURED_ID = 953800;

export function isFixtureCrate(crateName) {
  return crateName === fixtureManifest.crate;
}

export function featuredIdFor(crateName) {
  return isFixtureCrate(crateName) ? fixtureCuration.featured : CRATE_FEATURED_ID;
}
