// Canonical formatting rules (packages/reference/render/lib.mjs is the rules
// of record) — re-implemented, not shared (DIFF-TO-STARTER.md; ADR-0002 §6
// kept display strings out of the trays for exactly this). The drift gate
// proves the strings match; it does not care that the implementation lives
// twice.
import type { Price, ReleaseSummary } from "@pm/data-contract";

/** "$" + two decimals + "," thousands for USD; "<amount> <CUR>" otherwise. */
export function formatPrice(priceFrom: Price | null): string | null {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** "N for sale" with a real singular; an honest zero, never a blank. */
export function stockLine(numForSale: number): string {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Format string + year, " · " separated; year may be null. */
export function metaLine(summary: Pick<ReleaseSummary, "format" | "year">): string {
  return summary.year == null ? summary.format : `${summary.format} · ${summary.year}`;
}
