/**
 * Fit-line templates (ADR-0001 addendum C; ADR-0008 §3): the one sentence a
 * surface's reading closes on, GENERATED from receipt-derived values at
 * build — never typed — and REFUSED by the build when the receipts don't
 * support its claims (build.mjs bundleFromReceipt: the compared byte bands
 * must not overlap, and the surface's DECLARED `interactionFetch` must hold
 * in every variant's medians). Voice rules: names each paradigm's own cost in
 * the locked axis order (decision-map "Locked axes"), states no ranking, makes
 * no react-next-vs-qwik apples-to-apples claim (ADR-0001 addendum M — the
 * serialization caveat lives on the methodology page the chrome links).
 *
 * Keyed by SURFACE. A labBundle-flagged surface with no entry here serves an
 * empty bundle happily — but the build REFUSES a receipt for it, by name:
 * the fit sentence is written WITH the surface's first batch, against what
 * that batch actually measured, never ahead of it.
 *
 * Every entry MUST declare `interactionFetch`. Until 2026-08-28 the clause it
 * replaces was hardcoded in `build.mjs` as "every variant's interaction-byte
 * median is 0", which made a surface whose interaction legitimately fetches
 * unpublishable by construction rather than publishable with the fetch
 * STATED. Moving it here generalises the check; making it REQUIRED is what
 * stops that generalisation from being a loosening (ADR-0001 addendum R).
 */
export const FIT = {
  editorial: {
    /** The metric the sentence's contrast rides (the ADR-0001 §3 headline). */
    metric: "initial JS",
    /**
     * What this surface's scripted interaction is DECLARED to cost on the
     * wire, checked by the build against what the batch measured. Required:
     * a surface with no declaration is refused rather than published with the
     * clause silently absent, because the whole point of moving this out of
     * `build.mjs` is that a surface which legitimately fetches must publish
     * the fetch STATED, not slip past a check that no longer applies to it.
     *
     *  - `"none"`  — every variant's interaction-byte median must be 0 in
     *                BOTH columns. This is editorial's claim, and it is the
     *                site's strongest: "and none of them fetches another byte
     *                for the click".
     *  - `{ kind: "constant", toleranceBytes }` — the variants must AGREE
     *                within the stated tolerance, and the agreed figure is
     *                handed to `sentence` so it publishes IN the sentence
     *                rather than hiding in the receipt. A measured constant
     *                of zero is REFUSED: that is the `"none"` claim wearing a
     *                looser word, and a declaration that cannot fail is not a
     *                generalisation, it is a loosening.
     */
    interactionFetch: "none",
    /**
     * Whether this surface's INP row publishes. Required, for the same reason
     * `interactionFetch` is: a surface that can omit the declaration can
     * publish a timing cell without ever having judged whether it means the
     * same thing in every column.
     *
     * Editorial publishes it, and that is a measurement rather than an
     * assumption: `editorial-add-to-cart` reads 24 ms for all five variants
     * across every profile in the committed receipts, seven runs each. The
     * async-handler asymmetry ADR-0001 addendum T describes exists here too —
     * qwik's DOM change lands at 22.0 ms against 1.0-3.5 ms for the others —
     * but it falls INSIDE the measured window, so the cell is like-for-like.
     */
    interactionTiming: { publish: true },
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
  pdp: {
    /**
     * The PDP's headline is the INTERACTION, not initial JS (the pdp-build
     * ticket: "the render axis where JavaScript has real work to do"). The
     * sentence still names each paradigm's own JS cost in the locked axis
     * order, because that is the axis the reading table publishes — what
     * changes is what the sentence LEADS with.
     */
    metric: "interaction",
    requires: ["vanilla", "react-next", "astro", "qwik"],
    /**
     * `pdp-gallery-switch` FETCHES, by design: every variant swaps the stage
     * to the same full-size AVIF, a URL the load never requested because the
     * thumb carries the 160 px `.thumb.avif` derivative (ADR-0008 §11).
     * Declared as a CONSTANT rather than left to a hardcoded zero-check,
     * because the bytes are IMAGE MASS — the same URL in all four paradigms —
     * and are therefore never a paradigm difference. If they ever stop
     * agreeing, that is a defect or an instrument artifact, and this
     * declaration is what makes it a build failure instead of a published
     * verdict. It has already caught one: the runner's beacon capture used
     * Playwright routing, which disables the browser HTTP cache, and qwik's
     * re-write of five thumb `src` attributes to the values they already held
     * turned into 26,838 B of real downloads (ADR-0001 addendum R).
     *
     * 64 B, matching the attribution residual's own floor: the figure is a
     * compressed `transferSize`, so a response-header difference between two
     * variants' planes is legitimate spread and a byte-exact equality would
     * be brittle for no gain. Measured 2026-08-28: all four agree EXACTLY, in
     * both columns.
     */
    interactionFetch: { kind: "constant", toleranceBytes: 64 },
    /**
     * **The PDP's INP row does NOT publish, and the reason is measured.**
     *
     * Chromium closes an interaction's event-timing entry at the first paint
     * after the handler's SYNCHRONOUS processing returns. Qwik's resumed
     * handler returns having only SCHEDULED the render, so on this surface its
     * entry closes on a paint that carries nothing — and what the cell then
     * reads is a race with the frame boundary rather than a property of the
     * paradigm. Measured 2026-08-28 against the deployed plane, qwik against
     * the other three (which read 24 ms throughout):
     *
     *   pdp-gallery-switch, avg-broadband   qwik  8 ms
     *   pdp-gallery-switch, slow-4g          qwik  0 ms  (runs 0, 8, 0)
     *   pdp-add-to-cart,    avg-broadband   qwik  8 ms
     *   pdp-add-to-cart,    slow-4g          qwik 24 ms
     *
     * One column swinging 0 → 24 across conditions while the others hold at 24
     * is not a measurement of responsiveness, and the direction flatters the
     * paradigm doing the most work: on the same click qwik's visible update
     * lands at 34.6 ms, the LATEST of the four (18.2-19.5). Switching
     * interactions does not escape it — add-to-cart reads 8 ms on the default
     * profile too — so this is a property of the surface's handlers, not of the
     * chosen click.
     *
     * Withheld LOUDLY: the row says so, the fit sentence refuses the timing
     * comparison in its own words, and `/methodology/` carries the mechanism
     * and these figures. Publishing 0 ms beside three 24s under a caveat was
     * rejected — that is a number no prose can rescue, and "a plausible-looking
     * meaningless cell is worse than a missing one" is this project's own rule.
     * The bytes half of the interaction publishes normally: it is verified,
     * cross-paradigm constant, and it is what this surface CAN honestly say
     * about its click.
     */
    interactionTiming: {
      publish: false,
      reason: "not comparable on this surface — see the methodology page",
    },
    /**
     * kb: variant → initial-JS KB (warm median, receipt-derived).
     * facts.interactionKb: the agreed interaction cost, same derivation.
     *
     * The closing clause is not hedging, it is the ADR-0001 §9 obligation: on
     * this surface the INP cell is NOT like-for-like across the four, and the
     * asymmetry flatters the paradigm doing the most work. Measured
     * 2026-08-28: qwik's resumed handler returns in 0.7 ms having only
     * SCHEDULED the render, so the paint that closes its event-timing entry
     * carries nothing, and the cell reads 8 ms while its visible update lands
     * at 34.6 ms — the latest of the four (18.2–19.5). The methodology page
     * carries the mechanism and the numbers; the sentence refuses to imply a
     * comparison the ruler cannot support.
     */
    sentence: (kb, facts) =>
      `One product page, one real interaction: switching the gallery image costs every paradigm the ` +
      `same ${facts.interactionKb} KB, because that is image mass and not architecture — while the ` +
      `JavaScript each ships to run it is not the same at all: the no-runtime build ${kb["vanilla"]} KB, ` +
      `heavy hydration ${kb["react-next"]} KB, islands ${kb["astro"]} KB (inlined), ` +
      `resumability ${kb["qwik"]} KB (up front — deferred binding, not deferred bytes). ` +
      `How long the click takes is not measured like-for-like across these four; the methodology page says why.`,
  },
};
