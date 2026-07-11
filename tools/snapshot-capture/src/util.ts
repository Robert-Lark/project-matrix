/** Small shared utilities for the capture pipeline. */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Same rule as the fixture generator — slugs stay comparable across snapshots. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Discogs disambiguates duplicate artist/label names with a numeric suffix
 * ("Signal (2)"). That suffix is database bookkeeping, not the name — strip it
 * at normalization (undocumented convention; verified empirically at capture).
 */
export function stripNameDisambiguation(name: string): string {
  return name.replace(/\s+\(\d+\)$/, "");
}

/**
 * Free-text fields can carry Discogs markup ([a=Artist], [l=Label], [url=…]…,
 * [b]/[i]) — seen in the docs' label-profile example. No variant ships a
 * Discogs-markup parser (normalize ONCE, ADR-0002 §6), so notes are reduced to
 * plain text at capture. \r\n is transport noise → \n.
 */
export function stripDiscogsMarkup(text: string): string {
  return text
    .replace(/\[(?:a|l|m|r)=([^\]]*)\]/gi, "$1")
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[\/?(?:b|i|u|url)\]/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/** "4:35" → 275; "1:02:30" → 3750; anything else (incl. "") → null. */
export function parseDurationSeconds(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}
