#!/usr/bin/env node
/**
 * WCAG contrast audit for a candidate primitive-token file (ADR-0003 §4/§7:
 * "must clear WCAG contrast at token-definition time").
 *
 * Usage: node audit-contrast.mjs <tokens.css> [...more]
 *
 * Resolves the SEMANTIC pairings the components actually consume (mirroring
 * packages/tokens/css/tokens.css): surface=neutral-0, sunk=neutral-50,
 * text=neutral-900, muted=neutral-600, on-accent=neutral-0, focus=accent-500.
 * The fail set is the ADR pair list; extra real-usage pairs (chrome cells sit
 * on surface-sunk) are advisory so a near-miss is visible before the pour.
 */
import { readFileSync } from "node:fs";

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};
const lum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = false;
for (const file of process.argv.slice(2)) {
  const css = readFileSync(file, "utf8");
  const tok = {};
  for (const m of css.matchAll(/(--pm-[\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) tok[m[1]] = m[2];
  const t = (n) => {
    if (!tok[n]) throw new Error(`${file}: missing ${n}`);
    return tok[n];
  };
  const surface = t("--pm-neutral-0"), sunk = t("--pm-neutral-50");
  const pairs = [
    // [label, fg, bg, min, failSet]
    ["text / surface",          t("--pm-neutral-900"), surface, 4.5, true],
    ["text / surface-sunk",     t("--pm-neutral-900"), sunk,    4.5, true],
    ["muted / surface",         t("--pm-neutral-600"), surface, 4.5, true],
    ["accent-as-link / surface",t("--pm-accent-500"),  surface, 4.5, true],
    ["on-accent / accent-500",  surface,               t("--pm-accent-500"), 4.5, true],
    ["on-accent / accent-700",  surface,               t("--pm-accent-700"), 4.5, true],
    ["danger / surface",        t("--pm-danger-600"),  surface, 4.5, true],
    ["focus-ring / surface (non-text)", t("--pm-accent-500"), surface, 3.0, true],
    ["muted / surface-sunk (advisory)",  t("--pm-neutral-600"), sunk, 4.5, false],
    ["accent / surface-sunk — chrome cells (advisory)", t("--pm-accent-500"), sunk, 4.5, false],
    ["danger / surface-sunk (advisory)", t("--pm-danger-600"), sunk, 4.5, false],
    ["border / surface (advisory, visibility)", t("--pm-neutral-200"), surface, 1.3, false],
  ];
  console.log(`\n== ${file}`);
  for (const [label, fg, bg, min, hard] of pairs) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok && hard) failed = true;
    console.log(
      `${ok ? "PASS" : hard ? "FAIL" : "warn"}  ${r.toFixed(2).padStart(5)} (min ${min})  ${label}  [${fg} on ${bg}]`,
    );
  }
}
process.exit(failed ? 1 : 0);
