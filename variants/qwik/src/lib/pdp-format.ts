/**
 * PDP-only canonical formatting rules (`packages/reference/render/lib.mjs`
 * is the rules of record — re-implemented, never imported, ADR-0003 §1).
 * A separate module from format.ts, the unit's standing rule (the
 * react-next/astro pdp-format precedent): format.ts is editorial's shipped
 * code and its export set stays exactly what the editorial build consumed —
 * on this variant that is wire-load-bearing, because format.ts rides
 * editorial's published chunk graph.
 */
import type { Format } from "@pm/data-contract";

/** Track duration: m:ss (no zero-pad on minutes, two-digit seconds),
 *  h:mm:ss at 3600+, "" when null. */
export function formatDuration(durationSeconds: number | null): string {
  if (durationSeconds == null) return "";
  const s = Math.round(durationSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The full format COMPOSITION of a release — every component in tray order,
 *  "N × " where the tray records more than one of a medium, joined "; ". A
 *  Discogs `formats` array is what is IN the package, not a menu — which is
 *  why the PDP renders it as data and carries no format control (ADR-0008
 *  addendum A). */
export function formatComposition(formats: readonly Format[]): string {
  return formats
    .map((f) => {
      const body =
        f.descriptions.length > 0 ? `${f.name}, ${f.descriptions.join(", ")}` : f.name;
      return f.qty > 1 ? `${f.qty} × ${body}` : body;
    })
    .join("; ");
}

/** The 160 px thumb derivative, by the URL convention over the frozen tray
 *  src (ADR-0008 §11 — the trays themselves are untouched). */
export function thumbSrc(src: string): string {
  return src.replace(/\.avif$/, ".thumb.avif");
}
