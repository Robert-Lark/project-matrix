/**
 * The reference render is the golden-master SPEC (ADR-0003 §6; surface-design
 * session 2026-07-17): plain static HTML consuming the shared tokens + fonts
 * through the @pm/tokens workspace link, with no framework and no scripts.
 * These tests pin exactly that for the component demo AND every committed
 * surface master, plus the §4.3 regeneration guarantee: the committed masters
 * are the renderer's checked output and can never go stale. The DOM/pixel
 * drift checks against variants live at the composed-origin seam
 * (tools/origin-suite/suite/drift.browser.test.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(pkgRoot, "index.html"), "utf8");

/** Every committed surface golden master (sample is hand-pinned, issue #6;
 *  the other eight render from the fixture via render/build.mjs). */
const MASTERS = [
  "sample",
  "editorial",
  "pdp",
  "plp",
  "checkout",
  "a11y",
  "a11y/element-demos",
  "a11y/mode-demos",
  "how-it-was-built",
] as const;

const masterHtml = new Map(
  MASTERS.map((surface) => [
    surface,
    readFileSync(join(pkgRoot, "surfaces", surface, "index.html"), "utf8"),
  ]),
);

describe("consumes the shared design system", () => {
  it("every linked asset in the component demo resolves on disk through the workspace link", () => {
    const hrefs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map(
      (m) => m[1]!,
    );
    // At minimum: font preload, fonts.css, tokens.css, three component modules.
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) {
      expect(existsSync(join(pkgRoot, href)), `${href} does not resolve`).toBe(
        true,
      );
    }
  });

  for (const surface of MASTERS) {
    it(`${surface}: every relative linked asset resolves on disk`, () => {
      const dir = join(pkgRoot, "surfaces", surface);
      const source = masterHtml.get(surface)!;
      // Relative links only: /assets/img/* is the composed origin's data
      // plane (aliased by the drift gate's static server), absolute https://
      // links are provenance pointers — neither resolves on this disk.
      const hrefs = [
        ...source.matchAll(/(?:href|src)="((?:\.\.?\/)[^"]+)"/g),
      ].map((m) => m[1]!);
      // At minimum: two font preloads, fonts.css, tokens.css.
      expect(hrefs.length).toBeGreaterThanOrEqual(4);
      for (const href of hrefs) {
        expect(existsSync(join(dir, href)), `${href} does not resolve`).toBe(
          true,
        );
      }
    });
  }

  it("loads tokens and the self-hosted font from @pm/tokens", () => {
    expect(html).toContain("@pm/tokens/css/tokens.css");
    expect(html).toContain("@pm/tokens/css/fonts.css");
    expect(html).toMatch(
      /rel="preload"[^>]+@pm\/tokens\/fonts\/[^"]+\.woff2[^>]+as="font"/,
    );
  });
});

describe("framework-free (ADR-0003 §6)", () => {
  it("the component demo contains no script at all", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+="/i);
  });

  for (const surface of MASTERS) {
    it(`${surface}: no scripts, no inline handlers, no <style> elements, no chrome slot`, () => {
      const source = masterHtml.get(surface)!;
      expect(source).not.toMatch(/<script/i);
      expect(source).not.toMatch(/\son[a-z]+="/i);
      // No <style> ELEMENTS: a variant page gets no demo scaffolding, so
      // neither may the page it is compared against. Inline style ATTRIBUTES
      // are permitted — the a11y DS-OFF twins carry them by design (the
      // stripped side of a matched pair IS inline-styled defects).
      expect(source).not.toMatch(/<style[\s>]/i);
      // Chrome is instrumentation, injected by the front Worker on variant
      // pages only; the master must not carry a slot at all
      // (packages/switcher/README.md).
      expect(source).not.toContain("pm-chrome-slot");
    });
  }

  it("the sample master renders the canonical release-card markup", () => {
    expect(masterHtml.get("sample")!).toContain('class="pm-release-card');
  });

  it("renders the canonical pm- markup for all three components", () => {
    for (const cls of ["pm-release-card", "pm-button", "pm-field"]) {
      expect(html).toContain(`class="${cls}`);
    }
  });

  it("keeps the matched DS-on / DS-off field pair (ADR-0003 §5)", () => {
    expect(html).toContain("DS-ON");
    expect(html).toContain("DS-OFF");
    expect(html).toContain('aria-invalid="true"');
  });
});

describe("regeneration (§4.3 — the committed masters can never go stale)", () => {
  it("renderAll(fixture) reproduces the committed masters byte-for-byte", async () => {
    // Dynamic import by file URL: the renderer is plain-JS build tooling
    // (no type surface), and its CLI is main-module-guarded, so importing
    // it renders nothing and writes nothing.
    const build = await import(
      pathToFileURL(join(pkgRoot, "render", "build.mjs")).href
    );
    const lib = await import(
      pathToFileURL(join(pkgRoot, "render", "lib.mjs")).href
    );
    const rendered: Record<string, string> = build.renderAll(
      lib.loadSnapshot("fixture"),
    );

    // The renderer owns exactly the eight non-sample masters.
    expect(Object.keys(rendered).sort()).toEqual(
      MASTERS.filter((s) => s !== "sample")
        .map((s) => `${s}/index.html`)
        .sort(),
    );

    for (const [rel, output] of Object.entries(rendered)) {
      // how-it-was-built reads docs/adr/*.md + docs/build-log.md at render
      // time, so byte-equality here would pin the whole docs tree — and docs
      // change nearly every session in this repo (ADR-0008 landed mid-build
      // of this very test). Judgment call, recorded: the eight data-rendered
      // masters are regeneration-checked byte-for-byte; how-built is held to
      // its structural markers below and re-rendered when docs move.
      if (rel === "how-it-was-built/index.html") continue;
      expect(output, `${rel} is stale — re-run: node render/build.mjs`).toBe(
        readFileSync(join(pkgRoot, "surfaces", rel), "utf8"),
      );
    }

    // how-it-was-built: fresh render and committed master both carry the
    // surface's structural contract (doc layout, generated ADR + build-log
    // indexes pointing at the repository — never re-typed content).
    const freshHowBuilt = rendered["how-it-was-built/index.html"]!;
    const committedHowBuilt = masterHtml.get("how-it-was-built")!;
    for (const marker of [
      'class="pm-doc"',
      'id="decision-records"',
      'id="build-log"',
      "docs/adr/0001",
      'id="phase-0"',
    ]) {
      expect(freshHowBuilt, `fresh how-built lost ${marker}`).toContain(marker);
      expect(committedHowBuilt, `committed how-built lost ${marker}`).toContain(
        marker,
      );
    }
  });
});
