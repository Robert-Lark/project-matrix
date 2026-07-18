/**
 * Chrome dark-ground contrast audit (surface-design session, 2026-07-17).
 *
 * The instrument strip composes its inks as color-mix() derivations of the
 * poured neutrals (home §7 rule: no literal hex), on a near-black ground
 * where the store's DEFAULT pairings demonstrably fail (panel-audited:
 * --color-text-muted 3.02:1, --color-accent 2.71:1 on neutral-950). This
 * test re-derives the ACTUAL mixes from packages/switcher/src/chrome.css —
 * the same anti-rigging shape as the font cmap re-derivation: the audit
 * reads the shipped formulas, so a palette re-pour or a chrome edit that
 * breaks contrast fails CI instead of shipping.
 *
 * WCAG 2.x math: relative luminance per sRGB linearization, contrast
 * (L1+0.05)/(L2+0.05). Thresholds: 4.5:1 for the strip's text inks
 * (1.4.3 AA, the chrome sets ~11px text), 3:1 for the focus indicator
 * (1.4.11).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tokensCss = readFileSync(
  join(repoRoot, "packages/tokens/css/tokens.css"),
  "utf8",
);
const chromeCss = readFileSync(
  join(repoRoot, "packages/switcher/src/chrome.css"),
  "utf8",
);

type Rgb = [number, number, number];

function hex(name: string): Rgb {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in tokens.css`);
  const h = m[1]!;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** Evaluate the two-term srgb color-mix() forms chrome.css actually uses:
 *  color-mix(in srgb, var(--pm-A) P%, var(--pm-B))  and
 *  color-mix(in srgb, var(--pm-A) P%, transparent) composited over a base. */
function evalMix(declaration: string, over?: Rgb): Rgb {
  const m = declaration.match(
    /color-mix\(in srgb,\s*var\((--pm-[a-z0-9-]+)\)\s*(\d+)%,\s*(var\((--pm-[a-z0-9-]+)\)|transparent)\)/,
  );
  if (!m) throw new Error(`unparseable color-mix: ${declaration}`);
  const a = hex(m[1]!);
  const p = Number(m[2]) / 100;
  if (m[3] === "transparent") {
    if (!over) throw new Error("alpha mix needs a compositing base");
    return a.map((c, i) => Math.round(c * p + over[i]! * (1 - p))) as Rgb;
  }
  const b = hex(m[4]!);
  return a.map((c, i) => Math.round(c * p + b[i]! * (1 - p))) as Rgb;
}

function chromeVar(name: string): string {
  const m = chromeCss.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`${name} not found in chrome.css`);
  return m[1]!.trim();
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("the instrument's dark-ground inks (WCAG 1.4.3 / 1.4.11)", () => {
  const ground = evalMix(chromeVar("--pm-chrome-ground"));
  const ink = hex(chromeVar("--pm-chrome-ink").match(/--pm-[a-z0-9-]+/)![0]);
  const muted = evalMix(chromeVar("--pm-chrome-ink-muted"));
  const etch = evalMix(chromeVar("--pm-chrome-etch"), ground);

  it("primary ink clears 4.5:1 on the ground", () => {
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("muted ink clears 4.5:1 on the ground (labels and notes are text)", () => {
    expect(contrast(muted, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus indicator (primary ink) clears 3:1 on the ground", () => {
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(3);
  });

  it("the etch rules stay decorative — structure never rides on them alone", () => {
    // The hairline etch is deliberately below 3:1 (it is a texture, like the
    // store's mat-board border, ADR-0006 §2's recorded exception). This
    // assertion DOCUMENTS that: if someone brightens it past 3:1 they may
    // start using it as a load-bearing boundary; if they dim it to nothing
    // the fenced cell's dashed border loses its redundant cue. Meaning in
    // the chrome is always carried by text (the fence rule line, the
    // aria-current underline), never by the etch alone.
    expect(contrast(etch, ground)).toBeGreaterThan(1.2);
  });

  it("the semantic accent is never used as ink on the dark ground", () => {
    // Panel-audited: --color-accent on neutral-950 is 2.71:1. The chrome
    // must reach paper primitives, not the semantic accent, for anything
    // legible on the strip.
    const accent = hex("--pm-accent-500");
    expect(contrast(accent, ground)).toBeLessThan(4.5); // the fact...
    expect(chromeCss).not.toMatch(/color:\s*var\(--color-accent\)/); // ...the rule
  });
});
