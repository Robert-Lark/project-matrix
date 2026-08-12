// Canonical field formatting — this variant's own re-implementation of the
// lib.mjs rules of record (ADR-0003 §1: a component is a spec, re-implemented
// per paradigm; nothing here imports the reference renderer). Unlike the
// template-literal variants there is NO esc() here: Remix 3's serializer
// escapes every interpolated text and attribute value itself — the paradigm
// owns escaping, so a hand escaper would double-escape.

export interface PriceFrom {
  amount: number;
  currency: string;
}

export interface Label {
  name: string;
  catno?: string | null;
}

export interface Cover {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** The featured release's DETAIL tray — the fields this page renders. */
export interface Detail {
  id: number;
  slug: string;
  title: string;
  artist: string;
  year: number | null;
  format: string;
  labels: Label[];
  priceFrom: PriceFrom | null;
  numForSale: number;
  cover: Cover;
  images: Cover[];
}

/** Canonical price formatting (lib.mjs rules of record): "$" + two decimals
 *  + "," thousands for USD; "<amount> <CUR>" otherwise; null stays null. */
export function formatPrice(priceFrom: PriceFrom | null): string | null {
  if (priceFrom == null) return null;
  const { amount, currency } = priceFrom;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return currency === "USD" ? `$${grouped}.${frac}` : `${grouped}.${frac} ${currency}`;
}

/** Canonical stock line: real singular, honest zero. */
export function stockLine(numForSale: number): string {
  if (numForSale === 0) return "none for sale";
  return numForSale === 1 ? "1 for sale" : `${numForSale} for sale`;
}

/** Canonical meta line: format + year, " · " separated; year may be null. */
export function metaLine(release: Detail): string {
  return release.year == null ? release.format : `${release.format} · ${release.year}`;
}
