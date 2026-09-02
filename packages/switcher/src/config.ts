/**
 * The per-surface control-set config (ADR-0004 §7; redesigned by the
 * surface-design session, 2026-07-17): the switcher is CONTEXTUAL — its
 * control-set is a function of the surface — and SPARSE — live anchors exist
 * only for the variants a surface is actually served in, so the chrome can
 * never offer a matrix cell that does not exist.
 *
 * What changed in the redesign:
 *  - `plannedVariants`: the sparse-matrix cells a surface WILL be built in
 *    (decision-map rows). They render as dead, labeled "not built" column
 *    headers in the reading table and are never anchors — a disclosure, not
 *    an offer. Without this, an unregistered matrix surface would render as
 *    "singleton surface", which is a false statement (panel finding,
 *    zero-bias lens).
 *  - `proves`: the solo-first self-explanation line (what am I looking at ·
 *    what it proves · what to try). Counts are NEVER typed into these lines —
 *    anything countable renders from the arrays below (panel kill, voice
 *    lens).
 *  - `singleton`: surfaces off the benchmarked matrix. Their reading section
 *    shows ADR-0007 §5's plain sentence instead of a lab table — no lab
 *    snapshot will ever exist for them, so an empty table would promise
 *    numbers that are never coming.
 *  - `strategies` / `nKnob`: the PLP's data-strategy presets and data-volume
 *    knob (ADR-0005 §2/§8). Strategy is shipped code — identity — so presets
 *    carry full (path, query) targets, not variant-segment rewrites.
 *  - `host`: the designated host variant for cross-surface entry links (the
 *    masthead's absolute hrefs — canonical markup must be byte-identical
 *    across variants, and relative cross-surface links would 404 on sparse
 *    cells). Spec for the surface builds; the chrome itself never uses it.
 *
 * Registration discipline: a surface's `variants` array is extended by the
 * variant build that ships it — that edit, plus origin-suite assertions for
 * the pages it serves (the placeholders' assertions cover only the
 * placeholders), is part of the build ticket's definition of done. Until a
 * surface registers, its chrome renders the current condition with no
 * offers — true statements only, never "singleton".
 *
 * Completion has a second edit (ADR-0007 §1/§4): the commit that empties a
 * surface's `plannedVariants` also flips its home catalogue row in
 * `workers/front/home/index.html` from "In build" to "Public today" with a
 * same-origin link — at SURFACE completion, not first serve. The origin
 * suite's home-rows leg (`composed-origin.test.ts`) derives the expected
 * state from this object, so a completed matrix surface whose row still
 * reads "In build" goes red; singletons flip theirs by hand.
 */

export interface StrategyPreset {
  /** Honest label (CONTEXT.md vocabulary — never "cache mode"/"library"). */
  readonly label: string;
  /** Full path target (strategy is identity → path, ADR-0004 §5). */
  readonly path: string;
  /** Serving-condition query, e.g. "?cache=cold" (condition → query). */
  readonly query: string;
  /** Fenced exhibits are labeled and never counted in the four-strategy cells. */
  readonly fenced?: boolean;
}

/** A fenced VARIANT exhibit on the render axis (editorial-build slice F) —
 *  the variants-axis counterpart of StrategyPreset.fenced: labeled in the
 *  switcher control itself, a live anchor, but NEVER a reading-table column
 *  and never counted in "Served by N of M" (ADR-0005 §7 / ADR-0008 §3:
 *  fenced exhibits never get a column). */
export interface FencedExhibit {
  /** Variant prefix, e.g. "remix3". */
  readonly variant: string;
  /** The tag rendered inside the control (FINDINGS §7(c)2 — the exact
   *  pre-release version travels with the offer, not just the page). */
  readonly tag: string;
}

export interface SurfaceControls {
  /** Variant prefixes actually SERVING this surface today (live anchors). */
  readonly variants: readonly string[];
  /** Matrix cells decided but not yet built (dead labels, never anchors). */
  readonly plannedVariants?: readonly string[];
  /** Fenced variant exhibits serving this surface (anchors with a tag,
   *  excluded from every count, column, and benchmark number). */
  readonly fencedExhibits?: readonly FencedExhibit[];
  /** Off the benchmarked matrix: plain-sentence reading section, no table. */
  readonly singleton?: boolean;
  /** Solo-first line. No typed counts — computable facts render from arrays. */
  readonly proves: string;
  /** PLP only: the data-strategy presets (ADR-0005 §2 table). */
  readonly strategies?: readonly StrategyPreset[];
  /** PLP only: the data-volume knob values (ADR-0002 §5). */
  readonly nKnob?: readonly number[];
  /** Designated host variant for cross-surface entry links (spec, not chrome). */
  readonly host?: string;
  /** This surface's readings publish through the front build's lab pipeline:
   *  the build emits /_pm/lab/{surface}.json (empty until the surface's first
   *  batch) and the Worker serves AND embeds it. Setting the flag is the
   *  whole registration — the origin suite's per-surface bundle leg fails a
   *  flagged surface whose bundle is not served, so the wiring cannot be
   *  forgotten (the PDP_SERVING registry-tie idiom). Receipts for a surface
   *  WITHOUT the flag refuse the front build by name. */
  readonly labBundle?: boolean;
}

export const SURFACE_CONTROLS: Readonly<Record<string, SurfaceControls>> = {
  sample: {
    variants: ["placeholder-static", "placeholder-ssr"],
    proves:
      "A stand-in surface proving the composed origin: placeholder variants under one measurement contract. The real store surfaces replace it.",
  },
  editorial: {
    // All five planned cells are LIVE (slice E completed the surface) —
    // `plannedVariants` is gone, per the editorial-build PRD's acceptance
    // ("empty or gone"): the reading table shows five live columns and the
    // "Served by N of M" note now counts 5 of 5, both derived from this
    // array alone.
    variants: ["vanilla", "react-next", "astro", "qwik", "htmx"],
    // The Remix 3 frontier exhibit (slice F): a live anchor with the
    // pre-release tag in the control itself, fenced from every number —
    // deliberately NOT in `variants`, whose length feeds "Served by N of M"
    // and the reading-table columns (a fenced exhibit in either would be a
    // false count). The tag's version string is asserted against the
    // variant's installed pin by the origin suite, so it cannot drift.
    fencedExhibits: [{ variant: "remix3", tag: "pre-release 3.0.0-beta.5" }],
    host: "vanilla",
    labBundle: true,
    proves:
      "One article: prose plus a single interaction. The render baseline — how much machinery does prose need? Swap the variant and watch what changes.",
  },
  pdp: {
    // All four planned cells are LIVE (pdp-build shipped vanilla;
    // pdp-variants slices 1–3 shipped react-next, astro, qwik) —
    // `plannedVariants` is gone, per the editorial precedent ("empty or
    // gone"): the reading table shows four live columns and "Served by 4 of
    // 4", both derived from this array alone. The surface is the designated
    // host's own, so this is also the target of every release card's link.
    variants: ["vanilla", "react-next", "astro", "qwik"],
    host: "vanilla",
    // The bundle serves EMPTY until the PDP batches run (the
    // interaction-registry unit owns those, per the decision map) — an
    // empty bundle is the designed state every surface is in between
    // registration and its first batch.
    labBundle: true,
    // "format" was in this sentence until 2026-08-15 and is out with the
    // control (ADR-0008 addendum A). It is SERVED on every measured page, so
    // leaving it would have had the instrument advertise an interaction the
    // surface does not have — the same falsehood as the dead control, one
    // layer up.
    proves:
      "One product page where the interactivity is genuine — gallery, zoom, quantity, cart. The render axis where JavaScript has real work to do. Try the swap: the cart survives; the paradigm doesn't.",
  },
  plp: {
    // Both arms are LIVE: react-next serves the three client-side presets
    // (`plain`, `tanstack`, the fenced `apollo`) and htmx serves
    // `/htmx/plp/`, the server-loaders one. `plannedVariants` is GONE rather
    // than empty, per the editorial precedent ("empty or gone"): the reading
    // table's four strategy columns and the "Served by 2 of 2" note both
    // derive from this array alone, and a planned list with nothing in it is
    // a key the next reader has to check.
    //
    // Until these landed, `chrome.ts` filtered every strategy cell against an
    // empty array, so the PLP's ENTIRE measured-axis control — the whole
    // point of the surface — collapsed to one dead `<span aria-current=
    // "page">`, under a panel reading "Served by 0 of 2".
    variants: ["react-next", "htmx"],
    host: "react-next",
    proves:
      "The catalogue grid under the data axis: where the data layer lives — nowhere, the browser, the server, or the edge — is the variable. The switcher is the scenario table.",
    strategies: [
      { label: "No caching (cold)", path: "/react-next/plp/plain/", query: "?cache=cold" },
      { label: "Client cache — TanStack Query", path: "/react-next/plp/tanstack/", query: "?cache=cold" },
      { label: "Server-rendered — loaders + PE", path: "/htmx/plp/", query: "?cache=cold" },
      { label: "Edge cache — KV", path: "/react-next/plp/plain/", query: "" },
      { label: "Misapplication exhibit — Apollo on REST", path: "/react-next/plp/apollo/", query: "?cache=cold", fenced: true },
    ],
    nKnob: [24, 240],
  },
  checkout: {
    // vanilla is LIVE as of the checkout-vanilla build — `/vanilla/checkout/`
    // serves, so it moves out of `plannedVariants` and into `variants`. Both
    // arrays feed rendered counts ("Served by 1 of 3 planned variants today",
    // chrome.ts:184-190) and the reading table's live-vs-planned columns
    // (`:226-242`), so leaving it planned would have had the instrument
    // report a served page as unbuilt — the dead-control falsehood in
    // mirror image, and the reason this line ships with the routes it makes
    // true rather than in a later tidy-up.
    variants: ["vanilla"],
    plannedVariants: ["react-next", "htmx"],
    host: "vanilla",
    proves:
      "A realistic checkout form. The measured question is interaction latency under main-thread load — INP, scripted and labeled. The lab profile's CPU multiplier is the device axis.",
  },
  a11y: {
    variants: [],
    singleton: true,
    host: "vanilla",
    proves:
      "Store components compliant and stripped, side by side. Not a paradigm comparison — what the design system's accessibility defaults are worth.",
  },
  "how-it-was-built": {
    variants: [],
    singleton: true,
    proves:
      "The decision record as content — ADRs, build log, reviews. The process is the evidence.",
  },
};
