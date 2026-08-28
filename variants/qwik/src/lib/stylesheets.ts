/**
 * The per-surface stylesheet lists root.tsx renders (pdp-variants slice 3).
 * A plain module rather than root.tsx locals so the pre-merge guard can
 * import the lists without dragging qwik-city's vite-plugin virtual modules
 * (@qwik-city-sw-register et al) into vitest. fonts.css is deliberately in
 * NEITHER list — it is authored beside the preloads in root.tsx, because the
 * three of them together ARE the canonical font-loading markup (ADR-0003 §8)
 * and an array-rendered link gains a q:key and loses its attribute order.
 */

/** The editorial master's remaining sheets, in its order (editorial.mjs). */
export const STYLESHEETS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];

/** The PDP master's list (pdp.mjs `css` after the shell's, same order —
 *  cascade order is a rendering property; the pre-merge stylesheet-list
 *  guard compares this map against the master). */
export const PDP_STYLESHEETS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/gallery.css",
  "components/qty.css",
  "components/tracklist.css",
  "components/prose.css",
  "components/plaque.css",
  "surfaces/pdp.css",
];
