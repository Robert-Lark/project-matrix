/**
 * PM Instrument Mono coverage guard (verify-slice, anti-rigging lens).
 *
 * The chrome's own font carries the same "never a per-OS fallback" claim the
 * tokens fonts do (packages/switcher/fonts/README.md), so it gets the same
 * hardening: the cmap is re-derived from the shipped woff2 bytes, and every
 * non-ASCII codepoint the chrome's OWN strings can render (chrome.css
 * `content:` values, the renderer's literal glyphs) must be present — a
 * chrome copy edit that reaches outside the subset fails here, not on some
 * visitor's platform.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as fontkit from "fontkit";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fontPath = join(
  repoRoot,
  "packages/switcher/fonts/PMInstrumentMono.var.woff2",
);
const chromeCss = readFileSync(
  join(repoRoot, "packages/switcher/src/chrome.css"),
  "utf8",
);
const chromeTs = readFileSync(
  join(repoRoot, "packages/switcher/src/chrome.ts"),
  "utf8",
);

describe("PM Instrument Mono covers the chrome's own glyphs", () => {
  const font = fontkit.openSync(fontPath) as unknown as {
    hasGlyphForCodePoint(cp: number): boolean;
  };

  it("covers every non-ASCII codepoint in chrome.css content values and chrome.ts literals", () => {
    // The chrome renders NO crate/user text in the mono (titles stay in the
    // store register) — its glyph universe is its own source strings.
    const sources = [
      // CSS content: values ("·", "▾", "▴", …)
      ...[...chromeCss.matchAll(/content:\s*"([^"]*)"/g)].map((m) => m[1]!),
      // Renderer template literals (labels, separators, em-dashes, ellipses)
      // — comments stripped first: "ADR-0004 §5" citations are not rendered
      // output and must not drag § into the subset.
      chromeTs.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""),
    ];
    const needed = new Set<number>();
    for (const src of sources) {
      for (const ch of src) {
        const cp = ch.codePointAt(0)!;
        if (cp > 0x7f && cp !== 0xfeff) needed.add(cp);
      }
    }
    expect(needed.size).toBeGreaterThan(0); // the etch grammar uses non-ASCII
    for (const cp of needed) {
      expect(
        font.hasGlyphForCodePoint(cp),
        `U+${cp.toString(16).toUpperCase().padStart(4, "0")} not in PMInstrumentMono — re-cut the subset (fonts/README.md recipe)`,
      ).toBe(true);
    }
  });

  it("covers the documented subset set (the README recipe's codepoints)", () => {
    for (const cp of [0x00a0, 0x00b7, 0x00d7, 0x2013, 0x2014, 0x2026, 0x2191, 0x2193, 0x25b4, 0x25be]) {
      expect(font.hasGlyphForCodePoint(cp)).toBe(true);
    }
  });
});
