/**
 * Pre-merge textual identity: variant re-implementations vs the reference
 * masters, BOTH snapshots (editorial-build slice A; verify-slice finding).
 *
 * Variant-owned content is re-typed by design (the recorded slice-A call —
 * no shared component runtime, ADR-0003 §1), and the browser drift gate
 * polices identity. But CI's browser legs only ever serve the FIXTURE:
 * crate-flavored text (CRATE_ESSAY and its twin) is otherwise first
 * compared on the deployed plane, AFTER merge — so a one-word crate-copy
 * edit in one file would merge green and turn the post-deploy smoke red,
 * violating the PRD's standing rule ("nothing merges that turns the
 * deployed smoke red"). The crate TRAYS are committed, so this guard needs
 * no browser and no image bytes: render both flavors from both renderers
 * in-process and compare after stripping exactly what the ADR-0008
 * freedoms grant (head, script elements, the chrome slot) and collapsing
 * ASCII whitespace.
 *
 * Deliberately byte-strict beyond the browser normalizer (attribute order
 * is NOT freed here): today the two templates agree byte-for-byte after
 * the strip, and a legitimate serialization change should surface
 * pre-merge as a cheap, visible edit to this guard — never silently.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const SNAPSHOTS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
} as const;

/** The crate's featured editorial release is the recorded design constant
 *  (ADR-0008 §9 / lib.mjs CRATE_FEATURED); the fixture's curation names it. */
function featuredId(name: keyof typeof SNAPSHOTS): number {
  if (name === "crate") return 953800;
  const curated = (
    JSON.parse(readFileSync(join(SNAPSHOTS[name], "curation.json"), "utf8")) as {
      featured?: number;
    }
  ).featured;
  if (curated == null) throw new Error(`${name}: no featured release id`);
  return curated;
}

/** Strip the ADR-0008 delivery freedoms this guard tolerates: the head
 *  subtree, script elements, the chrome slot; collapse ASCII whitespace. */
function stripDelivery(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div id="pm-chrome-slot"><\/div>/, "")
    .replace(/[\t\n\f\r ]+/g, " ");
}

describe("vanilla editorial equals the master textually, both snapshots (pre-merge)", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: renderEditorialPage matches renderEditorial after the delivery strip`, async () => {
      // Dynamic import by file URL — both renderers are plain-JS build
      // tooling with no side effects on import (the reference regeneration
      // test's own pattern).
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      const vanilla = await import(
        pathToFileURL(join(repoRoot, "variants", "vanilla", "render.mjs")).href
      );

      const snapshot = lib.loadSnapshot(name);
      const master = stripDelivery(reference.renderEditorial(snapshot, { origin: "" }));
      const variant = stripDelivery(
        vanilla.renderEditorialPage(snapshot, featuredId(name)),
      );
      expect(variant).not.toBe("");
      expect(variant).toContain("pm-editorial");
      expect(variant).toBe(master);
    });
  }
});
