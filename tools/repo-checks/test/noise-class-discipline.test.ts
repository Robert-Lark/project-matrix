/**
 * Noise-class discipline (ADR-0008; editorial-build slice A). The
 * permitted-noise registry carries behavior attributes (`hx-*`, `on:*`,
 * `q:*`) as their OWN declared class — they are a paradigm's mechanism, not
 * inert residue. Stripping is identical by design (normalize.ts), so
 * nothing in the drift gate itself can catch a MISLABELED registration: a
 * variant registering `^hx-` under `attrPatterns` would pass every suite
 * while its published registry entry — part of the diff-to-starter story —
 * presents the mechanism as residue, exactly the smuggling the class was
 * minted to prevent.
 *
 * This guard makes the label load-bearing: no `attrPatterns` regex may
 * match the ADR-named behavior-attribute shapes.
 */
import { describe, expect, it } from "vitest";
import { PERMITTED_NOISE } from "@pm/drift-gate";

/** Probe strings for the ADR-0008-named behavior-attribute classes. */
const BEHAVIOR_PROBES = ["hx-get", "hx-post", "on:click", "on:input", "q:id"];

describe("behavior attributes never hide in the inert-residue class (ADR-0008)", () => {
  for (const [variant, spec] of Object.entries(PERMITTED_NOISE)) {
    it(`${variant}: attrPatterns claims no behavior-attribute shape`, () => {
      for (const source of spec.attrPatterns) {
        const re = new RegExp(source);
        for (const probe of BEHAVIOR_PROBES) {
          expect(
            re.test(probe),
            `${variant} registers "${source}" under attrPatterns, which matches ` +
              `behavior attribute "${probe}" — register it under behaviorAttrPatterns ` +
              `(ADR-0008: mechanism, not residue)`,
          ).toBe(false);
        }
      }
    });
  }

  it("the registry is non-empty (this guard is not vacuous)", () => {
    expect(Object.keys(PERMITTED_NOISE).length).toBeGreaterThan(0);
  });
});
