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
 *  the rest render from the fixture via render/build.mjs). The count is
 *  deliberately NOT written here — it said "eight" through three master
 *  additions (pdp-build made it eleven), so the assertions below derive it
 *  from this list instead. */
const MASTERS = [
  "sample",
  "editorial",
  "pdp",
  // The PDP's three DEGENERATE masters (pdp-build): the common path in both
  // snapshots, and ungated by construction while `build.mjs` rendered only
  // the rich featured release. Each isolates one branch — see
  // `render/lib.mjs` pdpMasterIds.
  "pdp/single-format",
  "pdp/unpriced",
  "pdp/one-image",
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

    // The renderer owns exactly the non-sample masters (derived from MASTERS,
    // never counted by hand).
    expect(Object.keys(rendered).sort()).toEqual(
      MASTERS.filter((s) => s !== "sample")
        .map((s) => `${s}/index.html`)
        .sort(),
    );

    for (const [rel, output] of Object.entries(rendered)) {
      // how-it-was-built reads docs/adr/*.md + docs/build-log.md at render
      // time, so byte-equality here would pin the whole docs tree — and docs
      // change nearly every session in this repo (ADR-0008 landed mid-build
      // of this very test). Judgment call, recorded: every data-rendered
      // master EXCEPT how-it-was-built is regeneration-checked byte-for-byte;
      // how-built is held to its structural markers below and re-rendered
      // when docs move.
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

    // The exemption above buys tolerance for docs PROSE, and it was quietly
    // buying tolerance for a stale INDEX too: this surface generates its
    // build-log list from the phase headings, so adding a phase silently left
    // the committed master a phase behind, with "re-rendered when docs move"
    // as the only thing standing between the record and the page. That is the
    // unguarded-true-statement shape this repo keeps paying for, so the INDEX
    // is pinned even though the prose is not (pdp-controls, 2026-08-15 — the
    // omission that prompted it was this session's own Phase 12).
    const phases = [
      ...readFileSync(join(pkgRoot, "..", "..", "docs", "build-log.md"), "utf8").matchAll(
        /^## Phase (\d+)\b/gm,
      ),
    ].map((m) => m[1]!);
    expect(phases.length, "no phase headings found — the pattern moved").toBeGreaterThan(10);
    for (const n of phases) {
      expect(
        committedHowBuilt,
        `committed how-built is missing Phase ${n} — re-run: node render/build.mjs`,
      ).toContain(`id="phase-${n}"`);
    }
  });
});

describe("the PDP master set gates its three structural branches (pdp-build)", () => {
  // `render/pdp.mjs` takes three STRUCTURAL branches — the format fieldset,
  // the priced/unpriced buy panel, and the thumb list — and `build.mjs`
  // rendered exactly one master (the rich featured release), so all three
  // degenerate arms were ungated by construction while being the COMMON path
  // (crate: single-format 439/500, unpriced 44/500, 1-image 90/500).
  //
  // What is asserted here is the mechanism, not a sentence in a comment:
  // every branch takes BOTH of its values across the master set, each
  // degenerate master differs from the single-format CENTRE by exactly ONE
  // branch, and no two masters render the same release.
  //
  // Deliberately NOT asserted, and both gaps are named rather than implied
  // (verify-slice 2026-08-14 caught the earlier wording overclaiming both):
  //  1. COMBINATION coverage. Three binary axes span 8 combinations; the crate
  //     populates 7 and the fixture 4, against a master set of 4. The counts
  //     are DERIVED below, not typed — an earlier draft said "16", which is
  //     not derivable from anything in the model.
  //  2. The three NON-structural branches pdp.mjs also takes — absent notes,
  //     a null track duration, a null year (see `pdpRenderClass`'s comment).
  //     `pdpRenderClass` does not model them, so no master gates them: 0 of
  //     the 4 fixture masters take any of those arms. Knowingly ungated.
  const load = async () => {
    const lib = await import(
      pathToFileURL(join(pkgRoot, "render", "lib.mjs")).href
    );
    return lib;
  };

  for (const snapshotName of ["fixture", "crate"] as const) {
    it(`${snapshotName}: the four masters are distinct and each isolates one branch`, async () => {
      const lib = await load();
      const snapshot = lib.loadSnapshot(snapshotName);
      const ids: Record<string, number> = lib.pdpMasterIds(snapshot);
      expect(new Set(Object.values(ids)).size).toBe(4);

      const classOf = (slot: string) =>
        lib.pdpRenderClass(lib.detailById(snapshot, ids[slot]));
      const rich = classOf("");
      expect(rich).toEqual({
        formats: "multi",
        priced: "priced",
        gallery: "gallery",
      });

      const differences = (a: Record<string, string>, b: Record<string, string>) =>
        Object.keys(a).filter((k) => a[k] !== b[k]);

      // single-format differs from the rich master by the format branch alone.
      expect(differences(rich, classOf("single-format"))).toEqual(["formats"]);
      // unpriced and one-image each differ from single-format by one branch,
      // so the format branch is held constant while theirs moves.
      const single = classOf("single-format");
      expect(differences(single, classOf("unpriced"))).toEqual(["priced"]);
      expect(differences(single, classOf("one-image"))).toEqual(["gallery"]);
    });

    it(`${snapshotName}: every branch value the snapshot contains is exercised by some master`, async () => {
      const lib = await load();
      const snapshot = lib.loadSnapshot(snapshotName);
      const ids: Record<string, number> = lib.pdpMasterIds(snapshot);
      const masterClasses = Object.values(ids).map((id) =>
        lib.pdpRenderClass(lib.detailById(snapshot, id)),
      );
      for (const axis of ["formats", "priced", "gallery"] as const) {
        const inSnapshot = new Set(
          snapshot.details.map((d: unknown) => lib.pdpRenderClass(d)[axis]),
        );
        const inMasters = new Set(masterClasses.map((c) => c[axis]));
        for (const value of inSnapshot) {
          expect(
            inMasters.has(value),
            `${snapshotName}: releases render ${axis}=${value} but no PDP master does`,
          ).toBe(true);
        }
      }
    });
  }

  it("the combination counts the record quotes are the counts the data has", async () => {
    // The record (ADR-0008, this file's comment above) states how much the
    // master set does NOT cover. That disclaimer is itself a published claim,
    // so it is derived here rather than typed — the failure mode it replaces
    // is the "16 combinations" figure, which matched no snapshot and no model.
    const lib = await load();
    const AXES = 3;
    expect(2 ** AXES).toBe(8); // three binary axes span 8 combinations
    const present = (name: string) =>
      new Set(
        lib
          .loadSnapshot(name)
          .details.map((d: unknown) => lib.pdpRenderClassKey(d)),
      ).size;
    expect(present("fixture")).toBe(4);
    expect(present("crate")).toBe(7);
    // ...and the master set is 4, which is what makes combination coverage a
    // thing the set cannot claim.
    expect(Object.keys(lib.pdpMasterIds(lib.loadSnapshot("fixture"))).length).toBe(4);
  });

  it("the unpriced branch is exactly the zero-stock branch, in both snapshots", async () => {
    // pdp.mjs renders the em-dash amount from `priceFrom == null` and the
    // disabled CTA from `numForSale === 0`. They are two fields, and the
    // degenerate master only gates them TOGETHER — so the equivalence the
    // renderer leans on is asserted against the data itself.
    const lib = await load();
    for (const name of ["fixture", "crate"] as const) {
      const snapshot = lib.loadSnapshot(name);
      const violations = snapshot.details.filter(
        (d: { priceFrom: unknown; numForSale: number }) =>
          (d.priceFrom == null) !== (d.numForSale === 0),
      );
      expect(
        violations.length,
        `${name}: ${violations.length} releases have priceFrom and numForSale disagreeing`,
      ).toBe(0);
    }
  });
});
