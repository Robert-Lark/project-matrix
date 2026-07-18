/**
 * The design-system font is a controlled constant (ADR-0003 §8): text must
 * render from the self-hosted subset on every platform, never an OS fallback.
 * A font swap or a crate re-freeze can silently break that — the Catalogue
 * pour (ADR-0006) shipped with U+26A0 missing until an adversarial pass caught
 * it, and the frozen crate also carries glyphs no Latin face covers.
 *
 * This guard makes the guarantee non-vacuous by pinning
 * `packages/tokens/fonts/coverage.json` — a manifest that records each shipped
 * font's sha256 and cmap. It:
 *   1. re-pins the fonts (sha256 of the file on disk == manifest.sha256), so a
 *      font that changes WITHOUT regeneration fails loudly;
 *   2. re-derives each font's cmap FROM THE WOFF2 BYTES (fontkit) and asserts
 *      it equals the manifest's `codepoints` — the surface-design session's
 *      anti-rigging hardening: a hand-edited manifest (faked sha + codepoints
 *      together) can no longer drift from the real cmap;
 *   3. asserts the ⚠ fallback lists U+26A0 (the exact regression the pour
 *      introduced — ADR-0006 §3);
 *   4. scans the committed crate DISPLAY trays and asserts every codepoint is
 *      either covered by a shipped font OR on the manifest's DECIDED per-OS
 *      system-fallback list (`crateSystemFallback` — Arabic/CJK plus four
 *      one-occurrence stragglers; the crate-glyph-coverage decision, DRAFT
 *      §4.1) — so a re-freeze that introduces a NEW uncovered glyph fails
 *      loudly instead of silently falling back to the OS.
 *
 * The manifest stays the human-readable record; regenerate it with the
 * fontTools recipe in packages/tokens/fonts/README.md whenever a font or the
 * crate changes. The exhaustive runtime proof that the fonts render is the
 * drift gate (it screenshots the real faces); this is the cheap static
 * tripwire for the crate-coverage case.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fontsDir = join(repoRoot, "packages", "tokens", "fonts");
const crateDir = join(repoRoot, "tools", "snapshot-capture", "crate");

interface Coverage {
  fonts: Record<string, { sha256: string; codepoints: number[] }>;
  crateSystemFallback: number[];
}
const coverage: Coverage = JSON.parse(
  readFileSync(join(fontsDir, "coverage.json"), "utf8"),
);

const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** Every string value in an arbitrarily-nested JSON tray. */
function* strings(node: unknown): Generator<string> {
  if (typeof node === "string") yield node;
  else if (Array.isArray(node)) for (const v of node) yield* strings(v);
  else if (node && typeof node === "object")
    for (const v of Object.values(node)) yield* strings(v);
}

describe("the shipped font covers the committed crate (ADR-0003 §8, ADR-0006 §3)", () => {
  it("each shipped font matches its coverage.json sha256 (bytes pinned)", () => {
    for (const [name, entry] of Object.entries(coverage.fonts)) {
      expect(
        sha256(join(fontsDir, name)),
        `${name} changed — regenerate coverage.json (README recipe)`,
      ).toBe(entry.sha256);
    }
  });

  it("each font's manifest cmap equals the cmap re-derived from the woff2 bytes", () => {
    // The anti-rigging hardening (crate-glyph-coverage / DRAFT §4.1): the
    // sha pins the BYTES, this pins the manifest's `codepoints` to the real
    // cmap parsed from those bytes — a hand-edited manifest cannot pass both.
    for (const [name, entry] of Object.entries(coverage.fonts)) {
      const parsed = fontkit.create(readFileSync(join(fontsDir, name)));
      expect("fonts" in parsed, `${name} parsed as a collection`).toBe(false);
      const font = parsed as fontkit.Font;
      // characterSet includes the cmap format-4 sentinel U+FFFF, which maps
      // to glyph 0 (.notdef) — not coverage. hasGlyphForCodePoint filters it
      // (verified: only U+FFFF differs from the fontTools-derived manifest).
      const derived = [...new Set(font.characterSet)]
        .filter((cp) => font.hasGlyphForCodePoint(cp))
        .sort((a, b) => a - b);
      expect(
        derived,
        `${name}: coverage.json codepoints drifted from the font's real cmap — ` +
          `regenerate coverage.json (README recipe); never hand-edit it`,
      ).toEqual(entry.codepoints);
    }
  });

  it("the ⚠ fallback (PMWarnGlyph) actually contains U+26A0, not just the file", () => {
    // Finding fixed here: the structure test asserted the file EXISTS; this
    // asserts the glyph is COVERED, closing the false-pass window that let
    // the original regression ship.
    const warn = coverage.fonts["PMWarnGlyph.U26A0.woff2"];
    expect(warn, "PMWarnGlyph.U26A0.woff2 missing from coverage.json").toBeDefined();
    expect(warn!.codepoints).toContain(0x26a0);
  });

  it("every crate glyph is in a shipped font or the decided system-fallback set", () => {
    const covered = new Set<number>();
    for (const f of Object.values(coverage.fonts))
      for (const cp of f.codepoints) covered.add(cp);
    const fallback = new Set(coverage.crateSystemFallback);

    // Scan the crate's DISPLAY trays — the ones whose text a surface renders:
    // summaries (PLP), details (PDP), and curation (label names + blurb a
    // collection/meta surface would show). manifest.json / images-index.json
    // are machine metadata (dates, sha256s, paths), not render surfaces.
    const uncoveredUndocumented = new Map<number, number>();
    for (const tray of ["summaries.json", "details.json", "curation.json"]) {
      for (const s of strings(JSON.parse(readFileSync(join(crateDir, tray), "utf8")))) {
        for (const ch of s) {
          const cp = ch.codePointAt(0)!;
          if (cp > 0x7f && !covered.has(cp) && !fallback.has(cp))
            uncoveredUndocumented.set(cp, (uncoveredUndocumented.get(cp) ?? 0) + 1);
        }
      }
    }
    const report = [...uncoveredUndocumented.entries()]
      .map(([cp, n]) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${String.fromCodePoint(cp)} x${n}`)
      .join(", ");
    expect(
      uncoveredUndocumented.size,
      `crate glyphs neither in a shipped font nor on the decided per-OS ` +
        `system-fallback list: ${report}. Either extend a subset / add a scoped ` +
        `fallback face, or — if the glyph belongs on system fallback like the ` +
        `Arabic/CJK set (shaping and Han-unification rationale in ` +
        `packages/tokens/fonts/README.md) — regenerate coverage.json with the ` +
        `README recipe so crateSystemFallback records the decision.`,
    ).toBe(0);
  });

  it("the system-fallback list stays minimal (no glyph a shipped font covers)", () => {
    const covered = new Set<number>();
    for (const f of Object.values(coverage.fonts))
      for (const cp of f.codepoints) covered.add(cp);
    const redundant = coverage.crateSystemFallback.filter((cp) => covered.has(cp));
    expect(redundant, `fallback list names glyphs the fonts cover: ${redundant}`).toEqual([]);
  });
});
