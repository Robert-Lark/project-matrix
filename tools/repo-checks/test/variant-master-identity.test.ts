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
