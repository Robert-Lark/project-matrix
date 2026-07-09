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

describe("forced-colors remap is intact at the semantic tier (ADR-0003 §4)", () => {
  it("remaps every --color-* semantic token inside @media (forced-colors: active)", () => {
    // Semantic color tokens declared in the base :root block.
    const declared = [...tokensCss.matchAll(/^\s*(--color-[a-z-]+):/gm)].map(
      (m) => m[1],
    );
    expect(declared.length).toBeGreaterThan(0);

    const forcedBlock = tokensCss.split("@media (forced-colors: active)")[1];
    expect(forcedBlock, "forced-colors block missing").toBeDefined();
    for (const token of new Set(declared)) {
      expect(forcedBlock, `${token} not remapped under forced-colors`).toContain(
        `${token}:`,
      );
    }
  });

  it("remaps to CSS system colors", () => {
    const forcedBlock = tokensCss.split("@media (forced-colors: active)")[1] ?? "";
    for (const keyword of ["Canvas", "CanvasText", "LinkText", "Highlight"]) {
      expect(forcedBlock).toContain(keyword);
    }
  });
});

describe("reduced-motion gating is intact (ADR-0003 §5)", () => {
  it("collapses the motion semantic tokens under prefers-reduced-motion", () => {
    const reducedBlock = tokensCss.split(
      "@media (prefers-reduced-motion: reduce)",
    )[1];
    expect(reducedBlock, "reduced-motion block missing").toBeDefined();
    expect(reducedBlock).toContain("--motion-fast:");
    expect(reducedBlock).toContain("--motion-base:");
  });
});

describe("placeholder font as a controlled constant (ADR-0003 §7–§8)", () => {
  it("the @font-face file exists and is self-hosted in this package", () => {
    const src = fontsCss.match(/src:\s*url\("([^"]+)"\)/)?.[1];
    expect(src).toBeDefined();
    expect(existsSync(join(pkgRoot, "css", src!))).toBe(true);
  });

  it("the face is poured into the primitive tier and labeled placeholder", () => {
    expect(fontsCss).toContain('font-family: "PM Placeholder Sans"');
    expect(tokensCss).toMatch(/--pm-font-ui:\s*"PM Placeholder Sans"/);
    expect(tokensCss).toMatch(/--pm-font-metric:\s*"PM Placeholder Sans"/);
    // The placeholder labeling must survive edits — it's what makes the
    // aesthetic clearly a stand-in (issue #2 acceptance).
    expect(tokensCss).toContain("PLACEHOLDER");
    expect(fontsCss).toContain("PLACEHOLDER");
  });

  it("license and loading markup travel with the font files", () => {
    expect(existsSync(join(pkgRoot, "fonts/LICENSE-OFL.txt"))).toBe(true);
    expect(existsSync(join(pkgRoot, "fonts/loading-markup.html"))).toBe(true);
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
