/**
 * The canonical formatting rules, re-implemented for this variant
 * (ADR-0003 §1: a component is a spec, re-implemented per paradigm —
 * `packages/reference/render/lib.mjs` is the rules of record and nothing here
 * imports it). The drift gate polices the result both ways: in CI against the
 * fixture master and on the deployed plane against the master re-rendered
 * from the resolved snapshot (ADR-0008 §9).
 *
 * There is no `esc()` here, unlike slices A and C. Every interpolated value
 * reaches the DOM as a JSX expression, which Qwik escapes itself — and
 * measured against a scaffold, byte-identically to the reference renderer's
 * `esc()`: `& < > " '` become `&amp; &lt; &gt; &quot; &#39;` in both text and
 * attribute values, apostrophe decimal. (Astro's html-escaper matches too;
 * React emits `&#x27;`, which is why slice B needed a second escaper in the
 * origin suite.) So this variant never builds HTML as a string and needs no
 * escaping boundary of its own.
 */
import type { Price, ReleaseSummary } from "@pm/data-contract";

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
