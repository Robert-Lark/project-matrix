/**
 * The interaction registry carries checkout's three ids (ADR-0008
 * Consequences; checkout-measure-prep, 2026-09-24). Until this unit
 * `grep -c "checkout-" src/collect.ts` was 0: the surface whose spotlight is
 * INP under load had nothing to batch, and the decision map had recorded the
 * gap since the checkout build. The ids come from the ADR, so the ADR is read
 * here rather than the names re-typed — a renamed id on either side fails.
 *
 * What this file CANNOT do, stated: drive them. That needs a plane and a
 * browser and is the origin suite's `bench-checkout.browser.test.ts`. This
 * is the in-process half: the ids exist, are drivable functions, and the fill
 * fixture covers exactly the ten fields `checkout.js` validates.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHECKOUT_FILL, CHECKOUT_FORMATTED_CARD, INTERACTIONS } from "../src/collect";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const CHECKOUT_IDS = ["checkout-type-card", "checkout-submit-invalid", "checkout-fix-and-submit"] as const;

describe("the registry carries checkout's three ids", () => {
  it("registers exactly the three ADR-0008 names, each a drivable function", () => {
    const registered = Object.keys(INTERACTIONS).filter((id) => id.startsWith("checkout-")).sort();
    expect(registered).toEqual([...CHECKOUT_IDS].sort());
    for (const id of CHECKOUT_IDS) {
      expect(Object.hasOwn(INTERACTIONS, id), id).toBe(true);
      expect(typeof INTERACTIONS[id], id).toBe("function");
    }
  });

  it("the names are the ADR's — read from docs/adr/0008, never re-typed here", () => {
    const adr = readFileSync(
      join(repoRoot, "docs", "adr", "0008-store-surfaces-and-instrument.md"),
      "utf8",
    );
    for (const id of CHECKOUT_IDS) {
      expect(adr.includes(`\`${id}\``), `${id} is not named in ADR-0008`).toBe(true);
    }
  });

  it("the fill fixture covers exactly the ten ids checkout.js validates", () => {
    // RULES in variants/vanilla/src/checkout.js — read off the file's `id:`
    // entries so a rule added there without a fill value here fails. Comment
    // stripping is not needed for this shape: `{ id: "…"` opens each rule.
    const script = readFileSync(join(repoRoot, "variants", "vanilla", "src", "checkout.js"), "utf8");
    const rules = [...script.matchAll(/\{\s*id: "([a-z0-9]+)"/g)].map((m) => m[1]!).sort();
    expect(rules.length).toBe(10);
    expect(Object.keys(CHECKOUT_FILL).sort()).toEqual(rules);
  });

  it("the formatted-card settle marker is the fixture's digits in groups of four", () => {
    const digits = CHECKOUT_FILL.card!;
    expect(digits).toMatch(/^\d{16}$/);
    expect(CHECKOUT_FORMATTED_CARD).toBe(digits.match(/.{1,4}/g)!.join(" "));
  });
});
