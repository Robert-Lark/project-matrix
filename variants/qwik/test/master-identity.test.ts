/**
 * Pre-merge textual identity: this variant's re-implementation vs the reference
 * master, BOTH snapshots (editorial-build slice D; the slice-A/B/C guards close
 * the same hole for their own variants).
 *
 * Why it exists: variant-owned content is re-typed by design (no shared
 * component runtime, ADR-0003 §1) and the browser drift gate polices identity —
 * but CI's browser legs only ever serve the FIXTURE. Crate-flavored text
 * (CRATE_ESSAY and its twin in `src/lib/essays.tsx`) would otherwise first be
 * compared on the deployed plane, AFTER merge, so a one-word crate-copy edit
 * would merge green and turn the post-deploy smoke red — violating the PRD's
 * standing rule. The crate TRAYS are committed, so this guard needs no browser,
 * no server, and no image bytes.
 *
 * The mechanism is Qwik's OWN render-to-string entry point:
 * `renderToString` from `@builder.io/qwik/server`, the same function the
 * streaming server render is built on. That makes this the most direct of the
 * four guards — slice A could call a string-returning render function, slice B
 * had to drive `react-dom/server` over a deliberately framework-neutral module,
 * slice C needed Astro's Container API, and this one just asks the framework to
 * render.
 *
 * Comparison policy is the drift gate's own normalizer (`PAGE_NORMALIZE`), run
 * over `linkedom` instead of a browser — the slice-B precedent, and required
 * here for two reasons a byte-compare could not survive: Qwik emits `class`
 * after an element's other attributes, and every `component$` host carries a
 * `q:key`. Both are exactly what `PERMITTED_NOISE["qwik"]` and the normalizer's
 * attribute sorting exist to forgive, and nothing beyond the ADR-0008 freedoms
 * is forgiven.
 *
 * ── Disclosed scope ──
 * This renders the SHELL + ARTICLE, wrapped in a hand-authored
 * `<html lang="en"><head></head><body>…</body></html>` (the slice-B guard's
 * shape). It therefore does not prove the `<html>`/`<body>` attributes or the
 * `<head>` contents — those come from `root.tsx` and `entry.ssr.tsx` and are
 * proven against the SERVED page by the drift gate and editorial.test.ts, in
 * both snapshot modes. What this guard is for is the crate-flavoured COPY, and
 * copy lives in the article.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { jsx } from "@builder.io/qwik";
import { renderToString } from "@builder.io/qwik/server";
import {
  NO_NOISE,
  PAGE_NORMALIZE,
  PERMITTED_NOISE,
  firstDomDivergence,
  type NoiseSpec,
} from "@pm/drift-gate";
import { EditorialArticle } from "../src/components/EditorialArticle";
import { Shell } from "../src/components/Shell";
import { projectFeatured } from "../src/lib/edge";
import { essayFor } from "../src/lib/essays";
import { featuredIdFor, isFixtureCrate } from "../src/lib/snapshot";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const QWIK_NOISE = PERMITTED_NOISE["qwik"]!;
/** The element `renderToString` wraps the rendered fragment in — unwrapped
 *  before normalizing, so the comparison sees the master's own tree depth. */
const CONTAINER = "body > div[q\\:container]";

/**
 * `PAGE_NORMALIZE` is written to run INSIDE a driven browser page — it is
 * self-contained by construction and reads `document`/`Node` as globals rather
 * than parameters. linkedom supplies same-shape globals for a plain HTML
 * string; install them for the one synchronous call, then restore.
 */
function normalizeHtml(html: string, noise: NoiseSpec, unwrap?: string): string {
  const { document, Node } = parseHTML(html);
  if (unwrap !== undefined) {
    // Replace the render's container element with its own children — a DOM
    // operation rather than string surgery, so the surrounding indentation the
    // normalizer emits is computed from the real tree depth.
    const container = document.querySelector(unwrap);
    if (container === null) throw new Error(`no ${unwrap} to unwrap`);
    container.replaceWith(...container.childNodes);
  }
  const g = globalThis as unknown as { document?: unknown; Node?: unknown };
  const prevDocument = g.document;
  const prevNode = g.Node;
  g.document = document;
  g.Node = Node;
  try {
    return PAGE_NORMALIZE({
      attrPatterns: [...noise.attrPatterns],
      classPatterns: [...noise.classPatterns],
      behaviorAttrPatterns: [...noise.behaviorAttrPatterns],
      dropElementSelectors: noise.dropElementSelectors ? [...noise.dropElementSelectors] : [],
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

interface Snapshot {
  manifest: { crate: string; capturedAt: string };
  details: { id: number }[];
}

async function loadSnapshot(name: "fixture" | "crate"): Promise<Snapshot> {
  // Plain-JS build tooling with a main-module-guarded CLI — importing renders
  // and writes nothing (the @pm/reference regeneration test's own pattern).
  const lib = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
  );
  return lib.loadSnapshot(name) as Snapshot;
}

/** Render the variant's own components for one snapshot's data, exactly as the
 *  route does — same projection function, same essay selector, same featured-id
 *  policy, so a divergence here is a divergence in what ships. */
async function renderVariant(snapshot: Snapshot): Promise<string> {
  const crate = snapshot.manifest.crate;
  const id = featuredIdFor(crate);
  const detail = snapshot.details.find((d) => d.id === id);
  if (!detail) throw new Error(`no detail tray for id ${id}`);

  const article = jsx(EditorialArticle, {
    essay: essayFor(isFixtureCrate(crate)),
    featured: projectFeatured(detail as never),
    capturedAt: snapshot.manifest.capturedAt,
  });
  const { html } = await renderToString(jsx(Shell, { current: "editorial", children: article }), {
    // A fragment container. `containerTagName: "body"` would be the tidier
    // shape but Qwik rejects it ("<body> can not be rendered because its parent
    // is not a <html> element"), so the container is a `<div>` that
    // `normalizeHtml` unwraps below — the real container element on the served
    // page is `<html>`, and this guard makes no claim about it.
    containerTagName: "div",
    qwikLoader: { include: "never" },
    // Qwik serializes every resumable handler as "<chunk>#<symbol>", and
    // outside a production build no chunk exists — the render aborts with
    // "QRLs can not be dynamically resolved, because it does not have a chunk
    // path". `symbolMapper` is the documented hook for supplying that mapping,
    // and a deterministic stub is the honest choice HERE: bundle layout is a
    // build concern this guard makes no claim about, and a fixed name keeps the
    // emitted `on:*` values stable across runs. What the real chunk names are is
    // proven against the SERVED page by editorial.test.ts, which fetches every
    // chunk an `on:*` attribute actually names.
    symbolMapper: (symbolName) => [symbolName, `test-chunk.js#${symbolName}`],
  });
  return `<!doctype html><html lang="en"><head></head><body>${html}</body></html>`;
}

describe("qwik editorial equals the master by normalized DOM, both snapshots (pre-merge)", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: the rendered components match renderEditorial`, async () => {
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      const snapshot = await loadSnapshot(name);
      const master = reference.renderEditorial(snapshot, { origin: "" });
      expect(master).not.toBe("");

      const variant = await renderVariant(snapshot);
      const masterDom = normalizeHtml(master, NO_NOISE);
      const variantDom = normalizeHtml(variant, QWIK_NOISE, CONTAINER);
      expect(variantDom).not.toBe("");
      expect(variantDom).toContain("pm-editorial");
      if (variantDom !== masterDom) {
        // The CI-log evidence: the gate's own first-divergence formatter.
        console.error(firstDomDivergence(masterDom, variantDom));
      }
      expect(variantDom).toBe(masterDom);
    });
  }

  it("the two snapshots really do render DIFFERENT prose (this guard is not vacuous)", async () => {
    // If both flavors somehow resolved to the same essay, the crate leg above
    // would be proving the fixture twice and the whole point would be lost.
    const fixture = await loadSnapshot("fixture");
    const crate = await loadSnapshot("crate");
    expect(crate.manifest.crate).not.toBe(fixture.manifest.crate);
    expect(isFixtureCrate(fixture.manifest.crate)).toBe(true);
    expect(isFixtureCrate(crate.manifest.crate)).toBe(false);
    expect(essayFor(true).title).not.toBe(essayFor(false).title);
  });

  it("the registered noise is what makes the comparison pass — not the normalizer alone", async () => {
    // Non-vacuity for the registration, in the one place it can be shown
    // without a browser: the SAME rendered markup must FAIL under NO_NOISE.
    // Otherwise a registration that had gone empty or wrong would still let
    // this guard pass, and the guard would stop defending anything.
    const snapshot = await loadSnapshot("fixture");
    const variant = await renderVariant(snapshot);
    const stripped = normalizeHtml(variant, QWIK_NOISE, CONTAINER);
    const unstripped = normalizeHtml(variant, NO_NOISE, CONTAINER);
    expect(unstripped).not.toBe(stripped);
    expect(unstripped).toMatch(/q:key=|on:click=/);
  });
});

/**
 * The PDP's version of the guard (pdp-variants slice 3) — the same
 * renderToString mechanism, over EVERY detail tray in BOTH snapshots (the
 * unit's standing shape: 740 pages, covering the render-class combinations
 * the crate has and the fixture does not, plus the three KNOWINGLY UNGATED
 * arms — absent notes, null duration, null year — that no committed master
 * exercises). Same disclosed scope as the editorial guard: shell + article;
 * the head/html attributes are proven against the SERVED page by the drift
 * gate and pdp.test.ts.
 */
async function renderVariantPdp(detail: unknown): Promise<string> {
  const { projectPdpDetail } = await import("../src/lib/edge");
  const { PdpArticle } = await import("../src/components/PdpArticle");
  const article = jsx(PdpArticle, {
    detail: projectPdpDetail(detail as never),
  });
  const { html } = await renderToString(jsx(Shell, { current: "plp", children: article }), {
    containerTagName: "div",
    qwikLoader: { include: "never" },
    symbolMapper: (symbolName) => [symbolName, `test-chunk.js#${symbolName}`],
  });
  return `<!doctype html><html lang="en"><head></head><body>${html}</body></html>`;
}

describe("qwik's PDP equals the master by normalized DOM, every tray, both snapshots", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: Shell+PdpArticle matches renderPdp for every detail tray`, async () => {
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
      );
      const snapshot = await loadSnapshot(name);
      expect(snapshot.details.length).toBeGreaterThan(0);

      const mismatched: number[] = [];
      for (const detail of snapshot.details) {
        const master = normalizeHtml(
          reference.renderPdp(snapshot, { origin: "", id: detail.id }),
          NO_NOISE,
        );
        const variant = normalizeHtml(await renderVariantPdp(detail), QWIK_NOISE, CONTAINER);
        if (variant !== master) {
          if (mismatched.length === 0) console.error(firstDomDivergence(master, variant));
          mismatched.push(detail.id);
        }
      }
      expect(mismatched, `${mismatched.length} of ${snapshot.details.length} PDP pages drifted`).toEqual([]);

      // Non-vacuity (the unit's standing rule): real PDP markup was compared,
      // the fenced plaque rode the comparison on both sides (CANONICAL
      // content here — never dropped), and the format CONTROL stays gone
      // while the format DATA survives (ADR-0008 addendum A).
      const sample = normalizeHtml(
        await renderVariantPdp(snapshot.details[0]),
        QWIK_NOISE,
        CONTAINER,
      );
      expect(sample).toContain("pm-pdp");
      expect(sample).toContain("pm-gallery__zoom");
      expect(sample).toContain("data-pm-fenced");
      expect(sample).not.toContain("pm-format");
    }, 60_000);
  }

  /**
   * The stylesheet LIST — the axis root.tsx's surface pick parameterises.
   * The guard compares the exported PDP_STYLESHEETS map (the single source
   * root.tsx renders from) against the master's tails; the SERVED head is
   * proven by pdp.test.ts's stylesheet leg on the plane.
   */
  it("root.tsx's PDP stylesheet map is exactly the master's list, in order", async () => {
    const { PDP_STYLESHEETS } = await import("../src/lib/stylesheets");
    const reference = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
    );
    const snapshot = await loadSnapshot("fixture");
    const master = [
      ...reference
        .renderPdp(snapshot, { origin: "", id: snapshot.details[0]!.id })
        .matchAll(/<link rel="stylesheet" href="([^"]+)"/g),
    ].map((m: RegExpMatchArray) => {
      const at = m[1]!.lastIndexOf("/css/");
      return m[1]!.slice(at + 5);
    });
    // The master's first sheet is fonts.css, which root.tsx authors beside
    // the preloads (the canonical font markup) rather than in the map.
    expect(master[0]).toBe("fonts.css");
    expect(PDP_STYLESHEETS).toEqual(master.slice(1));
    expect(PDP_STYLESHEETS).not.toContain("components/format-switch.css");
  });
});
