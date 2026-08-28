/**
 * Fit-line templates (ADR-0001 addendum C; ADR-0008 §3): the one sentence a
 * surface's reading closes on, GENERATED from receipt-derived values at
 * build — never typed — and REFUSED by the build when the receipts don't
 * support its claims (build.mjs bundleFromReceipt: the compared byte bands
 * must not overlap, and the no-fetch-on-click clause must hold in every
 * variant's medians). Voice rules: names each paradigm's own cost in the
 * locked axis order (decision-map "Locked axes"), states no ranking, makes
 * no react-next-vs-qwik apples-to-apples claim (ADR-0001 addendum M — the
 * serialization caveat lives on the methodology page the chrome links).
 *
 * Keyed by SURFACE. A labBundle-flagged surface with no entry here serves an
 * empty bundle happily — but the build REFUSES a receipt for it, by name:
 * the fit sentence is written WITH the surface's first batch, against what
 * that batch actually measured, never ahead of it. (The PDP's entry lands
 * with the interaction-registry unit's batches; its headline is expected to
 * be the interaction cell, not initial JS — decided there, not here.)
 */
export const FIT = {
  editorial: {
    /** The metric the sentence's contrast rides (the ADR-0001 §3 headline). */
    metric: "initial JS",
    /**
     * The EXACT variant set this sentence names. The build refuses any
     * batch whose columns differ (not a subset check — a sixth variant must
     * also force the sentence to be rewritten): without it, renaming or
     * dropping a variant leaves `kb["astro"]` undefined and publishes
     * "islands undefined KB" as the site's only verdict, through every
     * refusal guard, into every populated panel.
     */
    requires: ["vanilla", "react-next", "astro", "qwik", "htmx"],
    /** kb: variant → initial-JS KB (warm median, receipt-derived). */
    sentence: (kb) =>
      `Identical prose, one interaction: the no-runtime build ships ${kb["vanilla"]} KB of JavaScript, ` +
      `heavy hydration ${kb["react-next"]} KB, islands ${kb["astro"]} KB (inlined), ` +
      `resumability ${kb["qwik"]} KB (up front — deferred binding, not deferred bytes), ` +
      `hypermedia ${kb["htmx"]} KB (a site-wide runtime) — and none of them fetches another byte for the click.`,
  },
};
