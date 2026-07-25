/**
 * Pre-merge textual identity: this variant's re-implementation vs the reference
 * master, BOTH snapshots (editorial-build slice C; the slice-A/B guards close
 * the same hole for their own variants).
 *
 * Why it exists: variant-owned content is re-typed by design (no shared
 * component runtime, ADR-0003 §1) and the browser drift gate polices identity —
 * but CI's browser legs only ever serve the FIXTURE. Crate-flavored text
 * (CRATE_ESSAY and its twin in `src/lib/essays.ts`) would otherwise first be
 * compared on the deployed plane, AFTER merge, so a one-word crate-copy edit
 * would merge green and turn the post-deploy smoke red — violating the PRD's
 * standing rule. The crate TRAYS are committed, so this guard needs no browser,
 * no server, and no image bytes.
 *
 * The mechanism is Astro's OWN render-to-string entry point — the Container API
 * (`astro/container`), which renders a real `.astro` component tree in-process.
 * That is why this file can compare the whole document rather than just the
 * essay strings: it drives the same components the build does, with each
 * snapshot's data injected as props.
 *
 * Comparison policy is the drift gate's own normalizer (`PAGE_NORMALIZE`), run
 * over `linkedom` instead of a browser — the slice-B precedent. A byte-strict
 * compare would fail on whitespace: Astro emits a template's whitespace as
 * authored and then compresses it out (`compressHTML`, on by default), which
 * matches the master's rendering but not its bytes. The normalizer forgives
 * exactly the ADR-0008 freedoms (head, script/style/link/template, the chrome
 * slot, comments, insignificant whitespace) and nothing else.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { NO_NOISE, PAGE_NORMALIZE, firstDomDivergence } from "@pm/drift-gate";
import EditorialDocument from "../src/components/EditorialDocument.astro";
import EditorialPage from "../src/pages/editorial/index.astro";
import { essayFor } from "../src/lib/essays";
import { resolveEditorialData } from "../scripts/resolve-snapshot.mjs";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

/**
 * `PAGE_NORMALIZE` is written to run INSIDE a driven browser page — it is
 * self-contained by construction and reads `document`/`Node` as globals rather
 * than parameters. linkedom supplies same-shape globals for a plain HTML
 * string; install them for the one synchronous call, then restore.
 */
function normalizeHtml(html: string): string {
  const { document, Node } = parseHTML(html);
  const g = globalThis as unknown as { document?: unknown; Node?: unknown };
  const prevDocument = g.document;
  const prevNode = g.Node;
  g.document = document;
  g.Node = Node;
  try {
    return PAGE_NORMALIZE({
      attrPatterns: [...NO_NOISE.attrPatterns],
      classPatterns: [...NO_NOISE.classPatterns],
      behaviorAttrPatterns: [...NO_NOISE.behaviorAttrPatterns],
      dropElementSelectors: [],
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

describe("astro editorial equals the master by normalized DOM, both snapshots (pre-merge)", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: the rendered document matches renderEditorial`, async () => {
      // Both reference renderers are plain-JS build tooling with a
      // main-module-guarded CLI — importing renders and writes nothing (the
      // @pm/reference regeneration test's own pattern).
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      const master = reference.renderEditorial(lib.loadSnapshot(name), { origin: "" });
      expect(master).not.toBe("");

      const container = await AstroContainer.create();
      // partial: false renders the component as a full-fledged page rather than
      // a fragment — this component IS the whole document (doctype included).
      const variant = await container.renderToString(EditorialDocument, {
        props: { data: resolveEditorialData(name) },
        partial: false,
      });

      const masterDom = normalizeHtml(master);
      const variantDom = normalizeHtml(variant);
      expect(variantDom).not.toBe("");
      expect(variantDom).toContain("pm-editorial");
      if (variantDom !== masterDom) {
        // The CI-log evidence: the gate's own first-divergence formatter.
        console.error(firstDomDivergence(masterDom, variantDom));
      }
      expect(variantDom).toBe(masterDom);
    });
  }

  /**
   * The block above proves the COMPONENT for both snapshots, but the component
   * is not what ships — `src/pages/editorial/index.astro` is, and it is the
   * only consumer of the baked payload. Nothing else exercises it pre-merge
   * (verify-slice finding): CI's browser legs serve the built page but only
   * ever with the FIXTURE baked, so a page-level wiring bug that changes only
   * the CRATE flavor — a swapped import, a `name` override, a renamed tray
   * field the `as EditorialData` cast swallows — would pass every pre-merge
   * check and turn the post-deploy smoke red.
   *
   * Rather than try to drive the page once per flavor (its import of the baked
   * JSON is static, so that would mean rewriting a generated file mid-test),
   * this proves the page is a faithful PASS-THROUGH of whatever was baked.
   * Composed with the both-flavor component proof above, a faithful
   * pass-through of a correct component is correct for both flavors.
   *
   * Disclosed limit: a page bug conditional on the data itself (e.g. `if
   * (baked.name === "crate") …`) would still slip past, because only one
   * flavor is on disk per run. That is contrived rather than plausible, and
   * catching it would need the generated-file rewrite this deliberately
   * avoids.
   */
  it("the PAGE is a faithful pass-through of the baked payload, not just the component", async () => {
    const bakedPath = join(import.meta.dirname, "..", "src", "data", "snapshot.json");
    const baked = JSON.parse(readFileSync(bakedPath, "utf8"));

    const container = await AstroContainer.create();
    const fromPage = await container.renderToString(EditorialPage, { partial: false });
    const fromComponent = await container.renderToString(EditorialDocument, {
      props: { data: baked },
      partial: false,
    });

    const pageDom = normalizeHtml(fromPage);
    expect(pageDom).not.toBe("");
    expect(pageDom).toContain("pm-editorial");
    if (pageDom !== normalizeHtml(fromComponent)) {
      console.error(firstDomDivergence(normalizeHtml(fromComponent), pageDom));
    }
    expect(pageDom).toBe(normalizeHtml(fromComponent));

    // Non-vacuity: the page really did render the BAKED snapshot's essay, so
    // this cannot pass by both sides being empty or both being the wrong one.
    expect(fromPage).toContain(essayFor(baked.name).title);
  });

  it("the two snapshots really do render DIFFERENT prose (this guard is not vacuous)", () => {
    // If both flavors somehow resolved to the same essay, the crate leg above
    // would be proving the fixture twice and the whole point would be lost.
    const fixture = resolveEditorialData("fixture");
    const crate = resolveEditorialData("crate");
    expect(crate.name).not.toBe(fixture.name);
    expect(crate.featured.title).not.toBe(fixture.featured.title);
  });
});
