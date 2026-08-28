/**
 * Types for `fit.mjs`, which is plain ESM because `build.mjs` runs it in bare
 * node. This declaration exists so TYPED consumers can read the templates as
 * the single source of truth rather than restating their values.
 *
 * The concrete need: `tools/origin-suite/suite/bench-interaction.browser.test.ts`
 * asserts the PDP's cross-variant interaction constant, and the publication
 * build asserts the same property from `interactionFetch.toleranceBytes`. Two
 * guards on one property with two independently-typed thresholds is a trap —
 * the build publishes a spread the suite goes red on, and whoever hits it has
 * to decide which comment is the policy (verify-slice, conformance lens). One
 * number, one place, imported.
 */
export interface FitSpec {
  /** The metric the sentence's contrast rides (JSDoc; nothing reads it). */
  metric: string;
  /** What the surface's scripted interaction is DECLARED to cost on the wire. */
  interactionFetch: "none" | { kind: "constant"; toleranceBytes: number };
  /** Whether the surface's INP row publishes, and why not when it doesn't. */
  interactionTiming: { publish: true } | { publish: false; reason: string };
  /** The EXACT variant set the sentence names. */
  requires: readonly string[];
  /** Composed from receipt-derived values at build — never typed. */
  sentence: (
    kb: Record<string, number>,
    facts: { interactionId: string; interactionBytes: number; interactionKb: number },
  ) => string;
}

export declare const FIT: Record<string, FitSpec>;
