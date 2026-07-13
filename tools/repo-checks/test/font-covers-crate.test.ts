/**
 * The design-system font is a controlled constant (ADR-0003 §8): text must
 * render from the self-hosted subset on every platform, never an OS fallback.
 * A font swap or a crate re-freeze can silently break that — the Catalogue
 * pour (ADR-0006) shipped with U+26A0 missing until an adversarial pass caught
 * it, and the frozen crate also carries glyphs no Latin face covers.
 *
 * This guard makes the guarantee non-vacuous, without a font parser in the
 * Node test env, by trusting `packages/tokens/fonts/coverage.json` — a
 * manifest that pins each shipped font by sha256 and records its cmap. It:
 *   1. re-pins the fonts (sha256 of the file on disk == manifest.sha256), so a
 *      font that changes WITHOUT regeneration fails loudly;
 *   2. asserts the ⚠ fallback lists U+26A0 (the exact regression the pour
 *      introduced — ADR-0006 §3);
 *   3. scans the committed crate DISPLAY trays and asserts every codepoint is
 *      either covered by a shipped font OR on the manifest's documented,
 *      deferred i18n allow-list — so a re-freeze that introduces a NEW
 *      uncovered glyph fails loudly instead of silently falling back to the OS.
 *
 * HONEST LIMITATION (not a font parser): the sha pins the font BYTES only. The
 * `codepoints` arrays are RECIPE-DERIVED (the fontTools snippet in
 * packages/tokens/fonts/README.md), NOT re-parsed from the woff2 here — so a
 * hand-edited manifest (faking a sha + codepoints together) would not be
 * caught. Regenerate coverage.json with the recipe; never hand-edit it. The
 * exhaustive runtime proof that the fonts render is the drift gate (it
 * screenshots the real faces); this manifest is the cheap static tripwire for
 * the LATENT crate-coverage case no shipped surface exercises yet. Making CI
 * re-derive the cmap (a woff2 parser dep, or a fontTools + `git diff
 * --exit-code` step) is recorded as a future hardening in the
 * crate-glyph-coverage ticket.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fontsDir = join(repoRoot, "packages", "tokens", "fonts");
const crateDir = join(repoRoot, "tools", "snapshot-capture", "crate");

interface Coverage {
  fonts: Record<string, { sha256: string; codepoints: number[] }>;
  crateDeferredI18n: number[];
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

  it("the ⚠ fallback (PMWarnGlyph) actually contains U+26A0, not just the file", () => {
    // Finding fixed here: the structure test asserted the file EXISTS; this
    // asserts the glyph is COVERED, closing the false-pass window that let
    // the original regression ship.
    const warn = coverage.fonts["PMWarnGlyph.U26A0.woff2"];
    expect(warn, "PMWarnGlyph.U26A0.woff2 missing from coverage.json").toBeDefined();
    expect(warn!.codepoints).toContain(0x26a0);
  });

  it("every crate glyph is in a shipped font or the documented deferred set", () => {
    const covered = new Set<number>();
    for (const f of Object.values(coverage.fonts))
      for (const cp of f.codepoints) covered.add(cp);
    const deferred = new Set(coverage.crateDeferredI18n);

    // Scan the crate's DISPLAY trays — the ones whose text a surface renders:
    // summaries (PLP), details (PDP), and curation (label names + blurb a
    // collection/meta surface would show). manifest.json / images-index.json
    // are machine metadata (dates, sha256s, paths), not render surfaces.
    const uncoveredUndocumented = new Map<number, number>();
    for (const tray of ["summaries.json", "details.json", "curation.json"]) {
      for (const s of strings(JSON.parse(readFileSync(join(crateDir, tray), "utf8")))) {
        for (const ch of s) {
          const cp = ch.codePointAt(0)!;
          if (cp > 0x7f && !covered.has(cp) && !deferred.has(cp))
            uncoveredUndocumented.set(cp, (uncoveredUndocumented.get(cp) ?? 0) + 1);
        }
      }
    }
    const report = [...uncoveredUndocumented.entries()]
      .map(([cp, n]) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${String.fromCodePoint(cp)} x${n}`)
      .join(", ");
    expect(
      uncoveredUndocumented.size,
      `crate glyphs neither in the font nor documented as deferred i18n: ${report}. ` +
        `Cover them (extend the subset / add a scoped fallback) or add them to ` +
        `coverage.json crateDeferredI18n with a matching decision-map note.`,
    ).toBe(0);
  });

  it("the deferred i18n list stays minimal (no glyph the font already covers)", () => {
    const covered = new Set<number>();
    for (const f of Object.values(coverage.fonts))
      for (const cp of f.codepoints) covered.add(cp);
    const redundant = coverage.crateDeferredI18n.filter((cp) => covered.has(cp));
    expect(redundant, `deferred list names glyphs the font covers: ${redundant}`).toEqual([]);
  });
});
