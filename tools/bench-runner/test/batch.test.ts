/**
 * The PLP n fence (ADR-0005 addendum, 2026-09-04): a PLP batch is refused at
 * any `n` the warm tier never holds, and the set it refuses against is the
 * ONE derivation the edge Worker and the chrome's `cacheState` tag use
 * (`plpWarmable`), not a second copy that can drift.
 *
 * This is @pm/bench-runner's first test. The PLP data-plane unit's sabotage
 * table (2026-09-18) removed the fence and NOTHING pre-merge went red: the
 * package had no test task, so the ADR's sentence "the bench runner refuses
 * a PLP batch at any other n" was typechecked prose. A refusal with no test
 * is a receipt no field can falsify — the class the fence exists to stop.
 */
import { describe, expect, it } from "vitest";
import { PLP_N, plpWarmable } from "@pm/measurement";
import { assertWarmablePlpBatch } from "../src/batch";

const PLP_TARGETS = [{ path: "/htmx/plp/" }, { path: "/react-next/plp/plain/" }];
const NON_PLP_TARGETS = [{ path: "/vanilla/editorial/" }, { path: "/react-next/pdp/1-a-release/" }];

describe("the PLP n fence (batch.ts assertWarmablePlpBatch)", () => {
  it("refuses a PLP batch at an n the warm tier never holds, and names the knob values", () => {
    expect(() => assertWarmablePlpBatch(48, PLP_TARGETS)).toThrow(
      /n=48: the PLP warm tier holds only n ∈ \{24, 240\}/,
    );
  });

  it("admits both published knob values", () => {
    for (const n of PLP_N.warmed) {
      expect(() => assertWarmablePlpBatch(n, PLP_TARGETS), `n=${n}`).not.toThrow();
    }
  });

  it("is PLP-scoped: a batch with no PLP target passes at any n (the tier rule is the PLP's)", () => {
    expect(() => assertWarmablePlpBatch(48, NON_PLP_TARGETS)).not.toThrow();
  });

  it("one PLP target among others is enough to refuse (ONE batch, ONE n — ADR-0001 §4)", () => {
    expect(() => assertWarmablePlpBatch(48, [...NON_PLP_TARGETS, PLP_TARGETS[0]!])).toThrow();
  });

  it("refuses exactly the n values plpWarmable refuses, over the whole clamp range — one derivation", () => {
    for (let n = 1; n <= PLP_N.max; n++) {
      const warm = plpWarmable(new URLSearchParams({ n: String(n) }));
      let refused = false;
      try {
        assertWarmablePlpBatch(n, PLP_TARGETS);
      } catch {
        refused = true;
      }
      expect(refused, `n=${n}: fence and plpWarmable disagree`).toBe(!warm);
    }
  });

  it("reads the surface from the DECODED path, like the fence on fenced targets", () => {
    // `%70lp` decodes to `plp`: an encoded spelling must not slip past.
    expect(() => assertWarmablePlpBatch(48, [{ path: "/htmx/%70lp/" }])).toThrow();
  });
});
