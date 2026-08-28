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
import PdpDocument from "../src/components/PdpDocument.astro";
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

/**
 * The PDP's version of the guard (pdp-variants slice 2) — the same
 * Container-API mechanism, over EVERY detail tray in BOTH snapshots (the
 * vanilla and react-next PDP guards' shape: 740 pages, covering the
 * render-class combinations the crate has and the fixture does not, plus
 * the three KNOWINGLY UNGATED arms — absent notes, null duration, null
 * year — that no committed master exercises).
 */
describe("astro's PDP equals the master by normalized DOM, every tray, both snapshots", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: PdpDocument matches renderPdp for every detail tray`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      const details = snapshot.details as { id: number }[];
      expect(details.length).toBeGreaterThan(0);

      const container = await AstroContainer.create();
      const mismatched: number[] = [];
      for (const detail of details) {
        const master = normalizeHtml(
          reference.renderPdp(snapshot, { origin: "", id: detail.id }),
        );
        const variant = normalizeHtml(
          await container.renderToString(PdpDocument, {
            props: { detail },
            partial: false,
          }),
        );
        if (variant !== master) {
          if (mismatched.length === 0) console.error(firstDomDivergence(master, variant));
          mismatched.push(detail.id);
        }
      }
      expect(mismatched, `${mismatched.length} of ${details.length} PDP pages drifted`).toEqual([]);

      // Non-vacuity (the vanilla guard's rule): real PDP markup was compared,
      // the fenced plaque rode the comparison on both sides (it is CANONICAL
      // content here — core comparisons never drop it), and the format
      // CONTROL stays gone while the format DATA survives (ADR-0008
      // addendum A).
      const sample = normalizeHtml(
        await container.renderToString(PdpDocument, {
          props: { detail: details[0] },
          partial: false,
        }),
      );
      expect(sample).toContain("pm-pdp");
      expect(sample).toContain("pm-gallery__zoom");
      expect(sample).toContain("data-pm-fenced");
      expect(sample).not.toContain("pm-format");
      // Same class and same budget as the react-next and qwik catalogue
      // sweeps (300_000 — sized to catch a hang, not to race the runner).
      // MEASURED on ubuntu-latest (PR #31): fixture 2.78 s, crate 3.96 s,
      // against 739/1,676 ms here.
      //
      // Correcting the projection this comment used to carry: it said the 5 s
      // default "would have failed both". It would not have — both legs come
      // in UNDER 5 s. The crate leg's 1.26× margin is a flake waiting to
      // happen rather than a failure, which is reason enough for a real
      // budget, but the stronger claim was wrong and is retracted.
    }, 300_000);
  }

  /**
   * The stylesheet LIST, which the normalizer throws away with the head —
   * the axis the css prop parameterises, compared by tail after `/css/`
   * (order included: cascade order is a rendering property, not a freedom).
   * The vanilla and react-next guards carry the same leg.
   */
  it("the PDP document links exactly the master's stylesheets, in order", async () => {
    const lib = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
    );
    const reference = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
    );
    const snapshot = lib.loadSnapshot("fixture");
    const detail = (snapshot.details as { id: number }[])[0]!;

    const sheets = (html: string): string[] =>
      [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => {
        const at = m[1]!.lastIndexOf("/css/");
        if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
        return m[1]!.slice(at + 1);
      });

    const master = sheets(reference.renderPdp(snapshot, { origin: "", id: detail.id }));
    const container = await AstroContainer.create();
    const variant = sheets(
      await container.renderToString(PdpDocument, {
        props: { detail },
        partial: false,
      }),
    );
    expect(master.length, "the master links no stylesheets").toBeGreaterThan(5);
    expect(variant).toEqual(master);
    expect(variant).not.toContain("css/components/format-switch.css");
  });
});

/**
 * The PDP PAGE is a faithful pass-through (pdp-variants slice 2 — the
 * editorial page-level test's twin, adopted from the same finding class):
 * the component proof above covers PdpDocument, but the shipped artifact is
 * src/pages/pdp/[slug]/index.astro — its getStaticPaths enumeration and its
 * prop hand-off are otherwise proven only by the plane-dependent suite.
 */
describe("the PDP page passes the baked catalogue through faithfully", () => {
  it("getStaticPaths enumerates EVERY baked detail, slug-keyed, props intact", async () => {
    const bakedPath = join(import.meta.dirname, "..", "src", "data", "pdp.json");
    const baked = JSON.parse(readFileSync(bakedPath, "utf8")) as {
      details: { slug: string; id: number }[];
    };
    const { getStaticPaths } = (await import(
      "../src/pages/pdp/[slug]/index.astro"
    )) as unknown as {
      getStaticPaths: () => { params: { slug: string }; props: { detail: unknown } }[];
    };
    const paths = getStaticPaths();
    expect(paths.length).toBe(baked.details.length);
    expect(paths.length).toBeGreaterThan(0);
    for (const [i, entry] of paths.entries()) {
      expect(entry.params.slug).toBe(baked.details[i]!.slug);
      // Deep, not reference, equality: the page statically imports its own
      // instance of the baked JSON module; this test re-reads the file.
      expect(entry.props.detail).toStrictEqual(baked.details[i]);
    }
  });

  it("the page renders exactly what PdpDocument renders for the same detail", async () => {
    const bakedPath = join(import.meta.dirname, "..", "src", "data", "pdp.json");
    const baked = JSON.parse(readFileSync(bakedPath, "utf8")) as {
      details: { slug: string }[];
    };
    const detail = baked.details[0]!;
    const PdpPage = (await import("../src/pages/pdp/[slug]/index.astro")).default;

    const container = await AstroContainer.create();
    const fromPage = await container.renderToString(PdpPage, {
      props: { detail },
      params: { slug: detail.slug },
      partial: false,
    });
    const fromComponent = await container.renderToString(PdpDocument, {
      props: { detail },
      partial: false,
    });
    const pageDom = normalizeHtml(fromPage);
    expect(pageDom).not.toBe("");
    expect(pageDom).toContain("pm-pdp");
    expect(pageDom).toBe(normalizeHtml(fromComponent));
  });
});

/**
 * The bake IS the catalogue (pdp-variants slice 3, adopted from the slice-2
 * anti-rigging lens): the pass-through test above compares getStaticPaths
 * against pdp.json — the bake's OWN output — so a truncated bake (a
 * debugging .slice(), a "skip zero-image trays" filter, or a deliberate
 * shrink to flatter the build-time paradigm's build/dist cost) would pass
 * every gate while dozens of releases 404 in production. The slice's
 * honesty claim ("building only the bench's handful would be rigging the
 * variant to fit the instrument") is asserted against the committed trays,
 * not restated.
 */
describe("the PDP bake is the whole committed catalogue", () => {
  it("pdp.json IS the committed snapshot — trays verbatim, freeze date included", async () => {
    const bakedPath = join(import.meta.dirname, "..", "src", "data", "pdp.json");
    const baked = JSON.parse(readFileSync(bakedPath, "utf8")) as {
      name: "fixture" | "crate";
      capturedAt: string;
      details: { id: number }[];
    };
    const lib = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
    );
    const committed = lib.loadSnapshot(baked.name) as {
      manifest: { capturedAt: string };
      details: { id: number }[];
    };
    expect(committed.details.length).toBeGreaterThan(0);
    expect(baked.details.length).toBe(committed.details.length);
    // DEEP equality, not an id list (slice-3 anti-rigging lens): the bake
    // writes details.json verbatim, so a field-level shrink — stripped
    // notes, truncated tracklists, dropped images — keeps every id, shrinks
    // dist for the whole catalogue, and would pass an id compare while
    // shipping mutated pages no other gate renders from the bake.
    expect(baked.details).toStrictEqual(committed.details);
    expect(baked.capturedAt).toBe(committed.manifest.capturedAt);
  });
});
