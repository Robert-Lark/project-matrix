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

export interface SurfaceControls {
  /** Variant prefixes actually SERVING this surface today (live anchors). */
  readonly variants: readonly string[];
  /** Matrix cells decided but not yet built (dead labels, never anchors). */
  readonly plannedVariants?: readonly string[];
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
}

export const SURFACE_CONTROLS: Readonly<Record<string, SurfaceControls>> = {
  sample: {
    variants: ["placeholder-static", "placeholder-ssr"],
    proves:
      "A stand-in surface proving the composed origin: placeholder variants under one measurement contract. The real store surfaces replace it.",
  },
  editorial: {
    variants: ["vanilla"],
    plannedVariants: ["react-next", "astro", "qwik", "htmx"],
    host: "vanilla",
    proves:
      "One article: prose plus a single interaction. The render baseline — how much machinery does prose need? Swap the variant and watch what changes.",
  },
  pdp: {
    variants: [],
    plannedVariants: ["vanilla", "react-next", "astro", "qwik"],
    host: "vanilla",
    proves:
      "One product page where the interactivity is genuine — gallery, cart, quantity, format. The render axis where JavaScript has real work to do. Try the swap: the cart survives; the paradigm doesn't.",
  },
  plp: {
    variants: [],
    plannedVariants: ["react-next", "htmx"],
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
    variants: [],
    plannedVariants: ["vanilla", "react-next", "htmx"],
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
