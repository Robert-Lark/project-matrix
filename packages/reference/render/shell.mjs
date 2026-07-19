/**
 * The shared shell — canonical markup every store surface wraps itself in
 * (surface-design session, 2026-07-17). These template functions ARE the
 * markup contract: each paradigm re-implements this DOM in its own idiom and
 * must emit it byte-identically (ADR-0003 §1); the rendered masters under
 * ../surfaces/ are the spec of record the drift gate holds everyone to.
 *
 * Variant-page skeleton (what a paradigm serves — masters differ ONLY by the
 * two lines marked ✂):
 *   <body>
 *     <a class="pm-skip pm-button" href="#main">Skip to content</a>
 *     <div id="pm-chrome-slot"></div>            ✂ variants only — the skip
 *                                                  link stays FIRST focusable
 *     <div class="pm-page"> masthead · main · status · footer </div>
 *     …paradigm scripts…                         ✂ variants only
 *   </body>
 *
 * Cross-surface links (masthead, cards, featured, cart) are ABSOLUTE, to the
 * destination surface's DESIGNATED HOST variant: the sparse matrix means a
 * same-variant link 404s wherever the variant doesn't build that surface,
 * and a Worker redirect would silently swap the variant under a
 * URL-as-receipt (both rejected — session ADR). Within-surface condition
 * links (facets, sort, pages) stay relative/query-only.
 */
import { esc, formatPrice, stockLine, metaLine, thumbSrc, imageSrc } from "./lib.mjs";

/** Designated hosts (spec of record; SURFACE_CONTROLS carries them too). */
export const HOSTS = {
  plp: "/react-next/plp/plain/",
  pdp: (slug) => `/vanilla/pdp/${slug}/`,
  editorial: "/vanilla/editorial/",
  checkout: "/vanilla/checkout/",
  a11y: "/vanilla/a11y/",
  howBuilt: "/how-it-was-built/",
};

/**
 * The cart storage contract (ADR-0008 §7; minted by the editorial build's
 * slice A). The canonical SERVED state is empty — everything below is
 * per-paradigm CLIENT enhancement, and every variant plus every later
 * cart-bearing build (PDP, checkout, the masthead everywhere) re-implements
 * exactly this behavior. Five independent inventions would break
 * cart-survives-the-swap silently: `localStorage` is same-origin, so one
 * key + one value shape is the whole mechanism (ADR-0004 §5 — localStorage
 * holds the cart ONLY).
 *
 * - Storage: `localStorage[CART_CONTRACT.key]`, JSON:
 *   `{"v":1,"items":[{"id":<releaseId>,"qty":<integer ≥ 1>}]}` — one entry
 *   per release id; adding an id already present increments its `qty`.
 * - Validity: a missing, unparseable, or schema-failing value (wrong `v`,
 *   non-array `items`, any entry without an integer `id` and integer
 *   `qty ≥ 1`) is treated as the EMPTY cart; the next successful add
 *   overwrites it. A failed `setItem` (quota, storage off) changes nothing
 *   and announces nothing.
 * - Count: the sum of `qty` over `items`. On every shell page load the
 *   enhancement populates each `[data-pm-cart-count]` slot with
 *   `badge(count)` — empty string when 0 (the canonical empty state).
 *   The badge caps at "9+": the slot reserves `min-width: 2.4ch`
 *   (masthead.css), so an uncapped 3-digit count would widen it — a layout
 *   shift the shell must never manufacture (ADR-0008's zero-CLS posture).
 *   The exact number still reaches everyone: visually the cart page, and
 *   for AT through the label below.
 * - Label: whenever the count renders, the paradigm sets the cart anchor's
 *   `aria-label` to `cartLabel(count)` — the count span is `aria-hidden`,
 *   so without this a screen-reader user hears only "Cart"
 *   (masthead.css's header names exactly this duty). Count 0 removes the
 *   attribute (the accessible name falls back to the anchor text).
 * - Announcement: after a successful add, `announce(title, count)` is
 *   assigned as `textContent` (never HTML) to the shell's `[data-pm-status]`
 *   live region (WCAG 4.1.3).
 *
 * This module is build-time spec, never shipped code (ADR-0003 §1): variants
 * re-implement the strings; the origin suite asserts conformance against
 * this constant.
 */
export const CART_CONTRACT = {
  key: "pm:cart",
  version: 1,
  /** Total over all counts: 0 is the empty badge (the canonical state). */
  badge: (count) => (count === 0 ? "" : count > 9 ? "9+" : String(count)),
  /** null at 0 = REMOVE the attribute (name falls back to the anchor text). */
  cartLabel: (count) =>
    count === 0 ? null : `Cart, ${count} ${count === 1 ? "item" : "items"}`,
  announce: (title, count) => `Added "${title}" to cart — ${count} in cart.`,
};

/** The canonical <head> for a master at `depth` directories below
 *  packages/reference/ (font markup verbatim per tokens/fonts/loading-markup,
 *  base path adjusted only). `css` lists component/surface modules. */
export function head({ title, depth, css, noindex = false }) {
  const up = "../".repeat(depth);
  const t = `${up}node_modules/@pm/tokens`;
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    ...(noindex ? [`<meta name="robots" content="noindex">`] : []),
    `<link rel="preload" href="${t}/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="preload" href="${t}/fonts/PMCrateSymbols.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${t}/css/fonts.css">`,
    `<link rel="stylesheet" href="${t}/css/tokens.css">`,
    `<link rel="stylesheet" href="${t}/css/surfaces/shell.css">`,
    `<link rel="stylesheet" href="${t}/css/components/masthead.css">`,
    `<link rel="stylesheet" href="${t}/css/components/footer.css">`,
    `<link rel="stylesheet" href="${t}/css/components/button.css">`,
    ...css.map((f) => `<link rel="stylesheet" href="${t}/css/${f}">`),
  ].join("\n  ");
}

/** current: which masthead link (if any) marks aria-current="page". */
export function shell({ current, content }) {
  const link = (href, label, key) =>
    `<a class="pm-masthead__link" href="${href}"${current === key ? ` aria-current="page"` : ""}>${label}</a>`;
  return `
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        ${link(HOSTS.plp, "Records", "plp")}
        ${link(HOSTS.editorial, "Editorial", "editorial")}
      </nav>
      <a class="pm-masthead__cart" href="${HOSTS.checkout}">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
${content}
    </main>
    <p class="pm-status" role="status" data-pm-status></p>
    <footer class="pm-footer">
      <p class="pm-footer__fiction">A working store on frozen Discogs data — nothing ships, checkout is simulated.</p>
      <nav class="pm-footer__nav" aria-label="About this site">
        <a href="/">What is this?</a>
        <a href="${HOSTS.a11y}">Accessibility, shown</a>
        <a href="${HOSTS.howBuilt}">How it was built</a>
        <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">GitHub</a>
      </nav>
    </footer>
  </div>`;
}

/** One page, assembled. */
export function page({ title, depth, css, current, content, noindex }) {
  return `<!doctype html>
<html lang="en">
<head>
  ${head({ title, depth, css, noindex })}
</head>
<body>${shell({ current, content })}
</body>
</html>
`;
}

/** The release card, linked form (PLP grid + editorial feature): the whole
 *  card's title links to the PDP's designated host. Image loading attrs are
 *  the caller's (the PLP pins eager/lazy by position). */
export function releaseCard(summary, { imgAttrs = "", origin = "" } = {}) {
  const price = formatPrice(summary.priceFrom);
  const c = summary.cover;
  return `<li class="pm-release-card">
  <img class="pm-release-card__media" width="${c.width}" height="${c.height}"
       alt="${esc(c.alt)}" src="${esc(imageSrc(c.src, origin))}"${imgAttrs}>
  <div class="pm-release-card__body">
    <h3 class="pm-release-card__title"><a class="pm-release-card__link" href="${esc(HOSTS.pdp(summary.slug))}">${esc(summary.title)}</a></h3>
    <p class="pm-release-card__artist">${esc(summary.artist)}</p>
    <p class="pm-release-card__meta">${esc(metaLine(summary))}</p>
    <div class="pm-release-card__foot">
      <span class="pm-release-card__price">${price ?? "—"}</span>
      <span class="pm-release-card__stock">${esc(stockLine(summary.numForSale))}</span>
    </div>
  </div>
</li>`;
}

export { esc, formatPrice, stockLine, metaLine, thumbSrc, imageSrc };
