/**
 * Structural guards for the ADR-0003 invariants this package carries. These
 * are cheap string-level checks on the shipped CSS — the real rendering proof
 * is the drift gate (issue #6); these fail fast when someone breaks the token
 * ARCHITECTURE (tiers, seams, a11y gating) rather than its values.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensCss = readFileSync(join(pkgRoot, "css/tokens.css"), "utf8");
const fontsCss = readFileSync(join(pkgRoot, "css/fonts.css"), "utf8");
const componentFiles = readdirSync(join(pkgRoot, "css/components")).filter(
  (f) => f.endsWith(".css"),
);

describe("two-tier token seam (ADR-0003 §3)", () => {
  it("ships the expected component modules", () => {
    expect(componentFiles.sort()).toEqual([
      "button.css",
      "field.css",
      "release-card.css",
    ]);
  });

  it("component modules consume SEMANTIC tokens only — never a --pm-* primitive", () => {
    for (const file of componentFiles) {
      const css = readFileSync(join(pkgRoot, "css/components", file), "utf8");
      // Primitives (--pm-*) may only be referenced inside tokens.css itself.
      expect(css, `${file} references a primitive token`).not.toMatch(
        /var\(--pm-/,
      );
    }
  });
});

/**
 * Extract the body of an `@media (...)` block bounded by its own braces, so a
 * later block that declares the same tokens can't leak into the match. A plain
 * `split(selector)[1]` runs to EOF (unbounded) and would false-pass if, say, a
 * future dark-mode `@media` after this one re-declared a --color-* token that
 * had been dropped from the forced-colors remap. Returns "" if not found.
 */
function mediaBlock(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at === -1) return "";
  const open = css.indexOf("{", at);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

describe("forced-colors remap is intact at the semantic tier (ADR-0003 §4)", () => {
  it("remaps every --color-* semantic token inside @media (forced-colors: active)", () => {
    // Semantic color tokens declared in the base :root block.
    const declared = [...tokensCss.matchAll(/^\s*(--color-[a-z-]+):/gm)].map(
      (m) => m[1],
    );
    expect(declared.length).toBeGreaterThan(0);

    const forcedBlock = mediaBlock(tokensCss, "@media (forced-colors: active)");
    expect(forcedBlock, "forced-colors block missing").not.toBe("");
    for (const token of new Set(declared)) {
      expect(forcedBlock, `${token} not remapped under forced-colors`).toContain(
        `${token}:`,
      );
    }
  });

  it("remaps to CSS system colors", () => {
    const forcedBlock = mediaBlock(tokensCss, "@media (forced-colors: active)");
    for (const keyword of ["Canvas", "CanvasText", "LinkText", "Highlight"]) {
      expect(forcedBlock).toContain(keyword);
    }
  });
});

describe("reduced-motion gating is intact (ADR-0003 §5)", () => {
  it("collapses the motion semantic tokens under prefers-reduced-motion", () => {
    const reducedBlock = mediaBlock(
      tokensCss,
      "@media (prefers-reduced-motion: reduce)",
    );
    expect(reducedBlock, "reduced-motion block missing").not.toBe("");
    expect(reducedBlock).toContain("--motion-fast:");
    expect(reducedBlock).toContain("--motion-base:");
  });
});

describe("the font as a controlled constant (ADR-0003 §7–§8)", () => {
  it("the @font-face file exists and is self-hosted in this package", () => {
    const src = fontsCss.match(/src:\s*url\("([^"]+)"\)/)?.[1];
    expect(src).toBeDefined();
    expect(existsSync(join(pkgRoot, "css", src!))).toBe(true);
  });

  it("the Catalogue values are poured into the primitive tier (not the placeholder)", () => {
    expect(fontsCss).toContain('font-family: "Familjen Grotesk"');
    expect(tokensCss).toMatch(/--pm-font-ui:\s*"Familjen Grotesk"/);
    expect(tokensCss).toMatch(/--pm-font-metric:\s*"Familjen Grotesk"/);
    // VALUE-level checks, not just label hygiene: a reverted/never-poured
    // palette must fail HERE, not only in the pixel drift gate. Two
    // load-bearing Catalogue primitives (ADR-0006 §1–§2) — the warm-paper
    // surface and the slate-water accent — that differ from the old neutral
    // placeholder (#ffffff / #3b5bdb). Update these two when the palette is
    // re-poured (the drift gate is still the exhaustive proof; these are the
    // cheap static tripwire).
    expect(tokensCss).toMatch(/--pm-neutral-0:\s*#fdfcfa/i);
    expect(tokensCss).toMatch(/--pm-accent-500:\s*#3d5d70/i);
    // Label hygiene: the aesthetic cites its rationale of record and carries
    // no placeholder warning — this inverts the old issue #2 guard, which
    // kept the stand-in labeled until a real decision existed.
    expect(tokensCss).toContain("ADR-0006");
    expect(tokensCss).not.toContain("PLACEHOLDER");
    expect(fontsCss).not.toContain("PLACEHOLDER");
  });

  it("license and loading markup travel with the font files", () => {
    expect(existsSync(join(pkgRoot, "fonts/LICENSE-OFL.txt"))).toBe(true);
    expect(existsSync(join(pkgRoot, "fonts/loading-markup.html"))).toBe(true);
  });

  it("the field error glyph (U+26A0) is wired to a self-hosted fallback face", () => {
    // Regression guard (aesthetic-direction, 2026-07-12): the Catalogue face
    // (Familjen Grotesk) has no U+26A0, but field.css renders the error icon
    // with `content: "\26A0"`. A 1-glyph "PM Warn Glyph" face supplies it via
    // unicode-range so the icon never falls back to a per-OS / colour-emoji
    // glyph (ADR-0001 fairness, ADR-0003 §5 forced-colors). See ADR-0006 §3.
    // This checks the CSS WIRING; that the shipped woff2 actually CONTAINS
    // U+26A0 (not just exists) is pinned in
    // tools/repo-checks/test/font-covers-crate.test.ts via coverage.json.
    const fieldCss = readFileSync(join(pkgRoot, "css/components/field.css"), "utf8");
    const usesWarn = /content:\s*["']\\26A0/i.test(fieldCss);
    if (usesWarn) {
      // the fallback face is declared, scoped to exactly U+26A0, and shipped
      expect(fontsCss).toMatch(/font-family:\s*"PM Warn Glyph"/);
      expect(fontsCss).toMatch(/unicode-range:\s*U\+26A0/i);
      expect(existsSync(join(pkgRoot, "fonts/PMWarnGlyph.U26A0.woff2"))).toBe(true);
      // and it sits in the UI stack behind Familjen (never in front)
      expect(tokensCss).toMatch(/--pm-font-ui:\s*"Familjen Grotesk",\s*"PM Warn Glyph"/);
      // its OFL travels with it (a second font family = a second licence)
      expect(existsSync(join(pkgRoot, "fonts/LICENSE-OFL-Inter.txt"))).toBe(true);
    }
  });
});

describe("no runtime ships from this package (ADR-0003 §1)", () => {
  it("package exports expose only CSS and font assets", () => {
    const pkg = JSON.parse(
      readFileSync(join(pkgRoot, "package.json"), "utf8"),
    ) as { exports: Record<string, string>; main?: string; module?: string };
    expect(pkg.main).toBeUndefined();
    expect(pkg.module).toBeUndefined();
    expect(Object.keys(pkg.exports).sort()).toEqual(["./css/*", "./fonts/*"]);
  });
});
