/**
 * The canonical formatting rules, re-implemented for this variant
 * (ADR-0003 §1: a component is a spec, re-implemented per paradigm —
 * `packages/reference/render/lib.mjs` is the rules of record and nothing here
 * imports it). The drift gate polices the result both ways: in CI against the
 * fixture master and on the deployed plane against the master re-rendered
 * from the resolved snapshot (ADR-0008 §9).
 */
import type { Price, ReleaseSummary } from "@pm/data-contract";

/**
 * HTML-escape an interpolated tray value. Frozen data is still external data
 * (ADR-0002), and the essay's prose blocks reach the DOM through `set:html`,
 * so this is that path's security boundary.
 *
 * Measured, not assumed: this is byte-identical to Astro's own `{expr}`
 * escaping — Astro escapes through `html-escaper`, which maps the same five
 * characters to the same entities, apostrophe included (`&#39;`, decimal).
 * So markup written as Astro template expressions and markup built as a
 * string here escape identically, and both match the reference renderer.
 * (React does NOT: it emits `&#x27;`, which is why slice B's origin-suite
 * assertions needed a second escaper.)
 */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Price: USD renders as "$" + amount, exactly two decimals, "," thousands
 *  separator; non-USD falls back to "<amount> <CUR>". A null price is not a
 *  price of zero — the card renders an em dash and `stockLine` tells the
 *  honest story. */
export function formatPrice(priceFrom: Price | null): string | null {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** Stock: "N for sale" with a real singular, and an honest zero. */
export function stockLine(numForSale: number): string {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Meta: format + year, " · " separated; the year may be null. */
export function metaLine(summary: Pick<ReleaseSummary, "format" | "year">): string {
  return summary.year == null ? summary.format : `${summary.format} · ${summary.year}`;
}
