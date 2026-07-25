// Resolve the editorial page's baked payload from a COMMITTED snapshot —
// plain Node, deliberately outside Vite (editorial-build slice C).
//
// Astro is a build-time variant on this surface: the trays are read once, at
// build, and the rendered HTML ships as a static asset (ADR-0002 §7 —
// build-time variants bake the snapshot in; only request-time variants fetch
// through the edge Worker). This module is the one place that reads them.
//
// Why not read the trays from inside a component's frontmatter: Astro's
// static build renders through a Vite SSR bundle written to a temp directory,
// so `import.meta.url` inside a component resolves to that temp chunk, not to
// this source tree — repo-relative paths computed there would silently point
// at nothing. A pre-build step in plain Node has no such ambiguity, and it
// keeps the resolved payload a declared build INPUT rather than a hidden
// read (see @pm/astro#build's turbo inputs).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

/** The two committed snapshot-layout directories PM_SNAPSHOT selects between
 *  — the same pair `packages/reference/render/lib.mjs` loads by name, and the
 *  same pair `variants/vanilla/build.mjs` reads (the slice-A precedent). */
export const SNAPSHOTS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
};

/**
 * The editorial page's whole data dependency, for one snapshot: the freeze
 * date plus the featured release's detail and summary trays. Everything the
 * page renders is derived from this — no other data reaches the template.
 *
 * @param {"fixture" | "crate"} name
 */
export function resolveEditorialData(name) {
  const dir = SNAPSHOTS[name];
  if (!dir) {
    throw new Error(`PM_SNAPSHOT=${name} is not a known snapshot (fixture|crate)`);
  }
  const read = (file) => JSON.parse(readFileSync(join(dir, file), "utf8"));

  // The featured release: the fixture's curation.json names it; the crate's
  // frozen curation predates the field, so the crate pick is a recorded
  // design constant (ADR-0008 §9: editorial 953800 — a curated choice, like
  // the crate itself, not a receipt).
  const featuredId = name === "crate" ? 953800 : read("curation.json").featured;
  if (featuredId == null) throw new Error(`${name}: no featured release id`);

  const featured = read("details.json").find((d) => d.id === featuredId);
  if (!featured) throw new Error(`${name}: no detail tray for id ${featuredId}`);
  const summary = read("summaries.json").find((s) => s.id === featuredId);
  if (!summary) throw new Error(`${name}: no summary tray for id ${featuredId}`);

  const manifest = read("manifest.json");
  return { name, capturedAt: manifest.capturedAt, featured, summary };
}
