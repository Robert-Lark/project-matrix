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
import { parseHTML } from "linkedom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_NOISE, PAGE_NORMALIZE, PERMITTED_NOISE, type NoiseSpec } from "@pm/drift-gate";

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

/**
 * The PDP's version of the vanilla guard — and the one that would have caught
 * the pdp-controls unit's whole reason for existing.
 *
 * The editorial guard above compares ONE page per snapshot, because editorial
 * IS one page. The PDP is ~500, and the four committed masters cover four of
 * the eight render classes `pdpRenderClass` can express. So this loops EVERY
 * detail tray in both snapshots rather than only `pdpMasterIds` — 740 pages,
 * cheap because neither renderer needs a browser, a server or an image byte,
 * and it covers the render-class combinations the crate has and the fixture
 * does not.
 *
 * Why it did not exist before: `@pm/vanilla` contributes ZERO tasks to
 * turbo's 30 (`pnpm exec turbo run lint typecheck test --dry=json` → 75
 * nodes, 30 with a real command, `@pm/vanilla#test`/`#typecheck` both
 * `<NONEXISTENT>`), and no test anywhere read `renderPdpPage`. "Turbo 30/30
 * on the final tree" had therefore never covered this variant at all, and the
 * 740 pages matching was an UNGUARDED true statement — which by this repo's
 * standard is the defect, not the reassurance. This guard lives in
 * `@pm/repo-checks`, whose `test` script IS one of the 30, so it blocks a
 * merge the way the editorial ones do.
 *
 * What it cannot see, recorded so nobody mistakes its scope: it compares
 * SERVED MARKUP, JS-off. Both of the dead controls this unit repaired were
 * dead only with JS ON — the markup was correct and identical on both sides
 * the whole time. That blind spot is closed separately, by
 * `tools/origin-suite/suite/pdp-controls.browser.test.ts`.
 */
describe("vanilla's PDP equals the master textually, every tray, both snapshots", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: renderPdpPage matches renderPdp for every detail tray`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
      );
      const vanilla = await import(
        pathToFileURL(join(repoRoot, "variants", "vanilla", "render.mjs")).href
      );

      const snapshot = lib.loadSnapshot(name);
      const details = snapshot.details as { id: number }[];
      expect(details.length).toBeGreaterThan(0);

      // `renderPdp`'s default extraDepth is 0 → depth 2, which is the depth
      // `build.mjs` writes vanilla's pages at (/vanilla/pdp/{slug}/). Passing
      // it explicitly on the variant side keeps the two derivations visible
      // side by side rather than agreeing by default.
      const mismatched: number[] = [];
      for (const detail of details) {
        const master = stripDelivery(reference.renderPdp(snapshot, { origin: "", id: detail.id }));
        const variant = stripDelivery(vanilla.renderPdpPage(snapshot, detail, { depth: 2 }));
        if (variant !== master) mismatched.push(detail.id);
      }
      expect(mismatched, `${mismatched.length} of ${details.length} PDP pages drifted`).toEqual([]);

      // Non-vacuity: the loop above passes trivially if either renderer
      // returns "" for everything, and it would have passed identically on
      // the tree that shipped two dead controls. Pin that real PDP markup was
      // compared, and that the format CONTROL is gone from both sides while
      // the format DATA survives on both (ADR-0008 addendum A).
      const sample = stripDelivery(
        vanilla.renderPdpPage(snapshot, details[0], { depth: 2 }),
      );
      expect(sample).toContain("pm-pdp");
      expect(sample).toContain("pm-gallery__zoom");
      expect(sample).toContain("<dt>Format</dt>");
      expect(sample).not.toContain("pm-format");
    });
  }

  /**
   * The STYLESHEET LIST, which `stripDelivery` deliberately throws away.
   *
   * That strip is right for markup — the head is a delivery freedom — but it
   * means nothing in the repo compared which sheets a variant links against
   * which sheets the master links, and this unit changed exactly that axis:
   * `components/format-switch.css` left the PDP's list when the control was
   * cut. Had `pdp.mjs` dropped it and `variants/vanilla/render.mjs` kept it,
   * every check would have stayed green while the variant shipped a sheet of
   * dead rules — or, in the other direction, shipped a page missing the rules
   * its markup depends on, which is the `.pm-sr-only` failure mode one level
   * up.
   *
   * Compared by the tail after `css/`, because the two sides legitimately
   * differ in how they REACH the package: the master walks up to
   * `node_modules/@pm/tokens/css/…`, the variant serves its own copied tree at
   * `assets/pm/css/…`. Order is compared too — cascade order is a rendering
   * property, not a freedom.
   */
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: vanilla's PDP links exactly the master's stylesheets, in order`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
      );
      const vanilla = await import(
        pathToFileURL(join(repoRoot, "variants", "vanilla", "render.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      const detail = (snapshot.details as { id: number }[])[0]!;

      const sheets = (html: string): string[] =>
        [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => {
          const at = m[1]!.lastIndexOf("/css/");
          if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
          return m[1]!.slice(at + 1);
        });

      const master = sheets(reference.renderPdp(snapshot, { origin: "", id: detail.id }));
      const variant = sheets(vanilla.renderPdpPage(snapshot, detail, { depth: 2 }));
      expect(master.length, "the master links no stylesheets").toBeGreaterThan(5);
      expect(variant).toEqual(master);
      // The cut control's sheet is gone from BOTH, and the guard would notice
      // if it returned to either (ADR-0008 addendum A).
      expect(master).not.toContain("css/components/format-switch.css");
      expect(variant).not.toContain("css/components/format-switch.css");
    });
  }

  /**
   * Slug uniqueness, per snapshot. Three derivations now lean on it without
   * saying so (verify-slice, pdp-variants slice 2): vanilla's build writes
   * dist/pdp/{slug}/ per detail (a duplicate silently overwrites a page),
   * astro's getStaticPaths mints a route per slug (a duplicate is a build
   * error at best), and the request-time variants resolve slug → id assuming
   * one answer. An unguarded true statement is this repo's definition of a
   * defect, so the assumption is asserted where every tray already loads.
   */
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: detail slugs are unique`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const details = lib.loadSnapshot(name).details as { slug: string }[];
      expect(details.length).toBeGreaterThan(0);
      expect(new Set(details.map((d) => d.slug)).size).toBe(details.length);
    });
  }

  /**
   * The masters are a SUBSET of what the loop above covers, but they are the
   * only PDP pages the browser drift gate ever opens — so their four render
   * classes are pinned by id here too. A master silently resolving to a
   * release of the wrong class would leave the gate comparing four pages of
   * the same shape while still passing.
   */
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: each committed PDP master still renders its own class`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      const ids: Record<string, number> = lib.pdpMasterIds(snapshot);
      const classes = Object.fromEntries(
        Object.entries(ids).map(([slot, id]) => [
          slot,
          lib.pdpRenderClassKey(lib.detailById(snapshot, id)),
        ]),
      );
      expect(new Set(Object.values(classes)).size).toBe(Object.keys(ids).length);
      expect(classes[""]).toContain("multi/");
      expect(classes["single-format"]).toBe("single/priced/gallery");
      expect(classes["unpriced"]).toBe("single/unpriced/gallery");
      expect(classes["one-image"]).toBe("single/priced/one-image");
    });
  }

  /**
   * `formatComposition` and capture-time `normalize.ts` build a format string
   * from the same tray by the same rule, in two different repos' worth of
   * code — the "second derivation is a second opinion" class. For a single
   * component of quantity 1 they must produce the IDENTICAL string (that
   * equality is why cutting the format control left 309 of the crate's 500
   * PDP meta lines byte-unchanged while 191 moved — 439 is the single-format
   * COUNT, a different number, and an earlier draft of this comment confused
   * them), and for quantity > 1 the composition must differ by exactly the
   * prefix `format` drops.
   */
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: formatComposition agrees with the tray's own format field`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      type Detail = { format: string; formats: { name: string; qty: number }[] };
      const singles = (snapshot.details as Detail[]).filter((d) => d.formats.length === 1);
      expect(singles.length).toBeGreaterThan(0);
      let plain = 0;
      let quantified = 0;
      for (const d of singles) {
        const composed = lib.formatComposition(d.formats);
        if (d.formats[0]!.qty > 1) {
          expect(composed).toBe(`${d.formats[0]!.qty} × ${d.format}`);
          quantified += 1;
        } else {
          expect(composed).toBe(d.format);
          plain += 1;
        }
      }
      // NOT `plain + quantified === singles.length` — every iteration
      // increments exactly one counter, so that holds whatever
      // formatComposition returns. Assert the COVERAGE each snapshot actually
      // provides instead: both arms are exercised on the crate, and the
      // fixture provably exercises only the plain one, which is why the crate
      // leg is the load-bearing half of this pair.
      expect(plain).toBeGreaterThan(0);
      if (name === "crate") {
        expect(quantified, "the crate must exercise the N × arm").toBe(130);
      } else {
        expect(quantified, "the fixture has no single-format release with qty > 1").toBe(0);
      }
    });
  }
});

/**
 * htmx's version of the same guard (editorial-build slice E) — the vanilla
 * MECHANISM exactly (byte-strict after the delivery strip), because the
 * renderer is the same species: plain template literals mirroring the
 * master's serialization, importable directly with no framework runtime.
 * The one shape difference is the data: htmx is REQUEST-TIME, so its
 * renderer takes the resolved per-request data ({ isFixture, capturedAt,
 * featured DETAIL tray }) rather than a whole snapshot — this guard
 * assembles that from the committed trays, which also proves per snapshot
 * that the release card's fields are tray-identical between the summary
 * (what the master renders from) and the detail (what htmx renders from)
 * rather than assuming it.
 */
describe("htmx editorial equals the master textually, both snapshots (pre-merge)", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: renderEditorialPage matches renderEditorial after the delivery strip`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      const htmx = await import(
        pathToFileURL(join(repoRoot, "variants", "htmx", "src", "render.mjs")).href
      );

      // The featured-id and essay-selection POLICY is derived through the
      // variant's OWN runtime module (src/snapshot.mjs), not this file's
      // local constants — otherwise the one module production actually
      // executes would never run pre-merge, and a typo'd crate id or an
      // inverted isFixtureCrate would merge green and turn the deployed
      // smoke red (verify-slice finding, anti-rigging lens). Both are
      // still cross-checked against the recorded constants, so a policy
      // drift and a constant drift each fail loudly.
      const policy = await import(
        pathToFileURL(join(repoRoot, "variants", "htmx", "src", "snapshot.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      const master = stripDelivery(reference.renderEditorial(snapshot, { origin: "" }));
      const id = policy.featuredIdFor(snapshot.manifest.crate);
      expect(id).toBe(featuredId(name));
      const isFixture = policy.isFixtureCrate(snapshot.manifest.crate);
      expect(isFixture).toBe(name === "fixture");
      const featured = snapshot.details.find((d: { id: number }) => d.id === id);
      if (!featured) throw new Error(`${name}: no detail tray for id ${id}`);
      const variant = stripDelivery(
        htmx.renderEditorialPage({
          isFixture,
          capturedAt: snapshot.manifest.capturedAt,
          featured,
        }),
      );
      expect(variant).not.toBe("");
      expect(variant).toContain("pm-editorial");
      expect(variant).toBe(master);
    });
  }
});

/**
 * react-next's version of the same guard (editorial-build slice B) — same
 * hole to close (a crate-copy edit merging green, unproven until the
 * deployed smoke), different mechanism by necessity: vanilla's guard calls
 * a render function that returns a byte-exact string, because vanilla's
 * hand-typed template mirrors the master's serialization directly. A JSX
 * renderer never will — attribute order, quoting, and boolean-attribute
 * serialization are React's call, not this file's — so a byte-strict
 * compare would fail on cosmetic differences that carry zero content risk,
 * defeating the point of a targeted crate-text guard.
 *
 * Instead this reuses the ACTUAL drift-gate normalizer (tools/drift-gate),
 * the same policy the browser-driven composed-origin leg holds every
 * variant to, run here via `linkedom` instead of a browser: no server, no
 * network, no image bytes — render.tsx is plain framework-neutral React,
 * callable with `react-dom/server` directly, exactly like vanilla's
 * render.mjs is callable directly. One registration
 * (`PERMITTED_NOISE["react-next"]`), one normalizer, on both mechanisms.
 */
describe("react-next editorial equals the master by normalized DOM, both snapshots (pre-merge)", () => {
  const REACT_NEXT_NOISE = PERMITTED_NOISE["react-next"]!;

  /** A real browser's HTML tokenizer lowercases attribute names during
   *  parsing (the HTML spec's tokenization algorithm); linkedom's parser
   *  does not (verified: `<time dateTime="...">` parses with attribute
   *  name `dateTime`, not `datetime`). React's `dateTime` JSX prop is
   *  correct — a real browser (the drift gate's Playwright leg) sees the
   *  spec-correct lowercase attribute — so this is a linkedom parsing gap,
   *  not a real page difference; corrected once, pre-normalize, rather
   *  than treated as content drift or "fixed" by mangling correct JSX. */
  function lowercaseAttributeNames(document: ReturnType<typeof parseHTML>["document"]): void {
    for (const el of document.querySelectorAll("*")) {
      for (const attr of [...el.attributes]) {
        const lower = attr.name.toLowerCase();
        if (lower !== attr.name) {
          const value = attr.value;
          el.removeAttribute(attr.name);
          el.setAttribute(lower, value);
        }
      }
    }
  }

  /** PAGE_NORMALIZE (tools/drift-gate/src/normalize.ts) is written to run
   *  inside a driven browser page — self-contained, referencing `document`/
   *  `Node` as globals rather than parameters. linkedom provides a
   *  same-shape `document`/`Node` for a plain HTML string; this temporarily
   *  installs them as globals for the one synchronous call, then restores
   *  whatever was there (nothing, outside a browser test file). */
  function normalizeHtml(html: string, noise: NoiseSpec): string {
    const { document, Node } = parseHTML(html);
    lowercaseAttributeNames(document);
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

  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: react-next's render.tsx matches renderEditorial by normalized DOM`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      // render.tsx is deliberately framework-neutral (relative imports
      // throughout, no Next-specific API) so it's importable from outside
      // its own workspace's tsconfig path mapping — DIFF-TO-STARTER.md.
      const reactNext = await import(
        pathToFileURL(
          join(repoRoot, "variants", "react-next", "src", "lib", "render.tsx"),
        ).href
      );
      const snapshot = lib.loadSnapshot(name);
      const master = reference.renderEditorial(snapshot, { origin: "" });
      expect(master).not.toBe("");

      const id = featuredId(name);
      const featured = snapshot.details.find((d: { id: number }) => d.id === id);
      if (!featured) throw new Error(`${name}: no detail tray for id ${id}`);
      const essay = reactNext.essayFor(snapshot.manifest.crate);
      const body = renderToStaticMarkup(
        createElement(
          reactNext.Shell,
          { current: "editorial" },
          createElement(reactNext.EditorialArticle, {
            essay,
            featured,
            capturedAt: snapshot.manifest.capturedAt,
          }),
        ),
      );
      const variant = `<!doctype html><html lang="en"><head></head><body>${body}</body></html>`;

      const masterDom = normalizeHtml(master, NO_NOISE);
      const variantDom = normalizeHtml(variant, REACT_NEXT_NOISE);
      expect(variantDom).not.toBe("");
      expect(variantDom).toContain("pm-editorial");
      expect(variantDom).toBe(masterDom);
      // Non-vacuity check for the noise registration itself: renderToStaticMarkup
      // is a synchronous, non-streaming render, so it never produces the
      // `<div hidden><!--$--><!--/$--></div>` wrapper the REAL served page
      // carries (drift.browser.test.ts's browser leg proves that page-level
      // fact) — meaning `variant` above never exercises
      // REACT_NEXT_NOISE.dropElementSelectors, and a typo'd selector, or a
      // future Next/OpenNext version reshaping the wrapper, would pass this
      // guard silently (verify-slice finding). Proven separately, below.
    });
  }

  /**
   * NOTE — astro's equivalent guard is deliberately NOT in this file
   * (editorial-build slice C). It closes the same hole for the same reason,
   * but through Astro's own render-to-string entry point: the Container API
   * (`experimental_AstroContainer` from `astro/container`), which needs
   * Astro's compiler to load a `.astro` component and therefore needs
   * `getViteConfig` in the vitest config. Adding that here would route every
   * repo-wide structural check in this workspace through Astro's Vite plugin,
   * so an Astro upgrade could break guards with nothing to do with Astro.
   * It lives at `variants/astro/test/master-identity.test.ts`, reuses this
   * same `PAGE_NORMALIZE`-over-linkedom policy, and is still reached
   * pre-merge by the `check` job (`turbo run lint typecheck test`) with
   * `@pm/astro#test` declared `cache: false` for the same
   * under-declarable-inputs reason `@pm/repo-checks#test` is.
   */
  /**
   * The react-next PDP — the same hole the vanilla PDP guard closes (every
   * tray, both snapshots; the crate's render-class combinations the fixture
   * lacks), through this describe's normalized-DOM mechanism (JSX owns
   * attribute order and entity forms, so vanilla's byte-strict compare is
   * unavailable by construction). renderToStaticMarkup renders the client
   * islands' SERVER output, which is exactly the page the drift gate sees
   * JS-off.
   */
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: react-next's PdpArticle matches renderPdp by normalized DOM, every tray`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
      );
      const reactNext = await import(
        pathToFileURL(
          join(repoRoot, "variants", "react-next", "src", "lib", "render.tsx"),
        ).href
      );
      const reactNextPdp = await import(
        pathToFileURL(
          join(repoRoot, "variants", "react-next", "src", "lib", "pdp.tsx"),
        ).href
      );
      const snapshot = lib.loadSnapshot(name);
      const details = snapshot.details as { id: number }[];
      expect(details.length).toBeGreaterThan(0);

      const mismatched: number[] = [];
      for (const detail of details) {
        const master = normalizeHtml(
          reference.renderPdp(snapshot, { origin: "", id: detail.id }),
          NO_NOISE,
        );
        const body = renderToStaticMarkup(
          createElement(
            reactNext.Shell,
            { current: "plp" },
            createElement(reactNextPdp.PdpArticle, { detail }),
          ),
        );
        const variant = normalizeHtml(
          `<!doctype html><html lang="en"><head></head><body>${body}</body></html>`,
          REACT_NEXT_NOISE,
        );
        if (variant !== master) mismatched.push(detail.id);
      }
      expect(mismatched, `${mismatched.length} of ${details.length} PDP pages drifted`).toEqual([]);

      // Non-vacuity (the vanilla guard's own rule): pin that real PDP markup
      // was compared, the fenced plaque is present ON BOTH SIDES (core PDP
      // comparisons never drop it — it is canonical master content here,
      // unlike editorial), and the format CONTROL stays gone while the
      // format DATA survives (ADR-0008 addendum A).
      const sample = normalizeHtml(
        `<!doctype html><html lang="en"><head></head><body>${renderToStaticMarkup(
          createElement(
            reactNext.Shell,
            { current: "plp" },
            createElement(reactNextPdp.PdpArticle, { detail: details[0] }),
          ),
        )}</body></html>`,
        REACT_NEXT_NOISE,
      );
      expect(sample).toContain("pm-pdp");
      expect(sample).toContain("pm-gallery__zoom");
      expect(sample).toContain("data-pm-fenced");
      expect(sample).toContain("Format");
      expect(sample).not.toContain("pm-format");
      // These catalogue sweeps render every tray twice and compare normalized
      // DOM; the budget exists to catch a HANG, not to race the runner, so it
      // is the bench-runner's 300_000 rather than a figure fitted to the
      // measured time. Measured: 878 ms (fixture) / 1,771 ms (crate) locally
      // against 9,648/8,903 ms on ubuntu-latest, where vitest's 5 s default
      // failed PR #30's check job and skipped the deploy (run 33132628047).
      // The runner is ~9× this machine, derived from a test that ran GREEN in
      // that same run (@pm/reference renderAll: 450 ms CI / 50 ms local) —
      // the timed-out numbers above are lower bounds and cannot give a ratio.
    }, 300_000);
  }

  /**
   * The stylesheet LIST, which the normalized-DOM compare above throws away
   * with the head. The vanilla PDP has the byte-level version of this leg;
   * react-next's document head is a component (src/lib/document.tsx), so the
   * leg renders it and compares sheet tails after `/css/` — order included,
   * because cascade order is a rendering property, not a freedom.
   */
  it("react-next's PDP document links exactly the master's stylesheets, in order", async () => {
    const lib = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
    );
    const reference = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "pdp.mjs")).href
    );
    const documentModule = await import(
      pathToFileURL(
        join(repoRoot, "variants", "react-next", "src", "lib", "document.tsx"),
      ).href
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
    const variant = sheets(
      renderToStaticMarkup(
        createElement(documentModule.Document, { css: documentModule.PDP_CSS }, null),
      ),
    );
    expect(master.length, "the master links no stylesheets").toBeGreaterThan(5);
    expect(variant).toEqual(master);
    expect(variant).not.toContain("css/components/format-switch.css");
  });

  it("REACT_NEXT_NOISE.dropElementSelectors actually matches the App Router streaming wrapper", () => {
    const withWrapper = normalizeHtml(
      '<!doctype html><html lang="en"><body><div hidden><!--$--><!--/$--></div><p>content</p></body></html>',
      REACT_NEXT_NOISE,
    );
    const withoutWrapper = normalizeHtml(
      '<!doctype html><html lang="en"><body><p>content</p></body></html>',
      NO_NOISE,
    );
    expect(withWrapper).not.toContain("hidden");
    expect(withWrapper).toBe(withoutWrapper);
  });
});
