/**
 * The injected fragment's identity contract (ADR-0001 addendum N hole 1,
 * closed by the bench-instrumentation-dilution unit). renderChrome() emits
 * the chrome aside followed immediately by the measurement script tag; the
 * chrome-constant probe hashes that fragment out of the served body, and
 * the front build re-renders it from the same inputs and REFUSES to build
 * when the hashes differ — the constant must describe the chrome that
 * ships, not the chrome that happened to be serving when the probe ran.
 *
 * The extraction lives HERE, in the package that renders the fragment,
 * because both sides of that comparison must extract with the SAME rule: a
 * probe regex and a build regex maintained separately is exactly the silent
 * drift the hash gate exists to kill.
 */

/** The fragment as served: the chrome aside plus its sibling measurement
 *  script tag (whitespace between them tolerated for rewriter variance). */
export const CHROME_FRAGMENT_RE =
  /<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>\s*<script[^>]*\/_pm\/measure\.js[^>]*><\/script>/i;

/** Fallback when the measurement tag is absent (a page carrying the aside
 *  alone) — the probe's original two-step extraction, kept identical. */
const CHROME_ASIDE_RE = /<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i;

/** Extract the injected chrome fragment from a served body (or a
 *  renderChrome() return value — the renderer's output matches its own
 *  contract). Empty string when no chrome is present. */
export function chromeFragmentOf(body: string): string {
  return body.match(CHROME_FRAGMENT_RE)?.[0] ?? body.match(CHROME_ASIDE_RE)?.[0] ?? "";
}
